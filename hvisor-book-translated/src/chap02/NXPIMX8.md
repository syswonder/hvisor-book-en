# NXP Launches Jailhouse
Date: 2024/2/25
Updated: 2024/3/13

Authors: Yang Junyi, Chen Xingyu

Overall Approach:

1. Boot the first Linux using an SD card, it is recommended to use Ubuntu's rootfs and set up the network for convenience in package installation.
2. Boot the root Linux and compile the Linux kernel and Jailhouse.
3. Restart, modify the root dtb, and boot the root Linux.
4. Jailhouse boots non-root Linux, which is the Linux on the eMMC (original manufacturer's Linux), specifying the rootfs as eMMC.

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
# Install required packages such as vim, build-essential, python3, python3-dev, gcc, g++, git, make, kmod.
sudo apt-get install <PKG_NAME> 

exit

# If using arch-chroot, manual umount is not needed
sudo umount ./sys
sudo umount ./proc
sudo umount ./dev

mv etc/resolv.conf.saved etc/resolv.conf

## Additionally, copy Linux and jailhouse to the SD card, change to local path.
sudo cp -r LINUX_DEMO ubuntu-base-18.04.5-base-arm64/home #source path see Linux kernel compilation section
sudo cp -r Jailhouse_DEMO ubuntu-base-18.04.5-base-arm64/home
# Then copy the ubuntu-base-18.04.5-base-arm64 directory into the SD card as rootfs.
# It is recommended to complete the "Compilation" section before copying, or you can enter the system and then compile
sudo fdisk -l # determine the SD card device name
sudo mount /dev/sdb1 /mnt 
sudo cp -r ubuntu-base-18.04.5-base-arm64 /mnt
```

## 2. Compile NXP Linux Kernel

The source code can be obtained from the manufacturer's materials (source location: /OKMX8MP-C_Linux5.4.70+Qt5.15.0_User Information_R5 (update date: 20231012)/Linux/source/OK8MP-linux-sdk/OK8MP-linux-kernel)

This step can be done in a chroot environment or by first using an existing Image and dtb to boot the board (official files provide an Image and OK8MP-C.dtb)

### Add Root Device Tree

The device tree storage location is arch/arm64/boot/dts/freescale, add a new device tree OK8MP-C-root.dts, mainly modify to disable usdhc3 (eMMC) and uart4, and share pins between usdhc3 and usdhc2 to facilitate booting non-root-linux

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

&uart4 { // Also disable this, used for nonroot boot.
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

If the gcc version is too high, it might cause yylloc issues. You can downgrade the version or add 'extern' before yylloc in scripts/dtc/dtc-lexer.lex.c_shipped

If there are definition conflicts between jailhouse and the kernel, prioritize the kernel and modify jailhouse accordingly

### Compile Jailhouse

Jailhouse version uses v0.12 then manually add dts and configuration files
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
                                 JAILHOUSE