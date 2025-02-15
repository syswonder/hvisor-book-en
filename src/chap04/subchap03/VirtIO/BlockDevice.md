# Virtio Block

The implementation of Virtio disk devices follows the Virtio specification, using MMIO device access method for other virtual machines to discover and use. Currently, it supports five features: `VIRTIO_BLK_F_SEG_MAX`, `VIRTIO_BLK_F_SIZE_MAX`, `VIRTIO_F_VERSION_1`, `VIRTIO_RING_F_INDIRECT_DESC`, and `VIRTIO_RING_F_EVENT_IDX`.

## Top-level description of Virtio device - VirtIODevice

A Virtio device is represented by the VirtIODevice structure, which contains the device ID, the number of Virtqueues vqs_len, the virtual machine ID it belongs to, the device interrupt number irq_id, the starting address of the MMIO area base_addr, the length of the MMIO area len, the device type, some MMIO registers saved by the device regs, an array of Virtqueues vqs, and a pointer dev pointing to specific device information. With this information, a Virtio device can be fully described.

```c
// The highest representations of virtio device
struct VirtIODevice
{
    uint32_t id;
    uint32_t vqs_len;
    uint32_t zone_id;
    uint32_t irq_id;
    uint64_t base_addr; // the virtio device's base addr in non root zone's memory
    uint64_t len;       // mmio region's length
    VirtioDeviceType type;
    VirtMmioRegs regs;
    VirtQueue *vqs;
    // according to device type, blk is BlkDev, net is NetDev, console is ConsoleDev.
    void *dev;          
    bool activated;
};

typedef struct VirtMmioRegs {
    uint32_t device_id;
    uint32_t dev_feature_sel;
    uint32_t drv_feature_sel;
    uint32_t queue_sel;
    uint32_t interrupt_status;
    uint32_t interrupt_ack;
    uint32_t status;
    uint32_t generation;
    uint64_t dev_feature;
    uint64_t drv_feature;
} VirtMmioRegs;
```

## Description of Virtio Block device

For Virtio disk devices, the type field in VirtIODevice is VirtioTBlock, vqs_len is 1, indicating that there is only one Virtqueue, and the dev pointer points to the virtio_blk_dev structure describing specific information about the disk device. virtio_blk_dev's config represents the device's data capacity and the maximum amount of data in a single data transfer, img_fd is the file descriptor of the disk image opened by the device, tid, mtx, cond are used for the worker thread, procq is the work queue, and closing indicates when the worker thread should close. The definitions of virtio_blk_dev and blkp_req structures are shown in Figure 4.6.

```c
typedef struct virtio_blk_dev {
    BlkConfig config;
    int img_fd;
	// describe the worker thread that executes read, write and ioctl.
	pthread_t tid;
	pthread_mutex_t mtx;
	pthread_cond_t cond;
	TAILQ_HEAD(, blkp_req) procq;
	int close;
} BlkDev;

// A request needed to process by blk thread.
struct blkp_req {
	TAILQ_ENTRY(blkp_req) link;
    struct iovec *iov;
	int iovcnt;
	uint64_t offset;
	uint32_t type;
	uint16_t idx;
};
```

## Virtio Block device worker thread

Each Virtio disk device has a worker thread and a work queue. The thread ID of the worker thread is saved in the tid field of virtio_blk_dev, and the work queue is procq. The worker thread is responsible for data IO operations and calling the interrupt injection system interface. It is created after the Virtio disk device is started and continuously checks whether there are new tasks in the work queue. If the queue is empty, it waits for the condition variable cond; otherwise, it processes tasks.

When the driver writes to the QueueNotify register in the MMIO area of the disk device, it indicates that there are new IO requests in the available ring. After receiving this request, the Virtio disk device (located in the main thread's execution flow) first reads the available ring to get the first descriptor in the descriptor chain. The first descriptor points to a memory buffer that contains the type of IO request (read/write) and the sector number to be read or written. Subsequent descriptors point to data buffers; for read operations, the read data is stored in these data buffers, and for write operations, the data to be written is obtained from these data buffers. The last descriptor's memory buffer (result buffer) is used to describe the completion result of the IO request, with options including success (OK), failure (IOERR), and unsupported operation (UNSUPP). Based on this, the entire descriptor chain can be parsed to obtain all information about the IO request and save it in the blkp_req structure. The fields in this structure, iov, represent all data buffers, offset represents the data offset of the IO operation, type represents the type of IO operation (read/write), and idx is the index of the first descriptor in the descriptor chain, used to update the used ring. Subsequently, the device adds blkp_req to the work queue procq and wakes up the worker thread blocked on the condition variable cond through the signal function. The worker thread can then process the task.

After the worker thread retrieves the task, it reads and writes the disk image corresponding to img_fd using the preadv and pwritev functions according to the IO operation information indicated by blkp_req. After completing the read/write operation, it first updates the last descriptor in the descriptor chain, which is used to describe the completion result of the IO request, such as success, failure, or unsupported operation. Then it updates the used ring, writing the first descriptor of the descriptor chain to a new entry. Subsequently, it performs interrupt injection to notify other virtual machines.

The establishment of the worker thread effectively distributes time-consuming operations to other CPU cores, improving the efficiency and throughput of the main thread's request distribution and enhancing device performance.