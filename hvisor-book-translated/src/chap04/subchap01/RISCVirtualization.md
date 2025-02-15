# CPU Virtualization under RISCV

Abstract: Introducing the CPU virtualization work under the RISCV architecture centered around the ArchCpu structure.

## Two Data Structures Involved

Hvisor supports multiple architectures, and the work required for CPU virtualization varies for each architecture. However, a unified interface should be provided within a system. Therefore, we split the CPU into two data structures: `PerCpu` and `ArchCpu`.

### PerCpu

This is a general description of the CPU, which has already been introduced in the `PerCpu` documentation.

### ArchCpu

`ArchCpu` is a CPU structure specific to a particular architecture (**RISCV architecture is discussed in this article**). This structure undertakes the specific behavior of the CPU.

In the ARM architecture, there is also a corresponding `ArchCpu`, which has a slightly different structure from the `ArchCpu` introduced in this section, but they have the same interface (i.e., both have initialization behaviors).

The fields included are as follows:

```
pub struct ArchCpu {
    pub x: [usize; 32], //x0~x31
    pub hstatus: usize,
    pub sstatus: usize,
    pub sepc: usize,
    pub stack_top: usize,
    pub cpuid: usize,
    // pub first_cpu: usize,
    pub power_on: bool,
    pub init: bool,
    pub sstc: bool,
}
```

Explanation of each field:

- `x`: Values of general-purpose registers
- `hstatus`: Stores the value of the Hypervisor status register
- `sstatus`: Stores the Supervisor status register value, managing S-mode state information such as interrupt enable flags
- `sepc`: The return address at the end of exception handling
- `stack_top`: Stack top of the corresponding CPU stack
- `power_on`: Whether this CPU is powered on
- `init`: Whether this CPU has been initialized
- `sstc`: Whether a timer interrupt has been configured

## Related Methods

This part explains the involved methods.

### ArchCpu::init

This method mainly initializes the CPU, sets the context when first entering the VM, and some CSR initializations.

```
pub fn init(&mut self, entry: usize, cpu_id: usize, dtb: usize) {
        write_csr!(CSR_SSCRATCH, self as *const _ as usize); //arch cpu pointer
        self.sepc = entry;
        self.hstatus = 1 << 7 | 2 << 32; //HSTATUS_SPV | HSTATUS_VSXL_64
        self.sstatus = 1 << 8 | 1 << 63 | 3 << 13 | 3 << 15; //SPP
        self.stack_top = self.stack_top() as usize;
        self.x[10] = cpu_id; //cpu id
        self.x[11] = dtb; //dtb addr

        set_csr!(CSR_HIDELEG, 1 << 2 | 1 << 6 | 1 << 10); //HIDELEG_VSSI | HIDELEG_VSTI | HIDELEG_VSEI
        set_csr!(CSR_HEDELEG, 1 << 8 | 1 << 12 | 1 << 13 | 1 << 15); //HEDELEG_ECU | HEDELEG_IPF | HEDELEG_LPF | HEDELEG_SPF
        set_csr!(CSR_HCOUNTEREN, 1 << 1); //HCOUNTEREN_TM
                                          //In VU-mode, a counter is not readable unless the applicable bits are set in both hcounteren and scounteren.
        set_csr!(CSR_SCOUNTEREN, 1 << 1);
        write_csr!(CSR_HTIMEDELTA, 0);
        set_csr!(CSR_HENVCFG, 1 << 63);
        //write_csr!(CSR_VSSTATUS, 1 << 63 | 3 << 13 | 3 << 15); //SSTATUS_SD | SSTATUS_FS_DIRTY | SSTATUS_XS_DIRTY

        // enable all interupts
        set_csr!(CSR_SIE, 1 << 9 | 1 << 5 | 1 << 1); //SEIE STIE SSIE
                                                     // write_csr!(CSR_HIE, 1 << 12 | 1 << 10 | 1 << 6 | 1 << 2); //SGEIE VSEIE VSTIE VSSIE
        write_csr!(CSR_HIE, 0);
        write_csr!(CSR_VSTVEC, 0);
        write_csr!(CSR_VSSCRATCH, 0);
        write_csr!(CSR_VSEPC, 0);
        write_csr!(CSR_VSCAUSE, 0);
        write_csr!(CSR_VSTVAL, 0);
        write_csr!(CSR_HVIP, 0);
        write_csr!(CSR_VSATP, 0);
    }
```

