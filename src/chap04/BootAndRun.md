# Initialization process of hvisor

Abstract: Introduces the relevant knowledge involved in running hvisor on qemu and the initialization process of hvisor. Starting from the start of qemu, track the entire process, and you will have a general understanding of the initialization process of hvisor after reading this article.

## qemu startup process

The startup process of the computer simulated by qemu: After the necessary files are loaded into memory, the PC register is initialized to 0x1000, and a few instructions are executed from here before jumping to 0x80000000 to start executing the bootloader (hvsior arm part uses Uboot), after executing a few instructions, it jumps to the starting address of the kernel that uboot can recognize and executes.

### Generate the executable file of hvisor

```
rust-objcopy --binary-architecture=aarch64 target/aarch64-unknown-none/debug/hvisor --strip-all -O binary target/aarch64-unknown-none/debug/hvisor.bin.tmp
```

Convert the executable file of hvisor into logical binary and save it as `hvisor.bin.tmp`.

### Generate an image file that uboot can recognize

uboot is a bootloader, its main task is to jump to the first instruction of the hvisor image to start execution, so it is necessary to ensure that the generated hvisor image is recognizable by uboot, here you need to use the `mkimage` tool.

```
mkimage -n hvisor_img -A arm64 -O linux -C none -T kernel -a 0x40400000 -e 0x40400000 -d target/aarch64-unknown-none/debug/hvisor.bin.tmp target/aarch64-unknown-none/debug/hvisor.bin
```

* `-n hvisor_img`: Specify the name of the kernel image.
* `-A arm64`: Specify the architecture as ARM64.
* `-O linux`: Specify the operating system as Linux.
* `-C none`: Do not use compression algorithms.
* `-T kernel`: Specify the type as kernel.
* `-a 0x40400000`: Specify the loading address as `0x40400000`.
* `-e 0x40400000`: Specify the entry address as `0x40400000`.
* `-d target/aarch64-unknown-none/debug/hvisor.bin.tmp`: Specify the input file as the previously generated temporary binary file.
* The last parameter is the generated output file name, which is the final kernel image file `hvisor.bin`.

## Initialization process

### aarch64.ld link script

To understand how hvisor executes, we first look at the link script `aarch64.ld`, which gives us a general understanding of the execution process of hvisor.

```
ENTRY(arch_entry)
BASE_ADDRESS = 0x40400000;
```

The first line sets the program entry `arch_entry`, which can be found in `arch/aarch64/entry.rs`, introduced later.

```
.text : {
        *(.text.entry)
        *(.text .text.*)
    }
```

We make the `.text` section the very beginning section, and put the `.text.entry` containing the first entry instruction at the beginning of the `.text` section, ensuring that hvisor indeed starts executing from the 0x40400000 location agreed with qemu.

Here we also need to remember something called `__core_end`, which is the address of the end position of the link script, which can be known during the startup process.

### arch_entry

With the above prerequisites, we can step into the first instruction of hvisor, which is `arch_entry()`.

```
// src/arch/aarch64/entry.rs

pub unsafe extern "C" fn arch_entry() -> i32 {
    unsafe {
        core::arch::asm!(
            "
            // x0 = dtbaddr
            mov x1, x0
            mrs x0, mpidr_el1
            and x0, x0, #0xff
            ldr x2, =__core_end          // x2 = &__core_end
            mov x3, {per_cpu_size}      // x3 = per_cpu_size
            madd x4, x0, x3, x3       // x4 = cpuid * per_cpu_size + per_cpu_size
            add x5, x2, x4
            mov sp, x5           // sp = &__core_end + (cpuid + 1) * per_cpu_size
            b {rust_main}             // x0 = cpuid, x1 = dtbaddr
            ",
            options(noreturn),
            per_cpu_size=const PER_CPU_SIZE,
            rust_main = sym crate::rust_main,
        );
    }
}
```

