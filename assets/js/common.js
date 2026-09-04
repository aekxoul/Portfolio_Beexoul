"use strict";

/**
 * Common Core Utilities for Beexoul Portfolio
 * - Theme persistence & synchronization (Dark / Light)
 * - Smart header scroll hide/show
 * - Mobile navigation menu toggle
 * - Safe HTML, attribute, & URL sanitization (XSS prevention)
 * - Offline posts caching & Service Worker registration
 */

const THEME_KEY = "beexoul_theme_pref";
const DARK_THEME = "dark_theme";
const LIGHT_THEME = "light_theme";
const POSTS_CACHE_KEY = "beexoul_cached_posts";

const AppCore = {
    /**
     * Get stored theme or default to dark_theme
     */
    getStoredTheme() {
        try {
            return localStorage.getItem(THEME_KEY) || localStorage.getItem("theme") || DARK_THEME;
        } catch {
            return DARK_THEME;
        }
    },

    /**
     * Apply theme to body and update all toggle buttons
     */
    applyTheme(theme) {
        const isLight = theme === LIGHT_THEME;
        const validTheme = isLight ? LIGHT_THEME : DARK_THEME;

        document.body.classList.remove(DARK_THEME, LIGHT_THEME);
        document.body.classList.add(validTheme);

        try {
            localStorage.setItem(THEME_KEY, validTheme);
            localStorage.setItem("theme", validTheme);
        } catch {}

        // Update all theme buttons across pages
        const themeBtns = document.querySelectorAll("[data-theme-btn], .theme-toggle");
        themeBtns.forEach((btn) => {
            if (isLight) {
                btn.classList.add("active");
                if (btn.classList.contains("theme-toggle")) {
                    btn.textContent = "🌙";
                }
            } else {
                btn.classList.remove("active");
                if (btn.classList.contains("theme-toggle")) {
                    btn.textContent = "🌓";
                }
            }
        });
    },

    /**
     * Toggle between dark and light themes
     */
    toggleTheme() {
        const isCurrentDark = document.body.classList.contains(DARK_THEME);
        this.applyTheme(isCurrentDark ? LIGHT_THEME : DARK_THEME);
    },

    /**
     * Escape special HTML characters to prevent XSS attacks
     */
    escapeHtml(str) {
        if (str == null) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    },

    /**
     * Escape attribute strings safely
     */
    escapeAttribute(str) {
        return this.escapeHtml(str);
    },

    /**
     * Sanitize URLs to prevent javascript: pseudo-protocol XSS
     */
    sanitizeUrl(url) {
        if (!url || typeof url !== "string") return "";
        const trimmed = url.trim();
        // Allow relative URLs, http, https, and data:image
        if (/^(https?:\/\/|\/|\.\/|\.\.\/|data:image\/|mailto:)/i.test(trimmed)) {
            return trimmed;
        }
        return "#";
    },

    /**
     * Save posts data to localStorage for instant offline access
     */
    savePostsToStorage(posts) {
        if (!posts || !Array.isArray(posts)) return;
        try {
            localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(posts));
        } catch (e) {
            console.warn("Storage quota exceeded or unavailable:", e);
        }
    },

    /**
     * Get posts data from localStorage
     */
    getPostsFromStorage() {
        try {
            const raw = localStorage.getItem(POSTS_CACHE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    /**
     * Initialize Service Worker and offline indicator
     */
    initOfflineSupport() {
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => {
                // Determine sw.js path relative to current page location
                const pathname = window.location.pathname;
                let swPath = "./sw.js";
                if (pathname.includes("/blog/assets/post/")) {
                    swPath = "../../../sw.js";
                } else if (pathname.includes("/blog/")) {
                    swPath = "../sw.js";
                }

                navigator.serviceWorker
                    .register(swPath)
                    .then((reg) => {
                        // Check for updates
                        reg.addEventListener("updatefound", () => {
                            const newWorker = reg.installing;
                            if (newWorker) {
                                newWorker.addEventListener("statechange", () => {
                                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                                        console.log("New version of site available in background.");
                                    }
                                });
                            }
                        });
                    })
                    .catch((err) => {
                        console.warn("ServiceWorker registration failed:", err);
                    });
            });
        }

        // Offline status indicator
        const updateOnlineStatus = () => {
            let badge = document.getElementById("offline-status-badge");
            if (!navigator.onLine) {
                if (!badge) {
                    badge = document.createElement("div");
                    badge.id = "offline-status-badge";
                    badge.className = "offline-status-badge";
                    badge.setAttribute("role", "status");
                    badge.setAttribute("aria-live", "polite");
                    badge.innerHTML = `
                        <span class="offline-dot"></span>
                        <span>Offline &bull; Viewing Cached Site</span>
                    `;
                    document.body.appendChild(badge);
                }
                setTimeout(() => badge.classList.add("visible"), 50);
            } else if (badge) {
                badge.classList.remove("visible");
            }
        };

        window.addEventListener("online", updateOnlineStatus);
        window.addEventListener("offline", updateOnlineStatus);
        if (!navigator.onLine) {
            updateOnlineStatus();
        }
    },

    /**
     * Initialize common page elements (nav, header, scroll, theme)
     */
    initCommonUI() {
        // 1. Initial theme load
        this.applyTheme(this.getStoredTheme());

        // 2. Theme toggle button listeners
        const themeBtns = document.querySelectorAll("[data-theme-btn], .theme-toggle");
        themeBtns.forEach((btn) => {
            btn.addEventListener("click", () => this.toggleTheme());
        });

        // 3. Mobile navigation menu toggle
        const navToggleBtn = document.querySelector("[data-nav-toggle-btn]");
        const navbar = document.querySelector("[data-navbar]");
        if (navToggleBtn && navbar) {
            navToggleBtn.addEventListener("click", () => {
                navToggleBtn.classList.toggle("active");
                navbar.classList.toggle("active");
                document.body.classList.toggle("active");
            });

            // Auto-close menu when clicking any nav link
            navbar.querySelectorAll(".navbar-link").forEach((link) => {
                link.addEventListener("click", () => {
                    navToggleBtn.classList.remove("active");
                    navbar.classList.remove("active");
                    document.body.classList.remove("active");
                });
            });
        }

        // 4. Header scroll auto-hide & go-top button
        const header = document.querySelector("[data-header]");
        const goTopBtn = document.querySelector("[data-go-top]");
        let lastScrollY = window.scrollY;
        let isScrollingDown = false;

        window.addEventListener(
            "scroll",
            () => {
                const cur = window.scrollY;
                if (header && cur > lastScrollY && cur > 100) {
                    if (!isScrollingDown) {
                        header.classList.add("hidden");
                        isScrollingDown = true;
                    }
                } else if (header && cur < lastScrollY) {
                    if (isScrollingDown) {
                        header.classList.remove("hidden");
                        isScrollingDown = false;
                    }
                }

                if (cur >= 10) {
                    header?.classList.add("active");
                    goTopBtn?.classList.add("active");
                } else {
                    header?.classList.remove("active", "hidden");
                    goTopBtn?.classList.remove("active");
                    isScrollingDown = false;
                }
                lastScrollY = cur;
            },
            { passive: true }
        );

        // Go to top smooth click
        if (goTopBtn) {
            goTopBtn.addEventListener("click", (e) => {
                if (goTopBtn.getAttribute("href") === "#top" || goTopBtn.tagName === "BUTTON") {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                }
            });
        }

        // 5. Initialize hero email copy to clipboard
        this.initCopyEmailButton();

        // 6. Section scroll-spy for desktop active navigation indicator
        this.initScrollSpy();

        // 7. Initialize PWA offline support
        this.initOfflineSupport();
    },

    /**
     * Copy email address to clipboard with feedback
     */
    initCopyEmailButton() {
        const copyBtn = document.getElementById("copy-email-btn");
        if (!copyBtn) return;

        copyBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            let email = copyBtn.getAttribute("data-email");
            if (!email) {
                const parent = copyBtn.closest(".hero-email-item") || copyBtn.closest("li") || copyBtn.parentElement;
                const mailLink = parent ? parent.querySelector('a[href^="mailto:"]') : null;
                if (mailLink) {
                    email = mailLink.getAttribute("href").replace(/^mailto:/i, "").split("?")[0].trim();
                }
            }
            email = email || "notbeexoul@gmail.com";

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

            const tooltip = document.getElementById("copy-email-tooltip") || copyBtn.querySelector(".tooltip");
            const icon = document.getElementById("copy-email-icon") || copyBtn.querySelector("ion-icon");

            copyBtn.classList.add("copied");
            if (tooltip) {
                tooltip.textContent = copied ? "Copied!" : "Failed to copy";
            }
            if (icon) {
                icon.setAttribute("name", copied ? "checkmark-outline" : "alert-circle-outline");
            }
            copyBtn.setAttribute("aria-label", copied ? "Email copied to clipboard" : "Copy failed");

            clearTimeout(copyBtn._resetTimer);
            copyBtn._resetTimer = setTimeout(() => {
                copyBtn.classList.remove("copied");
                if (tooltip) {
                    tooltip.textContent = "Copy Email";
                }
                if (icon) {
                    icon.setAttribute("name", "copy-outline");
                }
                copyBtn.setAttribute("aria-label", "Copy email address to clipboard");
            }, 2500);
        });
        // Touch device support for revealing copy button on mobile
        const emailItem = document.querySelector(".hero-email-item");
        if (emailItem) {
            const mailLink = emailItem.querySelector('a[href^="mailto:"]');
            if (mailLink) {
                mailLink.addEventListener("click", (e) => {
                    const isTouch = window.matchMedia("(hover: none)").matches;
                    if (isTouch && !emailItem.classList.contains("is-active")) {
                        e.preventDefault();
                        emailItem.classList.add("is-active");
                    }
                });
            }

            document.addEventListener("click", (e) => {
                if (!emailItem.contains(e.target)) {
                    emailItem.classList.remove("is-active");
                }
            });
        }
    },

    /**
     * Highlight active nav link on scroll
     */
    initScrollSpy() {
        const sections = document.querySelectorAll("section[id]");
        const navLinks = document.querySelectorAll(".navbar-link");
        if (sections.length === 0 || navLinks.length === 0) return;

        const updateActiveLink = () => {
            const scrollPos = window.scrollY + 140;
            sections.forEach((section) => {
                const top = section.offsetTop;
                const height = section.offsetHeight;
                const id = section.getAttribute("id");

                if (scrollPos >= top && scrollPos < top + height) {
                    let activeId = id;
                    if (id === "experience") {
                        const activeTabBtn = document.querySelector("[data-resume-tabs] .tab-btn.active");
                        if (activeTabBtn) {
                            const target = activeTabBtn.getAttribute("data-tab-target");
                            if (target === "panel-education") activeId = "education";
                            else if (target === "panel-projects") activeId = "projects";
                            else activeId = "experience";
                        }
                    }

                    navLinks.forEach((link) => {
                        const href = link.getAttribute("href");
                        if (href === `#${activeId}` || href?.endsWith(`#${activeId}`)) {
                            link.classList.add("active");
                        } else if (href?.startsWith("#") || href?.includes("index.html#")) {
                            link.classList.remove("active");
                        }
                    });
                }
            });
        };

        window.addEventListener("scroll", updateActiveLink, { passive: true });
        updateActiveLink();
    }
};

// Expose globally
window.AppCore = AppCore;

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => AppCore.initCommonUI());
} else {
    AppCore.initCommonUI();
}
