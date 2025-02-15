# LoongArch Processor Virtualization

The LoongArch instruction set is an independent RISC instruction set released by China's Loongson Zhongke Company in 2020, which includes five modules: the basic instruction set, binary translation extension (LBT), vector extension (LSX), advanced vector extension (LASX), and virtualization extension (LVZ).

This article will briefly introduce the CPU virtualization design of the LoongArch instruction set, with related explanations from the publicly available KVM source code and code comments.

## Introduction to LoongArch Registers

### General Register Usage Convention

| Name        | Alias       | Usage                    | Preserved in Call |
|-------------|-------------|--------------------------|-------------------|
| `$r0`       | `$zero`     | Constant 0               | (constant)        |
| `$r1`       | `$ra`       | Return address           | No                |
| `$r2`       | `$tp`       | Thread pointer           | (non-assignable)  |
| `$r3`       | `$sp`       | Stack pointer            | Yes               |
| `$r4 - $r5` | `$a0 - $a1` | Argument/return registers| No                |
| `$r6 - $r11`| `$a2 - $a7` | Argument registers       | No                |
| `$r12 - $r20`| `$t0 - $t8`| Temporary registers      | No                |
| `$r21`      | Reserved    | (non-assignable)         |                   |
| `$r22`      | `$fp / $s9` | Frame pointer / static reg | Yes            |
| `$r23 - $r31`| `$s0 - $s8`| Static registers         | Yes               |

### Floating Point Register Usage Convention

| Name        | Alias       | Usage                    | Preserved in Call |
|-------------|-------------|--------------------------|-------------------|
| `$f0 - $f1` | `$fa0 - $fa1`| Argument/return registers| No                |
| `$f2 - $f7` | `$fa2 - $fa7`| Argument registers       | No                |
| `$f8 - $f23`| `$ft0 - $ft15`| Temporary registers     | No                |
| `$f24 - $f31`| `$fs0 - $fs7`| Static registers        | Yes               |

Temporary registers are also known as caller-saved registers. Static registers are also known as callee-saved registers.

### CSR Registers

**Control and Status Register (CSR)** is a special type of register in the LoongArch architecture used to control the processor's operational state.

For processors that have implemented the LVZ virtualization extension, there is also a set of CSRs for controlling virtualization.

### GCSR Register Set

In LoongArch processors that implement virtualization, there is an additional set of **Guest Control and Status Registers (GCSR)**.

### Entering Guest Mode Process (from Linux KVM source code)

1. **`switch_to_guest`**:
2. Clear the `CSR.ECFG.VS` field (set to 0, i.e., all exceptions use one entry address)
3. Read the guest eentry (guest OS interrupt vector address) saved in Hypervisor -> GEENTRY, then write GEENTRY to `CSR.EENTRY`
4. Read the guest era (guest OS exception return address) saved in Hypervisor -> GPC, then write GPC to `CSR.ERA`
5. Read `CSR.PGDL` global page table address, store in Hypervisor
6. Load guest pgdl from Hypervisor to `CSR.PGDL`
7. Read out `CSR.GSTAT.GID` and `CSR.GTLBC.TGID`, write to `CSR.GTLBC`
8. Set `CSR.PRMD.PIE` to 1, enabling global interrupts at the Hypervisor level
9. Set `CSR.GSTAT.PGM` to 1, aiming to make the ertn instruction enter guest mode
10. Hypervisor restores the guest's general-purpose registers (GPRS) saved earlier to the hardware registers (restoring the context)
11. **Execute the `ertn` instruction, entering guest mode**

## Virtualization-related Exceptions

| code | subcode | abbreviation | description |
|------|---------|--------------|-------------|
| 22   | -       | GSPR         | Guest-sensitive privilege resource exception, triggered by `cpucfg`, `idle`, `cacop` instructions, and when a virtual machine accesses non-existent GCSR and IOCSR, forcing a trap into Hypervisor for handling (e.g., software emulation) |
| 23   | -       | HVC          | Exception triggered by hvcl supercall instruction |
| 24   | 0       | GCM          | Guest GCSR software modification exception |
| 24   | 1       | GCHC         | Guest GCSR hardware modification exception |

### Handling Exceptions in Guest Mode Process (from Linux KVM source code)

1. **`kvm_exc_entry`**:
2. Hypervisor first saves the guest's general-purpose registers (GPRS), protecting the context.
3. Hypervisor saves `CSR.ESTAT` -> host ESTAT
4. Hypervisor saves `CSR.ERA` -> GPC
5. Hypervisor saves `CSR.BADV` -> host BADV, which records the erroneous virtual address when an address error exception is triggered
6. Hypervisor saves `CSR.BADI` -> host BADI, which records the opcode of the instruction that triggered the synchronous class exception, excluding interrupts (INT), guest CSR hardware modification exceptions (GCHC), and machine error exceptions (MERR).
7. Read the host ECFG saved by Hypervisor, write to `CSR.ECFG` (i.e., switch to host's exception configuration)
8. Read the host EENTRY saved by Hypervisor, write to `CSR.EENTRY`
9. Read the host PGD saved by Hypervisor, write to `CSR.PGDL` (restoring host page table global directory base address, lower half space)
10. Set `CSR.GSTAT.PGM` off
11. Clear `GTLBC.TGID` field
12. Restore kvm per CPU registers
    1. Involving KVM_ARCH_HTP, KVM_ARCH_HSP, KVM_ARCH_HPERCPU in kvm assembly
13. **Jump to KVM_ARCH_HANDLE_EXIT position to handle the exception**
14. Determine if the recent function ret is <=0
    1. If <=0, continue running host
    2. Otherwise, continue running guest, save percpu registers, as it may switch to a different CPU to continue running guest. Save host percpu registers to `CSR.KSAVE` register

15. Jump to `switch_to_guest`

## vCPU Context Registers to be Saved

According to the LoongArch function call standard, the registers to be saved when manually switching CPU function running context are (excluding floating point registers): `$s0`-`$s9`, `$sp`, `$ra`

## References

[1] Loongson Zhongke Technology Co., Ltd. Loongson Architecture ELF psABI Specification. Version 2.01.

[2] Loongson Zhongke Technology Co., Ltd. Loongson Architecture Reference Manual. Volume One: Basic Architecture.

[3] [https://github.com/torvalds/linux/blob/master/arch/loongarch/kvm/switch.S](https://github.com/torvalds/linux/blob/master/arch/loongarch/kvm/switch.S).