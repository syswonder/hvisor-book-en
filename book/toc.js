// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded affix "><a href="Introduction.html">Introduction</a></li><li class="chapter-item expanded affix "><li class="part-title">About hvisor</li><li class="chapter-item expanded "><a href="chap01/Overview.html"><strong aria-hidden="true">1.</strong> hvisor Overview</a></li><li class="chapter-item expanded "><a href="chap01/ISA.html"><strong aria-hidden="true">2.</strong> Instruction Sets and Processors Supported by hvisor</a></li><li class="chapter-item expanded "><a href="chap01/Board.html"><strong aria-hidden="true">3.</strong> Hardware Platforms Supported by hvisor</a></li><li class="chapter-item expanded "><a href="chap01/PlatformDev.html"><strong aria-hidden="true">4.</strong> hvisor Hardware Adaptation Development Manual 🧑🏻‍💻</a></li><li class="chapter-item expanded affix "><li class="part-title">hvisor Quick Start Guide</li><li class="chapter-item expanded "><a href="chap02/QemuAArch64.html"><strong aria-hidden="true">5.</strong> Quick Start with Qemu AArch64</a></li><li class="chapter-item expanded "><a href="chap02/QemuRISC-V.html"><strong aria-hidden="true">6.</strong> Quick Start with Qemu RISC-V</a></li><li class="chapter-item expanded "><a href="chap02/NXPIMX8.html"><strong aria-hidden="true">7.</strong> Quick Start with NXP i.MX 8</a></li><li class="chapter-item expanded "><a href="chap02/FPGA-Rockechip.html"><strong aria-hidden="true">8.</strong> Quick Start with FPGA-Rockechip</a></li><li class="chapter-item expanded "><a href="chap02/Loongson-3A5000.html"><strong aria-hidden="true">9.</strong> Quick Start with Loongson 3A5000 hvisor</a></li><li class="chapter-item expanded "><a href="chap02/subchap01/Xilinx-ZCU102.html"><strong aria-hidden="true">10.</strong> Quick Start with Xilinx ZCU102 hvisor</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="chap02/subchap01/Qemu-ZCU102.html"><strong aria-hidden="true">10.1.</strong> Qemu ZCU102 hvisor Boot</a></li><li class="chapter-item expanded "><a href="chap02/subchap01/Board-ZCU102.html"><strong aria-hidden="true">10.2.</strong> Board ZCU102 hvisor Multi-mode Boot</a></li><li class="chapter-item expanded "><a href="chap02/subchap01/Nonroot-ZCU102.html"><strong aria-hidden="true">10.3.</strong> ZCU102 Nonroot Boot</a></li><li class="chapter-item expanded "><a href="chap02/subchap01/UbootFitImage-ZCU102.html"><strong aria-hidden="true">10.4.</strong> UBOOT FIT Image Creation, Loading and Booting</a></li></ol></li><li class="chapter-item expanded "><div><strong aria-hidden="true">11.</strong> Quick Start with FPGA Xiangshan Kunming Lake</div></li><li class="chapter-item expanded affix "><li class="part-title">hvisor User Manual</li><li class="chapter-item expanded "><a href="chap03/Compile.html"><strong aria-hidden="true">12.</strong> How to Compile</a></li><li class="chapter-item expanded "><a href="chap03/BootRootLinux.html"><strong aria-hidden="true">13.</strong> Boot Management Linux VM</a></li><li class="chapter-item expanded "><a href="chap03/BootNonRootLinux.html"><strong aria-hidden="true">14.</strong> Boot Two VMs: Linux1 and Linux2</a></li><li class="chapter-item expanded "><a href="chap03/BootNonRootRTOS.html"><strong aria-hidden="true">15.</strong> Boot Two VMs: Linux and RTOS</a></li><li class="chapter-item expanded "><a href="chap03/ZoneConfig.html"><strong aria-hidden="true">16.</strong> ZONE Configuration and Management</a></li><li class="chapter-item expanded "><a href="chap03/CMDTools.html"><strong aria-hidden="true">17.</strong> Command Line Tools</a></li><li class="chapter-item expanded "><a href="chap03/VirtIOUseage.html"><strong aria-hidden="true">18.</strong> Using VirtIO</a></li><li class="chapter-item expanded affix "><li class="part-title">hvisor Architecture and Implementation</li><li class="chapter-item expanded "><a href="chap04/Structure.html"><strong aria-hidden="true">19.</strong> hvisor Architecture</a></li><li class="chapter-item expanded "><a href="chap04/BootAndRun.html"><strong aria-hidden="true">20.</strong> hvisor Boot and Operation</a></li><li class="chapter-item expanded "><a href="chap04/subchap01/CPUVirtualization.html"><strong aria-hidden="true">21.</strong> CPU Virtualization</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="chap04/subchap01/PerCPU.html"><strong aria-hidden="true">21.1.</strong> PerCPU Definition</a></li><li class="chapter-item expanded "><a href="chap04/subchap01/ARMVirtualization.html"><strong aria-hidden="true">21.2.</strong> ARM Processor Virtualization</a></li><li class="chapter-item expanded "><a href="chap04/subchap01/RISCVirtualization.html"><strong aria-hidden="true">21.3.</strong> RISC-V Processor Virtualization</a></li><li class="chapter-item expanded "><a href="chap04/subchap01/LoongArchVirtualization.html"><strong aria-hidden="true">21.4.</strong> LoongArch Processor Virtualization</a></li></ol></li><li class="chapter-item expanded "><a href="chap04/MemVirtualization.html"><strong aria-hidden="true">22.</strong> Memory Virtualization</a></li><li class="chapter-item expanded "><a href="chap04/subchap02/InterruptVirtualization.html"><strong aria-hidden="true">23.</strong> Interrupt Virtualization</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="chap04/subchap02/ARM-GIC.html"><strong aria-hidden="true">23.1.</strong> ARM Interrupt Control GIC</a></li><li class="chapter-item expanded "><a href="chap04/subchap02/RISC-PLIC.html"><strong aria-hidden="true">23.2.</strong> RISC-V Interrupt Control PLIC</a></li><li class="chapter-item expanded "><a href="chap04/subchap02/RISC-AIA.html"><strong aria-hidden="true">23.3.</strong> RISC-V Interrupt Control AIA</a></li><li class="chapter-item expanded "><a href="chap04/subchap02/LoongArch-Controller.html"><strong aria-hidden="true">23.4.</strong> LoongArch Interrupt Control</a></li></ol></li><li class="chapter-item expanded "><a href="chap04/subchap03/IO-Virtualization.html"><strong aria-hidden="true">24.</strong> I/O Virtualization</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="chap04/subchap03/IOMMU/IOMMU-Define.html"><strong aria-hidden="true">24.1.</strong> IOMMU</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="chap04/subchap03/IOMMU/ARM-SMMU.html"><strong aria-hidden="true">24.1.1.</strong> ARM SMMU Implementation</a></li><li class="chapter-item expanded "><a href="chap04/subchap03/IOMMU/RISC-IOMMU.html"><strong aria-hidden="true">24.1.2.</strong> RISC-V IOMMU Standard Implementation</a></li></ol></li></ol></li><li class="chapter-item expanded "><a href="chap04/subchap03/VirtIO/VirtIO-Define.html"><strong aria-hidden="true">25.</strong> VirtIO</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="chap04/subchap03/VirtIO/BlockDevice.html"><strong aria-hidden="true">25.1.</strong> Block</a></li><li class="chapter-item expanded "><a href="chap04/subchap03/VirtIO/NetDevice.html"><strong aria-hidden="true">25.2.</strong> Net</a></li><li class="chapter-item expanded "><a href="chap04/subchap03/VirtIO/ConsoleDevice.html"><strong aria-hidden="true">25.3.</strong> Console</a></li><li class="chapter-item expanded "><a href="chap04/subchap03/VirtIO/GPUDevice.html"><strong aria-hidden="true">25.4.</strong> GPU</a></li></ol></li><li class="chapter-item expanded "><a href="chap04/subchap03/PCI-Virtualization.html"><strong aria-hidden="true">26.</strong> PCI Virtualization</a></li><li class="chapter-item expanded "><a href="chap04/subchap04/ManageTools.html"><strong aria-hidden="true">27.</strong> Hvisor Management Tools</a></li><li><ol class="section"><li class="chapter-item expanded "><a href="chap04/subchap04/HyperCall.html"><strong aria-hidden="true">27.1.</strong> Hypercall</a></li></ol></li><li class="chapter-item expanded "><li class="part-title">hvisor&#39;s Plans</li><li class="chapter-item expanded "><div><strong aria-hidden="true">28.</strong> TODO</div></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split("#")[0];
        if (current_page.endsWith("/")) {
            current_page += "index.html";
        }
        var links = Array.prototype.slice.call(this.querySelectorAll("a"));
        var l = links.length;
        for (var i = 0; i < l; ++i) {
            var link = links[i];
            var href = link.getAttribute("href");
            if (href && !href.startsWith("#") && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The "index" page is supposed to alias the first chapter in the book.
            if (link.href === current_page || (i === 0 && path_to_root === "" && current_page.endsWith("/index.html"))) {
                link.classList.add("active");
                var parent = link.parentElement;
                if (parent && parent.classList.contains("chapter-item")) {
                    parent.classList.add("expanded");
                }
                while (parent) {
                    if (parent.tagName === "LI" && parent.previousElementSibling) {
                        if (parent.previousElementSibling.classList.contains("chapter-item")) {
                            parent.previousElementSibling.classList.add("expanded");
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', function(e) {
            if (e.target.tagName === 'A') {
                sessionStorage.setItem('sidebar-scroll', this.scrollTop);
            }
        }, { passive: true });
        var sidebarScrollTop = sessionStorage.getItem('sidebar-scroll');
        sessionStorage.removeItem('sidebar-scroll');
        if (sidebarScrollTop) {
            // preserve sidebar scroll position when navigating via links within sidebar
            this.scrollTop = sidebarScrollTop;
        } else {
            // scroll sidebar to current active section when navigating via "next/previous chapter" buttons
            var activeSection = document.querySelector('#sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        var sidebarAnchorToggles = document.querySelectorAll('#sidebar a.toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(function (el) {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define("mdbook-sidebar-scrollbox", MDBookSidebarScrollbox);
