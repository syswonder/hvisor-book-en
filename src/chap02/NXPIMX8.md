# Booting hvisor on NXP-IMX8MP
Date: 2024/2/25

Updated: 2025/3/7

Authors: Yang Junyi, Chen Xingyu, Li Guowei, Chen Linkun

## 1. Download the Linux source code provided by the manufacturer

https://pan.baidu.com/s/1XimrhPBQIG5edY4tPN9_pw?pwd=kdtk
Extraction code: kdtk

Enter the `Linux/sources/` directory, download the three compressed files `OK8MP-linux-sdk.tar.bz2.0*`, and after downloading, execute:

```
cd Linux/sources

# Merge split compressed files
cat OK8MP-linux-sdk.tar.bz2.0* > OK8MP-linux-sdk.tar.bz2

# Unzip the merged compressed file
tar -xvjf OK8MP-linux-sdk.tar.bz2

```

After unzipping, the `OK8MP-linux-kernel` directory is the Linux source code directory.

## 2. Compile Linux source code

### Install cross-compilation tools

1. Download the cross-compilation toolchain:

   ```bash
   wget https://armkeil.blob.core.windows.net/developer/Files/downloads/gnu-a/10.3-2021.07/binrel/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu.tar.xz
   ```

2. Unzip the toolchain:

   ```bash
   tar xvf gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu.tar.xz
   ```

3. Add the path so that `aarch64-none-linux-gnu-*` can be used directly, modify the `~/.bashrc` file:

   ```bash
   echo 'export PATH=$PWD/gcc-arm-10.3-2021.07-x86_64-aarch64-none-linux-gnu/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```

### Compile Linux

1. Switch to the Linux kernel source code directory:

   ```bash
   cd Linux/sources/OK8MP-linux-sdk
   ```

2. Execute the compilation command:

   ```makefile
   # Set Linux kernel configuration
   make OK8MP-C_defconfig ARCH=arm64 CROSS_COMPILE=aarch64-none-linux-gnu-
   
   # Compile the Linux kernel
   make ARCH=arm64 CROSS_COMPILE=aarch64-none-linux-gnu- Image -j$(nproc)
   
   # Copy the compiled image to the tftp directory
   cp arch/arm64/boot/Image ~/tftp/
   ```

Create a tftp directory here for later image organization and for using tftp to transfer images as mentioned in the appendix.

## 3. Prepare the SD card

1. Insert the SD card into the card reader and connect it to the host.

2. Switch to the Linux/Images directory.

3. Execute the following commands for partitioning:

   ```bash
   fdisk <$DRIVE>
   d  # Delete all partitions
   n  # Create a new partition
   p  # Choose primary partition
   1  # Partition number 1
   16384  # Starting sector
   t  # Change partition type
   83  # Select Linux filesystem (ext4)
   w  # Save and exit
   ```

4. Write the boot file to the SD card boot disk:

   ```bash
   dd if=imx-boot_4G.bin of=<$DRIVE> bs=1K seek=32 conv=fsync
   ```

5. Format the first partition of the SD card boot disk as ext4:

   ```bash
   mkfs.ext4 <$DRIVE>1
   ```

