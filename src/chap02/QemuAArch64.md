# Running hvisor on QEMU

## 1. Install Cross Compiler aarch64-none-linux-gnu-10.3

URL: [https://developer.arm.com/downloads/-/gnu-a](https://developer.arm.com/downloads/-/gnu-a)

Tool selection: AArch64 GNU/Linux target (aarch64-none-linux-gnu)

Download link: [https://developer.arm.com/-/media/Files/downloads/gnu-a/10.3-2021.07/binrel/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu.tar.xz?rev=1cb9c51b94f54940bdcccd791451cec3&hash=B380A59EA3DC5FDC0448CA6472BF6B512706F8EC](https://developer.arm.com/-/media/Files/downloads/gnu-a/10.3-2021.07/binrel/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu.tar.xz?rev=1cb9c51b94f54940bdcccd791451cec3&hash=B380A59EA3DC5FDC0448CA6472BF6B512706F8EC)

```bash
wget https://armkeil.blob.core.windows.net/developer/Files/downloads/gnu-a/10.3-2021.07/binrel/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu.tar.xz
tar xvf gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu.tar.xz
ls gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu/bin/
```

After installation, remember the path, for example, at: /home/tools/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu/bin/aarch64-none-linux-gnu-, this path will be used later.

## 2. Compile and Install QEMU 7.2.12

```
# Install required dependencies for compilation
sudo apt install autoconf automake autotools-dev curl libmpc-dev libmpfr-dev libgmp-dev \
              gawk build-essential bison flex texinfo gperf libtool patchutils bc \
              zlib1g-dev libexpat-dev pkg-config  libglib2.0-dev libpixman-1-dev libsdl2-dev \
              git tmux python3 python3-pip ninja-build
# Download source code
wget https://download.qemu.org/qemu-7.2.12.tar.xz
# Unzip
tar xvJf qemu-7.2.12.tar.xz
cd qemu-7.2.12
# Generate configuration files
./configure --enable-kvm --enable-slirp --enable-debug --target-list=aarch64-softmmu,x86_64-softmmu
# Compile
make -j$(nproc)
```

Then edit the `~/.bashrc` file, add a few lines at the end of the file:

```
# Please note, the parent directory of qemu-7.2.12 can be flexibly adjusted according to your actual installation location
export PATH=$PATH:/path/to/qemu-7.2.12/build
```

Afterward, you can update the system path in the current terminal by `source ~/.bashrc`, or directly restart a new terminal. At this point, you can check the qemu version:

```
qemu-system-aarch64 --version   #Check version
```

> Note, the above dependency packages may not be complete, for example:
>
> - If you encounter `ERROR: pkg-config binary 'pkg-config' not found`, you can install the `pkg-config` package;
> - If you encounter `ERROR: glib-2.48 gthread-2.0 is required to compile QEMU`, you can install the `libglib2.0-dev` package;
> - If you encounter `ERROR: pixman >= 0.21.8 not present`, you can install the `libpixman-1-dev` package.

> If you encounter an error ERROR: Dependency "slirp" not found, tried pkgconfig while generating configuration files:
>
> Download [https://gitlab.freedesktop.org/slirp/libslirp](https://gitlab.freedesktop.org/slirp/libslirp) package, and install according to the readme.

## 3. Compile Linux Kernel 5.4

Before compiling the root linux image, change the CONFIG_IPV6 and CONFIG_BRIDGE config in the .config file to y, to support creating bridges and tap devices in root linux. The specific operations are as follows:

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

> If you encounter an error while compiling linux:
>
> ```
> /usr/bin/ld: scripts/dtc/dtc-parser.tab.o:(.bss+0x20): multiple definition of `yylloc'; scripts/dtc/dtc-lexer.lex.o:(.bss+0x0): first defined here
> ```
>
> Then modify the file `scripts/dtc/dtc-lexer.lex.c` under the linux folder, add `extern` before `YYLTYPE yylloc;`. Compile again, if you encounter an error: openssl/bio.h: No such file or directory, then execute `sudo apt install libssl-dev`

After compilation, the kernel file is located at: arch/arm64/boot/Image. Remember the entire linux folder's path, for example: home/korwylee/lgw/hypervisor/linux, we will use this path in step 7.

## 4. Build File System Based on Ubuntu 20.04 arm64 Base

> This section can be omitted, you can directly download the ready-made disk image for use. https://blog.syswonder.org/#/2024/20240415_Virtio_devices_tutorial

We use Ubuntu 20.04 (22.04 is also possible) to build the root file system.

Download: [ubuntu-base-20.04.5-base-arm64.tar.gz](http://cdimage.ubuntu.com/ubuntu-base/releases/20.04/release/ubuntu-base-20.04.5-base-arm64.tar.gz)

Link: [http://cdimage.ubuntu.com/ubuntu-base/releases/20.04/release/ubuntu-base-20.04.5-base-arm64.tar.gz](http://cdimage.ubuntu.com/ubuntu-base/releases/20.04/release/ubuntu-base-20.04.5-base-arm64.tar.gz)

```bash
wget http://cdimage.ubuntu.com/ubuntu-base/releases/20.04/release/ubuntu-base-20.04.5-base-arm64.tar.gz

mkdir rootfs
# Create a 1G ubuntu.img, you can modify the count to change the img size
dd if=/dev/zero of=ubuntu-20.04-rootfs_ext4.img bs=1M count=1024 oflag=direct
mkfs.ext4 ubuntu-20.04-rootfs_ext4.img
# Put ubuntu.tar.gz into the ubuntu.img that has been mounted on rootfs
sudo mount -t ext4 ubuntu-20.04-rootfs_ext4.img rootfs/
sudo tar -xzf ubuntu-base-20.04.5-base-arm64.tar.gz -C rootfs/

# Let rootfs bind and get some information and hardware of the physical machine
# qemu-path is your qemu path
sudo cp qemu-path/build/qemu-system-aarch64 rootfs/usr/bin/
sudo cp /etc/resolv.conf rootfs/etc/resolv.conf
sudo mount -t proc /proc rootfs/proc
sudo mount -t sysfs /sys rootfs/sys
sudo mount -o bind /dev rootfs/dev
sudo mount -o bind /dev/pts rootfs/dev/pts

# Executing this command may report an error, please refer to the solution below
sudo chroot rootfs
sudo apt-get install git sudo vim bash-completion \
		kmod net-tools iputils-ping resolvconf ntpdate

# The following content surrounded by # is optional
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

Finally, unmount the mount to complete the root file system production.

> When executing `sudo chroot .`, if you encounter the error `chroot: failed to run command ‘/bin/bash’: Exec format error`, you can execute the command:
>
> ```
> sudo apt-get install qemu-user-static
> sudo update-binfmts --enable qemu-aarch64
> ```

## 5. Rust Environment Configuration

Please refer to: [Rust Language Bible](https://course.rs/first-try/intro.html)

## 6. Compile and Run hvisor

First, pull the [hvisor code repository](https://github.com/KouweiLee/hvisor) locally, then switch to the dev branch, and in the hvisor/images/aarch64 folder, put the previously compiled root file system and Linux kernel image respectively in the virtdisk and kernel directories, and rename them as rootfs1.ext4 and Image respectively. And in the devicetree directory, execute `make all`.

Then, in the hvisor directory, execute:

```
make ARCH=aarch64 LOG=info FEATURES=platform_qemu run
```

Afterward, you will enter the uboot startup interface, under this interface execute:

```
bootm 0x40400000 - 0x40000000
```

This startup command will boot hvisor from the physical address `0x40400000`, with the device tree address at `0x40000000`. When hvisor starts, it will automatically start root linux (used for management) and enter the shell interface of root linux, root linux is zone0, taking on management tasks.

> If missing `dtc`, you can execute the command:
>
> ```
> sudo apt install device-tree-compiler
> ```

## 7. Use hvisor-tool to Start zone1-linux

First, complete the compilation of the latest version of hvisor-tool. For details, please refer to the README of [hvisor-tool](https://github.com/syswonder/hvisor-tool) (the Chinese version is the latest version, the English README may not be updated in time). For example, if you want to compile a command line tool for arm64, and the source code of the Linux image in the Hvisor environment is located at `~/linux`, you can execute

```
make all ARCH=arm64 LOG=LOG_WARN KDIR=~/linux
```

> Please make sure that the Linux image in Hvisor is compiled from the Linux source directory specified in the options of compiling hvisor-tool.

After compilation, copy driver/hvisor.ko, tools/hvisor, driver/ivc.ko (if this file exists) to the directory where zone1 linux is started in the image/virtdisk/rootfs1.ext4 root file system (currently /home/arm64); then put the kernel image of zone1 (if it is the same Linux as zone0, copy a copy of image/aarch64/kernel/Image), and the device tree (image/aarch64/linux2.dtb) in the same directory (/home/arm64) of rootfs1.ext4, and rename them as Image and linux2.dtb respectively.

Finally, copy rootfs1.ext4 in place in image/aarch64/virtdisk, rename it as rootfs2.etx4.

Then, zone1-linux can be started on QEMU through root linux-zone0.

> For detailed steps to start zone1-linux, refer to the README of hvisor-tool. Here is a reference (subject to hvisor-tool), where linux2.json is the configuration file for zone1-linux:

```
# Execute in the /home/arm64 directory:
insmod hvisor.ko
./hvisor zone start linux2.json
```