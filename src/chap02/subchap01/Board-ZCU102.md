# ZCU102 Board hvisor Multi-mode Boot
## Booting Hvisor on ZCU102 Development Board in SD mode
### Prepare SD Card
1. Prepare a standard SD card, partition it into a Boot partition (FAT32) and the rest as file system partitions (EXT4). For partitioning in Windows, you can use [DiskGenius](https://www.diskgenius.cn/download.php), and for Linux, you can use [fdisk](https://www.cnblogs.com/renshengdezheli/p/13941563.html) or [mkfs](https://blog.csdn.net/linkedin_35878439/article/details/82020925).
2. Prepare a file system and copy its contents into any file system partition. You can refer to "NXPIMX8" for creating an Ubuntu file system or directly use the file system from the ZCU102 BSP.
3. Copy `zcu102-root-aarch64.dtb`, `Image`, and `hvisor` to the Boot partition.
4. In SD mode, it is necessary to provide ATF and Uboot from the SD card, therefore copy `pre-built/linux/images/boot.scr` and `BOOT.BIN` from the ZCU102 BSP to the BOOT partition.
#### Booting ZCU102
1. Set the ZCU102 to SD mode, insert the SD card, connect the serial port, and power on.
2. Press any key to interrupt the Uboot auto script execution and run the following commands to boot hvisor and root linux:
```
fatload mmc 0:1 0x40400000 hvisor;fatload mmc 0:1 0x40000000 zcu102-root-aarch64.dtb
fatload mmc 0:1 0x04000000 zcu102-root-aarch64.dtb;fatload mmc 0:1 0x00200000 Image;bootm 0x40400000 - 0x40000000
```
3. If successfully booted, you will see hvisor and linux information on the serial port and eventually enter the file system.

## Booting Hvisor on ZCU102 Development Board in Jtag mode

First, connect the two cables that come with the board to the JTAG and UART interfaces of the board, and the other end to the PC via USB.

Then, open a petalinux project in the command line, ensure the project has been compiled and has generated the corresponding boot files (vmlinux, BOOT.BIN, etc.), and then run from the project root directory:
```bash
petalinux-boot --jtag --prebuilt 2
```
Where prebuilt represents the boot level:
- **Level 1**: Only download the FPGA bitstream, boot FSBL and PMUFW
- **Level 2**: Download FPGA bitstream and boot UBOOT, and start FSBL, PMUFW, and TF-A (Trusted Firmware-A)
- **Level 3**: Download and boot linux, and load or boot FPGA bitstream, FSBL, PMUFW, TF-A, UBOOT

Afterwards, JTAG will download the corresponding files to the board (save to the designated memory address) and boot the corresponding bootloader. For the default UBOOT script by the official, refer to the boot.scr file in the project image directory.

Since hvisor requires a separate UBOOT command and a custom-made fitImage to boot, please refer to [UBOOT FIT Image Creation, Loading, and Booting](../../chap02/subchap01/UbootFitImage-ZCU102.md).

After creating the fitImage, replace the files in the petalinux images generation directory (Image.ub), so that JTAG loads our custom-made fitImage to the default FIT image load address configured in the petalinux project. This way, when JTAG boots, our fitImage will be loaded through the JTAG line to the corresponding address in the board memory, then extracted and booted through the uboot command line.

Another UART cable can be used to observe the output from the ZCU102 board (including FSBL, UBOOT, linux, etc.), which can be viewed through serial port tools such as `screen`, `gtkterm`, `termius`, or `minicom`.

<div class="warning">
    <h3>Please Note</h3>
    <p> Since petalinux has designated some fixed memory addresses, such as the default loading addresses for the linux kernel, fitImage, and DTB (configurable during petalinux project compilation), because we need to load and boot a custom-made fitImage, a problem currently identified is if the root linux dtb's load address in its matches the petalinux compilation load address, it will cause the dtb to be overwritten by the default petalinux dtb, leading to the root linux receiving an incorrect dtb and failing to boot. Therefore, it is necessary to specify a different address from the petalinux default dtb/fitImage load address during compilation to prevent other issues.
</div>

# References

[1] PetaLinux Tools Documentation: Reference Guide (UG1144).<https://docs.amd.com/r/2023.1-English/ug1144-petalinux-tools-reference-guide/Booting-a-PetaLinux-Image-on-Hardware-with-JTAG>
[2] Trusted Firmware-A Documentation.<https://trustedfirmware-a.readthedocs.io/en/latest/>