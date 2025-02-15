# LoongArch Interrupt Control

Due to the different designs of interrupt controllers for different Loongson processors/development boards (embedded processors like 2K1000 have their own interrupt controller designs, and the 3-series processors have the 7A1000 and 7A2000 bridge chips responsible for external interrupt control), this article mainly introduces the interrupt controller inside the latest **Loongson 7A2000 bridge chip**[1].

## CPU Interrupts

The interrupt configuration of LoongArch is controlled by `CSR.ECFG`. The interrupts in the Loongson architecture are line interrupts, and each processor core can record 13 line interrupts. These interrupts include: 1 inter-core interrupt (IPI), 1 timer interrupt (TI), 1 performance monitoring counter overflow interrupt (PMI), 8 hardware interrupts (HWI0~HWI7), and 2 software interrupts (SWI0~SWI1). All line interrupts are level interrupts and are active high[3].

- **Inter-core Interrupt**: Comes from an external interrupt controller and is recorded at `CSR.ESTAT.IS[12]`.
- **Timer Interrupt**: Originates from an in-core constant frequency timer, triggered when the timer counts down to zero, and is recorded at `CSR.ESTAT.IS[11]`. It is cleared by writing 1 to the `TI` bit of the `CSR.TICLR` register.
- **Performance Counter Overflow Interrupt**: Comes from an in-core performance counter, triggered when any performance counter with interrupt enable has its 63rd bit set to 1, and is recorded at `CSR.ESTAT.IS[10]`. It is cleared by resetting the 63rd bit of the performance counter causing the interrupt or by disabling the interrupt enable of that performance counter.
- **Hardware Interrupts**: Come from an external interrupt controller outside the processor core, 8 hardware interrupts `HWI[7:0]` are recorded at `CSR.ESTAT.IS[9:2]`.
- **Software Interrupts**: Originates from within the processor core, set by writing 1 to `CSR.ESTAT.IS[1:0]` through software instruction, cleared by writing 0.

The index value recorded in the `CSR.ESTAT.IS` domain is also known as the interrupt number (Int Number). For example, the interrupt number for `SWI0` is 0, for `SWI1` is 1, and so on, with `IPI` being 12.

## Traditional IO Interrupts

The diagram above shows the interrupt system of the 3A series processor + 7A series bridge chip. It shows two types of interrupt processes, the upper part shows the interruption through the interrupt line `INTn0`, and the lower part shows the interruption through the HT message packet.

Interrupts `intX` issued by devices (except for PCIe devices operating in MSI mode) are sent to the internal interrupt controller of 7A, routed to the bridge chip pins or converted into HT message packets sent to the 3A's HT controller. The 3A's interrupt controller receives the interrupt through external interrupt pins or HT controller interrupts, and routes it to interrupt a specific processor core[1].

The Loongson 3A5000 chip's **traditional IO interrupts** support 32 interrupt sources, managed in a unified manner as shown below.
Any IO interrupt source can be configured to enable, trigger mode, and the target processor core interrupt pin to be routed. Traditional interrupts do not support cross-chip distribution of interrupts; they can only interrupt processor cores within the same processor chip[2].

## Extended IO Interrupts

In addition to the compatibility with the original traditional IO interrupt mode, starting with 3A5000, **extended I/O interrupts** are supported, which distribute the 256-bit interrupts on the HT bus directly to each processor core, without forwarding through the HT interrupt line, enhancing the flexibility of IO interrupt usage[2].

## References

[1] Loongson Technology Corporation Limited. Loongson 7A2000 Bridge Chip User Manual. V1.0. Chapter 5.

[2] Loongson Technology Corporation Limited. Loongson 3A5000/3B5000 Processor Register Usage Manual - Multi-core Processor Architecture, Register Description and System Software Programming Guide. V1.3. Chapter 11.

[3] Loongson Technology Corporation Limited. Loongson Architecture Reference Manual. Volume One: Basic Architecture.