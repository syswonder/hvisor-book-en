# Command Line Tool

The command line tool is a management tool affiliated with hvisor, used to create and shut down other virtual machines on the Root Linux of the virtual machine manager, and is responsible for starting the Virtio daemon to provide Virtio device emulation. The repository is located at [hvisor-tool](https://github.com/syswonder/hvisor-tool).

## How to Compile

The command line tool currently supports two architectures: arm64 and riscv, and needs to be used in conjunction with a kernel module. Cross-compilation on an x86 host can be done for different architectures.

* arm64 compilation

Execute the following command in the hvisor-tool directory to obtain the command line tool hvisor and kernel module hvisorl.ko for the arm64 architecture.

```
make all ARCH=arm64 KDIR=xxx
```

Where KDIR is the Root Linux source path, used for compiling the kernel module.

* riscv compilation

Compile the command line tool and kernel module for the riscv architecture:

```
make all ARCH=riscv KDIR=xxx
```

## Managing Virtual Machines

### Load the Kernel Module

Before using the command line tool, you need to load the kernel module to facilitate user-space programs to interact with Hypervisor:

```
insmod hvisor.ko
```

The operation to unload the kernel module is:

```
rmmod hvisor.ko
```

Where hvisor.ko is located in the hvisor-tool/driver directory.

### Start a Virtual Machine

On Root Linux, you can create a virtual machine with id 1 by the following command. This command will load the virtual machine's operating system image file `Image` to the real physical address `xxxa`, load the virtual machine's device tree file `linux2.dtb` to the real physical address `xxxb`, and start it.

```
./hvisor zone start --kernel Image,addr=xxxa --dtb linux2.dtb,addr=xxxb --id 1
```

### Shut Down a Virtual Machine

Shut down the virtual machine with id 1:

```
./hvisor zone shutdown -id 1
```