# PerCPU Structure

In the architecture of hvisor, the PerCpu structure plays a core role, used to implement local state management for each CPU core and to support CPU virtualization. Below is a detailed introduction to the PerCpu structure and related functions:

## PerCpu Structure Definition

The PerCpu structure is designed as a container for each CPU core to store its specific data and state. Its layout is as follows:

```
#[repr(C)]
pub struct PerCpu {
    pub id: usize,
    pub cpu_on_entry: usize,
    pub dtb_ipa: usize,
    pub arch_cpu: ArchCpu,
    pub zone: Option<Arc<RwLock<Zone>>>,
    pub ctrl_lock: Mutex<()>,
    pub boot_cpu: bool,
    // percpu stack
}
```

The definitions of each field are as follows:

```
    id: Identifier of the CPU core.
    cpu_on_entry: An address used to track the CPU entry state, initialized to INVALID_ADDRESS, indicating an invalid address.
    dtb_ipa: The physical address of the device tree binary, also initialized to INVALID_ADDRESS.
    arch_cpu: A reference to the ArchCpu type, which contains architecture-specific CPU information and functions.
    zone: An optional Arc<RwLock<Zone>> type, representing the virtual machine (zone) that the current CPU core is running.
    ctrl_lock: A mutex used to control access and synchronize PerCpu data.
    boot_cpu: A boolean value indicating whether it is the boot CPU.
```

## Construction and Operation of PerCpu

```
    PerCpu::new: This function creates and initializes the PerCpu structure. It first calculates the virtual address of the structure, then safely writes the initialization data. For the RISC-V architecture, it also updates the CSR_SSCRATCH register to store the pointer to ArchCpu.
    run_vm: When this method is called, if the current CPU is not the boot CPU, it will first put it in an idle state, then run the virtual machine.
    entered_cpus: Returns the number of CPU cores that have entered the virtual machine running state.
    activate_gpm: Activates the GPM (Guest Page Management) of the associated zone.
```

## Obtaining PerCpu Instances

```
    get_cpu_data: Provides a method to obtain PerCpu instances based on CPU ID.
    this_cpu_data: Returns the PerCpu instance of the currently executing CPU.
```