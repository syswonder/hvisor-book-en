# Booting hvisor on Loongson 3A5000 Motherboard (7A2000)

Han Yulu <enkerewpo@hotmail.com>

Updated: December 4, 2024

## Step 1: Obtain and compile the hvisor source code

Clone the code locally:

```bash
git clone -b dev-loongarch https://github.com/syswonder/hvisor # dev-loongarch branch
make ARCH=loongarch64
```
After compilation, you can find the stripped hvisor.bin in the target directory (the file path will be displayed in the last line of the compilation output).

## Obtain the vmlinux.bin image

Please download the latest released hvisor default Loongson Linux image from <https://github.com/enkerewpo/linux-hvisor-loongarch64/releases> (including root Linux kernel + root Linux dtb + root Linux rootfs, where root Linux rootfs includes non-root Linux + non-root Linux dtb + non-root Linux rootfs). If you need to compile the Linux kernel and rootfs yourself, refer to the `arch/loongarch` directory in the repository for hvisor-related device trees and the buildroot environment I ported for 3A5000 (<https://github.com/enkerewpo/buildroot-loongarch64>). If you need to manually compile hvisor-tool, refer to <https://github.com/enkerewpo/hvisor-tool>. For the compilation order and script invocation process of all environments, refer to the code inside the `world` target in the `Makefile.1` file (<https://github.com/enkerewpo/hvisor_uefi_packer/blob/main/Makefile.1>), and compile everything by running the `./make_world` script. If you need to manually compile these, you need to modify the corresponding code path variables in Makefile.1, including:

```
HVISOR_LA64_LINUX_DIR = ../hvisor-la64-linux
BUILDROOT_DIR = ../buildroot-loongarch64
HVISOR_TOOL_DIR = ../hvisor-tool
```

Then run `./make_world`. Please note that the first compilation of Linux and buildroot may take a long time (possibly up to several tens of minutes, depending on your machine performance).

## Obtain hvisor UEFI Image Packer

Since the 3A5000 and subsequent Series 3 CPUs' motherboards use UEFI boot, hvisor can only be booted via an EFI image method. Clone the repository <https://github.com/enkerewpo/hvisor_uefi_packer> locally:

```bash
make menuconfig # Configure for your local loongarch64 gcc toolchain prefix, hvisor.bin path, vmlinux.bin path
# Modify make_image's HVISOR_SRC_DIR=../hvisor to your actual hvisor source code path, then run the script
./make_image
# You will get the BOOTLOONGARCH64.EFI file
```

The obtained `BOOTLOONGARCH64.EFI` must be placed in the first FAT32 partition of the USB drive at `/EFI/BOOT/BOOTLOONGARCH64.EFI`. Then insert the USB drive to boot and enter hvisor, which will automatically start root Linux.

Since the metadata related to root Linux (loading address, memory area, etc.) is hardcoded in the hvisor source code (`src/platform/ls3a5000_loongarch64.rs`), if you are manually compiling the Linux kernel, you need to modify the configuration here and recompile hvisor.

## Board Boot

Power on the motherboard, press **F12** to enter the UEFI Boot Menu, select your inserted USB drive and press Enter. It will automatically boot hvisor and enter the root Linux bash environment.

## Start nonroot

If you are using the related images provided in the release, after booting, enter in the root Linux bash:

```bash
./daemon.sh
./linux2_virtio.sh
```

This will automatically start nonroot (some related configuration files are located in the root Linux `/tool` directory, including the nonroot zone configuration JSON and virtio configuration JSON files provided to hvisor-tool). Afterwards, a screen process will open connecting to nonroot Linux's virtio-console, displaying a bash with "nonroot" printed. You can use the CTRL+A D shortcut key to detach (remember the displayed screen session name) during screen use. To return to nonroot Linux, run:

```bash
screen -r {the full name of the session just now or just enter the first few numbers}
```

This will return you to the nonroot Linux bash.