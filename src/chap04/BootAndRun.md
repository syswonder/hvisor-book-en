# Initialization Process of hvisor

Abstract: This article introduces the relevant knowledge involved in running hvisor on qemu and the initialization process of hvisor. Starting from the launch of qemu, the entire process is tracked, and after reading this article, you will have a general understanding of the initialization process of hvisor.

## Boot Process of qemu

The boot process of the computer simulated by qemu: After loading the necessary files into memory, the PC register is initialized to 0x1000, and a few instructions are executed from here before jumping to 0x80000000 to start executing the bootloader (hvsior arm part uses Uboot). After executing a few instructions, it jumps to the starting address of the kernel that uboot can recognize.

### Generate the executable file of hvisor

```
rust-objcopy --binary-architecture=aarch64 target/aarch64-unknown-none/debug/hvisor --strip-all -O binary target/aarch64-unknown-none/debug/hvisor.bin.tmp
```

Convert the executable file of hvisor into a logical binary and save it as `hvisor.bin.tmp`.

### Generate an image file recognizable by uboot

Uboot is a bootloader whose main task is to jump to the first instruction of the hvisor image and start execution, so it is necessary to ensure that the generated hvisor image is recognizable by uboot. Here, the `mkimage` tool is needed.

```
mkimage -n hvisor_img -A arm64 -O linux -C none -T kernel -a 0x40400000 -e 0x40400000 -d target/aarch64-unknown-none/debug/hvisor.bin.tmp target/aarch64-unknown-none/debug/hvisor.bin
```

* `-n hvisor_img`: Specify the name of the kernel image.
* `-A arm64`: Specify the architecture as ARM64.
* `-O linux`: Specify the operating system as Linux.
* `-C none`: Do not use compression algorithms.
* `-T kernel`: Specify the type as kernel.
* `-a 0x40400000`: Specify the loading address as `0x40400000`.
* `-e 0x40400000`: Specify the entry address as `0x40400000`.
* `-d target/aarch64-unknown-none/debug/hvisor.bin.tmp`: Specify the input file as the previously generated temporary binary file.
* The last parameter is the output file name, i.e., the final kernel image file `hvisor.bin`.

## Initialization Process

### aarch64.ld Link Script

To understand how hvisor is executed, we first look at the link script `aarch64.ld`, which gives us a general understanding of the execution process of hvisor.

```
ENTRY(arch_entry)
BASE_ADDRESS = 0x40400000;
```

The first line sets the program entry `arch_entry`, which can be found in `arch/aarch64/entry.rs`, introduced later.

```
.text : {
        *(.text.entry)
        *(.text .text.*)
    }
```

We make the `.text` segment the first segment, and place the `.text.entry` containing the first instruction of the entry at the beginning of the `.text` segment, ensuring that hvisor indeed starts execution from the 0x40400000 location agreed with qemu.

Here we also need to remember something called `__core_end`, which is the address of the end position of the link script, and its role can be known during the startup process.

### arch_entry

With the above prerequisites, we can step into the first instruction of hvisor, which is `arch_entry()`.

```
// src/arch/aarch64/entry.rs

pub unsafe extern "C" fn arch_entry() -> i32 {
    unsafe {
        core::arch::asm!(
            "
            // x0 = dtbaddr
            mov x1, x0
            mrs x0, mpidr_el1
            and x0, x0, #0xff
            ldr x2, =__core_end          // x2 = &__core_end
            mov x3, {per_cpu_size}      // x3 = per_cpu_size
            madd x4, x0, x3, x3       // x4 = cpuid * per_cpu_size + per_cpu_size
            add x5, x2, x4
            mov sp, x5           // sp = &__core_end + (cpuid + 1) * per_cpu_size
            b {rust_main}             // x0 = cpuid, x1 = dtbaddr
            ",
            options(noreturn),
            per_cpu_size=const PER_CPU_SIZE,
            rust_main = sym crate::rust_main,
        );
    }
}
```

