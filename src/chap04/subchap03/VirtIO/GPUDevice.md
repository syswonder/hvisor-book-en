# Virtio GPU

To use the Virtio GPU device in hvisor-tool, you need to first install libdrm on the host and perform some related configurations.

## Prerequisites

* Install libdrm

We need to install libdrm to compile Virtio-gpu, assuming the target platform is **arm64**.

```shell
wget https://dri.freedesktop.org/libdrm/libdrm-2.4.100.tar.gz
tar -xzvf libdrm-2.4.100.tar.gz
cd libdrm-2.4.100
```

Tips: libdrm versions above 2.4.100 require compilation with tools like meson, which can be complicated. More versions are available at https://dri.freedesktop.org/libdrm.

```shell
# Install to your aarch64-linux-gnu compiler
./configure --host=aarch64-linux-gnu --prefix=/usr/aarch64-linux-gnu && make && make install
```

For loongarch64, use:

```shell
./configure --host=loongarch64-unknown-linux-gnu --disable-nouveau --disable-intel --prefix=/opt/libdrm-install && make && sudo make install
```

* Configure the Linux kernel

The Linux kernel needs to support virtio-gpu and drm related drivers. Specifically, the following options need to be enabled when compiling the kernel:

```
CONFIG_DRM=y
CONFIG_DRM_VIRTIO_GPU=y
```

Other GPU-related drivers may not be compiled into the kernel. You need to compile according to the specific device, and you can use menuconfig during compilation. Specifically, go to `Device Drivers` -> `Graphics support` -> `Direct Rendering Infrastructure(DRM)`. Under `Graphics support`, there are also drivers supporting virtio-gpu. If needed, enable the compilation of related fields such as `Virtio GPU driver` and `DRM Support for bochs dispi vga interface`.

At the bottom of the `Graphics support` entry, there is `Bootup logo`. Enabling this option will display the Linux logo representing the number of CPU cores on the screen at startup.

* Detect physical GPU devices in Root Linux

To detect physical GPU devices in `Root Linux`, you need to edit files in the `hvisor/src/platform` directory to detect GPU devices on the PCI bus. You need to add the interrupt number of the Virtio-gpu device to `ROOT_ZONE_IRQS`. For example:

```
pub const ROOT_PCI_DEVS: [u64; 3] = [0, 1 << 3, 6 << 3];
```

After starting `Root Linux`, you can check if your GPU device is working properly by running `dmesg | grep drm` or `lspci`. If files like card0 and renderD128 appear under /dev/dri, it means the graphics device is successfully recognized and can be controlled by drm.

* Check if the real GPU device is supported

If you want to port Virtio-GPU to other platforms, you need to ensure that the physical GPU device on that platform is supported by the drm framework. To see the devices supported by libdrm, you can install the `libdrm-tests` package using the command `apt install libdrm-tests`, and then run `modetest`.

* qemu startup parameters

If hvisor runs in a qemu aarch64 environment, qemu needs to provide a GPU device to root linux. Add the following to the qemu startup parameters:

```
QEMU_ARGS += -device virtio-gpu,addr=06,iommu_platform=on
QEMU_ARGS += -display sdl
```

Also, ensure that the startup parameters include smmu configuration:

```
-machine virt,secure=on,gic-version=3,virtualization=on,iommu=smmuv3
-global arm-smmuv3.stage=2
```