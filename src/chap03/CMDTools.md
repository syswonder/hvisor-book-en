# Command Line Tools

Command line tools are management tools affiliated with hvisor, used to create and close other virtual machines on the management virtual machine Root Linux, and are responsible for starting the Virtio daemon, providing Virtio device emulation. The repository address is located at [hvisor-tool](https://github.com/syswonder/hvisor-tool).

## How to Compile

The command line tool currently supports two architectures: arm64 and riscv, and requires a kernel module to be used. Cross-compilation on an x86 host can be used to compile for different architectures.

* arm64 compilation

Execute the following command in the hvisor-tool directory to obtain the command line tool hvisor and kernel module hvisorl.ko for the arm64 architecture.

```
make all ARCH=arm64 KDIR=xxx
```

Where KDIR is the source path of Root Linux, used for the compilation of the kernel module.

* riscv compilation

Compile the command line tool and kernel module for the riscv architecture:

```
make all ARCH=riscv KDIR=xxx
```

## Managing Virtual Machines

### Loading the Kernel Module

Before using the command line tool, you need to load the kernel module to facilitate interaction between the user-mode program and Hypervisor:

```
insmod hvisor.ko
```

The operation to unload the kernel module is:

```
rmmod hvisor.ko
```

Where hvisor.ko is located in the hvisor-tool/driver directory.

### Starting a Virtual Machine

On Root Linux, you can create a virtual machine with id 1 using the following command. This command will load the virtual machine's operating system image file `Image` into the real physical address `xxxa`, load the virtual machine's device tree file `linux2.dtb` into the real physical address `xxxb`, and start it.

```
./hvisor zone start --kernel Image,addr=xxxa --dtb linux2.dtb,addr=xxxb --id 1
```

### Shutting Down a Virtual Machine

Shut down the virtual machine with id 1:

```
./hvisor zone shutdown -id 1
```