# How to Compile

## Compiling with Docker
### 1. Install Docker
```bash
sudo snap install docker
```
You can also refer to the [Docker official documentation](https://docs.docker.com/install/) to install Docker.

### 2. Build the image

```bash
make build_docker
```

This step builds a Docker image, automatically creating all the dependencies required for compilation.

### 3. Run the container

```bash
make docker
```
This step starts a container, mounts the current directory into the container, and enters the container's shell.

### 4. Compile

Execute the following command in the container to compile.
```bash
make all
```

## Compiling with Local Environment

### 1. Install RustUp and Cargo

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | \
    sh -s -- -y --no-modify-path --profile minimal --default-toolchain nightly
```

### 2. Install the toolchain

The toolchain currently used by the project is as follows:

 - Rust nightly 2023-07-12
 - [rustfmt](https://crates.io/crates/rustfmt)
 - [clippy](https://crates.io/crates/clippy)
 - [cargo-binutils](https://crates.io/crates/cargo-binutils/0.3.6)
 - rust-src
 - llvm-tools-preview
 - target: aarch64-unknown-none

You can check if these tools are installed on your own, or use the following commands to install:

#### (1) Install toml-cli and cargo-binutils

```bash
cargo install toml-cli cargo-binutils
```

#### (2) Install the target platform cross-compilation toolchain

```bash
rustup target add aarch64-unknown-none
```

#### (3) Parse rust-toolchain.toml to install the Rust toolchain

```bash
RUST_VERSION=$(toml get -r rust-toolchain.toml toolchain.channel) && \
Components=$(toml get -r rust-toolchain.toml toolchain.components | jq -r 'join(" ")') && \
rustup install $RUST_VERSION && \
rustup component add --toolchain $RUST_VERSION $Components
```
#### (4) Compile

```bash
make all
```