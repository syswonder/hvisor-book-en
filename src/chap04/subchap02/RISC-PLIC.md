# Source of Interruptions
In hvisor, there are three types of interrupts: timer interrupts, software interrupts, and external interrupts.

Timer Interrupt: A timer interrupt is generated when the time register becomes greater than the timecmp register.

Software Interrupt: In a multi-core system, one hart sends an inter-core interrupt to another hart, implemented through an SBI call.

External Interrupt: External devices send interrupt signals to the processor through interrupt lines.

# Timer Interrupt
When a virtual machine needs to trigger a timer interrupt, it traps into hvisor through the ecall instruction.
```rust
        ExceptionType::ECALL_VS => {
            trace!("ECALL_VS");
            sbi_vs_handler(current_cpu);
            current_cpu.sepc += 4;
        }
        ...
pub fn sbi_vs_handler(current_cpu: &mut ArchCpu) {
    let eid: usize = current_cpu.x[17];
    let fid: usize = current_cpu.x[16];
    let sbi_ret;
    match eid {
        ...
            SBI_EID::SET_TIMER => {
            sbi_ret = sbi_time_handler(fid, current_cpu);
        }
        ...
    }
}
```
If the sstc extension is not enabled, it is necessary to trap into machine mode through an SBI call, set the mtimecmp register, clear the virtual machine's timer interrupt pending bit, and enable hvisor's timer interrupt; if the sstc extension is enabled, stimecmp can be set directly.
```rs
pub fn sbi_time_handler(fid: usize, current_cpu: &mut ArchCpu) -> SbiRet {
...
    if current_cpu.sstc {
        write_csr!(CSR_VSTIMECMP, stime);
    } else {
        set_timer(stime);
        unsafe {
            // clear guest timer interrupt pending
            hvip::clear_vstip();
            // enable timer interrupt
            sie::set_stimer();
        }
    }
    return sbi_ret;
}
```
When the time register becomes greater than the timecmp register, a timer interrupt is generated.

After the interrupt is triggered, the trap context is saved, and dispatched to the corresponding handling function.
```rs
        InterruptType::STI => {
            unsafe {
                hvip::set_vstip();
                sie::clear_stimer();
            }
        }
```
Set the virtual machine's timer interrupt pending bit to 1, injecting a timer interrupt into the virtual machine, and clear hvisor's timer interrupt enable bit to complete the interrupt handling.

# Software Interrupt
When a virtual machine needs to send an IPI, it traps into hvisor through the ecall instruction.
```rs
        SBI_EID::SEND_IPI => {
            ...
            sbi_ret = sbi_call_5(
                eid,
                fid,
                current_cpu.x[10],
                current_cpu.x[11],
                current_cpu.x[12],
                current_cpu.x[13],
                current_cpu.x[14],
            );
        }
```
Then through an SBI call, trap into machine mode to send an IPI to the specified hart, setting the SSIP bit in the mip register to inject an inter-core interrupt into hvisor.

After the interrupt is triggered, the trap context is saved, and dispatched to the corresponding handling function.
```rs
pub fn handle_ssi(current_cpu: &mut ArchCpu) {
    ...
    clear_csr!(CSR_SIP, 1 << 1);
    set_csr!(CSR_HVIP, 1 << 2);
    check_events();
}
```
Set the virtual machine's software interrupt pending bit to 1, injecting a software interrupt into the virtual machine. Then determine the type of inter-core interrupt, wake or block the CPU, or handle VIRTIO-related interrupt requests.

# External Interrupt
## PLIC
RISC-V implements external interrupt handling through PLIC, which does not support virtualization or MSI.

The architectural diagram of PLIC.

The interrupt process of PLIC is shown in the following diagram.

The interrupt source sends an interrupt signal to the PLIC through the interrupt line, and only when the interrupt priority is greater than the threshold, it can pass through the threshold register's filter.

Then read the claim register to get the pending highest priority interrupt, then clear the corresponding pending bit. Pass it to the target hart for interrupt handling.

After handling, write the interrupt number to the complete register to receive the next interrupt request.
## Initialization
The initialization process is similar to AIA.
## Handling Process
When an external interrupt is triggered in the virtual machine, it will access the vPLIC address space, however, PLIC does not support virtualization, and this address space is unmapped. Therefore, a page fault exception will be triggered, trapping into hvisor for handling.

After the exception is triggered, the trap context is saved, and enters the page fault exception handling function.

```rs
pub fn guest_page_fault_handler(current_cpu: &mut ArchCpu) {
    ...
    if addr >= host_plic_base && addr < host_plic_base + PLIC_TOTAL_SIZE {
        let mut inst: u32 = read_csr!(CSR_HTINST) as u32;
        ...
        if let Some(inst) = inst {
            if addr >= host_plic_base + PLIC_GLOBAL_SIZE {
                vplic_hart_emul_handler(current_cpu, addr, inst);
            } else {
                vplic_global_emul_handler(current_cpu, addr, inst);
            }
            current_cpu.sepc += ins_size;
        } 
        ...
    }
}
```
Determine if the address where the page fault occurred is within the PLIC's address space, then parse the instruction that caused the exception, and modify the PLIC's address space based on the access address and instruction to emulate the configuration for vPLIC.
```rs
pub fn vplic_hart_emul_handler(current_cpu: &mut ArchCpu, addr: GuestPhysAddr, inst: Instruction) {
    ...
    if offset >= PLIC_GLOBAL_SIZE && offset < PLIC_TOTAL_SIZE {
        ...
        if index == 0 {
            // threshold
            match inst {
                Instruction::Sw(i) => {
                    // guest write threshold register to plic core
                    let value = current_cpu.x[i.rs2() as usize] as u32;
                    host_plic.write().set_threshold(context, value);
                }
                _ => panic!("Unexpected instruction threshold {:?}", inst),
            }
            ...
        }
    }
}
```