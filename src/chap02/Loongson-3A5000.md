# Booting hvisor on Loongson 3A5000 motherboard (7A2000)

Han Yulu <wheatfox17@icloud.com>

Updated: 2025.3.24

## Step 1: Obtain hvisor source code and compile

First, you need to install the `loongarch64-unknown-linux-gnu-` toolchain, please download and extract it from <https://github.com/sunhaiyong1978/CLFS-for-LoongArch/releases/download/8.0/loongarch64-clfs-8.0-cross-tools-gcc-full.tar.xz>, then add the `cross-tools/bin` directory to your `PATH` environment variable to ensure tools like `loongarch64-unknown-linux-gnu-gcc` can be directly called by the shell.

Then clone the code locally:

```bash
git clone -b dev https://github.com/syswonder/hvisor
make BID=loongarch64/ls3a5000
```
After compiling, you can find the stripped `hvisor.bin` file in the `target` directory.

## Step 2 (without compiling buildroot/linux, etc.): Obtain rootfs/kernel image

Please download the latest released hvisor default Loongson Linux image from <https://github.com/enkerewpo/linux-hvisor-loongarch64/releases> (including root linux kernel+root linux dtb+root linux rootfs, where root linux rootfs includes non-root linux+nonroot linux dtb+nonroot linux rootfs). The rootfs is already packaged with the non-root startup json as well as hvisor-tool, kernel modules, etc.

## Step 2 (compiling buildroot/linux, etc. yourself): Fully compile rootfs/kernel image

If you need to compile it yourself, this process will be more complex, and the details are as follows:

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

After downloading, place the `dl` directory in the root directory of buildroot-loongarch64, or you can let buildroot download it automatically (which may be very slow). If you still need to download packages after extracting the `dl` directory, that is normal.

### 3. Compile buildroot

```bash
cd buildroot-loongarch64
make loongson3a5000_hvisor_defconfig

make menuconfig # Please set Toolchain/Toolchain path prefix to your local loongarch64 toolchain path and prefix
# Then select save in the bottom right corner to save to the .config file

make -j$(nproc)
```

<div class="warning">
    <h3>Please note</h3>
    <p> This process may take several hours, depending on your machine performance and network environment.</p>
</div>

### 4. Compile linux for the first time (to prepare for subsequent make world)

```bash
cd hvisor-la64-linux # Currently using linux 6.13.7 by default
./build def # Generate the default root linux defconfig
# ./build nonroot_def # Generate the default nonroot linux defconfig

# ./build menuconfig # If you want to customize the kernel configuration, you can use this command
# (It will modify the .config file in the current directory, please be aware of whether you are modifying the root linux or nonroot linux configuration,
# You can check the content of the .flag file in the root directory is ROOT or NONROOT)

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

A brief introduction to the `make_world` script process, for specific commands please refer to the `Makefile.1` file:
1. Compile hvisor-tool, since the kernel module of hvisor-tool needs to be consistent with the kernel version of root linux, so you need to manually compile root linux once first, then make world can successfully compile hvisor-tool.
2. Copy the related files of hvisor-tool to the rootfs overlay of buildroot, located in `$(BUILDROOT_DIR)/board/loongson/ls3a5000/rootfs_ramdisk_overlay`.
3. Compile nonroot linux (nonroot currently does not use buildroot, but a simple busybox rootfs), note that the generated `vmlinux` includes nonroot dtb and busybox rootfs(initramfs) (all embedded in the kernel), and move `vmlinux.bin` to the rootfs overlay of buildroot. Remember the entry address of this nonroot linux `vmlinux`, later you can modify the `linux2.json` file in the buildroot overlay, writing this entry address in.
4. Compile buildroot rootfs, this time the rootfs includes the previously compiled nonroot linux vmlinux, as well as the related files of hvisor-tool.
5. Compile root linux, the generated `vmlinux` includes root linux dtb and buildroot rootfs (initramfs), please record this root linux `vmlinux` entry address and file path, which will be used later in hvisor and hvisor uefi packer.
6. Finish, what we ultimately need is this root linux `vmlinux.bin`.

## Step 3: Compile UEFI image

Since the 3A5000 and later 3 series CPUs' motherboards use UEFI boot, hvisor can only be booted through the efi image method.

Continuing from the previous step, in the hvisor uefi packer directory, first modify the `./make_image` script's `HVISOR_SRC_DIR` to the actual path where you saved the hvisor source code, then run the compilation script:

```bash
make menuconfig # Configure for your local loongarch64 gcc toolchain prefix, hvisor.bin path, vmlinux.bin path

# 1. Modify make_image's HVISOR_SRC_DIR=../hvisor to your actual saved hvisor source code path, then run the script
# 2. Modify BOARD=ls3a5000/ls3a6000 (choose according to your actual board model), the BOARD in the env mentioned later is the same

# ./make_world # See the previous step's description, this step can be skipped if you do not need to recompile buildroot/linux

ARCH=loongarch64 BOARD=ls3a5000 ./make_image
# make_image only compiles hvisor and BOOTLOONGARCH64.EFI
```

At this point, `BOOTLOONGARCH64.EFI` will be generated in the `hvisor_uefi_packer` directory, place it in the `/EFI/BOOT/BOOTLOONGARCH64.EFI` location of the first FAT32 partition of the USB drive.

<div class="warning">
    <h3>Please note</h3>
    <p> When you compile root and nonroot linux yourself, please manually use readelf to obtain the entry addresses of the two vmlinux files, and write them correspondingly in board.rs and linux2.json, otherwise it will definitely fail to boot.
</div>

## Step 4: Boot on board

Power on the motherboard, press **F12** to enter the UEFI Boot Menu, select to boot from the USB drive, and you will enter hvisor, then automatically enter root linux.

## Start nonroot

If you are using the related images provided in the release, after booting, enter in the bash of root linux:

```bash
./daemon.sh
./start.sh # Start nonroot, then please manually run screen /dev/pts/0
./start.sh -s # Start nonroot and automatically enter screen
```

Afterward, nonroot will automatically start (some related configuration files are located in the `/tool` directory of root linux, including the nonroot zone configuration json provided to hvisor-tool and the virtio configuration json files), then a screen process connected to the nonroot linux virtio-console will automatically open, you will see a bash printed with the nonroot label appear, you can use the `CTRL+A D` shortcut key to detach during screen (please remember the displayed screen session name / ID), at this time you will return to root linux, if you wish to return to nonroot linux, run

```bash
screen -r {the full name of the session just now or just enter the ID at the front}
```

Afterward, you will return to the bash of nonroot linux.