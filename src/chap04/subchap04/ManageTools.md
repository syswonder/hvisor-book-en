# hvisor Management Tool

hvisor manages the entire system through a Root Linux that manages virtual machines. Root Linux provides services for starting and shutting down virtual machines and starting and shutting down Virtio daemons through a set of management tools. The management tools include a command-line tool and a kernel module. The command-line tool is used to parse and execute commands entered by the user, and the kernel module is used for communication between the command-line tool, Virtio daemon, and Hypervisor. The repository address for the management tools is: [hvisor-tool](https://github.com/syswonder/hvisor-tool).

## Starting Virtual Machines

Users can create a new virtual machine on Root Linux for hvisor by entering the following command:

```
./hvisor zone start [vm_name].json
```

The command-line tool first parses the contents of the `[vm_name].json` file, writing the virtual machine configuration into the `zone_config` structure. Based on the images and dtb files specified in the file, their contents are read into temporary memory through the `read` function. To load the images and dtb files into a specified physical memory address, the `hvisor.ko` kernel module provides the `hvisor_map` function, which can map a physical memory area to user-space virtual address space.

When the command-line tool executes the `mmap` function on `/dev/hvisor`, the kernel calls the `hvisor_map` function to map user virtual memory to the specified physical memory. Afterwards, the image and dtb file contents can be moved from temporary memory to the user-specified physical memory area through a memory copy function.

After the image is loaded, the command-line tool calls `ioctl` on `/dev/hvisor`, specifying the operation code as `HVISOR_ZONE_START`. The kernel module then notifies the Hypervisor through a Hypercall and passes the address of the `zone_config` structure object, informing the Hypervisor to start the virtual machine.

## Shutting Down Virtual Machines

Users can shut down a virtual machine with ID `vm_id` by entering the command:

```
./hvisor shutdown -id [vm_id]
```

This command calls `ioctl` on `/dev/hvisor`, specifying the operation code as `HVISOR_ZONE_SHUTDOWN`. The kernel module then notifies the Hypervisor through a Hypercall, passing `vm_id`, and informs the Hypervisor to shut down the virtual machine.

## Starting Virtio Daemons

Users can start a Virtio device by entering the command:

```
nohup ./hvisor virtio start [virtio_cfg.json] &
```

This will create a Virtio device and initialize related data structures according to the Virtio device information specified in `virtio_cfg.json`. Currently, three types of Virtio devices can be created, including Virtio-net, Virtio-block, and Virtio-console devices.

Since the command-line parameters include `nohup` and `&`, the command will exist in the form of a daemon, with all output of the daemon redirected to `nohup.out`. The daemon's output includes six levels, from low to high: `LOG_TRACE`, `LOG_DEBUG`, `LOG_INFO`, `LOG_WARN`, `LOG_ERROR`, `LOG_FATAL`. When compiling the command-line tool, the LOG level can be specified. For example, when LOG is `LOG_INFO`, outputs equal to or higher than `LOG_INFO` will be recorded in the log file, while `log_trace` and `log_debug` will not be output.

After the Virtio device is created, the Virtio daemon will poll the request submission queue to obtain Virtio requests from other virtual machines. When there are no requests for a long time, it will automatically enter sleep mode.

## Shutting Down Virtio Daemons

Users can shut down the Virtio daemon by entering the command:

```
pkill hvisor
```

The Virtio daemon, when started, registers a signal handler `virtio_close` for the `SIGTERM` signal. When executing `pkill hvisor`, a `SIGTERM` signal is sent to the process named `hvisor`. At this point, the daemon executes `virtio_close`, recycles resources, shuts down various sub-threads, and finally exits.