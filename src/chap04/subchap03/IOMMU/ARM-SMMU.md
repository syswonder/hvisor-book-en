# ARM-SMMU Technical Documentation

Abstract: Introduction to the development process of ARM-SMMU.

## Background Knowledge

A brief introduction to the principle and function of SMMU.

### What is DMA? Why do we need IOMMU?

Virtual machines running on top of the hypervisor need to interact with devices, but if they wait for the CPU to host such tasks every time, it will reduce processing efficiency, hence the emergence of the DMA mechanism. **DMA is a mechanism that allows devices to exchange data directly with memory without CPU involvement.**

We can roughly outline the process of virtual machines interacting with devices through DMA. First, the virtual machine issues a DMA request, telling the target device where to write the data, and then the device writes into the memory according to the address.

However, some issues need to be considered in the above process:

- The hypervisor has virtualized memory for each virtual machine, so the target memory address of the DMA request issued by the virtual machine is GPA, also called IOVA here, which needs to be converted to the real PA to be written to the correct position in physical memory.
- Moreover, if the range of IOVA is not restricted, it means that any memory address can be accessed through the DMA mechanism, causing unforeseeable serious consequences.

Therefore, we need an institution that can help us with address conversion and ensure the legality of the operation address, just like the MMU memory management unit. This institution is called **IOMMU**, and in the Arm architecture, it has another name called **SMMU** (hereinafter referred to as SMMU).

Now you know that SMMU can convert virtual addresses to physical addresses, thus ensuring the legality of devices directly accessing memory.

### Specific Work of SMMU

As mentioned above, the function of SMMU is similar to MMU, whose target is virtual machines or applications, while SMMU targets each device, each identified by a sid, corresponding to a table called **stream table**. The table uses the device's sid as an index, and the sid of PCI devices can be obtained from the BDF number: sid = (B << 5) | (D << 3) | F.

## Development Work

Currently, we have implemented support for stage-2 address translation of SMMUv3 in Qemu, created a simple linear table, and conducted simple verification using PCI devices.

The work of IOMMU has not yet been merged into the mainline, you can switch to the IOMMU branch to check.

### Overall Idea

We pass through PCI HOST to zone0, that is, add a PCI node to the device tree provided to zone0, map the corresponding memory address in the second-stage page table of zone0, and ensure normal interrupt injection. Then zone0 will detect and configure the PCI device by itself, and we only need to do the configuration work of SMMU in the hypervisor.

### Qemu Parameters

Add `iommu=smmuv3` in `machine` to enable SMMUv3 support, and add `arm-smmuv3.stage=2` in `global` to enable the second-stage address translation.

Note that nested translation is not yet supported in Qemu. If `stage=2` is not specified, it defaults to supporting only the first-stage address translation. Please use Qemu version 8.1 or above, as lower versions do not support enabling the second-stage address translation.

When adding a PCI device, please enable `iommu_platform=on`.

addr can specify the bdf number of the device.

**In the PCI bus simulated by Qemu, in addition to the PCI HOST, there is a default network card device, so the addr parameter of other added devices must start from 2.0.**

```
// scripts/qemu-aarch64.mk

QEMU_ARGS := -machine virt,secure=on,gic-version=3,virtualization=on,iommu=smmuv3
QEMU_ARGS += -global arm-smmuv3.stage=2

QEMU_ARGS += -device virtio-blk-pci,drive=Xa003e000,disable-legacy=on,disable-modern=off,iommu_platform=on,addr=2.0
```

### Mapping SMMU Related Memory in the Hypervisor's Page Table

Consulting the source code of Qemu, it is known that the memory region corresponding to VIRT_SMMU starts at 0x09050000 and is 0x20000 in size. We need to access this area, so it must be mapped in the hypervisor's page table.

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

This structure contains a reference to the memory region of SMMUv3 that will be accessed, whether it supports a second-level table, the maximum number of bits of sid, and the base address and allocated page frames of the stream table.

The rp is a reference to `RegisterPage` defined, and `RegisterPage` is set according to the offsets in Chapter 6 of the SMMUv3 manual. Readers can refer to it themselves.

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

Taking the check of which table format the environment supports as an example, the supported table type is in the `IDR0` register, obtained by `self.rp.IDR0.get() as usize`, and the value of `IDR0` is obtained by `extract_bit`, obtaining the value of the `ST_LEVEL` field. According to the manual, 0b00 represents support for a linear table, 0b01 represents support for a linear table and a second-level table, and 0b1x is a reserved bit. We can choose what type of stream table to create based on this information.

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
            _ => info!("Smmuv3 don't support any stream table."),
        }

	...
    }
}
```

### init_linear_strtab()

We need to support the second-stage address translation, and there are not many devices in the system, so we choose to use a linear table.

When applying for the space needed for the linear table, we should determine the number of entries according to the current maximum number of bits of sid, multiplied by the space required for each entry `STRTAB_STE_SIZE`, and then know how many page frames need to be applied for. However, SMMUv3 has strict requirements for the starting address of the stream table, the low (5+sid_max_bits) bits of the starting address must be 0.

Since the current hypervisor does not yet support such space application, we apply for a space under the premise of ensuring safety, and select an address that meets the conditions within this space as the table base address, although this will cause some space waste.

After applying for the space, we can fill in this table's base address into the `STRTAB_BASE` register:

```
	let mut base = extract_bits(self.strtab_base, STRTAB_BASE_OFF, STRTAB_BASE_LEN);
	base = base << STRTAB_BASE_OFF;
	base |= STRTAB_BASE_RA;
	self.rp.STRTAB_BASE.set(base as _);
```

Then we also need to set the `STRTAB_BASE_CFG` register to indicate the format of the table we are using, whether it is a linear table or a second-level table, and the number of entries (represented in LOG2 form, i.e., the maximum number of bits of SID):

```
        // format : linear table
        cfg |= STRTAB_BASE_CFG_FMT_LINEAR << STRTAB_BASE_CFG_FMT_OFF;

        // table size : log2(entries)
        // entry_num = 2^(sid_bits)
        // log2(size) = sid_bits
        cfg |= self.sid_max_bits << STRTAB_BASE_CFG_LOG2SIZE_OFF;

        // linear table -> ignore SPLIT field
        self.rp.STRTAB_BASE_CFG.set(cfg as _);
```

### init_bypass