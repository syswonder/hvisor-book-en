# hvisor Overall Architecture

- CPU Virtualization
    - Architecture Compatibility: Supports architectures such as aarch64, riscv64, and loongarch, with dedicated CPU virtualization components for each architecture.
    - CPU Allocation: Uses static allocation method, pre-determining the CPU resources for each virtual machine.

- Memory Virtualization
    - Two-stage Page Table: Utilizes two-stage page table technology to optimize the memory virtualization process.

- Interrupt Virtualization
    - Interrupt Controller Virtualization: Supports virtualization of different architecture's interrupt controllers like ARM GIC and RISC-V PLIC.
    - Interrupt Handling: Manages the transmission and processing flow of interrupt signals.

- I/O Virtualization
    - IOMMU Integration: Supports IOMMU to enhance the efficiency and security of DMA virtualization.
    - VirtIO Standard: Follows the VirtIO specification, providing high-performance virtual devices.
    - PCI Virtualization: Implements PCI virtualization, ensuring virtual machines can access physical or virtual I/O devices.