6. Remove the SD card reader and reconnect. Extract the root file system rootfs.tar to the first partition of the SD card. The rootfs.tar can be made by referring to [qemu-aarch64](https://hvisor.syswonder.org/chap02/QemuAArch64.html) or using the image below.

   ```bash
   tar -xvf rootfs.tar -C <path/to/mounted/SD/card/partition>
   ```

rootfs.tar download address:

```
https://disk.pku.edu.cn/link/AADFFFE8F568DE4E73BE24F5AED54B00EB
Filename: rootfs.tar
```

7. After completion, eject the SD card.

## 4. Compile hvisor

1. Organize the configuration files

Place the configuration files where they belong. Sample configuration files can be referred to [here](https://github.com/syswonder/hvisor-tool/tree/main/examples/nxp-aarch64/gpu_on_root).

2. Compile hvisor

Enter the hvisor directory, switch to the main branch or dev branch, and execute the compilation command:

```makefile
make ARCH=aarch64 FEATURES=platform_imx8mp,gicv3 LOG=info all

# Put the compiled hvisor image into tftp
make cp
```

## 5. Boot hvisor and root linux

Before booting the NXP board, transfer the files from the tftp directory to the SD card, such as to the /home/arm64 directory on the SD card. The files in the tftp directory include:

* Image: root linux image, can also be used as non-root linux image
* linux1.dtb, linux2.dtb: device trees for root linux and non-root linux
* hvisor.bin: hvisor image
* OK8MP-C.dtb: This is used for some checks during uboot boot, essentially useless, can be obtained from here [OK8MP-C.dts](https://github.com/KouweiLee/tftp/blob/82545a7c83460747056ca35022de94c2ea365d29/OK8MP-C.dts)

Boot the NXP board:

1. Adjust the dip switches to enable SD card boot mode: (1,2,3,4) = (ON,ON,OFF,OFF).
2. Insert the SD card into the SD slot.
3. Connect the development board to the host using a serial cable.
4. Open the serial port with terminal software

After booting the NXP board, there should be output on the serial port. Restart the development board, immediately press and hold the spacebar to make uboot enter the command line terminal, and execute the following command:

```
setenv loadaddr 0x40400000; setenv fdt_addr 0x40000000; setenv zone0_kernel_addr 0xa0400000; setenv zone0_fdt_addr 0xa0000000; ext4load mmc 1:1 ${loadaddr} /home/arm64/hvisor.bin; ext4load mmc 1:1 ${fdt_addr} /home/arm64/OK8MP-C.dtb; ext4load mmc 1:1 ${zone0_kernel_addr} /home/arm64/Image; ext4load mmc 1:1 ${zone0_fdt_addr} /home/arm64/linux1.dtb; bootm ${loadaddr} - ${fdt_addr};
```

After execution, hvisor should boot and automatically enter root linux.

## 6. Boot non-root linux

Booting non-root linux requires hvisor-tool. For details, please refer to the README of [hvisor-tool](https://github.com/syswonder/hvisor-tool).

## Appendix. Convenient image transfer using tftp

Tftp facilitates data transfer between the development board and the host without the need to plug and unplug the SD card each time. The specific steps are as follows:

### For Ubuntu systems

If you are using Ubuntu, execute the following steps in sequence:

1. Install TFTP server software package

   ```bash
   sudo apt-get update
   sudo apt-get install tftpd-hpa tftp-hpa
   ```

2. Configure TFTP server

   Create TFTP root directory and set permissions:

   ```bash
   mkdir -p ~/tftp
   sudo chown -R $USER:$USER ~/tftp
   sudo chmod -R 755 ~/tftp
   ```

   Edit the tftpd-hpa configuration file:

   ```bash
   sudo nano /etc/default/tftpd-hpa
   ```

   Modify as follows:

   ```plaintext
   # /etc/default/tftpd-hpa
   
   TFTP_USERNAME="tftp"
   TFTP_DIRECTORY="/home/<your-username>/tftp"
   TFTP_ADDRESS=":69"
   TFTP_OPTIONS="-l -c -s"
   ```

   Replace `<your-username>` with your actual username.

3. Start/restart TFTP service

   ```bash
   sudo systemctl restart tftpd-hpa
   ```

4. Verify TFTP server

   ```bash
   echo "TFTP Server Test" > ~/tftp/testfile.txt
   ```

   ```bash
   tftp localhost
   tftp> get testfile.txt
   tftp> quit
   cat testfile.txt
   ```

   If "TFTP Server Test" is displayed, the TFTP server is working properly.

5. Configure to start on boot:

   ```
   sudo systemctl enable tftpd-hpa
   ```

6. Connect the development board's network port (there are two, please choose the one below) to the host using a network cable. And configure the host's wired network card, ip: 192.169.137.2, netmask: 255.255.255.0.

After booting the development board, enter the uboot command line, and the command becomes:

```
setenv serverip 192.169.137.2; setenv ipaddr 192.169.137.3; setenv loadaddr 0x40400000; setenv fdt_addr 0x40000000; setenv zone0_kernel_addr 0xa0400000; setenv zone0_fdt_addr 0xa0000000; tftp ${loadaddr} ${serverip}:hvisor.bin; tftp ${fdt_addr} ${serverip}:OK8MP-C.dtb; tftp ${zone0_kernel_addr} ${serverip}:Image; tftp ${zone0_fdt_addr} ${serverip}:linux1.dtb; bootm ${loadaddr} - ${fdt_addr};
```

Explanation:

- `setenv serverip 192.169.137.2`: Set the IP address of the tftp server.
- `setenv ipaddr 192.169.137.3`: Set the IP address of the development board.
- `setenv loadaddr 0x40400000`: Set the load address for the hvisor image.
- `setenv fdt_addr 0x40000000`: Set the load address for the device tree file.
- `setenv zone0_kernel_addr 0xa0400000`: Set the load address for the guest Linux image.
- `setenv zone0_fdt_addr 0xa0000000`: Set the load address for the root Linux device tree file.
- `tftp ${loadaddr} ${serverip}:hvisor.bin`: Download the hvisor image from the tftp server to the hvisor load address.
- `tftp ${fdt_addr} ${serverip}:OK8MP-C.dtb`: Download the device tree file from the tftp server to the device tree file load address.
- `tftp ${zone0_kernel_addr} ${serverip}:Image`: Download the guest Linux image from the tftp server to the guest Linux image load address.
- `tftp ${zone0_fdt_addr} ${serverip}:linux1.dtb`: Download the root Linux device tree file from the tftp server to the root Linux device tree file load address.
- `bootm ${loadaddr} - ${fdt_addr}`: Boot hvisor, load the hvisor image and device tree file.

### For Windows systems

You can refer to this article: https://blog.csdn.net/qq_52192220/article/details/142693036