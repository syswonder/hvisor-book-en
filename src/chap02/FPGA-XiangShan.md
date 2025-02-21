# qemu bosc-kmh hvisor
## Change hvisor to single core
Change the qemu parameter smp to 1

Change MAX_CPU_NUM in const.rs to 1

In qemu_riscv64.rs:
```pub const ROOT_ZONE_CPUS: u64 = (1 << 0);```

## Modification: hvisor's two-stage mapping
```rs
//src/arch/riscv64/s2pt.rs
        attr |= Self::VALID | Self::USER | Self::ACCESSED | Self::DIRTY; //stage 2 page table must be user
```

## Compile the Linux kernel

```bash
git clone git@gitlab.bosoc.cc:openxiangshan/riscv-linux.git	# Download the source repository
git checkout -b devel origin/devel	# Switch branch to devel
# Note: Developers should start work based on the latest HEAD of the main development branch devel
export CROSS_COMPILE=riscv64-unknown-linux-gnu-	# Specify compiler file prefix
export ARCH=riscv  # Specify architecture

export PATH=$PATH:/home/ran/toolchain/gcc12/riscv-toolchain-20230425/bin # Toolchain path  
make distclean	# Clean old build products, this command will cause all files to be recompiled, use with caution
make defconfig xiangshan.config # Compile to generate .config
gedit .config
CONFIG_BLK_DEV_INITRD=y
CONFIG_INITRAMFS_SOURCE="~/fdisk/kvm/rootfs_kvm_riscv64.cpio"
make
```
## Package the filesystem Image into hvisor.bin
After packaging, the fw_payload.bin is 250MB, change the memory layout to reduce it to 78MB
```rs
// config
#[link_section = ".img1"]
#[used]
pub static GUEST1_KERNEL: [u8; include_bytes!("../images/riscv64/kernel/Image").len()] =
    *include_bytes!("../images/riscv64/kernel/Image");
#[link_section = ".dtb1"]
#[used]
pub static GUEST1_DTB: [u8; include_bytes!("../images/riscv64/devicetree/linux.dtb").len()] =
    *include_bytes!("../images/riscv64/devicetree/linux.dtb");
```
```ld
    . = . + 0x2000000;
    gdtb = .;
    . = 0x82000000;
    .dtb1 : {
        KEEP(*(.dtb1))
    }
    . = ALIGN(4K);
    . = 0x83000000;
    .img1 : {
        KEEP(*(.img1))
    }
```
Modify the memory layout, PLIC, and serial configuration according to the linker script and kmh_v2_1core.dtb
```rs
//src/platform/qemu_riscv64.rs
pub const ROOT_ZONE_DTB_ADDR: u64 = 0x82000000;
pub const ROOT_ZONE_KERNEL_ADDR: u64 = 0x83000000;
pub const ROOT_ZONE_ENTRY: u64 = 0x83000000;
pub const ROOT_ZONE_CPUS: u64 = 1 << 0;
...
pub const ROOT_ZONE_MEMORY_REGIONS: [HvConfigMemoryRegion; 2] = [
    HvConfigMemoryRegion {
        mem_type: MEM_TYPE_RAM,
        physical_start: 0x81000000,
        virtual_start: 0x81000000,
        size: 0x08000000,
    }, // ram
    HvConfigMemoryRegion {
        mem_type: MEM_TYPE_IO,
        physical_start: 0x310b0000,
        virtual_start: 0x310b0000,
        size: 0x10000,
    }, // serial
];
```


## Embed hvisor.bin into opensbi fw_payload
When running on FPGA, use the packaged software image opensbi fw_payload
```bash
	cd ~/source/opensbi && \
	make PLATFORM=generic \
    	FW_PAYLOAD_PATH=/home/dorso/work/hvisor/target/riscv64gc-unknown-none-elf/debug/hvisor.bin \
		FW_FDT_PATH=/home/dorso/source/opensbi/kmh-v2-1core.dtb
```

## Run qemu bosc-kmh
```bash
QEMU := ~/source/qemu-devel/build/qemu-system-riscv64
# bosc's cpu is not manually specified
QEMU_ARGS := -machine bosc-kmh
QEMU_ARGS += -nographic
QEMU_ARGS += -smp 1
QEMU_ARGS += -m 2G
# Specify the prepared fw_payload as bios
QEMU_ARGS += -bios ~/source/opensbi/build/platform/generic/firmware/fw_payload.elf
```
## Run hvisor on FPGA
In the opensbi directory
```bash
./bin2fpgadata -i build/platform/generic/firmware/fw_payload.bin
```
After successful execution, the generated software image file data.txt is located in the current source root directory

```bash
source /home/tools/Xilinx/Vivado/2020.2/settings64.sh
# Confirm that the Linux server connected to the FPGA has executed the hw_server command after the above source command to start related services, then this x86_64 Linux computer will use the following command in the tcl script to establish communication with the backend server
vivado -mode batch -source ../onboard-ai1-fpga81-remote.tcl -tclargs <path to bitstream files>/  ./data.txt
```
Where <path to bitstream files> is the path to the used hardware image