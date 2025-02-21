PCI devices primarily have three spaces: Configuration Space, Memory Space, and I/O Space.

### 1. Configuration Space
- **Purpose**: Used for device initialization and configuration.
- **Size**: Each PCI device has 256 bytes of configuration space.
- **Access Method**: Accessed via bus number, device number, and function number.
- **Contents**:
  - Device identification information (such as vendor ID, device ID).
  - Status and command registers.
  - Base Address Registers (BARs), used to map the device's memory space and I/O space.
  - Information about interrupt lines and interrupt pins.

### 2. Memory Space
- **Purpose**: Used to access device registers and memory, suitable for high bandwidth access.
- **Size**: Defined by the device manufacturer, mapped into the system memory address space.
- **Access Method**: Accessed via memory read/write instructions.
- **Contents**:
  - Device registers: Used for control and status reading.
  - Device-specific memory: such as frame buffers, DMA buffers, etc.

### 3. I/O Space
- **Purpose**: Used to access the device's control registers, suitable for low bandwidth access.
- **Size**: Defined by the device manufacturer, mapped into the system's I/O address space.
- **Access Method**: Accessed via special I/O instructions (such as `in` and `out`).
- **Contents**:
  - Device control registers: Used to perform specific I/O operations.

### Summary
- **Configuration Space** is mainly used for device initialization and configuration.
- **Memory Space** is used for high-speed access to device registers and memory.
- **I/O Space** is used for low-speed access to device control registers.

PCI virtualization mainly involves managing the above three spaces. Considering that most devices do not have multiple PCI buses, and the ownership of the PCI bus generally belongs to zone0, to ensure the access speed of PCI devices in zone0, hvisor does not process the PCI bus and PCI devices in zone0 when there is no need to allocate devices on this bus to other zones.

When allocating PCI devices to a zone, we need to ensure that Linux in zone0 no longer uses them. As long as the devices are allocated to other zones, zone0 should not access these devices. Unfortunately, we cannot simply use PCI hot-plugging to remove/re-add devices at runtime, as Linux might reprogram the BARs and locate resources in positions we do not expect or allow. Therefore, a driver in the zone0 kernel is needed to intercept access to these PCI devices, and we turn to the hvisor tool.

The hvisor tool registers itself as a PCI virtual driver and claims management of these devices when other zones use them. Before creating a zone, hvisor allows these devices to unbind from their own drivers and bind to the hvisor tool. When a zone is destroyed, these devices are actually no longer in use by any zone, but from the perspective of zone0, the hvisor tool is still a valid virtual driver, so the release of the devices needs to be done manually. The hvisor tool releases the devices bound to these zones, and from the perspective of zone0 Linux, these devices are not bound to any drivers, so if these devices are needed, Linux will automatically rebind the correct drivers.

Now we need to allow zones to correctly access PCI devices, and to achieve this goal as simply as possible, we directly reuse the structure of the PCI bus, meaning the content about the PCI bus will appear in the device tree of the zones that need to use devices on this bus, but other than the zone that truly owns this bus, other zones can only access the device through mmio proxy by hvisor. When a zone attempts to access a PCI device, hvisor checks if it owns the device, which is declared when the zone is created. If a zone accesses the configuration space of a device that belongs to it, hvisor will correctly return the information.

Currently, the handling of I/O space and memory space is the same as for configuration space. Due to the uniqueness of BAR resources, configuration space cannot be directly allocated to a zone, and the frequency of access to BAR space is low, which does not significantly affect efficiency. However, direct allocation of I/O space and memory space is theoretically feasible, and further direct allocation of I/O space and memory space to the corresponding zone would improve access speed.

To facilitate testing of PCI virtualization in QEMU, we wrote a PCI device.

# PCIe Resource Allocation and Isolation

## Resource Allocation Method

