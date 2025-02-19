# NXP Launches Jailhouse
Date: 2024/2/25
Update Date: 2024/3/13

Authors: Yang Junyi, Chen Xingyu

Overall Approach:

1. Boot the first Linux using an SD card, it is recommended to use Ubuntu's rootfs for this Linux and ensure it is network-enabled for easy package installation.
2. Boot the root Linux and compile the Linux kernel and Jailhouse.
3. Restart, modify the root dtb, and boot root Linux.
4. Jailhouse boots nonroot Linux, which is the Linux on the eMMC (original manufacturer's Linux), specifying rootfs as eMMC.

## 1. Creating an Ubuntu SD Card Image

```shell
wget https://cdimage.ubuntu.com/ubuntu-base/releases/18.04/release/ubuntu-base-18.04.5-base-arm64.tar.gz
tar zxvf ubuntu-base-18.04.5-base-arm64.tar.gz

cd ubuntu-base-18.04.5-base-arm64

# chroot in x86
sudo apt-get install qemu
sudo cp /usr/bin/qemu-aarch64-static usr/bin/

sudo mount /sys ./sys -o bind
sudo mount /proc ./proc -o bind
sudo mount /dev ./dev -o bind

sudo mv etc/resolv.conf etc/resolv.conf.saved
sudo cp /etc/resolv.conf etc

sudo LC_ALL=C chroot . /bin/bash

# chroot in arm
sudo arch-chroot .

sudo apt-get update 
# Install necessary packages, such as vim, build-essential, python3, python3-dev, gcc, g++, git, make, kmod.
sudo apt-get install <PKG_NAME> 

exit

# If using arch-chroot, no need to manually umount
sudo umount ./sys
sudo umount ./proc
sudo umount ./dev

mv etc/resolv.conf.saved etc/resolv.conf

## Additionally, copy Linux and jailhouse to the SD card, change to local path here.
sudo cp -r LINUX_DEMO ubuntu-base-18.04.5-base-arm64/home # Source path see Linux kernel compilation section
sudo cp -r Jailhouse_DEMO ubuntu-base-18.04.5-base-arm64/home
# Then copy the ubuntu-base-18.04.5-base-arm64 directory to the SD card as rootfs.
# It is recommended to complete the "Compilation" section before copying, or you can compile after entering the system
sudo fdisk -l # Determine the SD card device name
sudo mount /dev/sdb1 /mnt 
sudo cp -r ubuntu-base-18.04.5-base-arm64 /mnt
```

## 2. Compile NXP Linux Kernel

The source code can be obtained from the manufacturer's materials (source location: /OKMX8MP-C_Linux5.4.70+Qt5.15.0_User Data_R5 (update date: 20231012)/Linux/Source/OK8MP-linux-sdk/OK8MP-linux-kernel)

### Adding root device tree

Device tree storage location is arch/arm64/boot/dts/freescale, add new device tree OK8MP-C-root.dts, mainly modify to disable usdhc3 (eMMC) and uart4, and share pins between usdhc3 and usdhc2 to facilitate booting non-root-linux

Content:

```C
// SPDX-License-Identifier: (GPL-2.0+ OR MIT)
/*
 * Copyright 2019 NXP
 */

/dts-v1/;

#include "OK8MP-C.dts"

/ {
        interrupt-parent = <&gic>;

        resmem: reserved-memory {
                #address-cells = <2>;
                #size-cells = <2>;
                ranges;
        };
};

&cpu_pd_wait {
        /delete-property/ compatible;
};

&clk {
        init-on-array = <IMX8MP_CLK_USDHC3_ROOT
                         IMX8MP_CLK_NAND_USDHC_BUS
                         IMX8MP_CLK_HSIO_ROOT
                         IMX8MP_CLK_UART4_ROOT
                         IMX8MP_CLK_OCOTP_ROOT>;
};

&{/busfreq} {
        status = "disabled";
};

&{/reserved-memory} { // Reserved jailhouse memory area
        jh_reserved: jh@fdc00000 {
                no-map;
                reg = <0 0xfdc00000 0x0 0x400000>;
        };

        loader_reserved: loader@fdb00000 {
                no-map;
                reg = <0 0xfdb00000 0x0 0x00100000>;
        };

        ivshmem_reserved: ivshmem@fda00000 {
                no-map;
                reg = <0 0xfda00000 0x0 0x00100000>;
        };

        ivshmem2_reserved: ivshmem2@fd900000 {
                no-map;
                reg = <0 0xfd900000 0x0 0x00100000>;
        };

        pci_reserved: pci@fd700000 {
                no-map;
                reg = <0 0xfd700000 0x0 0x00200000>;
        };

        inmate_reserved: inmate@60000000 {
                no-map;
                reg = <0 0x60000000 0x0 0x10000000>;
        };
};

&iomuxc {
        pinctrl_uart4: uart4grp {
                fsl,pins = <
                        MX8MP_IOMUXC_UART4_RXD__UART4_DCE_RX    0x49
                        MX8MP_IOMUXC_UART4_TXD__UART4_DCE_TX    0x49
                >;
        };
};

&usdhc3 { // eMMC: mmc2, since this eMMC is nonroot, root should not occupy it, so disable it
        status = "disabled";
};

&uart4 { // This is also disabled, used for nonroot boot.
        /delete-property/ dmas;
        /delete-property/ dma-names;
        pinctrl-names = "default";
        pinctrl-0 = <&pinctrl_uart4>;
        status = "disabled";
};

&uart2 { // uart1=ttymxc0 uart4=ttymxc3 default for ttymxc1.
        /* uart4 is used by the 2nd OS, so configure pin and clk */
        pinctrl-0 = <&pinctrl_uart2>, <&pinctrl_uart4>;
        assigned-clocks = <&clk IMX8MP_CLK_UART4>;
        assigned-clock-parents = <&clk IMX8MP_CLK_24M>;
};

&usdhc2 {
        pinctrl-0 = <&pinctrl_usdhc3>, <&pinctrl_usdhc2>, <&pinctrl_usdhc2_gpio>;
        pinctrl-1 = <&pinctrl_usdhc3>, <&pinctrl_usdhc2_100mhz>, <&pinctrl_usdhc2_gpio>;
        pinctrl-2 = <&pinctrl_usdhc3>, <&pinctrl_usdhc2_200mhz>, <&pinctrl_usdhc2_gpio>;
};
```

### Kernel Compilation

```shell
# First, refer to the previous chroot and enter the source directory
make OK8MP-C_defconfig # Configure default config
make -j$(nproc) ARCH=arm64 # Compilation takes about 15 minutes
```

If the gcc version is high, you may encounter yylloc issues, which can be resolved by lowering the version or by adding extern in front of yylloc in scripts/dtc under dtc-lexer.lex.c_shipped

If there are definition conflicts between jailhouse and the kernel, prioritize the kernel and modify jailhouse accordingly

### Compile jailhouse

Use jailhouse version v0.12 and manually add dts and configuration files
```shell
git checkout v0.12
```
.c file addition location configs/arm64

.dts file addition location configs/arm64/dts

imx8mp.c

```C
/*
 * i.MX8MM Target
 *
 * Copyright 2018 NXP
 *
 * Authors:
 *  Peng Fan <peng.fan@nxp.com>
 *
 * This work is licensed under the terms of the GNU GPL, version 2.  See
 * the COPYING file in the top-level directory.
 *
 * Reservation via device tree: reg = <0x0 0xffaf0000 0x0 0x510000>
 */

#include <jailhouse/types.h>
#include <jailhouse/cell-config.h>

struct {
        struct jailhouse_system header;
        __u64 cpus[1];
        struct jailhouse_memory mem_regions[15];
        struct jailhouse_irqchip irqchips[3];
        struct jailhouse_pci_device pci_devices[2];
} __attribute__((packed)) config = {
        .header = {
                .signature = JAILHOUSE_SYSTEM_SIGNATURE,
                .revision = JAILHOUSE_CONFIG_REVISION,
                .flags = JAILHOUSE_SYS_VIRTUAL_DEBUG_CONSOLE,
                .hypervisor_memory = {
                        .phys_start = 0xfdc00000,
                        .size =       0x00400000,
                },
                .debug_console = {
                        .address = 0x30890000,
                        .size = 0x1000,
                        .flags = JAILHOUSE_CON_TYPE_IMX |
                                 JAILHOUSE_CON_ACCESS_MMIO |
                                 JAILHOUSE_CON_REGDIST_4,
                        .type = JAILHOUSE_CON_TYPE_IMX,
                },
                .platform_info = {
                        .pci_mmconfig_base = 0xfd700000,
                        .pci_mmconfig_end_bus = 0,
                        .pci_is_virtual = 1,
                        .pci_domain = 0,

                        .arm = {
                                .gic_version = 3,
                                .gicd_base = 0x38800000,
                                .gicr_base = 0x38880000,
                                .maintenance_irq = 25,
                        },
                },
                .root_cell = {
                        .name = "imx8mp",

                        .num_pci_devices = ARRAY_SIZE(config.pci_devices),
                        .cpu_set_size = sizeof(config.cpus),
                        .num_memory_regions = ARRAY_SIZE(config.mem_regions),
                        .num_irqchips = ARRAY_SIZE(config.irqchips),
                        /* gpt5/4/3/2 not used by root cell */
                        .vpci_irq_base = 51, /* Not include 32 base */
                },
        },

        .cpus = {
                0xf,
        },

        .mem_regions = {
                /* IVHSMEM shared memory region for 00:00.0 (demo )*/ {
                        .phys_start = 0xfd900000,
                        .virt_start = 0xfd900000,
                        .size = 0x1000,
                        .flags = JAILHOUSE_MEM_READ,
                },
                {
                        .phys_start = 0xfd901000,
                        .virt_start = 0xfd901000,
                        .size = 0x9000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_WRITE ,
                },
                {
                        .phys_start = 0xfd90a000,
                        .virt_start = 0xfd90a000,
                        .size = 0x2000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_WRITE ,
                },
                {
                        .phys_start = 0xfd90c000,
                        .virt_start = 0xfd90c000,
                        .size = 0x2000,
                        .flags = JAILHOUSE_MEM_READ,
                },
                {
                        .phys_start = 0xfd90e000,
                        .virt_start = 0xfd90e000,
                        .size = 0x2000,
                        .flags = JAILHOUSE_MEM_READ,
                },
                /* IVSHMEM shared memory regions for 00:01.0 (networking) */
                JAILHOUSE_SHMEM_NET_REGIONS(0xfda00000, 0),
                /* IO */ {
                        .phys_start = 0x00000000,
                        .virt_start = 0x00000000,
                        .size =       0x40000000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_WRITE |
                                JAILHOUSE_MEM_IO,
                },
                /* RAM 00*/ {
                        .phys_start = 0x40000000,
                        .virt_start = 0x40000000,
                        .size = 0x80000000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_WRITE |
                                JAILHOUSE_MEM_EXECUTE,
                },
                /* Inmate memory */{
                        .phys_start = 0x60000000,
                        .virt_start = 0x60000000,
                        .size = 0x10000000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_WRITE |
                                JAILHOUSE_MEM_EXECUTE | JAILHOUSE_MEM_DMA,
                },
                /* Loader */{
                        .phys_start = 0xfdb00000,
                        .virt_start = 0xfdb00000,
                        .size = 0x100000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_WRITE |
                                JAILHOUSE_MEM_EXECUTE,
                },
                /* OP-TEE reserved memory?? */{
                        .phys_start = 0xfe000000,
                        .virt_start = 0xfe000000,
                        .size = 0x2000000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_WRITE,
                },
                /* RAM04 */{
                        .phys_start = 0x100000000,
                        .virt_start = 0x100000000,
                        .size = 0xC0000000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_WRITE,
                },
        },

        .irqchips = {
                /* GIC */ {
                        .address = 0x38800000,
                        .pin_base = 32,
                        .pin_bitmap = {
                                0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
                        },
                },
                /* GIC */ {
                        .address = 0x38800000,
                        .pin_base = 160,
                        .pin_bitmap = {
                                0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
                        },
                },
                /* GIC */ {
                        .address = 0x38800000,
                        .pin_base = 288,
                        .pin_bitmap = {
                                0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
                        },
                },
        },

        .pci_devices = {
                { /* IVSHMEM 0000:00:00.0 (demo) */
                        .type = JAILHOUSE_PCI_TYPE_IVSHMEM,
                        .domain = 0,
                        .bdf = 0 << 3,
                        .bar_mask = JAILHOUSE_IVSHMEM_BAR_MASK_INTX,
                        .shmem_regions_start = 0,
                        .shmem_dev_id = 0,
                        .shmem_peers = 3,
                        .shmem_protocol = JAILHOUSE_SHMEM_PROTO_UNDEFINED,
                },
                { /* IVSHMEM 0000:00:01.0 (networking) */
                        .type = JAILHOUSE_PCI_TYPE_IVSHMEM,
                        .domain = 0,
                        .bdf = 1 << 3,
                        .bar_mask = JAILHOUSE_IVSHMEM_BAR_MASK_INTX,
                        .shmem_regions_start = 5,
                        .shmem_dev_id = 0,
                        .shmem_peers = 2,
                        .shmem_protocol = JAILHOUSE_SHMEM_PROTO_VETH,
                },
        },
};
```


imx8mp-linux-demo.c

```C
/*
 * iMX8MM target - linux-demo
 *
 * Copyright 2019 NXP
 *
 * Authors:
 *  Peng Fan <peng.fan@nxp.com>
 *
 * This work is licensed under the terms of the GNU GPL, version 2.  See
 * the COPYING file in the top-level directory.
 */

/*
 * Boot 2nd Linux cmdline:
 * export PATH=$PATH:/usr/share/jailhouse/tools/
 * jailhouse cell linux imx8mp-linux-demo.cell Image -d imx8mp-evk-inmate.dtb -c "clk_ignore_unused console=ttymxc3,115200 earlycon=ec_imx6q,0x30890000,115200  root=/dev/mmcblk2p2 rootwait rw"
 */
#include <jailhouse/types.h>
#include <jailhouse/cell-config.h>

struct {
        struct jailhouse_cell_desc cell;
        __u64 cpus[1];
        struct jailhouse_memory mem_regions[15];
        struct jailhouse_irqchip irqchips[2];
        struct jailhouse_pci_device pci_devices[2];
} __attribute__((packed)) config = {
        .cell = {
                .signature = JAILHOUSE_CELL_DESC_SIGNATURE,
                .revision = JAILHOUSE_CONFIG_REVISION,
                .name = "linux-inmate-demo",
                .flags = JAILHOUSE_CELL_PASSIVE_COMMREG,

                .cpu_set_size = sizeof(config.cpus),
                .num_memory_regions = ARRAY_SIZE(config.mem_regions),
                .num_irqchips = ARRAY_SIZE(config.irqchips),
                .num_pci_devices = ARRAY_SIZE(config.pci_devices),
                .vpci_irq_base = 154, /* Not include 32 base */
        },

        .cpus = {
                0xc,
        },

        .mem_regions = {
                /* IVHSMEM shared memory region for 00:00.0 (demo )*/ {
                        .phys_start = 0xfd900000,
                        .virt_start = 0xfd900000,
                        .size = 0x1000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_ROOTSHARED,
                },
                {
                        .phys_start = 0xfd901000,
                        .virt_start = 0xfd901000,
                        .size = 0x9000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_WRITE |
                                JAILHOUSE_MEM_ROOTSHARED,
                },
                {
                        .phys_start = 0xfd90a000,
                        .virt_start = 0xfd90a000,
                        .size = 0x2000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_ROOTSHARED,
                },
                {
                        .phys_start = 0xfd90c000,
                        .virt_start = 0xfd90c000,
                        .size = 0x2000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_ROOTSHARED,
                },
                {
                        .phys_start = 0xfd90e000,
                        .virt_start = 0xfd90e000,
                        .size = 0x2000,
                        .flags = JAILHOUSE_MEM_READ | JAILHOUSE_MEM_WRITE |
                                JAILHOUSE_MEM_ROOTSHARED,
                },
                /* IVSHMEM shared memory regions for 00:01.0 (networking) */
                JAILHOUSE_SH