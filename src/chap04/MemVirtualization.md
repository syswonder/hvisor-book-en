# Memory Management

## Heap Memory Allocation

### Initializing the Allocator

When using programming languages, we often encounter dynamic memory allocation, such as allocating a block of memory in C using `malloc` or `new`, or using `Vec`, `String`, etc., in Rust, which are allocated on the heap.

To allocate memory on the heap, we need to do the following:

- Provide a large block of memory space at initialization
- Provide interfaces for allocation and release
- Manage free blocks

In summary, we need to allocate a large space and set up an allocator to manage this space. We then inform Rust that we now have an allocator, asking it to use it, allowing us to use variables like `Vec`, `String` that allocate memory on the heap. This is what the following lines of code do.

```
use buddy_system_allocator::LockedHeap;

use crate::consts::HV_HEAP_SIZE;

#[cfg_attr(not(test), global_allocator)]
static HEAP_ALLOCATOR: LockedHeap<32> = LockedHeap::<32>::new();

/// Initialize the global heap allocator.
pub fn init() {
    const MACHINE_ALIGN: usize = core::mem::size_of::<usize>();
    const HEAP_BLOCK: usize = HV_HEAP_SIZE / MACHINE_ALIGN;
    static mut HEAP: [usize; HEAP_BLOCK] = [0; HEAP_BLOCK];
    let heap_start = unsafe { HEAP.as_ptr() as usize };
    unsafe {
        HEAP_ALLOCATOR
            .lock()
            .init(heap_start, HEAP_BLOCK * MACHINE_ALIGN);
    }
    info!(
        "Heap allocator initialization finished: {:#x?}",
        heap_start..heap_start + HV_HEAP_SIZE
    );
}
```

`#[cfg_attr(not(test), global_allocator)]` is a conditional compilation attribute, setting the `HEAP_ALLOCATOR` defined in the next line as Rust's global memory allocator when not in a test environment. Now Rust knows we can perform dynamic allocations.

`HEAP_ALLOCATOR.lock().init(heap_start, HEAP_BLOCK * MACHINE_ALIGN)` manages the large space we allocated with the allocator.

### Testing

```
pub fn test() {
    use alloc::boxed::Box;
    use alloc::vec::Vec;
    extern "C" {
        fn sbss();
        fn ebss();
    }
    let bss_range = sbss as usize..ebss as usize;
    let a = Box::new(5);
    assert_eq!(*a, 5);
    assert!(bss_range.contains(&(a.as_ref() as *const _ as usize)));
    drop(a);
    let mut v: Vec<usize> = Vec::new();
    for i in 0..500 {
        v.push(i);
    }
    for (i, val) in v.iter().take(500).enumerate() {
        assert_eq!(*val, i);
    }
    assert!(bss_range.contains(&(v.as_ptr() as usize)));
    drop(v);
    info!("heap_test passed!");
}
```

In this test, we use `Box` and `Vec` to verify the memory we allocated is within the `bss` segment.

The large uninitiated global variable we just handed over to the allocator is placed in the `bss` segment. We only need to test if the addresses of the variables we obtained are within this range.

## Armv8 Memory Management Knowledge

### Addressing

The address bus is default 48 bits, while the addressing request issued is 64 bits, so based on the high 16 bits, the virtual address can be divided into 2 spaces:

- High 16 bits as 1: Kernel space
- High 16 bits as 0: User space

From the perspective of guestVM, when converting virtual addresses to physical addresses, the CPU selects the TTBR register based on the 63rd bit value of the virtual address. TTBR stores the base address of the level-1 page table. If it's user space, select TTBR0; if it's kernel space, select TTBR1.

### Four-Level Page Table Mapping (example with 4K page size)

Besides the high 16 bits used to determine which page table base register to use, the next 36 bits are divided every 9 bits as the index for each level of the page table, with the lower 12 bits as the offset within the page. As shown in the diagram below.

![Level4_PageTable](./img/memory_level4_pagetable.png)

### Stage-2 Page Table Mechanism

In a virtualized environment, there are two types of address mapping processes:

- guestVM uses Stage-1 address conversion, using `TTBR0_EL1` or `TTBR1_EL1`, to convert the accessed VA to IPA, then through Stage-2 address conversion, using `VTTBR0_EL2` to convert IPA to PA.
- Hypervisor may run its own applications, and the VA to PA conversion of these applications only needs one conversion, using the `TTBR0_EL2` register.

