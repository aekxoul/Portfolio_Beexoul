"use strict";

/**
 * Universal Dynamic Blog Post Loader:
 * - Loads posts from /blog/assets/post/posts.json
 * - Supports:
 *     /post.html?post=React_app_001
 *     /post.html?slug=React_app_001
 *     /post.html?id=001
 *     /post.html#React_app_001
 *     /React_app_001
 * - Bulletproof rendering for paragraphs, headings, code, and images
 * - Unsplash / CDN cross-origin referrer protection
 */

const loadingEl = document.getElementById("post-loading");
const errorEl = document.getElementById("post-error");
const wrapperEl = document.getElementById("post-wrapper");

function generateSlug(title, id) {
    const idStr = String(id || "").padStart(3, "0");
    const cleanTitle = (title || "post")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join("_");
    return `${cleanTitle}_${idStr}`;
}

function getRequestedSlugOrId() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("post")) return params.get("post").trim();
    if (params.get("slug")) return params.get("slug").trim();
    if (params.get("id")) return params.get("id").trim();
    if (params.get("article")) return params.get("article").trim();

    // Support hash: e.g. post.html#Mastering_CSS_002
    if (window.location.hash) {
        const hash = window.location.hash.replace(/^#/, "").trim();
        if (hash) return decodeURIComponent(hash);
    }

    // Support clean pathname: e.g. /Mastering_CSS_002
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length > 0) {
        const last = parts[parts.length - 1];
        if (last && !last.includes(".") && last !== "post" && last !== "blog") {
            return decodeURIComponent(last).trim();
        }
    }
    return null;
}

function findPost(posts, query) {
    if (!posts || !Array.isArray(posts) || posts.length === 0) return null;
    if (!query) {
        return posts[0];
    }
    const qLower = query.toLowerCase();

    // 1. Direct ID match (e.g. "002" or 2)
    let found = posts.find((p) => String(p.id).toLowerCase() === qLower);
    if (found) return found;

    // 2. Direct slug match
    found = posts.find((p) => p.slug && p.slug.toLowerCase() === qLower);
    if (found) return found;

    // 3. Auto-generated slug match
    found = posts.find((p) => generateSlug(p.title, p.id).toLowerCase() === qLower);
    if (found) return found;

    // 4. Trailing ID match (e.g. Mastering_CSS_002 -> 002)
    const matchId = query.match(/_([0-9a-zA-Z]+)$/);
    if (matchId) {
        found = posts.find((p) => String(p.id).toLowerCase() === matchId[1].toLowerCase());
        if (found) return found;
    }

    // 5. Title substring match
    found = posts.find((p) => p.title && p.title.toLowerCase().replace(/[\s-]+/g, "_").includes(qLower));
    return found || null;
}

async function fetchPostsData() {
    const urls = [
        "/blog/assets/post/posts.json",
        "./blog/assets/post/posts.json",
        "../blog/assets/post/posts.json",
        "./assets/post/posts.json",
        "./posts.json"
    ];

    for (const url of urls) {
        try {
            // Append cache buster to fetch fresh data
            const res = await fetch(`${url}?t=${Date.now()}`);
            if (res.ok) {
                return await res.json();
            }
        } catch {
            // try next candidate path
        }
    }
    throw new Error("Could not load posts.json from any known path");
}

