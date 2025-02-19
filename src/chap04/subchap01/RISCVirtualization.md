# CPU Virtualization under RISCV

Abstract: Introduce the CPU virtualization work under the RISCV architecture around the ArchCpu structure.

## Two Data Structures Involved

Hvisor supports multiple architectures, and the work required for CPU virtualization in each architecture is different, but a unified interface should be provided in a system. Therefore, we split the CPU into two data structures: `PerCpu` and `ArchCpu`.

### PerCpu

This is a general description of the CPU, which has already been introduced in the `PerCpu` documentation.

### ArchCpu

`ArchCpu` is a CPU structure for specific architectures (**RISCV architecture is introduced in this article**). This structure undertakes the specific behavior of the CPU.

In the ARM architecture, there is also a corresponding `ArchCpu`, which has a slightly different structure from the `ArchCpu` introduced in this section, but they have the same interface (i.e., they both have behaviors such as initialization).

The fields included are as follows:

```
pub struct ArchCpu {
    pub x: [usize; 32], //x0~x31
    pub hstatus: usize,
    pub sstatus: usize,
    pub sepc: usize,
    pub stack_top: usize,
    pub cpuid: usize,
    pub power_on: bool,
    pub init: bool,
    pub sstc: bool,
}
```

The explanation of each field is as follows:

- `x`: values of general-purpose registers
- `hstatus`: stores the value of the Hypervisor status register
- `sstatus`: stores the value of the Supervisor status register, managing S-mode state information, such as interrupt enable flags, etc.
- `sepc`: the return address at the end of exception handling
- `stack_top`: the stack top of the corresponding CPU stack
- `power_on`: whether the CPU is powered on
- `init`: whether the CPU has been initialized
- `sstc`: whether the timer interrupt has been configured

## Related Methods

This part explains the methods involved.

### ArchCpu::init

This method mainly initializes the CPU, sets the context when first entering the VM, and some CSR initialization.

### ArchCpu::idle

By executing the wfi instruction, set non-primary CPUs to a low-power idle state.

Set up a special memory page containing instructions that make the CPU enter a low-power waiting state, allowing them to be placed in a low-power waiting state when no tasks are allocated to some CPUs in the system until an interrupt occurs.

### ArchCpu::run

The main content of this method is some initialization, setting the correct CPU execution entry, and modifying the flag that the CPU has been initialized.

### vcpu_arch_entry / VM_ENTRY

This is a piece of assembly code describing the work that needs to be handled when entering the VM from hvisor. First, it gets the context information in the original `ArchCpu` through the `sscratch` register, then sets `hstatus`, `sstatus`, and `sepc` to the values we previously saved, ensuring that when returning to the VM, it is in VS mode and starts executing from the correct position. Finally, restore the values of the general-purpose registers and return to the VM using `sret`.

### VM_EXIT

When exiting the VM and entering hvisor, it is also necessary to save the relevant state at the time of VM exit.

First, get the address of `ArchCpu` through the `sscratch` register, but here we will swap the information of `sscratch` and `x31`, rather than directly overwriting `x31`. Then save the values of the general-purpose registers except `x31`. Now the information of `x31` is in `sscratch`, so first save the value of `x31` to `sp`, then swap `x31` and `sscratch`, and store the information of `x31` through `sp` to the corresponding position in `ArchCpu`.

Then save `hstatus`, `sstatus`, and `sepc`. When we finish the work in hvisor and need to return to the VM, we need to use the VM_ENTRY code to restore the values of these three registers to the state before the VM entered hvisor, so we should save them here.

`ld sp, 35*8(sp)` puts the top of the kernel stack saved by `ArchCpu` into `sp` for use, facilitating the use of the kernel stack in hvisor.

`csrr a0, sscratch` puts the value of `sscratch` into the `a0` register. When we have saved the context and jump to the exception handling function, the parameters will be passed through `a0`, allowing access to the saved context during exception handling, such as the exit code, etc.