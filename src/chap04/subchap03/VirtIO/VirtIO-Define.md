# Virtio

## Introduction to Virtio

Virtio was proposed by Rusty Russell in 2008 and is a device virtualization standard aimed at improving device performance and unifying various paravirtual device schemes. Currently, Virtio includes over a dozen peripherals such as disks, network cards, consoles, GPUs, etc., and many operating systems including Linux have implemented frontend drivers for various Virtio devices. Therefore, the virtual machine monitor only needs to implement the Virtio backend device, and it can directly allow virtual machines that have implemented Virtio drivers, such as Linux, to use Virtio devices.

The Virtio protocol defines a set of driver interfaces for paravirtual IO devices, stipulating that the operating system of the virtual machine needs to implement the frontend driver, and the Hypervisor needs to implement the backend device. The virtual machine and Hypervisor communicate and interact through the data plane interface and control plane interface.

### Data Plane Interface

The data plane interface refers to the method of IO data transfer between the driver and the device. For Virtio, the data plane interface refers to a shared memory area between the driver and the device called Virtqueue. Virtqueue is an important data structure in the Virtio protocol and is the mechanism and abstract representation for batch data transfer of Virtio devices, used for various data transfer operations between the driver and the device. Virtqueue consists of three main components: descriptor table, available ring, and used ring, which serve the following purposes:

1. Descriptor Table: An array of descriptors. Each descriptor contains 4 fields: addr, len, flag, next. Descriptors can represent the address (addr), size (len), and properties (flag) of a memory buffer. The memory buffer can contain commands or data of IO requests (filled by the Virtio driver) or the results of completed IO requests (filled by the Virtio device). Descriptors can be linked into a descriptor chain using the next field as needed, where a descriptor chain represents a complete IO request or result.

2. Available Ring: A circular queue, each element in the queue represents the index of an IO request issued by the Virtio driver in the descriptor table, pointing to the starting descriptor of a descriptor chain.
3. Used Ring: A circular queue, each element in the queue represents the index in the descriptor table where the IO result written by the Virtio device after completing the IO request is located.

Using these three data structures, the commands, data, and results of IO data transfer requests between the driver and the device can be completely described. The Virtio driver program is responsible for allocating the memory area where the Virtqueue is located and writing its address into the corresponding MMIO control registers to inform the Virtio device. After the device obtains the addresses of the three, it can perform IO transfer with the driver through the Virtqueue.

### Control Plane Interface

The control plane interface refers to the way the driver discovers, configures, and manages the device. In the Hypervisor, the control plane interface of Virtio mainly refers to the MMIO registers based on memory mapping. The operating system first detects MMIO-based Virtio devices through the device tree and can negotiate, configure, and notify the device by reading and writing these memory-mapped control registers. Some of the more important registers include:

* QueueSel: Used to select the current operating Virtqueue. A device may contain multiple Virtqueues, and the driver indicates which queue it is operating by writing this register.

* QueueDescLow, QueueDescHigh: Used to indicate the intermediate physical address IPA of the descriptor table. The driver writes these two 32-bit registers to inform the device of the 64-bit physical address of the descriptor table, used to establish shared memory.

* QueueDriverLow, QueueDriverHigh: Used to indicate the intermediate physical address IPA of the available ring.

* QueueDeviceLow, QueueDeviceHigh: Used to indicate the intermediate physical address IPA of the used ring.

* QueueNotify: When the driver writes this register, it indicates that there are new IO requests in the Virtqueue that need to be processed.

In addition to the control registers, each device's MMIO memory area also includes a device configuration space. For disk devices, the configuration space indicates the disk's capacity and block size; for network devices, the configuration space indicates the device's MAC address and connection status. For console devices, the configuration space provides console size information.

For the MMIO memory area where the Virtio device is located, the Hypervisor does not map the second-stage address translation for the virtual machine. When the driver reads and writes this area, a page fault exception will occur, causing a VM Exit into the Hypervisor. The Hypervisor can determine the accessed register based on the address causing the page fault exception and take appropriate actions, such as notifying the device to perform IO operations. After processing, the Hypervisor returns to the virtual machine through VM Entry.

### IO Process of Virtio Devices

