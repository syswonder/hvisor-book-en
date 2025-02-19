# hvisor Book Structure

[Introduction](./Introduction.md)

# About hvisor

- [hvisor Overview](./chap01/Overview.md)

- [Instruction Sets and Processors Supported by hvisor](./chap01/ISA.md)

- [Hardware Platforms Supported by hvisor](./chap01/Board.md)

# hvisor Quick Start Guide

- [Qemu AArch64 Quick Start](./chap02/QemuAArch64.md)

- [Qemu RISC-V Quick Start](./chap02/QemuRISC-V.md)

- [NXP i.MX 8 Quick Start](./chap02/NXPIMX8.md)

- [FPGA-Rockechip Quick Start](./chap02/FPGA-Rockechip.md)

- [Loongson 3A5000 hvisor Quick Start](./chap02/Loongson-3A5000.md)

- [Xilinx ZCU102 hvisor Quick Start](./chap02/subchap01/Xilinx-ZCU102.md)

	- [Qemu ZCU102 hvisor Boot](./chap02/subchap01/Qemu-ZCU102.md)
	
	- [Board ZCU102 hvisor Multi-mode Boot](./chap02/subchap01/Board-ZCU102.md)
	
	- [ZCU102 Nonroot Boot](./chap02/subchap01/Nonroot-ZCU102.md)
	
    - [UBOOT FIT Image Creation, Loading and Booting](./chap02/subchap01/UbootFitImage-ZCU102.md)

- [FPGA Xiangshan Kunming Lake Quick Start]()

# hvisor User Manual

- [How to Compile](./chap03/Compile.md)

- [Boot Management Linux VM](./chap03/BootRootLinux.md)

- [Boot Two VMs: Linux1 and Linux2](./chap03/BootNonRootLinux.md)

- [Boot Two VMs: Linux and RTOS](./chap03/BootNonRootRTOS.md)

- [ZONE Configuration and Management](./chap03/ZoneConfig.md)

- [Command Line Tools](./chap03/CMDTools.md)

- [Using VirtIO](./chap03/VirtIOUseage.md)

# hvisor Architecture and Implementation

- [hvisor Architecture](./chap04/Structure.md)
- [hvisor Boot and Operation](./chap04/BootAndRun.md)
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

        - [ARM SMMU Implementation](./chap04/subchap03/IOMMU/ARM-SMMU.md)

        - [RISC-V IOMMU Standard Implementation](./chap04/subchap03/IOMMU/RISC-IOMMU.md)
- [VirtIO](./chap04/subchap03/VirtIO/VirtIO-Define.md)
    
    - [Block](./chap04/subchap03/VirtIO/BlockDevice.md)
    - [Net](./chap04/subchap03/VirtIO/NetDevice.md)
    - [Console](./chap04/subchap03/VirtIO/ConsoleDevice.md)
    - [GPU]()
- [PCI Virtualization](./chap04/subchap03/PCI-Virtualization.md)
- [Hvisor Management Tools](./chap04/subchap04/ManageTools.md)
  
    - [Hypercall](./chap04/subchap04/HyperCall.md)

# hvisor's Plan

- [TODO]()