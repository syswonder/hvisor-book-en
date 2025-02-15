# hvisor Book Structure

[Introduction](./Introduction.md)

# About hvisor

- [Overview of hvisor](./chap01/Overview.md)

- [Instruction Sets and Processors Supported by hvisor](./chap01/ISA.md)

- [Hardware Platforms Supported by hvisor](./chap01/Board.md)

# Quick Start Guide for hvisor

- [Quick Start with Qemu AArch64](./chap02/QemuAArch64.md)

- [Quick Start with Qemu RISC-V](./chap02/QemuRISC-V.md)

- [Quick Start with NXP i.MX 8](./chap02/NXPIMX8.md)

- [Quick Start with FPGA-Rockechip](./chap02/FPGA-Rockechip.md)

- [Quick Start with Loongson 3A5000 hvisor](./chap02/Loongson-3A5000.md)

- [Quick Start with Xilinx ZCU102 hvisor](./chap02/subchap01/Xilinx-ZCU102.md)

	- [Boot hvisor on Qemu ZCU102](./chap02/subchap01/Qemu-ZCU102.md)
	
	- [Multi-mode Boot hvisor on Board ZCU102](./chap02/subchap01/Board-ZCU102.md)
	
	- [Nonroot Boot on ZCU102](./chap02/subchap01/Nonroot-ZCU102.md)
	
    - [UBOOT FIT Image Creation, Loading, and Booting](./chap02/subchap01/UbootFitImage-ZCU102.md)

- [Quick Start with FPGA Xiangshan Kunming Lake]()


# hvisor User Manual

- [How to Compile](./chap03/Compile.md)

- [Boot Management for Linux VM](./chap03/BootRootLinux.md)

- [Boot Two VMs: Linux1 and Linux2](./chap03/BootNonRootLinux.md)

- [Boot Two VMs: Linux and RTOS](./chap03/BootNonRootRTOS.md)

- [Configuration and Management of ZONE](./chap03/ZoneConfig.md)

- [Command Line Tools](./chap03/CMDTools.md)

- [Using VirtIO](./chap03/VirtIOUseage.md)

# Architecture and Implementation of hvisor

- [Architecture of hvisor](./chap04/Structure.md)
- [Boot and Operation of hvisor](./chap04/BootAndRun.md)
- [CPU Virtualization](./chap04/subchap01/CPUVirtualization.md)

    - [PerCPU Definition](./chap04/subchap01/PerCPU.md)

    - [ARM Processor Virtualization](./chap04/subchap01/ARMVirtualization.md)

    - [RISC-V Processor Virtualization](./chap04/subchap01/RISCVirtualization.md)
    
    - [LoongArch Processor Virtualization](./chap04/subchap01/LoongArchVirtualization.md)
- [Memory Virtualization](./chap04/MemVirtualization.md)
- [Interrupt Virtualization](./chap04/subchap02/InterruptVirtualization.md)

    - [ARM Interrupt Control GIC](./chap04/subchap02/ARM-GIC.md)

    - [RISC-V Interrupt Control PLIC](./chap04/subchap02/RISC-PLIC.md) 

    - [RISC-V Interrupt Control AIA](./chap04/subchap02/RISC-AIA.md)

    - [LoongArch Interrupt Control](./chap04/subchap02/LoongArch-Controller.md)
- [I/O Virtualization](./chap04/subchap03/IO-Virtualization.md)

    - [IOMMU](./chap04/subchap03/IOMMU/IOMMU-Define.md)

        - [Implementation of ARM SMMU](./chap04/subchap03/IOMMU/ARM-SMMU.md)

        - [Implementation of RISC-V IOMMU Standard](./chap04/subchap03/IOMMU/RISC-IOMMU.md)
- [VirtIO](./chap04/subchap03/VirtIO/VirtIO-Define.md)
    
    - [Block](./chap04/subchap03/VirtIO/BlockDevice.md)
    - [Net](./chap04/subchap03/VirtIO/NetDevice.md)
    - [Console](./chap04/subchap03/VirtIO/ConsoleDevice.md)
    - [GPU]()
- [PCI Virtualization](./chap04/subchap03/PCI-Virtualization.md)
- [Hvisor Management Tools](./chap04/subchap04/ManageTools.md)
  
    - [Hypercall](./chap04/subchap04/HyperCall.md)

# Future Plans for hvisor

- [TODO]()