First, look at the embedded assembly part. The first instruction `mov x1, x0` transfers the value in the `x0` register to the `x1` register, where x0 contains the address of the device tree. Qemu simulates an ARM architecture computer, which also has various devices such as mice, display screens, and various storage devices. When we want to get input from the keyboard or output to the display, we need to get input from somewhere or put the output data somewhere. In the computer, we use specific addresses to access these devices. The device tree contains the access addresses of these devices, and the hypervisor, as the general manager of all software, naturally needs to know the information of the device tree. Therefore, Uboot will put this information in `x0` before entering the kernel, which is a convention.

In `mrs x0, mpidr_el1`, `mrs` is an instruction to access system-level registers, which means to send the contents of the system register `mpidr_el1` to `x0`. `mpidr_el1` contains information about which CPU we are currently dealing with (the computer supports multi-core CPUs), and there will be a lot of cooperation work with the CPU later, so we need to know which CPU is currently in use. This register contains a lot of information about the CPU, and we currently need to use the lower 8 bits to extract the corresponding CPU id, which is what the instruction `and x0, x0, #0xff` is doing.

`ldr x2, = __core_end`, at the end of the link script, we set a symbol `__core_end` as the end address of the entire hvisor program space, and put this address into `x2`.

`mov x3, {per_cpu_size}` puts the size of each CPU's stack into `x3`. This `{xxx}` is to replace the value of `xxx` defined externally into the assembly code. You can see that the parameter below `per_cpu_size=const PER_CPU_SIZE` has changed the name of an external variable as a parameter. Another parameter with `sym` indicates that a symbol follows, which is defined elsewhere.

`per_cpu_size` in this size space, related registers can be saved and restored, including the CPU's stack space.

`madd x4, x0, x3, x3` is a multiply-add instruction, cpu_id * per_cpu_size + per_cpu_size, and the result is put into `x4`. At this point, `x4` contains the total space required by the current number of CPUs. (Starting from 0, so add per_cpu_size one more time).

`add x5, x2, x4` means to add the end address of hvisor and the total space required by the CPU to `x5`.

`mov sp, x5` finds the top of the current CPU's stack.

`b {rust_main}` represents jumping to `rust_main` to start execution, which also indicates that this section of assembly code will not return, corresponding to `option(noreturn)`.

## Enter rust_main()

### fn rust_main(cpuid: usize, host_dtb: usize)

Entering `rust_main` requires two parameters, which are passed through `x0` and `x1`. Remember that in the previous entry, our `x0` stored the cpu_id and `x1` stored the device tree information.

### install_trap_vector()

When the processor encounters an exception or interrupt, it needs to jump to the corresponding location for processing. Here, the corresponding jump addresses are set (which can be considered as setting a table) for handling exceptions at the Hypervisor level. Each privilege level has its own corresponding exception vector table, except for EL0, the application privilege level, which must jump to other privilege levels to handle exceptions. The `VBAR_ELn` register is used to store the base address of the exception vector table for the ELn privilege level.

```
extern "C" {
    fn _hyp_trap_vector();
}

pub fn install_trap_vector() {
    // Set the trap vector.
    VBAR_EL2.set(_hyp_trap_vector as _)
}

```

 `VBAR_EL2.set()` sets the address of `_hyp_trap_vector()` as the base address of the exception vector table for the EL2 privilege level.

`_hyp_trap_vector()` This assembly code constructs the exception vector table.

**Simple Introduction to the Exception Vector Table Format**

Based on the level of the exception and whether the level of handling the exception remains the same, it is divided into two categories. If the level does not change, it is divided into two groups based on whether the current level's SP is used. If the exception level changes, it is divided into two groups based on whether the execution mode is 64-bit/32-bit. Thus, the exception vector table is divided into 4 groups. In each group, each table entry represents an entry point for handling a specific type of exception.

### Main CPU

```
static MASTER_CPU: AtomicI32 = AtomicI32::new(-1);

let mut is_primary = false;
    if MASTER_CPU.load(Ordering::Acquire) == -1 {
        MASTER_CPU.store(cpuid as i32, Ordering::Release);
        is_primary = true;
        println!("Hello, HVISOR!");
        #[cfg(target_arch = "riscv64")]
        clear_bss();
    }
```