![Nested_Address_Translation](./img/memory_nested_translation.png)

## hvsior's Memory Management

### Physical Page Frame Management

Similar to the construction of the heap mentioned above, page frame allocation also requires an allocator, and then we manage the memory used for allocation with the allocator.

**Bitmap-based Allocator**

```
use bitmap_allocator::BitAlloc;
type FrameAlloc = bitmap_allocator::BitAlloc1M;

struct FrameAllocator {
    base: PhysAddr,
    inner: FrameAlloc,
}
```

`BitAlloc1M` is a bitmap-based allocator, managing page numbers by **providing information on which pages are free and which are occupied**.

Then, the bitmap allocator and the starting address used for page frame allocation are encapsulated into a page frame allocator.

So we see the initialization function as follows:

```
fn init(&mut self, base: PhysAddr, size: usize) {
        self.base = align_up(base);
        let page_count = align_up(size) / PAGE_SIZE;
        self.inner.insert(0..page_count);
    }
```

The starting address of the page frame allocation area and the size of the available space are passed in, calculating the number of page frames available for allocation in this space `page_size`, and then informing the bitmap allocator of all page frame numbers through the `insert` function.

**Page Frame Structure**

```
pub struct Frame {
    start_paddr: PhysAddr,
    frame_count: usize,
}
```

The structure of the page frame includes the starting address of this page frame and the number of page frames corresponding to this frame instance, which may be 0, 1, or more than 1.

> Why are there cases where the frame count is 0?
>
> When hvisor wants to access the content of the page frame through `Frame`, a temporary instance is needed, which does not involve page frame allocation or recycling, so 0 is used as a flag.

> Why are there cases where the frame count is more than 1?
>
> In some cases, we are required to allocate continuous memory, and the size exceeds one page, i.e., multiple continuous page frames are allocated.

**Allocation (alloc)**

Now we know that the page frame allocator can allocate a number of a free page frame, turning the number into a `Frame` instance to complete the page frame allocation, as follows for a single page frame allocation:

```
impl FrameAllocator {
    fn init(&mut self, base: PhysAddr, size: usize) {
        self.base = align_up(base);
        let page_count = align_up(size) / PAGE_SIZE;
        self.inner.insert(0..page_count);
    }
}

impl Frame {
    /// Allocate one physical frame.
    pub fn new() -> HvResult<Self> {
        unsafe {
            FRAME_ALLOCATOR
                .lock()
                .alloc()
                .map(|start_paddr| Self {
                    start_paddr,
                    frame_count: 1,
                })
                .ok_or(hv_err!(ENOMEM))
        }
    }
}
```

As seen, the frame allocator helps us allocate a page frame and returns the starting physical address, then creates a `Frame` instance.

**Page Frame Recycling**

The `Frame` structure is tied to the actual physical page, following the RAII design standard, so when a `Frame` leaves scope, the corresponding memory area also needs to be returned to hvisor. This requires us to implement the `Drop Trait`'s `drop` method, as follows:

```
impl Drop for Frame {
    fn drop(&mut self) {
        unsafe {
            match self.frame_count {
                0 => {} // Do not deallocate when use Frame::from_paddr()
                1 => FRAME_ALLOCATOR.lock().dealloc(self.start_paddr),
                _ => FRAME_ALLOCATOR
                    .lock()
                    .dealloc_contiguous(self.start_paddr, self.frame_count),
            }
        }
    }
}

impl FrameAllocator{
    unsafe fn dealloc(&mut self, target: PhysAddr) {
        trace!("Deallocate frame: {:x}", target);
        self.inner.dealloc((target - self.base) / PAGE_SIZE)
    }
}
```

In `drop`, we can see that page frames with a frame count of 0 do not need to release the corresponding physical pages, and page frames with a frame count greater than 1 indicate continuous allocated page frames, requiring the recycling of more than one physical page.

### Page Table Related Data Structures

With the above knowledge about Armv8 memory management, we know that the process of building page tables is divided into two parts: the page table used by hvisor itself and the Stage-2 conversion page table. We will focus on the Stage-2 page table.

Before that, we need to understand a few data structures that will be used.

**Logical Segment MemoryRegion**

The description of the logical segment, including the starting address, size, permission flags