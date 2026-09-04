"use strict";

/**
 * Single blog post script:
 * - Load post from network or offline cache
 * - Render markdown/block contents securely
 * - Copy code snippets to clipboard
 */

const POSTS_URL = "./posts.json";
const params = new URLSearchParams(window.location.search);
const postId = params.get("id");

const loadingEl = document.getElementById("post-loading");
const errorEl = document.getElementById("post-error");
const wrapperEl = document.getElementById("post-wrapper");

async function loadPost() {
    if (!postId) {
        showError();
        return;
    }

    // 1. Instant check from localStorage cache if available
    const cachedPosts = window.AppCore ? window.AppCore.getPostsFromStorage() : null;
    if (cachedPosts && Array.isArray(cachedPosts)) {
        const post = cachedPosts.find((p) => p.id === postId);
        if (post) {
            const others = cachedPosts.filter((p) => p.id !== postId).slice(0, 3);
            renderPost(post, others);
        }
    }

    // 2. Fetch fresh post data
    try {
        const res = await fetch(POSTS_URL);
        if (!res.ok) throw new Error("Failed to fetch posts");
        const posts = await res.json();
        if (window.AppCore) {
            window.AppCore.savePostsToStorage(posts);
        }

        const post = posts.find((p) => p.id === postId);
        if (!post) {
            if (wrapperEl && wrapperEl.classList.contains("hidden")) {
                showError();
            }
            return;
        }

        const others = posts.filter((p) => p.id !== postId).slice(0, 3);
        renderPost(post, others);
    } catch (err) {
        console.warn("Could not fetch fresh post, checking offline view:", err);
        if (wrapperEl && wrapperEl.classList.contains("hidden")) {
            showError();
        }
    }
}

function showError() {
    if (loadingEl) loadingEl.style.display = "none";
    if (errorEl) errorEl.classList.add("visible");
}

function renderPost(post, others) {
    const escape = window.AppCore ? window.AppCore.escapeHtml : (s) => s;
    const sanitize = window.AppCore ? window.AppCore.sanitizeUrl : (u) => u;

    document.title = `${post.title || "Post"} | Beexoul Blog`;

    const categoryEl = document.getElementById("post-category");
    const dateEl = document.getElementById("post-date");
    const readTimeEl = document.getElementById("post-read-time");
    const titleEl = document.getElementById("post-title");
    const subtitleEl = document.getElementById("post-subtitle");
    const authorNameEl = document.getElementById("author-name");
    const authorAvatarEl = document.getElementById("author-avatar-letter");
    const coverEl = document.getElementById("post-cover-img");

    if (categoryEl) categoryEl.textContent = post.category || "";
    if (dateEl) dateEl.textContent = post.date || "";
    if (readTimeEl) readTimeEl.textContent = post.readTime || "";
    if (titleEl) titleEl.textContent = post.title || "";
    if (subtitleEl) subtitleEl.textContent = post.subtitle || "";

    const author = post.author || "Shiva Raj Paudel";
    if (authorNameEl) authorNameEl.textContent = author;
    if (authorAvatarEl) authorAvatarEl.textContent = author.charAt(0).toUpperCase();

    if (coverEl) {
        coverEl.src = sanitize(post.thumbnail);
        coverEl.alt = escape(post.title || "Blog post cover");
    }

    const bodyEl = document.getElementById("post-body");
    if (bodyEl) {
        const contentBlocks = Array.isArray(post.content) ? post.content : [];
        bodyEl.innerHTML = contentBlocks.map((block) => renderBlock(block)).join("");
    }

    const tagsListEl = document.getElementById("post-tags-list");
    if (tagsListEl) {
        const tags = Array.isArray(post.tags) ? post.tags : [];
        tagsListEl.innerHTML = tags.map((tag) => `<li class="tag">${escape(tag)}</li>`).join("");
    }

    if (others && others.length) {
        const grid = document.getElementById("more-posts-grid");
        if (grid) {
            grid.innerHTML = others
                .map(
                    (p) => `
                <a href="post.html?id=${encodeURIComponent(p.id)}" class="more-post-card">
                    <div class="thumb">
                        <img src="${sanitize(p.thumbnail)}" alt="${escape(p.title)}" loading="lazy">
                    </div>
                    <div class="info">
                        <p class="cat">${escape(p.category || "")}</p>
                        <p class="title">${escape(p.title || "")}</p>
                    </div>
                </a>
            `
                )
                .join("");
        }
    } else {
        const morePostsSection = document.querySelector(".more-posts");
        if (morePostsSection) morePostsSection.style.display = "none";
    }

    if (loadingEl) loadingEl.style.display = "none";
    if (wrapperEl) wrapperEl.classList.remove("hidden");
    attachCopyHandlers();
}

function renderBlock(block) {
    if (!block || typeof block !== "object") return "";
    const escape = window.AppCore ? window.AppCore.escapeHtml : (s) => s;

    switch (block.type) {
        case "paragraph":
            return `<p>${escape(block.text || "")}</p>`;
        case "heading":
            return `<h2>${escape(block.text || "")}</h2>`;
        case "code":
            return `
                <div class="code-block">
                    <div class="code-header">
                        <span class="code-lang">${escape(block.language || "code")}</span>
                        <button class="copy-btn" data-code="${encodeURIComponent(block.text || "")}">Copy</button>
                    </div>
                    <pre><code>${escape(block.text || "")}</code></pre>
                </div>
            `;
        default:
            return "";
    }
}

function attachCopyHandlers() {
    document.querySelectorAll(".copy-btn").forEach((btn) => {
        btn.onclick = async () => {
            const code = decodeURIComponent(btn.dataset.code || "");
            try {
                await navigator.clipboard.writeText(code);
                btn.textContent = "Copied!";
                btn.classList.add("copied");
                setTimeout(() => {
                    btn.textContent = "Copy";
                    btn.classList.remove("copied");
                }, 2000);
            } catch {
                btn.textContent = "Failed";
                setTimeout(() => {
                    btn.textContent = "Copy";
                }, 2000);
            }
        };
    });
}

loadPost();
