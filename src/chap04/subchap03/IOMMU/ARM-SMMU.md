# ARM-SMMU Technical Documentation

Abstract: Introducing the development process of ARM-SMMU.

## Background Knowledge

A brief introduction to the principle and function of SMMU.

### What is DMA? Why is IOMMU needed?

Virtual machines running on top of the hypervisor need to interact with devices, but if they wait for the CPU to host this work every time, it would reduce processing efficiency. Therefore, the DMA mechanism appears. **DMA is a mechanism that allows devices to exchange data directly with memory without CPU involvement.**

We can roughly figure out the process of virtual machines interacting with devices through DMA. First, the virtual machine issues a DMA request, telling the target device where to write the data, and then the device writes to the memory according to the address.

However, some issues need to be considered in the above process:

- The hypervisor has virtualized memory for each virtual machine, so the target memory address of the DMA request issued by the virtual machine is GPA, also called IOVA here, which needs to be converted to the real PA to be written to the correct position in physical memory.
- Moreover, if the range of IOVA is not restricted, it means that any memory address can be accessed through the DMA mechanism, causing unforeseen severe consequences.

Therefore, we need an institution that can help us with address conversion and ensure the legality of the operation address, just like the MMU memory management unit. This institution is called **IOMMU**, and it has another name in the Arm architecture called **SMMU** (referred to as SMMU hereafter).

Now you know that SMMU can convert virtual addresses to physical addresses, thus ensuring the legality of devices directly accessing memory.

### Specific Tasks of SMMU

As mentioned above, the function of SMMU is similar to MMU, whose target is virtual machines or applications, while the target of SMMU is each device. Each device is identified by a sid, and the corresponding table is called **stream table**. This table uses the device's sid as an index, and the sid of PCI devices can be obtained from the BDF number: sid = (B << 5) | (D << 3) | F.

## Development Work

Currently, we have implemented support for stage-2 address translation of SMMUv3 in Qemu, created a simple linear table, and conducted simple verification using PCI devices.

The work of IOMMU has not yet been merged into the mainline, and you can switch to the IOMMU branch to check.

### Overall Idea

We pass through the PCI HOST to zone0, that is, add the PCI node to the device tree provided to zone0, map the corresponding memory address in the second-stage page table of zone0, and ensure normal interrupt injection. Then zone0 will detect and configure the PCI device by itself, and we only need to configure SMMU in the hypervisor.

### Qemu Parameters

Add `iommu=smmuv3` in `machine` to enable SMMUv3 support, and add `arm-smmuv3.stage=2` in `global` to enable second-stage address translation.

Note that nested translation is not yet supported in Qemu. If `stage=2` is not specified, only the first stage of address translation is supported by default. Please use Qemu version 8.1 or above, as lower versions do not support enabling second-stage address translation.

When adding PCI devices, please ensure to enable `iommu_platform=on`.

The addr can specify the bdf number of the device.

**In the PCI bus simulated by Qemu, in addition to the PCI HOST, there is a default network card device, so the addr parameter of other added devices must start from 2.0.**

```
// scripts/qemu-aarch64.mk

QEMU_ARGS := -machine virt,secure=on,gic-version=3,virtualization=on,iommu=smmuv3
QEMU_ARGS += -global arm-smmuv3.stage=2

QEMU_ARGS += -device virtio-blk-pci,drive=Xa003e000,disable-legacy=on,disable-modern=off,iommu_platform=on,addr=2.0
```

### Mapping SMMU-related Memory in the Hypervisor's Page Table

Consulting the Qemu source code reveals that the memory area corresponding to VIRT_SMMU starts at 0x09050000 and is 0x20000 in size. We need to access this area, so it must be mapped in the hypervisor's page table.

```
// src/arch/aarch64/mm.rs

pub fn init_hv_page_table(fdt: &fdt::Fdt) -> HvResult {
    hv_pt.insert(MemoryRegion::new_with_offset_mapper(
        smmuv3_base(),
        smmuv3_base(),
        smmuv3_size(),
        MemFlags::READ | MemFlags::WRITE,
    ))?;
}
```

### SMMUv3 Data Structure

