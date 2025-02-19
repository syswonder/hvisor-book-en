# Hypercall Description

As a Hypervisor, hvisor provides a hypercall processing mechanism to the upper layer virtual machines.

## How Virtual Machines Execute Hypercall

Virtual machines execute a specified assembly instruction, which is `hvc` on Arm64 and `ecall` on riscv64. When executing the assembly instruction, the parameters passed are:

* code: hypercall id, its range and meaning are detailed in hvisor's handling of hypercalls
* arg0: the first parameter passed by the virtual machine, type is u64
* arg1: the second parameter passed by the virtual machine, type is u64

For example, for riscv linux:

```c
#ifdef RISCV64

// according to the riscv sbi spec
// SBI return has the following format:
// struct sbiret
//  {
//  long error;
//  long value;
// };

// a0: error, a1: value
static inline __u64 hvisor_call(__u64 code,__u64 arg0, __u64 arg1) {
	register __u64 a0 asm("a0") = code;
	register __u64 a1 asm("a1") = arg0;
	register __u64 a2 asm("a2") = arg1;
	register __u64 a7 asm("a7") = 0x114514;
	asm volatile ("ecall"
	        : "+r" (a0), "+r" (a1)
			: "r" (a2), "r" (a7)
			: "memory");
	return a1;
}
#endif
```

For arm64 linux:

```c
#ifdef ARM64
static inline __u64 hvisor_call(__u64 code, __u64 arg0, __u64 arg1) {
	register __u64 x0 asm("x0") = code;
	register __u64 x1 asm("x1") = arg0;
	register __u64 x2 asm("x2") = arg1;

	asm volatile ("hvc #0x4856"
	        : "+r" (x0)
			: "r" (x1), "r" (x2)
			: "memory");
	return x0;
}
#endif /* ARM64 */
```

## hvisor's Handling of Hypercall

After the virtual machine executes a hypercall, the CPU enters the exception handling function specified by hvisor: `hypercall`. Then hvisor continues to call different processing functions based on the hypercall parameters `code`, `arg0`, `arg1`, which are:

| code | Function Called       | Parameter Description                                      | Function Summary                               |
| ---- | -------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| 0    | hv_virtio_init       | arg0: start address of shared memory                       | Used for root zone to initialize virtio mechanism |
| 1    | hv_virtio_inject_irq | None                                                       | Used for root zone to send virtio device interrupts to other virtual machines |
| 2    | hv_zone_start        | arg0: virtual machine configuration file address; arg1: configuration file size | Used for root zone to start a virtual machine |
| 3    | hv_zone_shutdown     | arg0: id of the virtual machine to be shut down            | Used for root zone to shut down a virtual machine |
| 4    | hv_zone_list         | arg0: address of data structure representing virtual machine information; arg1: number of virtual machine information | Used for root zone to view information of all virtual machines in the system |
| 5    | hv_ivc_info          | arg0: start address of ivc information                     | Used for a zone to view its own communication domain information |