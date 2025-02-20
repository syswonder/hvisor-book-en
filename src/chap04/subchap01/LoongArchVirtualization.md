# LoongArch Processor Virtualization

The LoongArch instruction set is an independent RISC instruction set released by China's Loongson Zhongke Company in 2020, which includes five modules: the basic instruction set, binary translation extension (LBT), vector extension (LSX), advanced vector extension (LASX), and virtualization extension (LVZ).

This article will provide a brief introduction to the CPU virtualization design of the LoongArch instruction set, with related explanations from the currently publicly available KVM source code and code comments.

## Introduction to LoongArch Registers

### Conventions for General Registers Usage

| Name          | Alias        | Usage                     | Preserved across calls |
| ------------- | ----------- | ------------------------ | ---------------- |
| `$r0`         | `$zero`     | Constant 0               | (constant)         |
| `$r1`         | `$ra`       | Return address           | No               |
| `$r2`         | `$tp`       | Thread pointer           | (not allocatable)     |
| `$r3`         | `$sp`       | Stack pointer            | Yes               |
| `$r4 - $r5`   | `$a0 - $a1` | Argument/return value registers | No               |
| `$r6 - $r11`  | `$a2 - $a7` | Argument registers       | No               |
| `$r12 - $r20` | `$t0 - $t8` | Temporary registers      | No               |
| `$r21`        | Reserved    | (not allocatable)        |                  |
| `$r22`        | `$fp / $s9` | Frame pointer / static register | Yes               |
| `$r23 - $r31` | `$s0 - $s8` | Static registers         | Yes               |

### Conventions for Floating Point Registers Usage

| Name          | Alias           | Usage                     | Preserved across calls |
| ------------- | -------------- | ------------------------ | ---------------- |
| `$f0 - $f1`   | `$fa0 - $fa1`  | Argument/return value registers | No               |
| `$f2 - $f7`   | `$fa2 - $fa7`  | Argument registers       | No               |
| `$f8 - $f23`  | `$ft0 - $ft15` | Temporary registers      | No               |
| `$f24 - $f31` | `$fs0 - $fs7`  | Static registers         | Yes               |

Temporary registers are also known as caller-saved registers. Static registers are also known as callee-saved registers.

### CSR Registers

**Control and Status Register (CSR)** is a special class of registers in the LoongArch architecture used to control the processor's operational state.
List of CSR registers (excluding new CSRs in the LVZ virtualization extension):