This structure contains a reference to the memory area of SMMUv3 that will be accessed, whether it supports secondary tables, the maximum number of bits of sid, and the base address and allocated page frames of the stream table.

The rp is a reference to the defined `RegisterPage`, which is set according to the offsets in Chapter 6 of the SMMUv3 manual. Readers can refer to it on their own.

```
// src/arch/aarch64/iommu.rs

pub struct Smmuv3{
    rp:&'static RegisterPage,

    strtab_2lvl:bool,
    sid_max_bits:usize,

    frames:Vec<Frame>,

    // strtab
    strtab_base:usize,

    // about queues...
}
```

### new()

After completing the mapping work, we can refer to the corresponding register area.

```
impl Smmuv3{
    fn new() -> Self{
        let rp = unsafe {
            &*(SMMU_BASE_ADDR as *const RegisterPage)
        };

        let mut r = Self{
            ...
        };

        r.check_env();

        r.init_structures();

        r.device_reset();

        r
    }
}
```

### check_env()

Check which stage of address translation the current environment supports, what type of stream table it supports, how many bits of sid it supports, etc.

Taking the check of which table format the environment supports as an example, the supported table type is in the `IDR0` register. Obtain the value of `IDR0` by `self.rp.IDR0.get() as usize`, and use `extract_bit` to extract and get the value of the `ST_LEVEL` field. According to the manual, 0b00 represents support for linear tables, 0b01 represents support for linear tables and secondary tables, and 0b1x is a reserved bit. We can choose what type of stream table to create based on this information.

```
impl Smmuv3{
    fn check_env(&mut self){
        let idr0 = self.rp.IDR0.get() as usize;

        info!("Smmuv3 IDR0:{:b}",idr0);

        // supported types of stream tables.
        let stb_support = extract_bits(idr0, IDR0_ST_LEVEL_OFF, IDR0_ST_LEVEL_LEN);
        match stb_support{
            0 => info!("Smmuv3 Linear Stream Table Supported."),
            1 => {info!("Smmuv3 2-level Stream Table Supported.");
                self.strtab_2lvl = true;
            }
            _ => info!("Smmuv3 doesn't support any stream table."),
        }

	...
    }
}
```

### init_linear_strtab()

We need to support the second stage of address translation, and there are not many devices in the system, so we choose to use a linear table.

When applying for the space needed for the linear table, we should calculate the number of table entries based on the current maximum number of bits of sid, multiplied by the space needed for each table entry `STRTAB_STE_SIZE`, to know how many page frames need to be applied for. However, SMMUv3 has strict requirements for the starting address of the stream table. The low (5+sid_max_bits) bits of the starting address must be 0.

Since the current hypervisor does not support applying for space in this way, we apply for a space under safe conditions and select an address that meets the conditions as the table base address within this space, although this will cause some space waste.

After applying for space, we can fill in this table's base address into the `STRTAB_BASE` register:

```
	let mut base = extract_bits(self.strtab_base, STRTAB_BASE_OFF, STRTAB_BASE_LEN);
	base = base << STRTAB_BASE_OFF;
	base |= STRTAB_BASE_RA;
	self.rp.STRTAB_BASE.set(base as _);
```

Next, we also need to set the `STRTAB_BASE_CFG` register to indicate the format of the table we are using, whether it is a linear table or a secondary table, and the number of table items (represented in LOG2 form, i.e., the maximum number of bits of SID):

```
        // format: linear table
        cfg |= STRTAB_BASE_CFG_FMT_LINEAR << STRTAB_BASE_CFG_FMT_OFF;

        // table size: log2(entries)
        // entry_num = 2^(sid_bits)
        // log2(size) = sid_bits
        cfg |= self.sid_max_bits << STRTAB_BASE_CFG_LOG2SIZE_OFF;

        // linear table -> ignore SPLIT field
        self.rp.STRTAB_BASE_CFG.set(cfg as _);
```

### init_bypass_ste(sid:usize)

Currently, we have not configured any relevant information yet, so we need to set all table entries to the default state first.

For each sid, find the address of the table entry based on the table base address, i.e., the valid bit is 0, and the address translation is set to `BYPASS`.

