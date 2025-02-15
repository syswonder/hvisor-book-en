PCI devices primarily have three spaces: Configuration Space, Memory Space, and I/O Space.

### 1. Configuration Space
- **Purpose**: Used for device initialization and configuration.
- **Size**: Each PCI device has 256 bytes of configuration space.
- **Access Method**: Accessed through bus number, device number, and function number.
- **Content**:
  - Device identification information (such as Vendor ID, Device ID).
  - Status and command registers.
  - Base Address Registers (BARs), used to map the device's memory space and I/O space.
  - Information on interrupt lines and interrupt pins.

### 2. Memory Space
- **Purpose**: Used to access the device's registers and memory, suitable for high bandwidth access.
- **Size**: Defined by the device manufacturer, mapped into the system memory address space.
- **Access Method**: Accessed through memory read and write instructions.
- **Content**:
  - Device registers: Used for control and status reading.
  - Device-specific memory: such as frame buffers, DMA buffers, etc.

### 3. I/O Space
- **Purpose**: Used to access the device's control registers, suitable for low bandwidth access.
- **Size**: Defined by the device manufacturer, mapped into the system's I/O address space.
- **Access Method**: Accessed through special I/O instructions (such as `in` and `out`).
- **Content**:
  - Device control registers: Used to perform specific I/O operations.

### Summary
- **Configuration Space** is mainly used for device initialization and configuration.
- **Memory Space** is used for high-speed access to the device's registers and memory.
- **I/O Space** is used for low-speed access to the device's control registers.

The virtualization of PCI mainly involves managing the above three spaces. Considering that most devices do not have multiple PCI buses, and the ownership of the PCI bus generally belongs to zone0, to ensure the access speed of PCI devices in zone0, hvisor does not process the PCI bus and PCI devices in zone0 when there is no need to allocate devices on this bus to other zones.

When allocating PCI devices to a zone, we need to ensure that Linux in zone0 no longer uses them. As long as the devices are allocated to other zones, zone0 should not access these devices. Unfortunately, we cannot simply use PCI hot-plugging to remove/re-add devices at runtime, as Linux may reprogram the BARs and allocate resources to locations we do not expect or allow. Therefore, a driver within the zone0 kernel is needed to intercept access to these PCI devices, and we turn to the hvisor tool.

The hvisor tool registers itself as a PCI virtual driver and claims management of these devices when other zones use them. Before creating a zone, hvisor allows these devices to unbind from their own drivers and bind to the hvisor tool. When a zone is destroyed, these devices are no longer used by any zone, but from the perspective of zone0, the hvisor tool is still a valid virtual driver, so the release of the devices needs to be done manually. The hvisor tool releases the devices bound to these zones, from the perspective of zone0 Linux, these devices are not bound to any drivers, so if these devices are needed, Linux will automatically rebind the correct drivers.

Now we need to allow the zone to correctly access the PCI devices, and to achieve this goal as simply as possible, we directly reuse the structure of the PCI bus, meaning that the content about the PCI bus will appear in the device tree of the zone that needs to use the devices on this bus, but other than the zone that actually owns this bus, other zones can only access the device through mmio by proxy of hvisor. When a zone attempts to access a PCI device, hvisor checks whether it owns the device, and ownership is declared at the time of zone creation. If a zone accesses the configuration space of a device it owns, hvisor will correctly return the information.

Currently, the treatment of I/O space and memory space is the same as that of configuration space. Because of the uniqueness of BARs resources, the configuration space cannot be directly allocated to a zone, and the frequency of access to BAR space is low, which does not significantly affect efficiency. However, the direct allocation of I/O space and memory space is theoretically feasible, and further, the I/O space and memory space will be directly allocated to the corresponding zone to improve access speed.

To facilitate testing PCI virtualization in QEMU, we wrote a PCI device.