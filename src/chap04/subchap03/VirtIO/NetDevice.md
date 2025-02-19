# Virtio Network Device

The Virtio network device is essentially a virtual network card. Currently supported features include `VIRTIO_NET_F_MAC`, `VIRTIO_NET_F_STATUS`, `VIRTIO_F_VERSION_1`, `VIRTIO-RING_F_INDIRECT_DESC`, `VIRTIO_RING_F_EVENT_IDX`.

## Description of Virtio Network Device

For the Virtio network device, the type field in VirtIODevice is VirtioTNet, vqs_len is 2, indicating there are 2 Virtqueues, which are the Receive Queue and the Transmit Queue, respectively. The dev pointer points to the virtio_net_dev structure that describes specific information about the network device. In Virtio_net_dev, config is used to represent the MAC address and connection status of the network card, tapfd is the file descriptor of the Tap device corresponding to the device, rx_ready indicates whether the receive queue is available, and event is used for the receive packet thread to monitor the Tap device's readable events through epoll.

```c
typedef struct virtio_net_dev {
    NetConfig config;
    int tapfd;
    int rx_ready;   
    struct hvisor_event *event;
} NetDev;

struct hvisor_event {
    void        (*handler)(int, int, void *);
    void        *param;
    int         fd;
    int         epoll_type;
};
```

## Tap Device and Bridge Device

The implementation of the Virtio network device is based on two virtual devices provided by the Linux kernel: Tap device and bridge device.

A Tap device is an Ethernet device implemented in software by the Linux kernel, and Ethernet frames can be simulated by reading and writing to the Tap device in user space. Specifically, when a process or kernel performs a write operation on the Tap device, it is equivalent to sending a packet to the Tap device. When a read operation is performed on the Tap device, it is equivalent to receiving a packet from the Tap device. Thus, by performing read and write operations on the Tap device, packet transfer between the kernel and the process can be achieved.

The command to create a tap device is: `ip tuntap add dev tap0 mode tap`. This command creates a tap device named tap0. If a process wants to use this device, it needs to first open the /dev/net/tun device, obtain a file descriptor tun_fd, and call ioctl(TUNSETIFF) on it to link the process to the tap0 device. Afterwards, tun_fd actually becomes the file descriptor of the tap0 device, and it can be read, written, and polled.

A bridge device is a virtual device provided by the Linux kernel that functions similarly to a switch. When other network devices are connected to the bridge device, those devices become ports of the bridge device, and the bridge device takes over the packet sending and receiving process of all devices. When other devices receive packets, they are sent directly to the bridge device, which forwards them to other ports based on the MAC address. Therefore, all devices connected to the bridge can communicate with each other.

The command to create a bridge device is: `brctl addbr br0`. The command to connect the physical network card eth0 to br0 is: brctl addif br0 eth0. The command to connect the tap0 device to br0 is: brctl addif br0 tap0.

Before the Virtio network device starts, Root Linux needs to create and start the tap device and bridge device in advance from the command line, and connect the tap device and the physical network card on Root Linux to the bridge device respectively. Each Virtio network device needs to connect to a tap device, ultimately forming a network topology diagram as shown below. In this way, the Virtio network device can transmit packets to the external network by reading and writing to the tap device.

![hvisor-virtio-net](./img/hvisor-virtio-net.svg)

## Sending Packets

The Transmit Virtqueue of the Virtio network device is used to store the send buffer. When the device receives a request from the driver to write to the QueueNotify register, if the QueueSel register points to the Transmit Queue at this time, it indicates that the driver is notifying the device that there is a new packet to send. The Virtio-net device will take out a descriptor chain from the available ring, each descriptor chain corresponds to a packet, and the memory buffer it points to contains the packet data to be sent. The packet data includes 2 parts, the first part is the packet header virtio_net_hdr_v1 structure specified by the Virtio protocol, which contains some description information of the packet, and the second part is the Ethernet frame. To send a packet, just write the Ethernet frame part to the Tap device through the writev function. After the Tap device receives the frame, it will forward it to the bridge device, and the bridge device will forward it to the external network through the physical network card based on the MAC address.

## Receiving Packets

When initializing, the Virtio network device adds the file descriptor of the Tap device to the interest list of the event monitor thread epoll instance. The event monitor thread will loop and call the epoll_wait function to monitor the readable events of the tap device. Once a readable event occurs, indicating that the tap device has received a packet from the kernel, the epoll_wait function returns and executes the packet reception processing function. The processing function will take out a descriptor chain from the available ring of the Receive Virtqueue, read the tap device, write the data into the memory buffer pointed to by the descriptor chain, and update the used ring. The processing function will repeat this step until reading the tap device returns a negative value and errno is EWOULDBLOCK, indicating that there are no new packets in the tap device, and then interrupt to notify other virtual machines to receive packets.