The process from when a user process running on a virtual machine initiates an IO operation to when it obtains the IO result can generally be divided into the following four steps:

1. The user process initiates an IO operation, and the Virtio driver program in the operating system kernel receives the IO operation command, writes it into the Virtqueue, and writes to the QueueNotify register to notify the Virtio device.
2. After receiving the notification, the device parses the available ring and descriptor table, obtains the specific IO request and buffer address, and performs the actual IO operation.
3. After completing the IO operation, the device writes the result into the used ring. If the driver program uses the polling method to wait for the IO result, the driver can immediately receive the result information; otherwise, it needs to notify the driver program through an interrupt.
4. The driver program obtains the IO result from the used ring and returns it to the user process.

## Design and Implementation of the Virtio Backend Mechanism

The Virtio devices in hvisor follow the [Virtio v1.2](https://docs.oasis-open.org/virtio/virtio/v1.2/virtio-v1.2.pdf) protocol for design and implementation. To maintain good device performance while ensuring the lightweight nature of hvisor, the two design points of the Virtio backend are:

1. Adopting a microkernel design philosophy, moving the implementation of Virtio devices from the Hypervisor layer to the user space of the management virtual machine. The management virtual machine runs the Linux operating system, referred to as Root Linux. Physical devices such as disks and network cards are passed through to Root Linux, while Virtio devices act as daemons on Root Linux, providing device emulation for other virtual machines (Non Root Linux). This ensures the lightweight nature of the Hypervisor layer and facilitates formal verification.

2. The Virtio drivers located on other virtual machines and the Virtio devices located on Root Linux interact directly through shared memory. The shared memory area, which stores interaction information, is called the communication trampoline and adopts a producer-consumer model, shared by the Virtio device backend and Hypervisor. This reduces the interaction overhead between the driver and the device, enhancing the device's performance.

Based on the above two design points, the implementation of the Virtio backend device will be divided into three parts: communication trampoline, Virtio daemon, and kernel service module:

### Communication Trampoline

To achieve efficient interaction between drivers and devices distributed across different virtual machines, this paper designs a communication trampoline as a bridge for passing control plane interaction information between the driver and the device. It is essentially a shared memory area containing two circular queues: the request submission queue and the request result queue, which store interaction requests issued by the driver and results returned by the device, respectively. Both queues are located in the memory area shared by the Hypervisor and the Virtio daemon and adopt a producer-consumer model. The Hypervisor acts as the producer of the request submission queue and the consumer of the request result queue, while the Virtio daemon acts as the consumer of the request submission queue and the producer of the request result queue. This facilitates the passing of Virtio control plane interaction information between Root Linux and other virtual machines. It is important to note that the request submission queue and the request result queue are different from the Virtqueue. The Virtqueue is the data plane interface between the driver and the device, used for data transfer and essentially containing information about the data buffer's address and structure. In contrast, the communication trampoline is used for control plane interactions and communication between the driver and the device.

* Communication Trampoline Structure

The communication trampoline is represented by the virtio_bridge structure, where req_list is the request submission queue, and res_list and cfg_values together form the request result queue. The device_req structure represents interaction requests sent by the driver to the device, and the device_res structure represents interrupt information injected by the device to notify the virtual machine driver that the IO operation has been completed.

```c
// Communication trampoline structure:
struct virtio_bridge {
	__u32 req_front;
	__u32 req_rear;
    __u32 res_front;
    __u32 res_rear;
    // Request submission queue
	struct device_req req_list[MAX_REQ]; 
    // res_list, cfg_flags, and cfg_values together form the request result queue
    struct device_res res_list[MAX_REQ];
	__u64 cfg_flags[MAX_CPUS]; 
	__u64 cfg_values[MAX_CPUS];
	__u64 mmio_addrs[MAX_DEVS];
	__u8 mmio_avail;
	__u8 need_wakeup;
};
// Interaction requests sent by the driver to the device
struct device_req {
	__u64 src_cpu;
	__u64 address; // zone's ipa
	__u64 size;
	__u64 value;
	__u32 src_zone;
	__u8 is_write;
	__u8 need_interrupt;
	__u16 padding;
};
// Interrupt information injected by