In each zone's configuration file, the number of PCIe devices allocated to that zone is specified by `num_pci_devs`, and these devices' BDF is specified by `alloc_pci_devs`. Note that it must include 0.

For example:

```json
{
    "arch": "riscv",
    "name": "linux2",
    "zone_id": 1,
    ///
    "num_pci_devs": 2,
    "alloc_pci_devs": [0, 16]
}
```

## virt PCI

```rust
pub struct PciRoot {
    endpoints: Vec<EndpointConfig>,
    bridges: Vec<BridgeConfig>,
    alloc_devs: Vec<usize>, // include host bridge
    phantom_devs: Vec<PhantomCfg>,
    bar_regions: Vec<BarRegion>,
}
```

It should be noted that `phantom_devs` are devices that do not belong to this virtual machine; `bar_regions` are the BAR spaces of devices that belong to this virtual machine.

### phantom_dev

This part of the code can be found in `src/pci/phantom_cfg.rs`. When the virtual machine first accesses a device that does not belong to it, a `phantom_dev` is created.

The handling function can be found in `src/pci/pci.rs` under `mmio_pci_handler`, which is our function for handling the virtual machine's access to the configuration space.

#### header

**hvisor lets each virtual machine see the same PCIe topology, which can avoid complex processing brought by different BAR and bus number allocations, especially for configurations involving TLB forwarding in bridge devices, saving a lot of effort.**

However, for Endpoints not allocated to the virtual machine, they are virtualized as `phantom_devs`. When accessing the header, it should return a specific `vendor-id` and `device-id`, such as 0x77777777, and return a reserved `class-code`. For such devices that exist but cannot find corresponding drivers, the virtual machine will only perform some basic configurations during the enumeration stage, such as reserving BARs.

#### capabilities

The capabilities section involves MSI configurations and more. When the virtual machine accesses the `capabilities-pointer`, it returns 0, indicating that the device has no capabilities, preventing overwriting the configuration of the device's owning virtual machine (e.g., the configuration content in the MSI-TABLE in the BAR space).

#### command

Additionally, for the `COMMAND` register, when the virtual machine detects no `MSI capabilities`, it will turn on traditional interrupts, which involves setting the `DisINTx` field in the `COMMAND` register. Hardware requires choosing between MSI and legacy, avoiding contradictions set by different virtual machines (originally, non-owning virtual machines should not set this), hence we need a virtual `COMMAND` register.

### About BAR

This part of the code can be found in `src/pci/pcibar.rs`.

```rust
pub struct PciBar {
    val: u32,
    bar_type: BarType,
    size: usize,
}

pub struct BarRegion{
    pub start: usize,
    pub size: usize,
    pub bar_type: BarType
}

pub enum BarType {
    Mem32,
    Mem64,
    IO,
    #[default]
    Unknown,
}
```

If each virtual machine sees the same topology, then the allocation of BAR space is completely the same.

Then, when a non-root virtual machine starts, it directly reads the BAR configured by the root to know which BAR spaces each virtual machine should access (determined by the devices allocated to it).

If the virtual machine accesses the BAR and then traps into the hypervisor for proxy, the efficiency is low. We should let the hardware do this, directly writing this space into the virtual machine's stage-2 page table. Note in the `pci_bars_register` function, when filling in the page table, according to the `BarRegion`'s `BarType`, find the mapping relationship between the PCI address and the CPU address of that type (written in the device tree, also synchronized in the configuration file's `pci_config`), and convert the PCI address in the BAR configuration to the corresponding CPU address before writing it into the page table.

**The method of obtaining the BAR allocation result from the root-configured BAR as described above mainly distinguishes between Endpoint and Bridge (because the number of BARs is different for the two), accesses the configuration space according to BDF, first reads the root's configuration result, then writes all 1s to get the size, and then writes back the configuration result. Specific code can be combined with `endpoint.rs`, `bridge.rs`, and `pcibar.rs` for reference, with special attention needed for handling 64-bit memory addresses.**