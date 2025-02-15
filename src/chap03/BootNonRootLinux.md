# How to Boot NonRoot Linux

Hvisor has properly handled the booting of NonRoot, making it relatively simple to do so, as follows:

1. Prepare the kernel image, device tree, and file system for NonRoot Linux. Place the kernel and device tree in the file system of Root Linux.

2. Specify the serial port and file system to be mounted for NonRoot Linux in the device tree file, as shown below:

```
	chosen {
		bootargs = "clk_ignore_unused console=ttymxc3,115200 earlycon=ec_imx6q3,0x30a60000,115200 root=/dev/mmcblk3p2 rootwait rw";
		stdout-path = "/soc@0/bus@30800000/serial@30a60000";
	};
```

3. Compile the [kernel module and command line tool](https://github.com/syswonder/hvisor-tool?tab=readme-ov-file) for Hvisor and place it in the file system of Root Linux.

4. Boot Hvisor's Root Linux and inject the kernel module that was just compiled:

```
insmod hvisor.ko
```

5. Use the command line tool, here assumed to be named ```hvisor```, to boot NonRoot Linux.

```
./hvisor zone start --kernel kernel image,addr=0x70000000 --dtb device tree file,addr=0x91000000 --id virtual machine number (starting from 1)
```

6. Once NonRoot Linux has booted, open the specified serial port to use it.