`static MASTER_CPU: AtomicI32` In this, `AtomicI32` indicates that this is an atomic type, meaning its operations are either successful or fail without any intermediate state, ensuring safe access in a multi-threaded environment. In short, it is a very safe `i32` type.

`MASSTER_CPU.load()` is a method for performing read operations. The parameter `Ordering::Acquire` indicates that if there are some write operations before I read, I need to wait for these write operations to be completed in order. **In short, this parameter ensures that the data is correctly changed before being read.**

If it reads -1, the same as when it was defined, it indicates that the main CPU has not been set, so set `cpu_id` as the main CPU. Similarly, the role of `Ordering::Release` is certainly to ensure that all other modifications are completed before the change.

### Common Data Structure for CPUs: PerCpu

hvisor supports different architectures, and a reasonable system design should allow different architectures to use a unified interface for easy description of each part's work. `PerCpu` is such a general CPU description.

```
pub struct PerCpu {
    pub id: usize,
    pub cpu_on_entry: usize,
    pub arch_cpu: ArchCpu,
    pub zone: Option<Arc<RwLock<Zone>>>,
    pub ctrl_lock: Mutex<()>,
    pub boot_cpu: bool,
    // percpu stack
}
```

For each field of `PerCpu`:

- `id`: CPU sequence number
- `cpu_on_entry`: The address of the first instruction when the CPU enters EL1, also known as the guest. Only when this CPU is the boot CPU will it be set to a valid value. Initially, we set it to an inaccessible address.
- `arch_cpu`: CPU description related to the architecture. The behavior is initiated by `PerCpu`, and the specific executor is `arch_cpu`.
  - `cpu_id`
  - `psci_on`: Whether the cpu is started
- `zone`: zone actually represents a guestOS. For the same guestOS, multiple CPUs may serve it.
- `ctrl_lock`: Set for concurrent safety.
- `boot_cpu`: For a guestOS, it distinguishes the main/secondary cores serving it. `boot_cpu` indicates whether the current CPU is the main core for a guest.

### Main Core Wakes Up Other Cores

```
if is_primary {
        wakeup_secondary_cpus(cpu.id, host_dtb);
}

fn wakeup_secondary_cpus(this_id: usize, host_dtb: usize) {
    for cpu_id in 0..MAX_CPU_NUM {
        if cpu_id == this_id {
            continue;
        }
        cpu_start(cpu_id, arch_entry as _, host_dtb);
    }
}

pub fn cpu_start(cpuid: usize, start_addr: usize, opaque: usize) {
    psci::cpu_on(cpuid as u64 | 0x80000000, start_addr as _, opaque as _).unwrap_or_else(|err| {
        if let psci::error::Error::AlreadyOn = err {
        } else {
            panic!("can't wake up cpu {}", cpuid);
        }
    });
}
```

If the current CPU is the main CPU, it will wake up other secondary cores, and the secondary cores execute `cpu_start`. In `cpu_start`, `cpu_on` actually calls the SMC instruction in `call64`, falling into EL3 to perform the action of waking up the CPU.

From the declaration of `cpu_on`, we can roughly guess its function: to wake up a CPU, which will start executing from the location `arch_entry`. This is because multi-core processors communicate and cooperate with each other, so CPU consistency must be ensured. Therefore, the same entry should be used to start execution to maintain synchronization. This can be verified by the following few lines of code.

```
    ENTERED_CPUS.fetch_add(1, Ordering::SeqCst);
    wait_for(|| PerCpu::entered_cpus() < MAX_CPU_NUM as _);
    assert_eq!(PerCpu::entered_cpus(), MAX_CPU_NUM as _);
```

Among them, `ENTERED_CPUS.fetch_add(1, Ordering::SeqCst)` represents increasing the value of `ENTERED_CPUS` in sequence consistency. After each CPU executes once, this `assert_eq` macro should pass smoothly.

### Things the Main Core Still Needs to Do primary_init_early()

**Initialize Logging**