```
	let base = self.strtab_base + sid * STRTAB_STE_SIZE;
	let tab = unsafe{&mut *(base as *mut [u64;STRTAB_STE_DWORDS])};

	let mut val:usize = 0;
	val |= STRTAB_STE_0_V;
	val |= STRTAB_STE_0_CFG_BYPASS << STRTAB_STE_0_CFG_OFF;
```

### device_reset()

We have done some preparatory work above, but some additional configurations are still needed, such as enabling SMMU, otherwise, SMMU will be in a disabled state.

```
	let cr0 = CR0_SMMUEN;
	self.rp.CR0.set(cr0 as _);
```

### write_ste(sid:usize,vmid:usize,root_pt:usize)

This method is used to configure specific device information.

First, we need to find the address of the corresponding table entry based on sid.

```
	let base = self.strtab_base + sid * STRTAB_STE_SIZE;
        let tab = unsafe{&mut *(base as *mut [u64;STRTAB_STE_DWORDS])};
```

In the second step, we need to indicate that the information related to this device is used for the second stage of address translation, and this table entry is now valid.

```
        let mut val0:usize = 0;
        val0 |= STRTAB_STE_0_V;
        val0 |= STRTAB_STE_0_CFG_S2_TRANS << STRTAB_STE_0_CFG_OFF;
```

In the third step, we need to specify which virtual machine this device is allocated to, and enable the second-stage page table traversal, `S2AA64` represents that the second-stage translation table is based on aarch64, `S2R` represents enabling error recording.

```
        let mut val2:usize = 0;
        val2 |= vmid << STRTAB_STE_2_S2VMID_OFF;
        val2 |= STRTAB_STE_2_S2PTW;
        val2 |= STRTAB_STE_2_S2AA64;
        val2 |= STRTAB_STE_2_S2R;
```

The last step is to point out the basis for the second-stage translation, which is the page table of the corresponding virtual machine in the hypervisor. Just fill in the base address of the page table in the corresponding position, i.e., the `S2TTB` field.

Here we also need to explain the configuration information of this page table, so that SMMU knows the format and other information of this page table and can use this page table, i.e., the `VTCR` field.

```
	let vtcr = 20 + (2<<6) + (1<<8) + (1<<10) + (3<<12) + (0<<14) + (4<<16);
        let v = extract_bits(vtcr as _, 0, STRTAB_STE_2_VTCR_LEN);
        val2 |= v << STRTAB_STE_2_VTCR_OFF;

        let vttbr = extract_bits(root_pt, STRTAB_STE_3_S2TTB_OFF, STRTAB_STE_3_S2TTB_LEN);
```

## Initialization and Device Allocation

In `src/main.rs`, after the hypervisor's page table is initialized (mapping the SMMU-related area), SMMU can be initialized.

```
fn primary_init_early(dtb: usize) {
    ...

    crate::arch::mm::init_hv_page_table(&host_fdt).unwrap();

    info!("Primary CPU init hv page table OK.");

    iommu_init();

    zone_create(0,ROOT_ENTRY,ROOT_ZONE_DTB_ADDR as _, DTB_IPA).unwrap();
    INIT_EARLY_OK.store(1, Ordering::Release);
}
```

Next, we need to allocate devices, which we complete synchronously when creating the virtual machine. Currently, we only allocate devices for zone0 to use.

```
// src/zone.rs

pub fn zone_create(
    zone_id: usize,
    guest_entry: usize,
    dtb_ptr: *const u8,
    dtb_ipa: usize,
) -> HvResult<Arc<RwLock<Zone>>> {
    ...

    if zone_id==0{
        // add_device(0, 0x8, zone.gpm.root_paddr());
        iommu_add_device(zone_id, BLK_PCI_ID, zone.gpm.root_paddr());
    }
  
    ...
}
```

## Simple Verification

Start qemu with the parameter `-trace smmuv3_*` to see related outputs:

```
smmuv3_config_cache_hit Config cache HIT for sid=0x10 (hits=1469, misses=1, hit rate=99)
smmuv3_translate_success smmuv3-iommu-memory-region-16-2 sid=0x10 iova=0x8e043242 translated=0x8e043242 perm=0x3
```