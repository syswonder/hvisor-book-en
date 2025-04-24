# ZCU102 Board hvisor Multi-Mode Boot
Ren Hangqi (2572131118@qq.com)
## Booting Hvisor on ZCU102 Development Board in SD Mode
### Prepare the SD Card
1. Prepare a standard SD card, partition it into one Boot partition (FAT32) and the rest as file system partitions (EXT4). Windows partitions can be managed using [DiskGenius](https://www.diskgenius.cn/download.php), and Linux partitions can be managed using [fdisk](https://www.cnblogs.com/renshengdezheli/p/13941563.html), [mkfs](https://blog.csdn.net/linkedin_35878439/article/details/82020925).
2. Prepare a file system and copy its contents to any file system partition, refer to "NXPIMX8" for creating an Ubuntu file system, or directly use the file system in the ZCU102 BSP.
3. Copy `zcu102-root-aarch64.dtb`, `Image`, `hvisor` to the Boot partition.
4. In SD mode, ATF and Uboot need to be provided from the SD card, thus copy `boot.scr` and `BOOT.BIN` from the ZCU102 BSP into the BOOT partition.
#### Booting ZCU102
1. Set ZCU102 to SD mode, insert the SD card, connect the serial port, and power on.
2. Press any key to interrupt the Uboot auto script execution, run the following commands to start hvisor and root Linux:
```
fatload mmc 0:1 0x40400000 hvisor;fatload mmc 0:1 0x40000000 zcu102-root-aarch64.dtb
fatload mmc 0:1 0x04000000 zcu102-root-aarch64.dtb;fatload mmc 0:1 0x00200000 Image;bootm 0x40400000 - 0x40000000
```
3. If successful, hvisor and Linux information will be visible on the serial port, ultimately entering the file system.

## Booting Hvisor on ZCU102 Development Board in Jtag Mode

First, connect the two cables that come with the board to the JTAG and UART interfaces on the board, and the other end to the PC via USB.

Then, open a petalinux project in the command line, ensure the project has been compiled and generated the corresponding boot files (vmlinux, BOOT.BIN, etc.), then enter the project root directory and run:

```bash
petalinux-boot --jtag --prebuilt 2
```

Where prebuilt represents the boot level:
- **Level 1**: Only download the FPGA bitstream, boot FSBL and PMUFW
- **Level 2**: Download the FPGA bitstream and boot UBOOT, and start FSBL, PMUFW, and TF-A (Trusted Firmware-A)
- **Level 3**: Download and boot Linux, and load or boot FPGA bitstream, FSBL, PMUFW, TF-A, UBOOT

Then, JTAG will download the corresponding files to the board (saving to specified memory addresses) and start the corresponding bootloader. For the official UBOOT default script, refer to the boot.scr file in the project image directory.

Since hvisor requires separate UBOOT commands and a custom-made fitImage to boot, please refer to [UBOOT FIT Image Creation, Loading, and Booting](../../chap02/subchap01/UbootFitImage-ZCU102.md).

After creating the fitImage, replace the file (Image.ub) in the petalinux images generation directory so that JTAG loads our custom-made fitImage to the default FIT image loading address configured in the petalinux project. This way, JTAG will load our fitImage through the JTAG line to the corresponding address in the board memory, then extract and bootm through the uboot command line.

Another UART line can be used to observe the output of the ZCU102 board (including FSBL, UBOOT, Linux, etc.), which can be viewed through serial port tools like `screen`, `gtkterm`, `termius`, `minicom`.

<div class="warning">
    <h3>Please Note</h3>
    <p> Since petalinux has specified some fixed memory addresses, such as the default loading addresses for the Linux kernel, fitImage, DTB (configurable during petalinux compilation), since we need to load and boot a custom-made fitImage, a problem discovered is that if the root Linux dtb's loading address in its matches the loading address during petalinux compilation, it will cause the dtb to be overwritten by the default petalinux dtb, thereby causing root Linux to receive an incorrect dtb and fail to boot. Therefore, it is necessary to specify a different address from the default petalinux dtb/fitImage loading address during compilation to prevent other issues.
</div>

# References

[1] PetaLinux Tools Documentation: Reference Guide (UG1144).<https://docs.amd.com/r/2023.1-English/ug1144-petalinux-tools-reference-guide/Booting-a-PetaLinux-Image-on-Hardware-with-JTAG>
[2] Trusted Firmware-A Documentation.<https://trustedfirmware-a.readthedocs.io/en/latest/>