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

Once installed, remember the path, for example: /home/tools/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu/bin/aarch64-none-linux-gnu-, this path will be used later.

## 2. Compile and Install QEMU 7.2.12

```
# Install required dependencies for compilation
sudo apt install autoconf automake autotools-dev curl libmpc-dev libmpfr-dev libgmp-dev \
              gawk build-essential bison flex texinfo gperf libtool patchutils bc \
              zlib1g-dev libexpat-dev pkg-config  libglib2.0-dev libpixman-1-dev libsdl2-dev \
              git tmux python3 python3-pip ninja-build
# Download the source code
wget https://download.qemu.org/qemu-7.2.12.tar.xz
# Extract
tar xvJf qemu-7.2.12.tar.xz
cd qemu-7.2.12
# Generate configuration file
./configure --enable-kvm --enable-slirp --enable-debug --target-list=aarch64-softmmu,x86_64-softmmu
# Compile
make -j$(nproc)
```

Then edit the `~/.bashrc` file, add a few lines at the end of the file:

```
# Note that the parent directory of qemu-7.2.12 can be adjusted flexibly according to your actual installation location
export PATH=$PATH:/path/to/qemu-7.2.12/build
```

Then you can update the system path in the current terminal by `source ~/.bashrc`, or simply restart a new terminal. At this point, you can confirm the qemu version:

```
qemu-system-aarch64 --version   # Check the version
```

> Note, the above dependencies may not be complete, for example:
>
> - If `ERROR: pkg-config binary 'pkg-config' not found` occurs, you can install the `pkg-config` package;
> - If `ERROR: glib-2.48 gthread-2.0 is required to compile QEMU` occurs, you can install the `libglib2.0-dev` package;
> - If `ERROR: pixman >= 0.21.8 not present` occurs, you can install the `libpixman-1-dev` package.

> If you encounter an error ERROR: Dependency "slirp" not found, tried pkgconfig when generating the configuration file:
>
> Download the [https://gitlab.freedesktop.org/slirp/libslirp](https://gitlab.freedesktop.org/slirp/libslirp) package and install it according to the readme.

## 3. Compile Linux Kernel 5.4

Before compiling the root linux image, change the CONFIG_IPV6 and CONFIG_BRIDGE config in the .config file to y to support creating bridges and tap devices in root linux. The specific operations are as follows:

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

> If there is an error when compiling linux:
>
> ```
> /usr/bin/ld: scripts/dtc/dtc-parser.tab.o:(.bss+0x20): multiple definition of `yylloc'; scripts/dtc/dtc-lexer.lex.o:(.bss+0x0): first defined here
> ```
>
> Then modify `scripts/dtc/dtc-lexer.lex.c` under the linux folder, add `extern` before `YYLTYPE yylloc;`. Compile again, if you encounter the error: openssl/bio.h: No such file or directory, then execute `sudo apt install libssl-dev`

Once compiled, the kernel file is located at: arch/arm64/boot/Image. Remember the path of the entire linux folder, for example: home/korwylee/lgw/hypervisor/linux, we will use this path again in step 7.

## 4. Build File System Based on Ubuntu 20.04 Arm64 Base

> This section can be omitted, you can directly download the ready-made disk image to use. https://blog.syswonder.org/#/2024/20240415_Virtio_devices_tutorial

We use Ubuntu 20.04 (22.04 is also possible) to build the root file system.

Download: [ubuntu-base-20.04.5-base-arm64.tar.gz](http://cdimage.ubuntu.com/ubuntu-base/releases/20.04/release/ubuntu-base-20.04.5-base-arm64.tar.gz)

Link: [http://cdimage.ubuntu.com/ubuntu-base/releases/20.04/release/ubuntu-base-20.04.5-base-arm64.tar.gz](http://cdimage.ubuntu.com/ubuntu-base/releases/20.04/release/ubuntu-base-20.04.5-base-arm64.tar.gz)

```bash
wget http://cdimage.ubuntu.com/ubuntu-base/releases/20.04/release/ubuntu-base-20.04.5-base-arm64.tar.gz

mkdir rootfs
# Create a 1G size ubuntu.img, you can modify the count to change the img size
dd if=/dev/zero of=ubuntu-20.04-rootfs_ext4.img bs=1M count=1024 oflag=direct
mkfs.ext4 ubuntu-20.04-rootfs_ext4.img
# Put ubuntu.tar.gz into the ubuntu.img that has been mounted on rootfs
sudo mount -t ext4 ubuntu-20.04-rootfs_ext4.img rootfs/
sudo tar -xzf ubuntu-base-20.04.5-base-arm64.tar.gz -C rootfs/

# Let rootfs bind and obtain some information and hardware of the physical machine
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

> When executing `sudo chroot .