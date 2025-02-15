# Configuration and Management of Zones

The hvisor project, as a lightweight hypervisor, uses a Type-1 architecture that allows multiple virtual machines (zones) to run directly on top of hardware. Below is a detailed explanation of the key points of zone configuration and management:

## Resource Allocation

Resources such as CPU, memory, devices, and interrupts are statically allocated to each zone, meaning that once allocated, these resources will not be dynamically scheduled between zones.

## Root Zone Configuration

The configuration of the root zone is hardcoded inside hvisor, written in Rust language, and presented as a C-style structure HvZoneConfig. This structure contains key information such as zone ID, number of CPUs, memory regions, interrupt information, physical addresses and sizes of the kernel and device tree binaries (DTB).

## Non-root Zones Configuration

The configuration of non-root zones is stored in the file system of root Linux, usually represented in JSON format. For example:

```json
    {
        "arch": "arm64",
        "zone_id": 1,
        "cpus": [2, 3],
        "memory_regions": [
            {
                "type": "ram",
                "physical_start": "0x50000000",
                "virtual_start":  "0x50000000",
                "size": "0x30000000"
            },
            {
                "type": "io",
                "physical_start": "0x30a60000",
                "virtual_start":  "0x30a60000",
                "size": "0x1000"
            },
            {
                "type": "virtio",
                "physical_start": "0xa003c00",
                "virtual_start":  "0xa003c00",
                "size": "0x200"
            }
        ],
        "interrupts": [61, 75, 76, 78],
        "kernel_filepath": "./Image",
        "dtb_filepath": "./linux2.dtb",
        "kernel_load_paddr": "0x50400000",
        "dtb_load_paddr":   "0x50000000",
        "entry_point":      "0x50400000"
    }
```

- The `arch` field specifies the target architecture (e.g., arm64).
- `cpus` is a list indicating the CPU core IDs allocated to the zone.
- `memory_regions` describes different types of memory regions along with their physical and virtual start addresses and sizes.
- `interrupts` lists the interrupt numbers allocated to the zone.
- `kernel_filepath` and `dtb_filepath` indicate the paths of the kernel and device tree binary files.
- `kernel_load_paddr` and `dtb_load_paddr` are the physical memory load addresses for the kernel and device tree binaries.
- `entry_point` specifies the entry point address of the kernel.

The management tool of root Linux is responsible for reading the JSON configuration file and converting it into a C-style structure, which is then passed to hvisor to start non-root zones.