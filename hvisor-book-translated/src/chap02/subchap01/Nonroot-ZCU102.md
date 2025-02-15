## ZCU102 NonRoot Boot
1. Compile [hvisor-tool](https://github.com/syswonder/hvisor-tool) using the Linux kernel source code used during the Root boot. The detailed compilation process can be referred to in [Readme](https://github.com/syswonder/hvisor-tool/blob/main/README-zh.md).
2. Prepare the required `virtio_cfg.json` and `zone1_linux.json` for NonRoot boot. You can directly use the `example/zcu102-aarch64` in the hvisor-tool directory, which has been verified to ensure it can boot.
3. Prepare the Linux kernel Image, filesystem rootfs, and device tree linux1.dtb needed for NonRoot. The kernel and filesystem can be the same as Root, while Linux1.dtb should be configured as needed, or you can use `images/aarch64/devicetree/zcu102-nonroot-aarch64.dts` from the hvisor directory.
4. Copy `hvisor.ko, hvisor, virtio_cfg, zone1_linux.json, linux1.dtb, Image, rootfs.ext4` to the filesystem used by Root Linux.
5. Enter the following commands in RootLinux to start NonRoot:
```
# Load kernel module
insmod hvisor.ko
# Create virtio device
nohup ./hvisor virtio start virtio_cfg.json &
# Start NonRoot based on the json configuration file
./hvisor zone start zone1_linux.json
# View the output of NonRoot and interact.
screen /dev/pts/0
```
For more operation details, refer to [hvisor-tool Readme](https://github.com/syswonder/hvisor-tool/blob/main/README-zh.md)