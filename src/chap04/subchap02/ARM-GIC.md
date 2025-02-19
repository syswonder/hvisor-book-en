# ARM GICv3 Module

## 1. GICv3 Module

### GICv3 Initialization Process

The GICv3 initialization process in hvisor involves the initialization of the GIC Distributor (GICD) and GIC Redistributor (GICR), as well as the mechanisms for interrupt handling and virtual interrupt injection. Key steps in this process include:

- SDEI version check: Obtain the version information of the Secure Debug Extensions Interface (SDEI) through smc_arg1!(0xc4000020).
- ICCs configuration: Set icc_ctlr_el1 to only provide priority drop functionality, set icc_pmr_el1 to define the interrupt priority mask, and enable Group 1 IRQs.
- Clear pending interrupts: Call the gicv3_clear_pending_irqs function to clear all pending interrupts, ensuring the system is in a clean state.
- VMCR and HCR configuration: Set ich_vmcr_el2 and ich_hcr_el2 registers to enable the virtualization CPU interface and prepare for virtual interrupt handling.

### Pending Interrupt Handling

- The `pending_irq` function reads the `icc_iar1_el1` register and returns the current interrupt ID being processed. If the value is greater than or equal to 0x3fe, it is considered an invalid interrupt.
- The `deactivate_irq` function clears the interrupt flags by writing to the `icc_eoir1_el1` and `icc_dir_el1` registers, enabling the interrupt.

### Virtual Interrupt Injection

- The `inject_irq` function checks for an available `List Register (LR)` and writes the virtual interrupt information into it. This function distinguishes between hardware interrupts and software-generated interrupts, appropriately setting fields in the LR.

### GIC Data Structure Initialization

- GIC is a global Once container used for the lazy initialization of the Gic structure, which contains the base addresses and sizes of GICD and GICR.
- The primary_init_early and primary_init_late functions configure the GIC during the early and late initialization stages, enabling interrupts.

### Zone-Level Initialization

In the Zone structure, the `arch_irqchip_reset` method is responsible for resetting all interrupts allocated to a specific zone by directly writing to the GICD's ICENABLER and ICACTIVER registers.

## 2. vGICv3 Module

hvisor's VGICv3 (Virtual Generic Interrupt Controller version 3) module provides virtualization support for GICv3 in the ARMv8-A architecture. It controls and coordinates interrupt requests between different zones (virtual machine instances) through MMIO (Memory Mapped I/O) access and interrupt bitmaps management.

### MMIO Region Registration

During initialization, the `Zone` structure's `vgicv3_mmio_init` method registers the MMIO regions for the GIC Distributor (GICD) and each CPU's GIC Redistributor (GICR). MMIO region registration is completed through the `mmio_region_register` function, which associates specific processor or interrupt controller addresses with corresponding handling functions `vgicv3_dist_handler` and `vgicv3_redist_handler`.

### Interrupt Bitmap Initialization

The `Zone` structure's `irq_bitmap_init` method initializes the interrupt bitmap to track which interrupts belong to the current `zone`. Each interrupt is inserted into the bitmap by iterating through the provided interrupt list. The `insert_irq_to_bitmap` function is responsible for mapping specific interrupt numbers to the appropriate positions in the bitmap.

### MMIO Access Restriction

The `restrict_bitmask_access` function restricts MMIO access to the `GICD` registers, ensuring that only interrupts belonging to the current `zone` can be modified. The function checks whether the access is for the current zone's interrupts and, if so, updates the access mask to allow or restrict specific read/write operations.

### VGICv3 MMIO Handling

The `vgicv3_redist_handler` and `vgicv3_dist_handler` functions handle MMIO access for GICR and GICD, respectively. The `vgicv3_redist_handler` function handles read/write operations for GICR, checking whether the access is for the current `zone`'s GICR and allowing access if so; otherwise, the access is ignored. The `vgicv3_dist_handler` function calls `vgicv3_handle_irq_ops` or `restrict_bitmask_access` based on different types of GICD registers to appropriately handle interrupt routing and configuration register access.

Through these mechanisms, hvisor effectively manages interrupts across zones, ensuring that each zone can only access and control the interrupt resources allocated to it while providing necessary isolation. This allows VGICv3 to work efficiently and securely in a multi-zone environment, supporting complex virtualization scenarios.