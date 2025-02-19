# LoongArch Processor Virtualization

The LoongArch instruction set is an independent RISC instruction set released by China's Loongson Zhongke Company in 2020, which includes five modules: the basic instruction set, binary translation extension (LBT), vector extension (LSX), advanced vector extension (LASX), and virtualization extension (LVZ).

This article will briefly introduce the CPU virtualization design of the LoongArch instruction set, with related explanations from the currently publicly available KVM source code and code comments.

## Introduction to LoongArch Registers

### General Register Usage Convention

| Name          | Alias       | Usage                      | Preserved across calls |
| ------------- | ----------- | -------------------------- | ---------------------- |
| `$r0`         | `$zero`     | Constant 0                 | (Constant)             |
| `$r1`         | `$ra`       | Return address             | No                     |
| `$r2`         | `$tp`       | Thread pointer             | (Unallocatable)        |
| `$r3`         | `$sp`       | Stack pointer              | Yes                    |
| `$r4 - $r5`   | `$a0 - $a1` | Argument/return value regs | No                     |
| `$r6 - $r11`  | `$a2 - $a7` | Argument registers         | No                     |
| `$r12 - $r20` | `$t0 - $t8` | Temporary registers        | No                     |
| `$r21`        | Reserved    | (Unallocatable)            |                        |
| `$r22`        | `$fp / $s9` | Frame pointer / static reg | Yes                    |
| `$r23 - $r31` | `$s0 - $s8` | Static registers           | Yes                    |

### Floating Point Register Usage Convention

| Name          | Alias        | Usage                      | Preserved across calls |
| ------------- | ------------ | -------------------------- | ---------------------- |
| `$f0 - $f1`   | `$fa0 - $fa1`| Argument/return value regs | No                     |
| `$f2 - $f7`   | `$fa2 - $fa7`| Argument registers         | No                     |
| `$f8 - $f23`  | `$ft0 - $ft15`| Temporary registers       | No                     |
| `$f24 - $f31` | `$fs0 - $fs7`| Static registers           | Yes                    |

Temporary registers are also known as caller-saved registers. Static registers are also known as callee-saved registers.

### CSR Registers

**Control and Status Register (CSR)** is a special type of register in the LoongArch architecture used to control the processor's operational state. List of CSR registers (excluding new CSRs in the LVZ virtualization extension):

(Here follows a table of various CSR registers, their numbers, and names, organized in three columns.)

For processors that have implemented the LVZ virtualization extension, there is also a set of CSRs for controlling virtualization.

### GCSR Registers

In LoongArch processors that implement virtualization, there is an additional set of **GCSR (Guest Control and Status Register)** registers.

### Process of Entering Guest Mode (from Linux KVM source code)

(Here follows a detailed list of steps for entering guest mode, involving various CSR operations and transitions between host and guest modes.)

## Virtualization-related Exceptions

(Here follows a table of exception codes, subcodes, abbreviations, and descriptions related to virtualization, such as guest-sensitive privilege resource exceptions, hypercall exceptions, and guest GCSR modification exceptions.)

### Process for Handling Exceptions in Guest Mode (from Linux KVM source code)

(Here follows a detailed list of steps for handling exceptions in guest mode, including saving and restoring registers and switching between host and guest configurations.)

## vCPU Context Registers to be Saved

According to the LoongArch function call convention, if manual switching of the CPU function running context is required, the following registers need to be saved (excluding floating-point registers): `$s0`-`$s9`, `$sp`, `$ra`

## References

(Here follows a list of references including technical documents from Loongson Zhongke Technology Co., Ltd. and a link to relevant Linux KVM source code on GitHub.)