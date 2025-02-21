# Running hvisor on QEMU

## 1. Install Cross Compiler aarch64-none-linux-gnu- 10.3

URL: [https://developer.arm.com/downloads/-/gnu-a](https://developer.arm.com/downloads/-/gnu-a)

Tool Selection: AArch64 GNU/Linux target (aarch64-none-linux-gnu)

Download Link: [https://developer.arm.com/-/media/Files/downloads/gnu-a/10.3-2021.07/binrel/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu.tar.xz?rev=1cb9c51b94f54940bdcccd791451cec3&hash=B380A59EA3DC5FDC0448CA6472BF6B512706F8EC](https://developer.arm.com/-/media/Files/downloads/gnu-a/10.3-2021.07/binrel/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu.tar.xz?rev=1cb9c51b94f54940bdcccd791451cec3&hash=B380A59EA3DC5FDC0448CA6472BF6B512706F8EC)

```bash
wget https://armkeil.blob.core.windows.net/developer/Files/downloads/gnu-a/10.3-2021.07/binrel/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu.tar.xz
tar xvf gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu.tar.xz
ls gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu/bin/
```

After installation, remember the path, for example: /home/tools/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu/bin/aarch64-none-linux-gnu-, which will be used later.

## 2. Compile and Install QEMU 9.0.1

**Note, QEMU needs to be changed from 7.2.12 to 9.0.1 to properly use PCI virtualization**

```
# Install required packages for compilation
sudo apt install autoconf automake autotools-dev curl libmpc-dev libmpfr-dev libgmp-dev \
              gawk build-essential bison flex texinfo gperf libtool patchutils bc \
              zlib1g-dev libexpat-dev pkg-config  libglib2.0-dev libpixman-1-dev libsdl2-dev \
              git tmux python3 python3-pip ninja-build
# Download the source code
wget https://download.qemu.org/qemu-9.0.1.tar.xz
# Extract
tar xvJf qemu-9.0.1.tar.xz
cd qemu-9.0.1
# Generate configuration file
./configure --enable-kvm --enable-slirp --enable-debug --target-list=aarch64-softmmu,x86_64-softmmu
# Compile
make -j$(nproc)
```

Then edit the `~/.bashrc` file, add a few lines at the end of the file:

```
# Please note, the parent directory of qemu-9.0.1 can be flexibly adjusted according to your actual installation location. Also, it needs to be placed at the beginning of the $PATH variable.
export PATH=/path/to/qemu-7.2.12/build:$PATH
```

Then you can update the system path in the current terminal with `source ~/.bashrc`, or directly restart a new terminal. At this point, you can confirm the qemu version, if it displays qemu-9.0.1, then the installation was successful:

```
qemu-system-aarch64 --version   # Check version
```

> Note, the above packages may not be complete, for example:
>
> - If you encounter `ERROR: pkg-config binary 'pkg-config' not found`, you can install the `pkg-config` package;
> - If you encounter `ERROR: glib-2.48 gthread-2.0 is required to compile QEMU`, you can install the `libglib2.0-dev` package;
> - If you encounter `ERROR: pixman >= 0.21.8 not present`, you can install the `libpixman-1-dev` package.

> If you encounter an error ERROR: Dependency "slirp" not found, tried pkgconfig when generating the configuration file:
>
> Download the [https://gitlab.freedesktop.org/slirp/libslirp](https://gitlab.freedesktop.org/slirp/libslirp) package and install according to the readme.

## 3. Compile Linux Kernel 5.4

Before compiling the root linux image, change the CONFIG_IPV6 and CONFIG_BRIDGE config in the .config file to y, to support creating bridges and tap devices in root linux. Specific operations are as follows:

```
git clone https://github.com/torvalds/linux -b v5.4 --depth=1
cd linux
git checkout v5.4
# Modify the CROSS_COMPILE path according to the path of the cross compiler installed in the first step
make ARCH=arm64 CROSS_COMPILE=/root/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu/bin/aarch64-none-linux-gnu- defconfig
# Add a line in .config
CONFIG_BLK_DEV_RAM=y
# Modify two CONFIG parameters in .config
CONFIG_IPV6=y
CONFIG_BRIDGE=y
# Compile, modify the CROSS_COMPILE path according to the path of the cross compiler installed in the first step
make ARCH=arm64 CROSS_COMPILE=/root/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu/bin/aarch64-none-linux-gnu- Image -j$(nproc)
```

> If you encounter an error during the compilation of linux:
>
> ```
> /usr/bin/ld: scripts/dtc/dtc-parser.tab.o:(.bss+0x20): multiple definition of `yylloc'; scripts/dtc/dtc-lexer.lex.o:(.bss+0x0): first defined here
> ```
>
> Then modify the `scripts/dtc/dtc-lexer.lex.c` file under the linux folder, add `extern` before `YYLTYPE yylloc;`. Recompile, and if you encounter the error: openssl/bio.h: No such file or directory, execute `sudo apt install libssl-dev`

After compilation, the kernel file is located at: arch/arm64/boot/Image. Remember the entire path of the linux folder, for example: home/korwylee/lgw/hypervisor/linux, we will use this path again in step 7.

## 4. Build File System Based on Ubuntu 22.04 Arm64 Base

> You can skip this part and directly download the ready-made disk image. https://blog.syswonder.org/#/2024/20240415_Virtio_devices_tutorial

We use Ubuntu 22.04 to build the root file system.

> **Ubuntu 20.04** can also be used, but it will report a low glibc version error when running. You can refer to the solution in the comment section of [ARM64-qemu-jailhouse](https://blog.syswonder.org/#/2023/20230421_ARM64-QEMU-jailhouse).

```bash
wget http://cdimage.ubuntu.com/ubuntu-base/releases/22.04/release/ubuntu-base-22.04.5-base-arm64.tar.gz

mkdir rootfs
# Create a 1G ubuntu.img, you can modify the count to change the img size
dd if=/dev/zero of=rootfs1.img bs=1M count=1024 oflag=direct
mkfs.ext4 rootfs1.img
# Put ubuntu.tar.gz into the ubuntu.img that has been mounted to rootfs
sudo mount -t ext4 rootfs1.img rootfs/
sudo tar -xzf ubuntu-base-22.04.5-base-arm64.tar.gz -C rootfs/

# Bind rootfs to get some information and hardware from the physical machine
# qemu-path is your qemu path
sudo cp qemu-path/build/qemu-system-aarch64 rootfs/usr/bin/
sudo cp /etc/resolv.conf rootfs/etc/resolv.conf
sudo mount -t proc /proc rootfs/proc
sudo mount -t sysfs /sys rootfs/sys
sudo mount -o bind /dev rootfs/dev
sudo mount -o bind /dev/pts rootfs/dev/pts

# Executing this command may report an error, please refer to the solution below
sudo chroot rootfs
apt-get update
apt-get install git sudo vim bash-completion \
		kmod net-tools iputils-ping resolvconf ntpdate screen

# The following content surrounded by # can be done or not
###################
adduser arm64
adduser arm64 sudo
echo "kernel-5_4" >/etc/hostname
echo "127.0.0.1 localhost" >/etc/hosts
echo "127.0.0.1 kernel-5_4">>/etc/hosts
dpkg-reconfigure resolvconf
dpkg-reconfigure tzdata
###################
exit

sudo umount rootfs/proc
sudo umount rootfs/sys
sudo umount rootfs/dev/pts
sudo umount rootfs/dev
sudo umount rootfs
```

Finally, unmount the mount to complete the production of the root file system.

> When executing `sudo chroot .`, if you encounter the error `chroot: failed to run command ‘/bin/bash’: Exec format error`, you can execute the command:
>
> ```
> sudo apt-get install qemu-user-static
> sudo update-binfmts --enable qemu-aarch64
> ```

## 5. Rust Environment Configuration

Please refer to: [Rust Language Bible](https://course.rs/first-try/intro.html)

## 6. Compile and Run hvisor

First, pull the [hvisor code repository](https://github.com/KouweiLee/hvisor) locally, then switch to the dev branch, and in the hvisor/images/aarch64 folder, put the previously compiled root file system and Linux kernel image in the virtdisk and kernel directories respectively, and rename them to rootfs1.ext4 and Image.

Second, prepare the configuration files. Taking the [virtio-blk&console example](https://github.com/syswonder/hvisor-tool/tree/main/examples/qemu-aarch64/with_virtio_blk_console) as an example, this directory contains 6 files, perform the following operations on these 6 files:

* linux1.dts: Root Linux's device tree, used by hvisor at startup.
* linux2.dts: Zone1 Linux's device tree, needed by hvisor-tool when starting zone1. Replace linux1.dts and linux2.dts in the devicetree directory with the same name files, and execute `make all` to compile, obtaining linux1.dtb and linux2.dtb.
* qemu_aarch64.rs and qemu-aarch64.mk directly replace the files with the same name in the hvisor repository.

Then, in the hvisor directory, execute:

```
make ARCH=aarch64 BOARD=qemu FEATURES=platform_qemu,gicv3 LOG=info run
```

Afterward, you will enter the uboot startup interface. In this interface, execute:

```
bootm 0x40400000 - 0x40000000
```

This boot command will start hvisor from the physical address `0x40400000`. `0x40000000` is essentially no longer used, but is still retained for historical reasons. When hvisor starts, it will automatically start root linux (Linux used for management), and enter the shell interface of root linux. Root linux is zone0, which undertakes management tasks.

> If you are missing `dtc`, you can execute the command:
>
> ```
> sudo apt install device-tree-compiler
> ```

## 7. Use hvisor-tool to Start Zone1-linux

First, complete the compilation of the latest version of hvisor-tool. For specific details, please refer to the README of [hvisor-tool](https://github.com/syswonder/hvisor-tool). For example, if you want to compile a command-line tool for arm64, and the source code of the Linux image in the Hvisor environment is compiled from the source code directory located at `~/linux`, you can execute

```
make all ARCH=arm64 LOG=LOG_WARN KDIR=~/linux
```

> Please make sure that the Root Linux image in Hvisor is compiled from the Linux source code directory specified in the compilation options of hvisor-tool.

After compilation, copy driver/hvisor.ko and tools/hvisor to the directory where zone1 linux starts in the image/virtdisk/rootfs1.ext4 root file system (for example, /same_path/); then put the kernel image of zone1 (if it is the same Linux as zone0, just copy a copy of image/aarch64/kernel/Image) and the device tree (image/aarch64/linux2.dtb) in the same directory (/same_path/), and rename them to Image and linux2.dtb.

Then you need to create a root file system for Zone1 linux. You can copy a copy of image/aarch64/virtdisk/rootfs1.ext4, or repeat step 4 (preferably reduce the image size), and rename it to rootfs2.etx4. Then put rootfs2.ext4 in the same directory (/same_path/) as rootfs1.ext4.

> If the capacity of rootfs1.ext4 is not enough, you can refer to [img expansion](https://blog.syswonder.org/#/2023/20230421_ARM64-QEMU-jailhouse?id=_2-img%e6%89%a9%e5%ae%b9) to expand rootfs1.ext4.

Then you can start zone1-linux on QEMU through root linux-zone0.

> For detailed steps on starting zone1-linux, refer to the README of hvisor-tool and the [startup example](https://github.com/syswonder/hvisor-tool/tree/main/examples/qemu-aarch64/with_virtio_blk_console/README.md)