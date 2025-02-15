<div align=center>
	<img src="img/hvisor-logo.svg"/>
</div>

# Welcome to hvisor!

[hvisor](https://github.com/syswonder/hvisor) is a lightweight Type-1 virtual machine monitor written in Rust, offering efficient resource management and low-overhead virtualization performance.

Features
1. **Cross-platform support**: Supports multiple architectures including AARCH64, RISC-V, and LoongArch.
2. **Lightweight**: Focuses on core virtualization features, avoiding unnecessary complexity found in traditional virtualization solutions, suitable for resource-constrained environments.
3. **Efficient**: Runs directly on hardware without going through the OS layer, providing near-native performance.
4. **Security**: Rust is known for its memory safety and concurrent programming model, helping to reduce common system-level programming errors such as memory leaks and data races.
5. **Fast startup**: Simple design with short boot times, suitable for scenarios requiring rapid deployment of virtualization.

Main Functions

1. **Virtual machine management**: Provides basic management functions such as creating, starting, stopping, and deleting virtual machines.
2. **Resource allocation and isolation**: Supports efficient allocation and management of CPU, memory, and I/O devices, using virtualization technology to ensure isolation between different virtual machines, enhancing system security and stability.

Use Cases

1. **Edge computing**: Suitable for running on edge devices, providing virtualization support for IoT and edge computing scenarios.
2. **Development and testing**: Developers can quickly create and destroy virtual machine environments for software development and testing.
3. **Security research**: Provides an isolated environment for security research and malware analysis.