1. Creation of a global log recorder
2. Setting of the log level filter, the main purpose of setting the log level filter is to decide which log messages should be recorded and output.

**Initialize Heap Space and Page Tables**

1. A space in the .bss segment is allocated as heap space, and the allocator is set up.
2. Set up the page frame allocator.

**Parse Device Tree Information**

Parse the device tree information based on the device tree address in the `rust_main` parameter.

**Create a GIC Instance**

Instantiate a global static variable GIC, an instance of the Generic Interrupt Controller.

**Initialize hvisor's Page Table**

This page table is only for the implementation of converting VA to PA for hypervisor itself (understood in terms of the relationship between the kernel and applications).

**Create a zone for each VM**

```
zone_create(zone_id, TENANTS[zone_id] as _, DTB_IPA);

zone_create(vmid: usize, dtb_ptr: *const u8, dtb_ipa: usize) -> Arc<RwLock<Zone>>
```

zone actually represents a guestVM, containing various information that a guestVM might use. Observing the function parameters, `dtb_ptr` is the address of the device information that the hypervisor wants this guest to see, which can be seen in `images/aarch64/devicetree`. The role of `dtb_ipa` is that each guest will obtain this address from the CPU's `x0` register to find the device tree information, so it is necessary to ensure that this IPA will map to the guest's dtb address during the construction of the stage2 page table. In this way, the guest is informed about the type of machine it is running on, the starting address of the physical memory, the number of CPUs, etc.

```
let guest_fdt = unsafe { fdt::Fdt::from_ptr(dtb_ptr) }.unwrap();
    let guest_entry = guest_fdt
        .memory()
        .regions()
        .next()
        .unwrap()
        .starting_address as usize;
```

The above content, by parsing the device tree information, obtained `guest_entry`, which is the starting address of the physical address that this guest can see. In the qemu startup parameters, we can also see where a guest image is loaded into memory, and these two values are equal.

Next, the stage-2 page table, MMIO mapping, and IRQ bitmap for this guest will be constructed based on the `dtb` information.

```
guest_fdt.cpus().for_each(|cpu| {
        let cpu_id = cpu.ids().all().next().unwrap();
        zone.cpu_set.set_bit(cpu_id as usize);
});

pub fn set_bit(&mut self, id: usize) {
    assert!(id <= self.max_cpu_id);
    self.bitmap |= 1 << id;
}
```

The above code records the id of the CPU allocated to this zone in the bitmap according to the CPU information given in the dtb.

```
let new_zone_pointer = Arc::new(RwLock::new(zone));
    {
        cpu_set.iter().for_each(|cpuid| {
            let cpu_data = get_cpu_data(cpuid);
            cpu_data.zone = Some(new_zone_pointer.clone());
            //chose boot cpu
            if cpuid == cpu_set.first_cpu().unwrap() {
                cpu_data.boot_cpu = true;
            }
            cpu_data.cpu_on_entry = guest_entry;
        });
    }
  
```

The task completed by the above code is: Traverse the CPUs allocated to this zone, obtain the mutable reference of the `PerCpu` of that CPU, modify its zone member variable, and mark the first CPU allocated to this zone as `boot_cpu`. Also, set the address of the first instruction after this zone's main CPU enters the guest as `guest_entry`.

The tasks that the main core CPU needs to do are paused, marked with `INIT_EARLY_OK.store(1, Ordering::Release)`, while other CPUs can only wait before the main core completes `wait_for_counter(&INIT_EARLY_OK, 1)`.

### Address Space Initialization

The previous section mentioned IPA and PA, which are actually part of the address space. Specific content will be provided in the memory management document, and here is a brief introduction.

If Hypervisor is not considered, guestVM, as a kernel, will perform memory management work, which is the process from the application program's virtual address VA to the kernel's PA. In this case, the PA is the actual physical memory address.

When considering Hypervisor, Hypervisor, as a kernel role, will also perform memory management work, only this time the application program becomes guestVM, and guestVM will not be aware of the existence of Hypervisor (otherwise, it would require changing the design of guestVM, which does not meet our intention to improve performance). We call the PA in guestVM IPA or GPA because it