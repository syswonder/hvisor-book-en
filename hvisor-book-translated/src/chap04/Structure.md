# hvisor Overall Architecture

- CPU Virtualization
    - Architectural Compatibility: Supports aarch64, riscv64, and loongarch architectures, each with a dedicated CPU virtualization component.
    - CPU Allocation: Uses static allocation, pre-determining the CPU resources for each virtual machine.

- Memory Virtualization
    - Two-Level Page Table: Utilizes two-level page table technology to optimize the memory virtualization process.

- Interrupt Virtualization
    - Interrupt Controller Virtualization: Supports ARM GIC, RISC-V PLIC, and other architecture-specific interrupt controller virtualizations.
    - Interrupt Handling: Manages the transmission and processing of interrupt signals.

- I/O Virtualization
    - IOMMU Integration: Supports IOMMU, enhancing the efficiency and security of DMA virtualization.
    - VirtIO Standard: Adheres to the VirtIO specification, providing high-performance virtual devices.
    - PCI Virtualization: Implements PCI virtualization, ensuring virtual machines can access physical or virtual I/O devices.