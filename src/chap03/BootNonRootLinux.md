# How to Start NonRoot Linux

Hvisor has properly handled the startup of NonRoot, making it relatively simple, as follows:

1. Prepare the kernel image, device tree, and file system for NonRoot Linux. Place the kernel and device tree in the file system of Root Linux.

2. Specify the serial port used by this NonRoot Linux and the file system to be mounted in the device tree file for NonRoot Linux, as shown in the example below:

```
	chosen {
		bootargs = "clk_ignore_unused console=ttymxc3,115200 earlycon=ec_imx6q3,0x30a60000,115200 root=/dev/mmcblk3p2 rootwait rw";
		stdout-path = "/soc@0/bus@30800000/serial@30a60000";
	};
```

3. Compile the [kernel module and command line tools](https://github.com/syswonder/hvisor-tool?tab=readme-ov-file) for Hvisor and place them in the file system of Root Linux.

4. Start Hvisor's Root Linux and inject the kernel module that was just compiled:

```
insmod hvisor.ko
```

5. Use the command line tool, here assumed to be named ```hvisor```, to start NonRoot Linux.

```
./hvisor zone start --kernel kernel image,addr=0x70000000 --dtb device tree file,addr=0x91000000 --id virtual machine number (starting from 1)
```

6. After NonRoot Linux has started, open the specified serial port to use it.