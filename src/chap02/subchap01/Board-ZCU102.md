# ZCU102 hvisor Multi-mode Boot
## Booting Hvisor on ZCU102 Development Board in SD Mode
### Preparing the SD Card
1. Prepare a standard SD card, partition it into a Boot partition (FAT32) and the rest as filesystem partitions (EXT4). For Windows partitions, you can use [DiskGenius](https://www.diskgenius.cn/download.php), and for Linux partitions, you can use [fdisk](https://www.cnblogs.com/renshengdezheli/p/13941563.html) or [mkfs](https://blog.csdn.net/linkedin_35878439/article/details/82020925).
2. Prepare a filesystem and copy its contents to any filesystem partition. You can refer to "NXPIMX8" for creating an Ubuntu filesystem or directly use the filesystem from the ZCU102 BSP.
3. Copy `zcu102-root-aarch64.dtb`, `Image`, and `hvisor` to the Boot partition.
4. In SD mode, it is necessary to provide ATF and Uboot from the SD card, so copy `boot.scr` and `BOOT.BIN` from the ZCU102 BSP to the BOOT partition.
#### Booting ZCU102
1. Set ZCU102 to SD mode, insert the SD card, connect the serial port, and power on.
2. Press any key to interrupt the Uboot auto script and run the following commands to boot hvisor and root Linux:
```
fatload mmc 0:1 0x40400000 hvisor;fatload mmc 0:1 0x40000000 zcu102-root-aarch64.dtb
fatload mmc 0:1 0x04000000 zcu102-root-aarch64.dtb;fatload mmc 0:1 0x00200000 Image;bootm 0x40400000 - 0x40000000
```
3. If successful, you will see hvisor and Linux information on the serial port and finally enter the filesystem.

## Booting Hvisor on ZCU102 Development Board in Jtag Mode

First, connect the two cables that come with the board to the JTAG and UART interfaces of the board, and connect the other end to the PC via USB.

Then open a petalinux project in the command line, ensure the project has been compiled and generated the corresponding boot files (vmlinux, BOOT.BIN, etc.), and then enter the project root directory and run:

```bash
petalinux-boot --jtag --prebuilt 2
```

Where prebuilt represents the boot level:
- **Level 1**: Only download the FPGA bitstream, boot FSBL and PMUFW
- **Level 2**: Download FPGA bitstream and boot UBOOT, and start FSBL, PMUFW, and TF-A (Trusted Firmware-A)
- **Level 3**: Download and boot Linux, and load or boot FPGA bitstream, FSBL, PMUFW, TF-A, UBOOT

Afterward, JTAG will download the corresponding files to the board (saving to the specified memory address) and start the corresponding bootloader. For the specific official UBOOT default script, see the boot.scr file in the project image directory.

Since hvisor requires separate UBOOT commands and a custom-made fitImage to boot, please refer to [UBOOT FIT Image Creation, Loading, and Booting](../../chap02/subchap01/UbootFitImage-ZCU102.md).

After making the fitImage, replace the files in the petalinux images generation directory (Image.ub), so that JTAG loads our custom-made fitImage to the default FIT image load address configured in the petalinux project. This way, when JTAG starts, it will load our fitImage via the JTAG line to the corresponding address in the board memory, and then extract and bootm through the uboot command line.

Another UART line can be used to observe the output of the ZCU102 board (including FSBL, UBOOT, Linux, etc.), which can be viewed through serial port tools such as `screen`, `gtkterm`, `termius`, `minicom`.

<div class="warning">
    <h3>Please Note</h3>
    <p> Since petalinux specifies some fixed memory addresses, such as the default loading addresses for the Linux kernel, fitImage, and DTB (configurable during petalinux project compilation), there is an issue where if the root Linux dtb in its has the same loading address as during petalinux compilation, it will cause the dtb to be overwritten with the default petalinux dtb, preventing root Linux from booting correctly. Therefore, it is necessary to specify different addresses from the default petalinux dtb/fitImage loading addresses during compilation to prevent other issues.
</div>

# References

[1] PetaLinux Tools Documentation: Reference Guide (UG1144).<https://docs.amd.com/r/2023.1-English/ug1144-petalinux-tools-reference-guide/Booting-a-PetaLinux-Image-on-Hardware-with-JTAG>
[2] Trusted Firmware-A Documentation.<https://trustedfirmware-a.readthedocs.io/en/latest/>