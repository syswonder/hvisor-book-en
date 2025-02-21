# Install qemu
Install QEMU 9.0.2:
```
wget https://download.qemu.org/qemu-9.0.2.tar.xz
# Unzip
tar xvJf qemu-9.0.2.tar.xz
cd qemu-9.0.2
# Configure Riscv support
./configure --target-list=riscv64-softmmu,riscv64-linux-user 
make -j$(nproc)
# Add to environment variable
export PATH=$PATH:/path/to/qemu-9.0.2/build
# Test if installation was successful
qemu-system-riscv64 --version
```
# Install cross-compiler
The Riscv cross-compiler needs to be obtained and compiled from riscv-gnu-toolchain.
```
# Install necessary tools
sudo apt-get install autoconf automake autotools-dev curl python3 python3-pip libmpc-dev libmpfr-dev libgmp-dev gawk build-essential bison flex texinfo gperf libtool patchutils bc zlib1g-dev libexpat-dev ninja-build git cmake libglib2.0-dev libslirp-dev

git clone https://github.com/riscv/riscv-gnu-toolchain
cd riscv-gnu-toolchain
git rm qemu 
git submodule update --init --recursive
# The above operation will occupy more than 5GB of disk space
# If git reports a network error, you can execute:
git config --global http.postbuffer 524288000
```
Then start compiling the toolchain:
```
cd riscv-gnu-toolchain
mkdir build
cd build
../configure --prefix=/opt/riscv64
sudo make linux -j $(nproc)
# After compilation, add the toolchain to the environment variable
echo 'export PATH=/opt/riscv64/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```
This will get the riscv64-unknown-linux-gnu toolchain.
# Compile Linux
```
git clone https://github.com/torvalds/linux -b v6.2 --depth=1
cd linux
git checkout v6.2
make ARCH=riscv CROSS_COMPILE=riscv64-unknown-linux-gnu- defconfig
make ARCH=riscv CROSS_COMPILE=riscv64-unknown-linux-gnu- modules -j$(nproc)
# Start compiling
make ARCH=riscv CROSS_COMPILE=riscv64-unknown-linux-gnu- Image -j$(nproc)

```
# Make Ubuntu root filesystem
```
wget http://cdimage.ubuntu.com/ubuntu-base/releases/20.04/release/ubuntu-base-20.04.2-base-riscv64.tar.gz
mkdir rootfs
dd if=/dev/zero of=riscv_rootfs.img bs=1M count=1024 oflag=direct
mkfs.ext4 riscv_rootfs.img
sudo mount -t ext4 riscv_rootfs.img rootfs/
sudo tar -xzf ubuntu-base-20.04.2-base-riscv64.tar.gz -C rootfs/

sudo cp /path-to-qemu/build/qemu-system-riscv64 rootfs/usr/bin/
sudo cp /etc/resolv.conf rootfs/etc/resolv.conf
sudo mount -t proc /proc rootfs/proc
sudo mount -t sysfs /sys rootfs/sys
sudo mount -o bind /dev rootfs/dev
sudo mount -o bind /dev/pts rootfs/dev/pts
sudo chroot rootfs 
# After entering chroot, install necessary packages:
apt-get update
apt-get install git sudo vim bash-completion \
    kmod net-tools iputils-ping resolvconf ntpdate
exit

sudo umount rootfs/proc
sudo umount rootfs/sys
sudo umount rootfs/dev/pts
sudo umount rootfs/dev
sudo umount rootfs
```
# Run hvisor
Place the prepared root filesystem and Linux kernel image in the specified location in the hvisor directory, then execute `make run ARCH=riscv64` in the hvisor root directory

By default, it uses PLIC, execute `make run ARCH=riscv64 IRQ=aia` to enable AIA specification

# Start non-root linux
Use hvisor-tool to generate the hvisor.ko file, then you can start zone1-linux through root linux-zone0 on QEMU.

After starting root linux, execute in the /home directory
```bash
sudo insmod hvisor.ko
rm nohup.out
mkdir -p /dev/pts
mount -t devpts devpts /dev/pts
nohup ./hvisor zone start linux2-aia.json && cat nohup.out | grep "char device" && script /dev/null
```