| Number              | Name                                  | Number              | Name                                  | Number             | Name                                  |
| ----------------- | ------------------------------------- | ----------------- | ------------------------------------- | ---------------- | ------------------------------------- |
| 0x0               | Current mode information `CRMD`       | 0x1               | Exception prior mode information `PRMD` | 0x2              | Extension part enable `EUEN`         |
| 0x3               | Miscellaneous control `MISC`         | 0x4               | Exception configuration `ECFG`        | 0x5              | Exception status `ESTAT`            |
| 0x6               | Exception return address `ERA`       | 0x7               | Error virtual address `BADV`         | 0x8              | Error instruction `BADI`           |
| 0xc               | Exception entry address `EENTRY`     | 0x10              | TLB index `TLBIDX`                   | 0x11             | TLB entry high `TLBEHI`             |
| 0x12              | TLB entry low 0 `TLBELO0`            | 0x13              | TLB entry low 1 `TLBELO1`            | 0x18             | Address space identifier `ASID`     |
| 0x19              | Low half address space global directory base `PGDL` | 0x1A              | High half address space global directory base `PGDH` | 0x1B             | Global directory base `PGD`        |
| 0x1C              | Page table traversal control low half `PWCL` | 0x1D              | Page table traversal control high half `PWCH` | 0x1E             | STLB page size `STLBPS`            |
| 0x1F              | Reduced virtual address configuration `RVACFG` | 0x20              | Processor number `CPUID`            | 0x21             | Privilege resource configuration info 1 `PRCFG1` |
| 0x22              | Privilege resource configuration info 2 `PRCFG2` | 0x23              | Privilege resource configuration info 3 `PRCFG3` | 0x30+n (0≤n≤15)  | Data save `SAVEn`                  |
| 0x40              | Timer number `TID`                  | 0x41              | Timer configuration `TCFG`           | 0x42             | Timer value `TVAL`                 |
| 0x43              | Timer compensation `CNTC`           | 0x44              | Timer interrupt clear `TICLR`        | 0x60             | LLBit control `LLBCTL`             |
| 0x80              | Implementation related control 1 `IMPCTL1` | 0x81              | Implementation related control 2 `IMPCTL2` | 0x88             | TLB refill exception entry address `TLBRENTRY` |
| 0x89              | TLB refill exception error virtual address `TLBRBADV` | 0x8A              | TLB refill exception return address `TLBRERA` | 0x8B             | TLB refill exception data save `TLBRSAVE` |
| 0x8C              | TLB refill exception entry low 0 `TLBRELO0` | 0x8D              | TLB refill exception entry low 1 `TLBRELO1` | 0x8E             | TLB refill exception entry high `TLBREHI` |
| 0x8F              | TLB refill exception prior mode information `TLBRPRMD` | 0x90              | Machine error control `MERRCTL`     | 0x91             | Machine error information 1 `MERRINFO1` |
| 0x92              | Machine error information 2 `MERRINFO2` | 0x93              | Machine error exception entry address `MERRENTRY` | 0x94             | Machine error exception return address `MERRERA` |
| 0x95              | Machine error exception data save `MERRSAVE` | 0x98              | Cache tag `CTAG`                    | 0x180+n (0≤n≤3)  | Direct mapping configuration window n `DMWn` |
| 0x200+2n (0≤n≤31) | Performance monitoring configuration n `PMCFGn` | 0x201+2n (0≤n≤31) | Performance monitoring counter n `PMCNTn` | 0x300            | Load/store monitor point overall control `MWPC` |
| 0x301             | Load/store monitor point overall status `MWPS` | 0x310+8n (0≤n≤7)  | Load/store monitor point n configuration 1 `MWPnCFG1` | 0x311+8n (0≤n≤7) | Load/store monitor point n configuration 2 `MWPnCFG2` |
| 0x312+8n (0≤n≤7)  | Load/store monitor point n configuration 3 `MWPnCFG3` | 0x313+8n (0≤n≤7)  | Load/store monitor point n configuration 4 `MWPnCFG4` | 0x380            | Instruction fetch monitor point overall control `FWPC` |
| 0x381             | Instruction fetch monitor point overall status `FWPS` | 0x390+8n (0≤n≤7)  | Instruction fetch monitor point n configuration 1 `FWPnCFG1` | 0x391+8n (0≤n≤7) | Instruction fetch monitor point n configuration 2 `FWPnCFG2` |
| 0x392+8n (0≤n≤7)  | Instruction fetch monitor point n configuration 3 `FWPnCFG3` | 0x393+8n (0≤n≤7)  | Instruction fetch monitor point n configuration 4 `FWPnCFG4` | 0x500            | Debug register `DBG`                |
| 0x501             | Debug exception return address `DERA` | 0x502             | Debug data save `DSAVE`             |                  |                                       |

For processors that have implemented the LVZ virtualization extension, there is an additional set of CSR registers for controlling virtualization.

| Number | Name                     |
| ---- | ------------------------ |
| 0x15 | Guest TLB control `GTLBC`    |
| 0x16 | TLBRD read Guest item `TRGP`    |
| 0x50 | Guest status `GSTAT`       |
| 0x51 | Guest control `GCTL`        |
| 0x52 | Guest interrupt control `GINTC`   |
| 0x53 | Guest counter compensation `GCNTC` |

### GCSR Register Group

In LoongArch processors that implement virtualization, there is an additional group of **GCSR (Guest Control and Status Register)** registers.

### Process of Entering Guest Mode (from Linux KVM source code)

1. **`switch_to_guest`**:
2. Clear the `CSR.ECFG.VS` field (set to 0, i.e., all exceptions share one entry address)
3. Read the guest eentry saved in the Hypervisor (guest OS interrupt vector address) -> GEENTRY
   1. Then write GEENTRY to `CSR.EENTRY`
