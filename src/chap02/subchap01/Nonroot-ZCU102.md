## ZCU102 NonRoot Boot
Ren Hangqi (2572131118@qq.com)
1. Use the Linux kernel source code used during the Root boot to compile [hvisor-tool](https://github.com/syswonder/hvisor-tool), the detailed compilation process can refer to [Readme](https://github.com/syswonder/hvisor-tool/blob/main/README-zh.md).
2. Prepare the `virtio_cfg.json` and `zone1_linux.json` needed to boot NonRoot, you can directly use the `example/zcu102-aarch64` under the hvisor-tool directory, the content has been verified to ensure it can boot.
3. Prepare the Linux kernel Image, filesystem rootfs, and device tree linux1.dtb required for NonRoot. The kernel and filesystem can be the same as Root, Linux1.dtb is configured as needed, you can also use `images/aarch64/devicetree/zcu102-nonroot-aarch64.dts` under the hvisor directory.
4. Copy `hvisor.ko, hvisor, virtio_cfg, zone1_linux.json, linux1.dtb, Image, rootfs.ext4` to the filesystem used by Root Linux.
5. Enter the following commands in RootLinux to start NonRoot:
```
# Load the kernel module
insmod hvisor.ko
# Create virtio device
nohup ./hvisor virtio start virtio_cfg.json &
# Start NonRoot according to the json configuration file
./hvisor zone start zone1_linux.json 
# View the output of NonRoot and interact.
screen /dev/pts/0
```
For more operational details refer to [hvisor-tool Readme](https://github.com/syswonder/hvisor-tool/blob/main/README-zh.md)