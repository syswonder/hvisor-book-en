# Using VirtIO Devices

Currently, hvisor supports three types of Virtio devices: Virtio block, Virtio net, and Virtio Console, which are presented to virtual machines other than Root Linux via MMIO. The Virtio device source code repository is located at [hvisor-tool](https://github.com/syswonder/hvisor-tool), compiled and used together with the command-line tool. After creating a Virtio device through the command-line tool, the Virtio device becomes a daemon on Root Linux, and its log information is output to the nohup.out file.

## Creating and Starting Virtio Devices

Before creating a Virtio device through the command line, execute `insmod hvisor.ko` to load the kernel module.

### Virtio blk Device

Execute the following example command on the Root Linux console to create a Virtio blk device:

```shell
nohup ./hvisor virtio start \
	--device blk,addr=0xa003c00,len=0x200,irq=78,zone_id=1,img=rootfs2.ext4 &
```

`--device blk` indicates creating a Virtio disk device for use by the virtual machine with id `zone_id`. The virtual machine will interact with the device through an MMIO region, starting at address `addr`, with length `len`, device interrupt number `irq`, and corresponding disk image path `img`.

> Virtual machines using Virtio devices need to add information about the Virtio mmio node in the device tree.

### Virtio net Device

#### Creating Network Topology

Before using a Virtio net device, a network topology needs to be created in Root Linux to connect the Virtio net device with the real network card through a Tap device and bridge device. Execute the following commands in Root Linux:

```shell
mount -t proc proc /proc
mount -t sysfs sysfs /sys
ip link set eth0 up
dhclient eth0
brctl addbr br0
brctl addif br0 eth0
ifconfig eth0 0
dhclient br0
ip tuntap add dev tap0 mode tap
brctl addif br0 tap0
ip link set dev tap0 up
```

This creates a `tap0 device<-->bridge device<-->real network card` network topology.

#### Starting Virtio net

Execute the following example command on the Root Linux console to create a Virtio net device:

```shell
nohup ./hvisor virtio start \
	--device net,addr=0xa003600,len=0x200,irq=75,zone_id=1,tap=tap0 &
```

`--device net` indicates creating a Virtio network device for use by the virtual machine with id `zone_id`. The virtual machine will interact with the device through an MMIO region, starting at address `addr`, with length `len`, device interrupt number `irq`, and connected to a Tap device named `tap`.

### Virtio Console Device

Execute the following example command on the Root Linux console to create a Virtio console device:

```shell
nohup ./hvisor virtio start \
	--device console,addr=0xa003800,len=0x200,irq=76,zone_id=1 &
```

`--device console` indicates creating a Virtio console for use by the virtual machine with id `zone_id`. The virtual machine will interact with the device through an MMIO region, starting at address `addr`, with length `len`, device interrupt number `irq`.

Execute `cat nohup.out | grep "char device"`, and you will see the output `char device redirected to /dev/pts/xx`. On Root Linux, execute:

```
screen /dev/pts/xx
```

to enter the virtual console and interact with the virtual machine. Press the shortcut key `Ctrl +a d` to return to the Root Linux terminal. Execute `screen -r [session_id]` to re-enter the virtual console.

### Creating Multiple Virtio Devices

Execute the following command to simultaneously create Virtio blk, net, and console devices, all within one daemon process.

```shell
nohup ./hvisor virtio start \
	--device blk,addr=0xa003c00,len=0x200,irq=78,zone_id=1,img=rootfs2.ext4 \
	--device net,addr=0xa003600,len=0x200,irq=75,zone_id=1,tap=tap0 \
	--device console,addr=0xa003800,len=0x200,irq=76,zone_id=1 &
```

## Closing Virtio Devices

Execute the following command to close the Virtio daemon and all created devices:

```
pkill hvisor
```