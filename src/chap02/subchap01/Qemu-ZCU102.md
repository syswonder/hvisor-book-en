# Qemu ZCU102 hvisor Startup
Ren Hangqi (2572131118@qq.com)
## Install Petalinux
1. Install [Petalinux 2024.1](https://china.xilinx.com/support/download/index.html/content/xilinx/zh/downloadNav/embedded-design-tools/2024-1.html)
   Please note that this article uses 2024.1 as an example, which does not mean that other versions cannot be used, but other versions have not been verified, and it has been found in tests that Petalinux has a strong dependency on the operating system. Please install the version of Petalinux suitable for your operating system.
2. Place the downloaded `petalinux.run` file in the directory where you want to install it, add execution permissions to it, and then run the installer directly with `./petalinux.run`.
3. The installer will automatically detect the required environment, and if it does not meet the requirements, it will prompt for the missing environment, which can be installed one by one with `apt install`.
4. After installation, you need to enter the installation directory and manually `source settings.sh` to add environment variables before using Petalinux each time. If it's too troublesome, you can add this command to `~/.bashrc`.

## Install ZCU102 BSP
1. Download the BSP corresponding to the Petalinux version, in the example it is [ZCU102 BSP 2024.1](https://china.xilinx.com/support/download/index.html/content/xilinx/zh/downloadNav/embedded-design-tools/2024-1.html)
2. Activate the Petalinux environment, i.e., in the Petalinux installation directory `source settings.sh`.
3. Create a Petalinux Project based on BSP: `petalinux-create -t project -s xilinx-zcu102-v2024.1-05230256.bsp`
4. This will create a `xilinx-zcu102-2024.1` folder, which contains the parameters needed for QEMU to simulate ZCU102 (device tree), as well as pre-compiled Linux images, device trees, Uboot, etc., that can be directly loaded onto the board.

## Compile Hvisor
Refer to "Running Hvisor on Qemu" for configuring the environment required to compile Hvisor, then in the hvisor directory, execute:
```
make ARCH=aarch64 LOG=info BOARD=zcu102 cp
```
to compile. The directory `/target/aarch64-unknown-none (may vary)/debug/hvisor` contains the required hvisor image.

## Prepare Device Tree
### Use Existing Device Tree
In the Hvisor's image/devicetree directory, there is zcu102-root-aarch64.dts, which is a device tree file that has been tested for booting RootLinux. Compile it as follows:
```
dtc -I dts -O dtb -o zcu102-root-aarch64.dtb zcu102-root-aarch64.dts
```
If the dtc command is invalid, install the device-tree-compiler.
```
sudo apt-get install device-tree-compiler
```
### Prepare Device Tree Yourself
If you have custom requirements for the device, it is recommended to prepare the device tree yourself. You can decompile the `pre-built/linux/images/system.dtb` in the ZCU102 BSP to get a complete device tree, and modify based on `zcu102-root-aarch64.dts`.

## Prepare Image
### Use Existing Image
It is recommended to use the `pre-built/linux/images/Image` from the ZCU102 BSP as the Linux kernel to boot on ZCU102, as its driver configuration is complete.
### Compile Yourself
After testing, the support for ZYNQMP in the Linux source code before version 5.15 is not comprehensive, it is not recommended to use versions before this for compilation. For later versions, you can compile directly following the general compilation process, as the basic support for ZYNQMP in the source code is enabled by default. Specific compilation operations are as follows:
1. Visit the [linux-xlnx](https://github.com/Xilinx/linux-xlnx/tags?after=xilinx-v2023.1) official website to download the Linux source code, it is best to download `zynqmp-soc-for-v6.3`.
2. `tar -xvf zynqmp-soc-for-v6.3` to unzip the source code
3. Enter the unzipped directory, execute the following command using the default configuration, `make ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- defconfig`
4. Compile: `make ARCH=arm64 CROSS_COMPILE=aarch64-linux-gnu- Image -j$(nproc)`
5. After compilation, the directory `arch/arm64/boot/Image` contains the required image.

## Enable QEMU Simulation
1. Activate the Petalinux environment, i.e., in the Petalinux installation directory `source settings.sh`.
2. Enter the `xilinx-zcu102-2024.1` folder, use the following command to start hvisor on the QEMU-simulated ZCU102, where the file paths need to be modified according to your actual situation.
```
# QEMU parameter passing
petalinux-boot --qemu --prebuilt 2 --qemu-args '-device loader,file=hvisor,addr=0x40400000,force-raw=on -device loader,
file=zcu102-root-aarch64.dtb,addr=0x40000000,force-raw=on -device loader,file=zcu102-root-aarch64.dtb,addr=0x04000000,
force-raw=on -device loader,file=/home/hangqi-ren/Image,addr=0x00200000,force-raw=on -drive if=sd,format=raw,index=1,
file=rootfs.ext4' 
# Start hvisor
bootm 0x40400000 - 0x40000000
```