# Booting hvisor on Loongson 3A5000 motherboard (7A2000)

Han Yulu <wheatfox17@icloud.com>

Updated: 2025.3.3

## Step 1: Obtain the hvisor source code and compile it

First, you need to install the `loongarch64-unknown-linux-gnu-` toolchain. Please download it from <https://github.com/sunhaiyong1978/CLFS-for-LoongArch/releases/download/8.0/loongarch64-clfs-8.0-cross-tools-gcc-full.tar.xz> and extract it locally. Then add the `cross-tools/bin` directory to your `PATH` environment variable to ensure tools like `loongarch64-unknown-linux-gnu-gcc` can be directly called by the shell.

Next, clone the code locally:

```bash
git clone -b dev https://github.com/syswonder/hvisor
make BID=loongarch64/ls3a5000
```
After compilation, you can find the stripped `hvisor.bin` in the target directory (the file path will be displayed in the last line of the compilation output).

## Obtain `vmlinux.bin` and other files

Please download the latest released hvisor default Loongson Linux image from <https://github.com/enkerewpo/linux-hvisor-loongarch64/releases> (including root Linux kernel + root Linux dtb + root Linux rootfs, where root Linux rootfs includes non-root Linux + nonroot Linux dtb + nonroot Linux rootfs). If you need to compile the Linux kernel and rootfs yourself, refer to the `arch/loongarch` directory in that repository for hvisor-related device trees and the buildroot environment I ported for 3A5000 (<https://github.com/enkerewpo/buildroot-loongarch64>). If you need to manually compile the hvisor-tool, refer to <https://github.com/enkerewpo/hvisor-tool>. For the compilation order and script invocation process of all environments, refer to the code within the `world` target in the `Makefile.1` file (<https://github.com/enkerewpo/hvisor_uefi_packer/blob/main/Makefile.1>), and compile everything by running the `./make_world` script. If you need to manually compile these, you will need to modify the corresponding code path variables in `Makefile.1`, including:

```
HVISOR_LA64_LINUX_DIR = ../hvisor-la64-linux
BUILDROOT_DIR = ../buildroot-loongarch64
HVISOR_TOOL_DIR = ../hvisor-tool
```

Then run `./make_world`. Please note that the first time compiling Linux and buildroot may take a long time (possibly up to several tens of minutes, depending on your machine performance).

## Obtain hvisor UEFI Image Packer

Since the 3A5000 and later series CPUs' motherboards use UEFI boot, hvisor can only be started via an EFI image method. Clone the repository <https://github.com/enkerewpo/hvisor_uefi_packer> locally:

```bash
make menuconfig # Configure for your local loongarch64 gcc toolchain prefix, hvisor.bin path, vmlinux.bin path
# 1. Modify the HVISOR_SRC_DIR in make_image to the actual path where you saved the hvisor source code, then run the script
# 2. Modify BOARD=ls3a5000/ls3a6000
./make_loongarch64
# Obtain the BOOTLOONGARCH64.EFI file
```

The obtained `BOOTLOONGARCH64.EFI` must be placed in the first FAT32 partition of the USB drive at `/EFI/BOOT/BOOTLOONGARCH64.EFI`. Then insert the USB drive to boot and enter hvisor, which will automatically start root Linux.

Since the metadata related to root Linux (loading address, memory area, etc.) is hardcoded in the hvisor source code (`src/platform/ls3a5000_loongarch64.rs`), if you are manually compiling the Linux kernel, you need to modify this configuration and recompile hvisor.

## Booting on the board

Power on the motherboard, press **F12** to enter the UEFI Boot Menu, select the inserted USB drive and press Enter. hvisor will automatically start and enter the bash environment of root Linux.

## Start nonroot

If you are using the related images provided in the release, after booting, enter in the bash of root Linux:

```bash
./daemon.sh
./start.sh # Start nonroot, then please manually run screen /dev/pts/0
./start.sh -s # Start nonroot and automatically enter screen
```

Afterward, nonroot will automatically start (some related configuration files are located in the `/tool` directory of root Linux, including the nonroot zone configuration JSON and virtio configuration JSON files provided to hvisor-tool). A screen process will automatically open connecting to the virtio-console of nonroot Linux, displaying a bash with the nonroot label. You can use the `CTRL+A D` shortcut key to detach during screen usage (remember the displayed screen session name / ID). You will return to root Linux. If you want to return to nonroot Linux, run:

```bash
screen -r {the full name of the session just now or just enter the front ID}
```

You will then return to the bash of nonroot Linux.