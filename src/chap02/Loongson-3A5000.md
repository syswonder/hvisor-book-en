# Booting hvisor on Loongson 3A5000 motherboard (7A2000)

Han Yulu <wheatfox17@icloud.com>

Updated: 2025.3.24

## Step 1: Obtain the hvisor source code and compile

First, you need to install the `loongarch64-unknown-linux-gnu-` toolchain, please download it from <https://github.com/sunhaiyong1978/CLFS-for-LoongArch/releases/download/8.0/loongarch64-clfs-8.0-cross-tools-gcc-full.tar.xz> and extract it locally, then add the `cross-tools/bin` directory to your `PATH` environment variable to ensure tools like `loongarch64-unknown-linux-gnu-gcc` can be directly called by the shell.

Then clone the code locally:

```bash
git clone -b dev https://github.com/syswonder/hvisor
make BID=loongarch64/ls3a5000
```
After compilation, you can find the stripped `hvisor.bin` file in the `target` directory.

## Step 2 (without compiling buildroot/linux etc.): Obtain rootfs/kernel image

Please download the latest released hvisor default Loongson Linux image from <https://github.com/enkerewpo/linux-hvisor-loongarch64/releases> (including root linux kernel+root linux dtb+root linux rootfs, where root linux rootfs includes non root linux+nonroot linux dtb+nonroot linux rootfs). The rootfs already includes the nonroot startup json as well as hvisor-tool, kernel modules, etc.

## Step 2 (compiling buildroot/linux etc. yourself): Complete compilation of rootfs/kernel image

If you need to compile it yourself, this process will be more complex, and the details will be introduced next:

### 1. Prepare the environment

Create a working directory (optional):

```bash
mkdir workspace && cd workspace

git clone -b dev https://github.com/syswonder/hvisor
git clone https://github.com/enkerewpo/buildroot-loongarch64
git clone https://github.com/enkerewpo/linux-hvisor-loongarch64 hvisor-la64-linux
git clone https://github.com/enkerewpo/hvisor-tool
git clone https://github.com/enkerewpo/hvisor_uefi_packer
```
### 2. Prepare the buildroot environment

Since buildroot will download source code packages from various places when it cannot find the package to compile, I have prepared a pre-downloaded image:

<https://pan.baidu.com/s/1sVPRt0JiExUxFm2QiCL_nA?pwd=la64>

After downloading, place the `dl` directory in the root directory of buildroot-loongarch64, or you can let buildroot download it automatically (which may be very slow). If you find that software packages still need to be downloaded during compilation after extracting the `dl` directory, this is normal.

### 3. Compile buildroot

```bash
cd buildroot-loongarch64
make loongson3a5000_hvisor_defconfig

make menuconfig # Please set the Toolchain/Toolchain path prefix to your local loongarch64 toolchain path and prefix
# Then select the bottom right corner save to save to the .config file

make -j$(nproc)
```

<div class="warning">
    <h3>Please note</h3>
    <p> This process may take several hours, depending on your machine performance and network environment.</p>
</div>


### 4. Compile linux for the first time (to prepare for the subsequent make world)

```bash
cd hvisor-la64-linux # Currently using linux 6.13.7 by default
./build def # Generate the default root linux defconfig
# ./build nonroot_def # Generate the default nonroot linux defconfig

# ./build menuconfig # If you want to customize the kernel configuration, you can use this command
# (It will modify the .config file in the current directory, please note whether you are modifying the configuration of root linux or nonroot linux,
# You can check the content of the root directory .flag file is ROOT or NONROOT)

./build kernel # Compile the kernel corresponding to the current .config (may be root linux
# or nonroot linux, depending on ./build def and ./build nonroot_def)
```

<div class="warning">
    <h3>Please note</h3>
    <p> This process may take several tens of minutes, depending on your machine performance.</p>
</div>

### 5. Execute the make world process through hvisor uefi packer

First, you need to modify the `Makefile.1` file in the `hvisor_uefi_packer` directory, changing variables like `HVISOR_LA64_LINUX_DIR` to the actual paths:

