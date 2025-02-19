# How to Start Root Linux

## QEMU

### Install Dependencies

#### 1. Install Dependencies

```bash
apt-get install -y jq wget build-essential \
 libglib2.0-0 libfdt1 libpixman-1-0 zlib1g \
 libfdt-dev libpixman-1-dev libglib2.0-dev \
 zlib1g-dev ninja-build
```

#### 1. Download and Extract QEMU

```bash
wget https://download.qemu.org/qemu-7.0.0.tar.xz
tar -xvf qemu-${QEMU_VERSION}.tar.xz
```

#### 2. Conditionally Compile and Install QEMU

Here we only compile QEMU for emulating aarch64, if you need QEMU for other architectures, refer to [QEMU Official Documentation](https://wiki.qemu.org/Hosts/Linux).
```bash
cd qemu-7.0.0 && \
./configure --target-list=aarch64-softmmu,aarch64-linux-user && \
make -j$(nproc) && \
make install
```

#### 3. Test if QEMU is Successfully Installed

```bash
qemu-system-aarch64 --version
```

### Start Root Linux

#### 1. Prepare Root File System and Kernel Image

Place the image file in ```hvisor/images/aarch64/kernel/```, named ```Image```.

Place the Root file system in ```hvisor/images/aarch64/virtdisk/```, named ```rootfs1.ext4```.

#### 2. Start QEMU
Execute the following command in the hviosr directory:
```bash
make run
```

#### 3. Enter QEMU

It will automatically load uboot, wait for uboot to finish loading, then enter ```bootm 0x40400000 - 0x40000000``` to enter Root Linux.