async function loadPost() {
    const queryIdentifier = getRequestedSlugOrId();

    // 1. Check local storage cache for instant rendering
    const cachedPosts = window.AppCore ? window.AppCore.getPostsFromStorage() : null;
    if (cachedPosts && Array.isArray(cachedPosts) && cachedPosts.length > 0) {
        const post = findPost(cachedPosts, queryIdentifier);
        if (post) {
            const others = cachedPosts.filter((p) => p.id !== post.id).slice(0, 3);
            renderPost(post, others);
        }
    }

    // 2. Fetch fresh post data
    try {
        const posts = await fetchPostsData();
        if (window.AppCore) {
            window.AppCore.savePostsToStorage(posts);
        }

        const post = findPost(posts, queryIdentifier);
        if (!post) {
            if (wrapperEl && wrapperEl.classList.contains("hidden")) {
                showError();
            }
            return;
        }

        const others = posts.filter((p) => p.id !== post.id).slice(0, 3);
        renderPost(post, others);
    } catch (err) {
        console.warn("Could not fetch fresh post:", err);
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
    const escape = window.AppCore ? window.AppCore.escapeHtml : (s) => (s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
    const sanitize = window.AppCore ? window.AppCore.sanitizeUrl : (u) => u;

    document.title = `${post.title || "Post"} | AeKxoul Blog`;

    const categoryEl = document.getElementById("post-category");
    const dateEl = document.getElementById("post-date");
    const readTimeEl = document.getElementById("post-read-time");
    const titleEl = document.getElementById("post-title");
    const subtitleEl = document.getElementById("post-subtitle");
    const authorNameEl = document.getElementById("author-name");
    const authorAvatarEl = document.getElementById("author-avatar-letter");
    const coverEl = document.getElementById("post-cover-img");

    if (categoryEl) categoryEl.textContent = post.category || "General";
    if (dateEl) dateEl.textContent = post.date || "";
    if (readTimeEl) readTimeEl.textContent = post.readTime || "5 min read";
    if (titleEl) titleEl.textContent = post.title || "";
    if (subtitleEl) {
        if (post.subtitle) {
            subtitleEl.textContent = post.subtitle;
            subtitleEl.style.display = "";
        } else {
            subtitleEl.style.display = "none";
        }
    }

    const author = post.author || "Shiva Raj Paudel";
    if (authorNameEl) authorNameEl.textContent = author;
    if (authorAvatarEl) authorAvatarEl.textContent = author.charAt(0).toUpperCase();

    // 1st image: Top cover image with referrer and error guards
    const topImage = post.top_image || post.thumbnail || post.cover_image || post.image;
    if (coverEl && topImage) {
        coverEl.src = sanitize(topImage);
        coverEl.alt = escape(post.title || "Blog post cover");
        coverEl.setAttribute("referrerpolicy", "no-referrer");
        coverEl.onerror = function () {
            if (this.parentElement) {
                this.parentElement.style.display = "none";
            }
        };
        coverEl.parentElement.style.display = "";
    } else if (coverEl && !topImage) {
        coverEl.parentElement.style.display = "none";
    }

    // Build content blocks
    let contentBlocks = Array.isArray(post.content) ? [...post.content] : [];

    // Optional second_image fallback
    const secondImage = post.second_image || post.second_img || post.middle_image;
    const hasInlineImageBlock = contentBlocks.some((b) => {
        const t = String(b.type || "").toLowerCase();
        return t.startsWith("image") || t.startsWith("img") || t === "photo";
    });

    if (secondImage && !hasInlineImageBlock) {
        const insertIndex = Math.min(2, contentBlocks.length);
        contentBlocks.splice(insertIndex, 0, {
            type: "image",
            src: secondImage,
            caption: post.second_image_caption || ""
        });
    }

    const bodyEl = document.getElementById("post-body");
    if (bodyEl) {
        bodyEl.innerHTML = contentBlocks.map((block) => renderBlock(block)).join("");
    }

    const tagsListEl = document.getElementById("post-tags-list");
    if (tagsListEl) {
        const tags = Array.isArray(post.tags) ? post.tags : [];
        if (tags.length > 0) {
            tagsListEl.parentElement.style.display = "";
            tagsListEl.innerHTML = tags.map((tag) => `<li class="tag">${escape(tag)}</li>`).join("");
        } else {
            tagsListEl.parentElement.style.display = "none";
        }
    }

    if (others && others.length) {
        const grid = document.getElementById("more-posts-grid");
        if (grid) {
            grid.innerHTML = others
                .map((p) => {
                    const cardSlug = p.slug || generateSlug(p.title, p.id);
                    const cardImg = p.top_image || p.thumbnail || p.cover_image || p.image || "";
                    return `
                <a href="/post.html?post=${encodeURIComponent(cardSlug)}" class="more-post-card">
                    <div class="thumb">
                        <img src="${sanitize(cardImg)}" alt="${escape(p.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.style.display='none'">
                    </div>
                    <div class="info">
                        <p class="cat">${escape(p.category || "")}</p>
                        <p class="title">${escape(p.title || "")}</p>
                    </div>
                </a>
            `;
                })
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
    if (!block) return "";
    const escape = window.AppCore ? window.AppCore.escapeHtml : (s) => (s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"));
    const sanitize = window.AppCore ? window.AppCore.sanitizeUrl : (u) => u;

    if (typeof block === "string") {
        return `<p>${escape(block)}</p>`;
    }

    const type = String(block.type || "").toLowerCase().trim();
    const text = block.text || block.content || block.body || block.desc || "";

    // Code blocks
    if (type === "code" || block.code !== undefined) {
        const codeText = block.code !== undefined ? block.code : text;
        const lang = block.language || block.lang || "code";
        return `
            <div class="code-block">
                <div class="code-header">
                    <span class="code-lang">${escape(lang)}</span>
                    <button class="copy-btn" data-code="${encodeURIComponent(codeText)}">Copy</button>
                </div>
                <pre><code>${escape(codeText)}</code></pre>
            </div>
        `;
    }

    // Headings: h1..h6, heading, heading-1..6
    if (type === "h1" || type === "heading-1" || type === "heading1") {
        return `<h1>${escape(text)}</h1>`;
    }
    if (type === "h2" || type === "heading-2" || type === "heading2" || type === "heading") {
        return `<h2>${escape(text)}</h2>`;
    }
    if (type === "h3" || type === "heading-3" || type === "heading3") {
        return `<h3>${escape(text)}</h3>`;
    }
    if (type === "h4" || type === "heading-4" || type === "heading4") {
        return `<h4>${escape(text)}</h4>`;
    }
    if (type === "h5" || type === "heading-5" || type === "heading5") {
        return `<h5>${escape(text)}</h5>`;
    }
    if (type === "h6" || type === "heading-6" || type === "heading6") {
        return `<h6>${escape(text)}</h6>`;
    }

    // Inline images
    if (/^image(-\d+)?$/.test(type) || /^img(-\d+)?$/.test(type) || type === "photo" || block.src) {
        const src = sanitize(block.src || block.url || block.image || "");
        if (!src) return "";
        const alt = escape(block.alt || block.caption || "Blog image");
        const caption = block.caption ? `<figcaption>${escape(block.caption)}</figcaption>` : "";
        return `
            <figure class="post-inline-image">
                <img src="${src}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.style.display='none'">
                ${caption}
            </figure>
        `;
    }

    // Quotes
    if (type === "quote" || type === "blockquote") {
        return `<blockquote><p>${escape(text)}</p></blockquote>`;
    }

    // Lists
    if (type === "list" || type === "bullets" || Array.isArray(block.items)) {
        const items = Array.isArray(block.items) ? block.items : [];
        return `
            <ul>
                ${items.map((it) => `<li>${escape(it)}</li>`).join("")}
            </ul>
        `;
    }

    // Paragraphs: paragraph, paragraph-1..99, p, or any block with text
    if (text) {
        return `<p>${escape(text)}</p>`;
    }

    return "";
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

// Initial load
loadPost();

// Listen for popstate or hashchange
window.addEventListener("popstate", loadPost);
window.addEventListener("hashchange", loadPost);