`write_csr!(CSR_SSCRATCH, self as *const _ as usize)` continues the content of the previous method, writing the address of `ArchCpu` into `sscratch`. The return address is set as the entry, the `SPV` field of `hstatus` is set to 1, representing that when returning to the VM, the VM runs under VS mode (or understood as the VM was running in VS mode before the exception occurred); the `VSXL` field sets the length of the registers under VS mode. The `SPP` and other fields of `sstatus` provide information about which privilege level the CPU was in before the Trap occurred. `SPP` and `SPV` fields, used in combination, determine which privilege level should be returned to when executing the `sret` instruction under HS mode, with the return address set by `spec`.

`HIDELEG` and `CSR_HEDELEG` settings delegate certain interrupts to VS mode for handling. `HCOUNTEREN` and `SCOUNTEREN` are used to restrict the performance counters that the VM can access, in this case enabling the `TM` field, allowing access to the `time` register. `HTIMEDELTA` is used to adjust the value read from the `time` register by the VM, returning the sum of `HTIMEDELTA` and `time` in VS or VU mode. `SIE` enables interrupts, and we have enabled all interrupts.

In the code, note the difference between `write_csr!` and `set_csr!`; `write_csr!` uses direct writing, which is an overwrite method, while `set_csr!` uses the "or" method, setting certain bits.

### ArchCpu::idle

By executing the wfi instruction, non-primary CPUs are set to a low-power idle state.

Set a special memory page that contains instructions to put the CPU into a low-power waiting state, allowing them to be placed in a low-power waiting state when no tasks are allocated to certain CPUs in the system, until an interrupt occurs.

```
pub fn idle(&mut self) -> ! {
        extern "C" {
            fn vcpu_arch_entry() -> !;
        }
        assert!(this_cpu_id() == self.cpuid);
        self.init(0, this_cpu_data().id, this_cpu_data().opaque);
        // reset current cpu -> pc = 0x0 (wfi)
        PARKING_MEMORY_SET.call_once(|| {
            let parking_code: [u8; 4] = [0x73, 0x00, 0x50, 0x10]; // 1: wfi; b 1b
            unsafe {
                PARKING_INST_PAGE[..4].copy_from_slice(&parking_code);
            }

            let mut gpm = MemorySet::<Stage2PageTable>::new();
            gpm.insert(MemoryRegion::new_with_offset_mapper(
                0 as GuestPhysAddr,
                unsafe { &PARKING_INST_PAGE as *const _ as HostPhysAddr - PHYS_VIRT_OFFSET },
                PAGE_SIZE,
                MemFlags::READ | MemFlags::WRITE | MemFlags::EXECUTE,
            ))
            .unwrap();
            gpm
        });
        unsafe {
            PARKING_MEMORY_SET.get().unwrap().activate();
            vcpu_arch_entry();
        }
}
```

Set the CPU's entry address to 0, and the address 0 will be mapped to the `parking page`, which has some wfi instruction encodings set. The `wfi` instruction puts the CPU into a waiting state until an interrupt occurs.

Then enter `vcpu_arch_entry`, `vcpu_arch_entry` points to a piece of assembly code, which is to find `ArchCpu` based on `sscratch` for context recovery, then execute `sret`, return to the address set by `spec` to execute, that is, execute the wfi instruction just set (**not kernel code**), and enter low power mode.

Although some initialization work is also done here, the CPU's initialization flag `init` is not set to `true`, so when the CPU is truly awakened and run later, it will be re-initialized (reflected in the run method).

### ArchCpu::run

The main content of this method is some initialization, setting the correct CPU execution entry, and modifying the flag that the CPU has been initialized.

```
pub fn run(&mut self) -> ! {
        extern "C" {
            fn vcpu_arch_entry() -> !;
        }

        assert!(this_cpu_id() == self.cpuid);
        //change power_on
        this_cpu_data().activate