```Makefile
HVISOR_LA64_LINUX_DIR = ../hvisor-la64-linux
BUILDROOT_DIR = ../buildroot-loongarch64
HVISOR_TOOL_DIR = ../hvisor-tool
```

Then run:

```bash
cd hvisor_uefi_packer
./make_world
```

A brief introduction to the `make_world` script process, please refer to the `Makefile.1` file for specific commands:
1. Compile hvisor-tool, as the kernel module of hvisor-tool needs to be consistent with the kernel version of root linux, so it needs to be manually compiled once for root linux first, then make world can successfully compile hvisor-tool.
2. Copy the relevant files of hvisor-tool to the rootfs overlay of buildroot, located at `$(BUILDROOT_DIR)/board/loongson/ls3a5000/rootfs_ramdisk_overlay`.
3. Compile nonroot linux (nonroot currently does not use buildroot, but a simple busybox rootfs), note that the generated `vmlinux` internally includes nonroot's dtb and busybox rootfs(initramfs) (all embedded in the kernel), and move `vmlinux.bin` to the rootfs overlay of buildroot. Remember the entry address of this nonroot linux `vmlinux`, later you can modify the `linux2.json` file in the overlay of buildroot to write this entry address.
4. Compile the buildroot rootfs, at this time the rootfs includes the previously compiled nonroot linux vmlinux, as well as the relevant files of hvisor-tool.
5. Compile root linux, the generated `vmlinux` internally includes the dtb of root linux and the buildroot rootfs (initramfs), please record the entry address and file path of this root linux `vmlinux`, which will be used later in hvisor and hvisor uefi packer.
6. End, what we ultimately need is this root linux `vmlinux.bin`.

### 6. Compile the UEFI image

Since the 3A5000 and later 3 series CPUs' motherboards all use UEFI boot, hvisor can only be booted through the efi image method.

Following the previous step, in the hvisor uefi packer directory, first modify the `./make_image` script's `HVISOR_SRC_DIR` to the actual path where you saved the hvisor source code, then run the compilation script:

```bash
make menuconfig # Configure to your local loongarch64 gcc toolchain prefix, hvisor.bin path, vmlinux.bin path

# 1. Modify make_image's HVISOR_SRC_DIR=../hvisor to the actual path where you saved the hvisor source code, then run the script
# 2. Modify BOARD=ls3a5000/ls3a6000 (choose according to your actual board model), the BOARD in the env below is the same

# ./make_world # See the previous step for explanation, this step can be skipped if there is no need to recompile buildroot/linux

ARCH=loongarch64 BOARD=ls3a5000 ./make_image
# make_image only compiles hvisor and BOOTLOONGARCH64.EFI
```

At this point, `BOOTLOONGARCH64.EFI` will be generated in the `hvisor_uefi_packer` directory, place it in the first FAT32 partition of the USB drive at `/EFI/BOOT/BOOTLOONGARCH64.EFI`.

<div class="warning">
    <h3>Please note</h3>
    <p> When you compile root and nonroot linux yourself, please manually readelf to get the entry addresses of the two vmlinux, and write them correctly in board.rs and linux2.json, otherwise it will definitely fail to boot.
</div>


## Board boot

Power on the motherboard, press **F12** to enter the UEFI Boot Menu, select the USB drive you inserted, in the UEFI Boot Menu select the USB drive to boot, then you will enter hvisor, and then automatically enter root linux.

## Start nonroot

If you are using the related images provided in the release, after booting, enter in the bash of root linux:

```bash
./daemon.sh
./start.sh # Start nonroot, then please manually run screen /dev/pts/0
./start.sh -s # Start nonroot and automatically enter screen
```

Afterward, nonroot will automatically start (some related configuration files are located in the `/tool` directory of root linux, including the nonroot zone configuration json and virtio configuration json files provided to hvisor-tool), then a screen process connecting to nonroot linux's virtio-console will automatically open, you will see a bash printed with nonroot appear, you can use the `CTRL+A D` shortcut key to detach while using screen (please remember the displayed screen session name / ID), at this time it will return to root linux, if you want to return to nonroot linux, run

```bash
screen -r {the full name of the session just now or just enter the ID}
```

Afterward, it will return to the bash of nonroot linux.