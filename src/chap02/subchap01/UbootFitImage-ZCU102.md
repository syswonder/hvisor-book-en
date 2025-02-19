# UBOOT FIT Image Creation, Loading, and Booting

wheatfox (enkerewpo@hotmail.com)

This article introduces the basic knowledge related to FIT images, as well as how to create, load, and boot FIT images.

## ITS Source File
ITS is the source code used by uboot to generate FIT images (FIT Image), i.e., Image Tree Source, which uses the Device Tree Source (DTS) syntax format. FIT images can be generated using the mkimage tool provided by uboot.
In the ZCU102 port of hvisor, FIT images are used to package hvisor, root linux, root dtb, and other files into one fitImage, facilitating booting on QEMU and actual hardware.
The ITS file for the ZCU102 platform is located at `scripts/zcu102-aarch64-fit.its`:

```c
/dts-v1/;
/ {
    description = "FIT image for HVISOR with Linux kernel, root filesystem, and DTB";
    images {
        root_linux {
            description = "Linux kernel";
            data = /incbin/("__ROOT_LINUX_IMAGE__");
            type = "kernel";
            arch = "arm64";
            os = "linux";
            ...
        };
        ...
        root_dtb {
            description = "Device Tree Blob";
            data = /incbin/("__ROOT_LINUX_DTB__");
            type = "flat_dt";
            ...
        };
        hvisor {
            description = "Hypervisor";
            data = /incbin/("__HVISOR_TMP_PATH__");
            type = "kernel";
            arch = "arm64";
            ...
        };
    };

    configurations {
        default = "config@1";
        config@1 {
            description = "default";
            kernel = "hvisor";
            fdt = "root_dtb";
        };
    };
};
```

Here, `__ROOT_LINUX_IMAGE__`, `__ROOT_LINUX_DTB__`, `__HVISOR_TMP_PATH__` will be replaced with actual paths by the `sed` command in the Makefile. In the ITS source code, it mainly consists of images and configurations sections. The images section defines the files to be packaged, and the configurations section defines how to combine these files. During UBOOT booting, the files specified in the default configuration in configurations will be automatically loaded to the specified address. Multiple configurations can be set to support the loading of different image configurations at boot time.

The corresponding mkimage command in the Makefile:

```Makefile
.PHONY: gen-fit
gen-fit: $(hvisor_bin) dtb
	@if [ ! -f scripts/zcu102-aarch64-fit.its ]; then \
		echo "Error: ITS file scripts/zcu102-aarch64-fit.its not found."; \
		exit 1; \
	fi
	$(OBJCOPY) $(hvisor_elf) --strip-all -O binary $(HVISOR_TMP_PATH)
# now we need to create the vmlinux.bin
	$(GCC_OBJCOPY) $(ROOT_LINUX_IMAGE) --strip-all -O binary $(ROOT_LINUX_IMAGE_BIN)
	@sed \
		-e "s|__ROOT_LINUX_IMAGE__|$(ROOT_LINUX_IMAGE_BIN)|g" \
		-e "s|__ROOT_LINUX_ROOTFS__|$(ROOT_LINUX_ROOTFS)|g" \
		-e "s|__ROOT_LINUX_DTB__|$(ROOT_LINUX_DTB)|g" \
		-e "s|__HVISOR_TMP_PATH__|$(HVISOR_TMP_PATH)|g" \
		scripts/zcu102-aarch64-fit.its > temp-fit.its
	@mkimage -f temp-fit.its $(TARGET_FIT_IMAGE)
	@echo "Generated FIT image: $(TARGET_FIT_IMAGE)"
```

## Booting hvisor and root linux through FIT image in petalinux qemu

Since a fitImage includes all the necessary files, for qemu, it only needs to load this file into a suitable position in memory through the loader.

Then, qemu boots and enters UBOOT, where the following command can be used to boot (please modify the specific addresses according to the actual situation, and during actual use, all lines can be copied into one line and pasted into UBOOT for booting, or saved to the environment variable `bootcmd`, which requires UBOOT to mount a persistent flash for environment variable storage):

```bash
setenv fit_addr 0x10000000; setenv root_linux_load 0x200000;
imxtract ${fit_addr} root_linux ${root_linux_load}; bootm ${fit_addr};
```

# References

[1] Flat Image Tree (FIT). <https://docs.u-boot.org/en/stable/usage/fit/>