4. Read the guest era saved in the Hypervisor (guest OS exception return address) -> GPC
   1. Then write GPC to `CSR.ERA`
5. Read the `CSR.PGDL` global page table address, save it in the Hypervisor
6. Load the guest pgdl from the Hypervisor into `CSR.PGDL`
7. Read `CSR.GSTAT.GID` and `CSR.GTLBC.TGID`, write to `CSR.GTLBC`
8. Set `CSR.PRMD.PIE` to 1, turn on Hypervisor-level global interrupts
9. Set `CSR.GSTAT.PGM` to 1, the purpose is to make the ertn instruction enter guest mode
10. The Hypervisor restores the guest's general registers (GPRS) saved by itself to the hardware registers (restore the scene)
11. **Execute the `ertn` instruction, enter guest mode**

## Virtualization-related Exceptions

| code | subcode | Abbreviation | Introduction                                                                                                                                       |
| ------ | ------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 22     | -       | GSPR | Guest-sensitive privileged resource exception, triggered by `cpucfg`, `idle`, `cacop` instructions, and when the virtual machine accesses non-existent GCSR and IOCSR, forcing a trap into the Hypervisor for processing (such as software simulation) |
| 23     | -       | HVC  | Exception triggered by the hvcl supercall instruction                                                                                                                         |
| 24     | 0       | GCM  | Guest GCSR software modification exception                                                                                                                             |
| 24     | 1       | GCHC | Guest GCSR hardware modification exception                                                                                                                             |

### Process of Handling Exceptions Under Guest Mode (from Linux KVM source code)

1. **`kvm_exc_entry`**:
2. The Hypervisor first saves the guest's general registers (GPRS), protecting the scene.
3. The Hypervisor saves `CSR.ESTAT` -> host ESTAT
4. The Hypervisor saves `CSR.ERA` -> GPC
5. The Hypervisor saves `CSR.BADV` -> host BADV, i.e., when an address error exception is triggered, the erroneous virtual address is recorded
6. The Hypervisor saves `CSR.BADI` -> host BADI, this register is used to record the instruction code of the instruction that triggered the synchronous class exception, synchronous class exceptions refer to all exceptions except for interrupts (INT), guest CSR hardware modification exceptions (GCHC), and machine error exceptions (MERR).
7. Read the host ECFG saved by the Hypervisor, write to `CSR.ECFG` (i.e., switch to the host's exception configuration)
8. Read the host EENTRY saved by the Hypervisor, write to `CSR.EENTRY`
9. Read the host PGD saved by the Hypervisor, write to `CSR.PGDL` (restore the host page table global directory base, low half space)
10. Set `CSR.GSTAT.PGM` off
11. Clear the `GTLBC.TGID` field
12. Restore kvm per CPU registers
    1. The kvm assembly involves KVM_ARCH_HTP, KVM_ARCH_HSP, KVM_ARCH_HPERCPU
13. **Jump to KVM_ARCH_HANDLE_EXIT to handle the exception**
14. Determine if the return of the function just now is <=0
    1. If <=0, continue running the host
    2. Otherwise, continue running the guest, save percpu registers, as it may switch to a different CPU to continue running the guest. Save host percpu registers to `CSR.KSAVE` register

15. Jump to `switch_to_guest`

## vCPU Context Registers to be Saved

According to the LoongArch function call specification, if you need to manually switch the CPU function running context, the registers to be saved are as follows (excluding floating point registers): `$s0`-`$s9`, `$sp`, `$ra`

## References

[1] Loongson Zhongke Technology Co., Ltd. Loongson Architecture ELF psABI Specification. Version 2.01.

[2] Loongson Zhongke Technology Co., Ltd. Loongson Architecture Reference Manual. Volume One: Basic Architecture.

[3] [https://github.com/torvalds/linux/blob/master/arch/loongarch/kvm/switch.S](https://github.com/torvalds/linux/blob/master/arch/loongarch/kvm/switch.S).