# CPU Virtualization on AArch64

## CPU Boot Mechanism

Under the AArch64 architecture, hvisor uses the `psci::cpu_on()` function to wake up a specified CPU core, bringing it from a shutdown state to a running state. This function takes the CPU's ID, boot address, and an opaque parameter as input. If an error occurs, such as the CPU already being awake, the function will handle the error appropriately to avoid redundant wake-ups.

## CPU Virtualization Initialization and Operation

The `ArchCpu` structure encapsulates architecture-specific CPU information and functionalities, and its `reset()` method is responsible for setting the CPU to the initial state of virtualization mode. This includes:

- Setting the ELR_EL2 register to the specified entry point
- Configuring the SPSR_EL2 register
- Clearing the general registers
- Resetting the virtual machine-related registers
- `activate_vmm()`, activating the Virtual Memory Manager (VMM)

The `activate_vmm()` method is used to configure the VTCR_EL2 and HCR_EL2 registers, enabling the virtualization environment.

The `ArchCpu`'s `run()` and `idle()` methods are used to start and idle the CPU, respectively. Upon starting, it activates the zone's GPM (Guest Page Management), resets to the specified entry point and device tree binary (DTB) address, and then jumps to the EL2 entry point through the `vmreturn` macro. In idle mode, the CPU is reset to a waiting state (WFI) and prepares a `parking` instruction page for use during idle periods.

## Switching Between EL1 and EL2

hvisor uses EL2 as the hypervisor mode and EL1 for the guest OS in the AArch64 architecture. The `handle_vmexit` macro handles the context switch from EL1 to EL2 (VMEXIT event), saves the user mode register context, calls an external function to handle the exit reason, and then returns to continue executing the hypervisor code segment. The `vmreturn` function is used to return from EL2 mode to EL1 mode (VMENTRY event), restores the user mode register context, and then returns to the guest OS code segment through the `eret` instruction.

## MMU Configuration and Enabling

To support virtualization, the `enable_mmu()` function configures MMU mapping in EL2 mode, including setting the MAIR_EL2, TCR_EL2, and SCTLR_EL2 registers, enabling instruction and data caching capabilities, and ensuring the virtual range covers the entire 48-bit address space.

Through these mechanisms, hvisor achieves efficient CPU virtualization on the AArch64 architecture, allowing multiple independent zones to operate under statically allocated resources while maintaining system stability and performance.