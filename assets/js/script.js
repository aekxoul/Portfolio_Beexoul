"use strict";

/**
 * Home page specific script:
 * 1. Skills & Tools interactive toggle
 * 2. Experience, Education & Projects tabs
 */
document.addEventListener("DOMContentLoaded", () => {
    // 1. Skills & Tools toggle
    const toggleBtnBox = document.querySelector("[data-toggle-box]");
    const toggleBtns = document.querySelectorAll("[data-toggle-btn]");
    const skillsBox = document.querySelector("[data-skills-box]");

    if (toggleBtns.length && toggleBtnBox && skillsBox) {
        toggleBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                toggleBtnBox.classList.toggle("active");
                toggleBtns.forEach((toggleBtn) => toggleBtn.classList.toggle("active"));
                skillsBox.classList.toggle("active");
            });
        });
    }

    // 2. Experience, Education & Projects Tab Switcher
    const resumeTabButtons = document.querySelectorAll("[data-resume-tabs] .tab-btn");
    const resumePanels = document.querySelectorAll(".resume-panel");

    function switchResumeTab(targetId, updateHash = true) {
        if (!targetId) return;

        let found = false;
        resumeTabButtons.forEach((btn) => {
            const isMatch = btn.getAttribute("data-tab-target") === targetId;
            btn.classList.toggle("active", isMatch);
            btn.setAttribute("aria-selected", isMatch ? "true" : "false");
            if (isMatch) found = true;
        });

        if (!found) return;

        resumePanels.forEach((panel) => {
            const isMatch = panel.getAttribute("id") === targetId;
            panel.classList.toggle("active", isMatch);
        });

        if (updateHash) {
            let hashName = "experience";
            if (targetId === "panel-education") hashName = "education";
            else if (targetId === "panel-projects") hashName = "projects";

            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, "", `#${hashName}`);
            }
        }

        // Trigger scroll spy update if AppCore exists
        if (window.AppCore && typeof window.AppCore.initScrollSpy === "function") {
            const navLinks = document.querySelectorAll(".navbar-link");
            let activeName = "experience";
            if (targetId === "panel-education") activeName = "education";
            else if (targetId === "panel-projects") activeName = "projects";

            navLinks.forEach((link) => {
                const href = link.getAttribute("href");
                if (href === `#${activeName}` || href?.endsWith(`#${activeName}`)) {
                    link.classList.add("active");
                } else if (href?.startsWith("#") || href?.includes("index.html#")) {
                    if (["#experience", "#education", "#projects"].some(h => href.includes(h))) {
                        link.classList.remove("active");
                    }
                }
            });
        }
    }

    if (resumeTabButtons.length && resumePanels.length) {
        resumeTabButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const targetId = btn.getAttribute("data-tab-target");
                switchResumeTab(targetId, true);
            });
        });

        // Listen for navbar clicks to directly activate corresponding tab
        document.querySelectorAll('a[href="#experience"], a[href="#education"], a[href="#projects"]').forEach((link) => {
            link.addEventListener("click", (e) => {
                const href = link.getAttribute("href");
                let panelId = "panel-experience";
                if (href === "#education") panelId = "panel-education";
                else if (href === "#projects") panelId = "panel-projects";

                switchResumeTab(panelId, false);
            });
        });

        // Check initial hash on load
        function handleInitialHash() {
            const hash = window.location.hash.toLowerCase();
            if (hash === "#education") {
                switchResumeTab("panel-education", false);
            } else if (hash === "#projects") {
                switchResumeTab("panel-projects", false);
            } else if (hash === "#experience") {
                switchResumeTab("panel-experience", false);
            }
        }

        handleInitialHash();
        window.addEventListener("hashchange", handleInitialHash);
    }

    // 3. Footer interactions (Dynamic year, Copy email, Back to top)
    const footerYear = document.getElementById("footer-year");
    if (footerYear) {
        footerYear.textContent = new Date().getFullYear();
    }

    const footerCopyBtn = document.getElementById("footer-copy-btn");
    const footerCopyTooltip = document.getElementById("footer-copy-tooltip");
    const footerCopyIcon = document.getElementById("footer-copy-icon");

    if (footerCopyBtn) {
        footerCopyBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const email = footerCopyBtn.getAttribute("data-email") || "notbeexoul@gmail.com";
            let copied = false;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(email);
                    copied = true;
                } catch {
                    copied = false;
                }
            }

            if (!copied) {
                try {
                    const tempInput = document.createElement("input");
                    tempInput.value = email;
                    tempInput.style.position = "fixed";
                    tempInput.style.opacity = "0";
                    document.body.appendChild(tempInput);
                    tempInput.focus();
                    tempInput.select();
                    copied = document.execCommand("copy");
                    document.body.removeChild(tempInput);
                } catch {
                    copied = false;
                }
            }

            if (footerCopyTooltip) {
                footerCopyTooltip.textContent = copied ? "Copied!" : "Copy failed";
                footerCopyTooltip.classList.add("show");
            }

            if (footerCopyIcon) {
                footerCopyIcon.setAttribute("name", copied ? "checkmark-outline" : "alert-circle-outline");
            }

            setTimeout(() => {
                if (footerCopyTooltip) {
                    footerCopyTooltip.classList.remove("show");
                    setTimeout(() => {
                        footerCopyTooltip.textContent = "Copy";
                    }, 200);
                }
                if (footerCopyIcon) {
                    footerCopyIcon.setAttribute("name", "copy-outline");
                }
            }, 2000);
        });
    }

    const footerBackToTop = document.getElementById("footer-back-to-top");
    if (footerBackToTop) {
        footerBackToTop.addEventListener("click", (e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }
});