First, look at the embedded assembly part. The first instruction `mov x1,x0`, passes the value of the `x0` register into the `x1` register, where x0 contains the address of the device tree. qemu simulates an arm architecture computer, which also has various devices such as input/output devices like mice and displays, as well as various storage devices. When we want to get input from the keyboard and output to the display, we need to get input from somewhere or put the output data somewhere. In the computer, we use specific addresses to access these devices. The device tree saves the access addresses of these devices. As the supervisor of all software, the hypervisor naturally needs to know the information of the device tree, so Uboot will put this information in `x0` before entering the kernel, which is a convention.

`mrs x0, mpidr_el1` is an instruction to access system-level registers, that is, to send the contents of the system register `mpidr_el1` to `x0`, and `mpidr_el1` contains information about which CPU we are currently dealing with (the computer supports multi-core CPUs), and there are many cooperations with the CPU later, so we need to know which CPU is currently in use. This register contains a lot of information about the CPU, and what we currently need is the lower 8 bits, which extract the corresponding CPU id, which is what the sentence `and x0, x0, #0xff` is doing.

`ldr x2, = __core_end`, we set a symbol `__core_end` at the end of the link script, as the end address of the entire hvisor program space, and put this address into `x2`.

`mov x3,{per_cpu_size}` puts the size of each CPU's stack into `x3`, this `{xxx}` is to replace the value of `xxx` with the assembly code, you can see below `per_cpu_size=const PER_CPU_SIZE` The external variable is renamed as a parameter. Another parameter with `sym` indicates that what follows is a symbol defined elsewhere.

`per_cpu_size` In this size space, related registers can be saved and restored, including the CPU's stack space.

`madd x4, x0, x3, x3` is a multiply-add instruction, cpu_id * per_cpu_size + per_cpu_size, the result is put into `x4`, at this time `x4` contains how much space the current number of CPUs needs. (The sequence starts from 0, so add per_cpu_size one more time).

`add x5,x2,x4` means to add the end address of hvisor to the total space required by the CPU and put it into `x5`.

`mov sp,x5` is to find the top of the current CPU's stack.

`b {rust_main}` means to jump to `rust_main` to start execution, which also indicates that this piece of assembly code will not return, corresponding to `option(noreturn)`.

## Enter rust_main()

### fn rust_main(cpuid:usize, host_dtb:usize)

Entering `rust_main` requires two parameters, which are passed through `x0` and `x1`. Remember that in the previous entry, our `x0` stored the cpu_id and `x1` stored the device tree related information.

### install_trap_vector()

When the processor encounters an exception or interrupt, it needs to jump to the corresponding location for processing. Here, these corresponding jump addresses are set (can be regarded as setting a table) for handling exceptions at the Hypervisor level. Each privilege level has its own corresponding exception vector table, except for EL0, the application privilege level, which must jump to other privilege levels to handle exceptions. The `VBAR_ELn` register is used to store the base address of the exception vector table under the ELn privilege level.

```
extern "C" {
    fn _hyp_trap_vector();
}

pub fn install_trap_vector() {
    // Set the trap vector.
    VBAR_EL2.set(_hyp_trap_vector as _)
}

```

`VBAR_EL2.set()` sets the address of `_hyp_trap_vector()` as the base address of the exception vector table for EL2 privilege level.

`_hyp_trap_vector()` This assembly code is constructing the exception vector table.

**Simple introduction to the format of the exception vector table**

According to the level of the exception and whether the level of handling the exception is the same, it is divided into two categories. If the level remains unchanged, it is divided into two groups according to whether the current level's SP is used. If the exception level changes, it is divided into two groups according to whether the execution mode is 64-bit/32-bit. At this point, the exception vector table is divided into 4 groups. In each group, each table entry represents an entry for handling a certain type of exception.

### Main CPU

```
static MASTER_CPU: AtomicI32 = AtomicI32::new(-1);

let mut is_primary = false;
    if