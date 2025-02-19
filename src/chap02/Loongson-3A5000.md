# Starting hvisor on Loongson 3A5000 motherboard (7A2000)

Han Yulu <enkerewpo@hotmail.com>

Updated: 2024.12.4

## Step 1: Obtain hvisor source code and compile

Clone the code locally:

```bash
git clone -b dev-loongarch https://github.com/syswonder/hvisor # dev-loongarch branch
make ARCH=loongarch64
```
After compiling, you can find the stripped hvisor.bin in the target directory (the file path will be displayed in the last line of the compilation output).

## Obtain vmlinux.bin image

Please download the latest released hvisor default Loongson Linux image from <https://github.com/enkerewpo/linux-hvisor-loongarch64/releases> (including root linux kernel + root linux dtb + root linux rootfs, where root linux rootfs includes non-root linux + nonroot linux dtb + nonroot linux rootfs). If you need to compile the Linux kernel and rootfs yourself, refer to the `arch/loongarch` directory in the repository for hvisor-related device trees and the buildroot environment I ported for 3A5000 (<https://github.com/enkerewpo/buildroot-loongarch64>). If you need to manually compile hvisor-tool, please refer to <https://github.com/enkerewpo/hvisor-tool>, for the compilation order and script invocation process of all environments, refer to the code within the `world` target in the `Makefile.1` file (<https://github.com/enkerewpo/hvisor_uefi_packer/blob/main/Makefile.1>), and compile everything by running the `./make_world` script. If you need to manually compile these, you need to modify the corresponding code path variables in Makefile.1, including:

```
HVISOR_LA64_LINUX_DIR = ../hvisor-la64-linux
BUILDROOT_DIR = ../buildroot-loongarch64
HVISOR_TOOL_DIR = ../hvisor-tool
```

Then run `./make_world`, please note that the first time compiling Linux and buildroot may take quite a long time (possibly up to several tens of minutes, depending on your machine performance).

## Obtain hvisor UEFI Image Packer

Since the 3A5000 and subsequent 3 series CPUs' motherboards all use UEFI boot, hvisor can only be started through the efi image method, clone the repository <https://github.com/enkerewpo/hvisor_uefi_packer> locally:

```bash
make menuconfig # Configure for your local loongarch64 gcc toolchain prefix, hvisor.bin path, vmlinux.bin path
# Modify make_image in HVISOR_SRC_DIR=../hvisor to your actual saved hvisor source code path, then run the script
./make_image
# Get BOOTLOONGARCH64.EFI file
```

The obtained `BOOTLOONGARCH64.EFI` must be placed in the `/EFI/BOOT/BOOTLOONGARCH64.EFI` position of the first FAT32 partition of the USB drive. Then insert the USB drive to boot into hvisor and automatically start root linux.

Since the metadata related to root linux (loading address, memory area, etc.) is hard-coded in the hvisor source code (`src/platform/ls3a5000_loongarch64.rs`), if you are manually compiling the Linux kernel, you need to modify the configuration here and recompile hvisor.

## Board boot

Power on the motherboard, press **F12** to enter the UEFI Boot Menu, select the inserted USB drive and press Enter, hvisor will automatically start and enter the root linux bash environment.

## Start nonroot

If you are using the related images provided in the release, after starting, enter in the root linux bash:

```bash
./daemon.sh
./linux2_virtio.sh
```

Afterward, nonroot will automatically start (some related configuration files are located in the root linux `/tool` directory, including the nonroot zone configuration json and virtio configuration json files provided to hvisor-tool), then a screen process connected to nonroot linux's virtio-console will automatically open, and you will see a bash printed with the nonroot label appear, you can use the CTRL+A D shortcut key to detach during screen (please remember the displayed screen session name), at this point you will return to root linux, if you want to return to nonroot linux, run

```bash
screen -r {the full name of the session just now or just enter the first few digits}
```

Afterward, you will return to the nonroot linux bash.