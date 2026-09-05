"use strict";

/**
 * Blog index script:
 * - Search, category filters, and debounced input
 * - Instant offline load from localStorage cache + network sync
 * - Secure rendering (XSS-safe sanitization and protocol checks)
 */

const POSTS_URL = "./assets/post/posts.json";
let allPosts = [];
let activeCategory = "All";
let searchQuery = "";

const searchInput = document.getElementById("blog-search-input");
const clearBtn = document.getElementById("search-clear-btn");
const resultsCount = document.getElementById("search-results-count");
const sectionLabel = document.getElementById("posts-section-label");
const featuredSection = document.getElementById("featured-section");

function debounce(fn, ms) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

if (searchInput) {
    searchInput.addEventListener(
        "input",
        debounce(() => {
            searchQuery = searchInput.value.trim();
            if (searchQuery.length > 0) {
                clearBtn?.classList.add("visible");
            } else {
                clearBtn?.classList.remove("visible");
            }
            applyFilters();
        }, 220)
    );
}

if (clearBtn) {
    clearBtn.addEventListener("click", () => {
        if (searchInput) {
            searchInput.value = "";
            searchInput.focus();
        }
        searchQuery = "";
        clearBtn.classList.remove("visible");
        applyFilters();
    });
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && searchQuery) {
        if (searchInput) {
            searchInput.value = "";
        }
        searchQuery = "";
        clearBtn?.classList.remove("visible");
        applyFilters();
    }
});

async function loadPosts() {
    // 1. Instant load from localStorage cache if available
    const cachedPosts = window.AppCore ? window.AppCore.getPostsFromStorage() : null;
    if (cachedPosts && Array.isArray(cachedPosts) && cachedPosts.length > 0) {
        allPosts = cachedPosts;
        setupFilters(allPosts);
        applyFilters();
    }

    // 2. Fetch fresh posts from network or Service Worker cache
    try {
        const res = await fetch(POSTS_URL);
        if (!res.ok) throw new Error("Failed to fetch posts");
        const freshPosts = await res.json();
        allPosts = freshPosts;
        if (window.AppCore) {
            window.AppCore.savePostsToStorage(freshPosts);
        }
        setupFilters(allPosts);
        applyFilters();
    } catch (err) {
        console.warn("Using offline cached posts:", err);
        if (!allPosts || allPosts.length === 0) {
            const grid = document.getElementById("posts-grid");
            if (grid) {
                grid.innerHTML = `
                    <p style="color:var(--color-secondary);grid-column:1/-1;text-align:center;padding:40px 0;">
                        No articles available offline. Please reconnect to load the blog.
                    </p>
                `;
            }
        }
    }
}

function applyFilters() {
    const q = searchQuery.toLowerCase();
    let pool = activeCategory === "All" ? allPosts : allPosts.filter((p) => p.category === activeCategory);

    if (q) {
        pool = pool.filter(
            (p) =>
                (p.title && p.title.toLowerCase().includes(q)) ||
                (p.excerpt && p.excerpt.toLowerCase().includes(q)) ||
                (p.category && p.category.toLowerCase().includes(q)) ||
                (Array.isArray(p.tags) && p.tags.some((t) => t.toLowerCase().includes(q)))
        );
    }

    const isSearching = q.length > 0;
    if (isSearching) {
        if (featuredSection) featuredSection.style.display = "none";
        if (sectionLabel) sectionLabel.textContent = "Search Results";
        renderGrid(pool);
        showResultsCount(pool.length, q);
    } else if (activeCategory === "All") {
        if (featuredSection) featuredSection.style.display = "";
        if (sectionLabel) sectionLabel.textContent = "Latest Posts";
        renderFeatured(allPosts[0]);
        renderGrid(allPosts.slice(1));
        hideResultsCount();
    } else {
        if (featuredSection) featuredSection.style.display = "none";
        if (sectionLabel) sectionLabel.textContent = "Latest Posts";
        renderGrid(pool);
        hideResultsCount();
    }
}

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

function getPostUrl(post) {
    const slug = post.slug || generateSlug(post.title, post.id);
    return `/post.html?post=${encodeURIComponent(slug)}`;
}

function renderFeatured(post) {
    if (!post) return;
    const el = document.getElementById("featured-card");
    if (!el) return;

    const escape = window.AppCore ? window.AppCore.escapeHtml : (s) => s;
    const sanitize = window.AppCore ? window.AppCore.sanitizeUrl : (u) => u;
    const topImg = post.top_image || post.thumbnail || post.cover_image || post.image || "";

    el.href = getPostUrl(post);
    el.innerHTML = `
        <div class="card-img">
            <img src="${sanitize(topImg)}" alt="${escape(post.title)}" loading="lazy">
        </div>
        <div class="card-body">
            <div class="card-meta">
                <span class="card-category">${escape(post.category || "")}</span>
                <span class="card-date">${escape(post.date || "")}</span>
                <span class="card-read-time">&middot; ${escape(post.readTime || "")}</span>
            </div>
            <h2 class="card-title">${escape(post.title || "")}</h2>
            <p class="card-excerpt">${escape(post.excerpt || "")}</p>
            <span class="read-link">Read Article <span class="arrow">&rarr;</span></span>
        </div>
    `;
}

function renderGrid(posts) {
    const grid = document.getElementById("posts-grid");
    const noResults = document.getElementById("no-results");
    const noResultsMsg = document.getElementById("no-results-msg");
    if (!grid) return;

    if (!posts.length) {
        grid.innerHTML = "";
        if (noResults) noResults.classList.add("visible");
        if (noResultsMsg) {
            noResultsMsg.textContent = searchQuery
                ? `No articles matched "${searchQuery}". Try a different keyword.`
                : "No posts found in this category yet.";
        }
        return;
    }

    if (noResults) noResults.classList.remove("visible");
    const q = searchQuery.toLowerCase();
    const escape = window.AppCore ? window.AppCore.escapeHtml : (s) => s;
    const sanitize = window.AppCore ? window.AppCore.sanitizeUrl : (u) => u;

    grid.innerHTML = posts
        .map(
            (post) => {
                const postUrl = getPostUrl(post);
                const postImg = post.top_image || post.thumbnail || post.cover_image || post.image || "";
                return `
        <a href="${postUrl}" class="post-card">
            <div class="card-img">
                <img src="${sanitize(postImg)}" alt="${escape(post.title)}" loading="lazy">
            </div>
            <div class="card-body">
                <div class="card-meta">
                    <span class="card-category">${escape(post.category || "")}</span>
                    <span class="card-date">${escape(post.date || "")}</span>
                </div>
                <h3 class="card-title">${q ? highlight(post.title, q) : escape(post.title || "")}</h3>
                <p class="card-excerpt">${q ? highlight(post.excerpt, q) : escape(post.excerpt || "")}</p>
                <div class="card-tags">
                    ${(post.tags || [])
                        .slice(0, 3)
                        .map((t) => `<span class="tag">${q ? highlight(t, q) : escape(t)}</span>`)
                        .join("")}
                </div>
            </div>
        </a>
    `;
            }
        )
        .join("");
}

function setupFilters(posts) {
    const bar = document.getElementById("filter-bar");
    if (!bar) return;
    const categories = ["All", ...new Set(posts.map((p) => p.category).filter(Boolean))];
    bar.innerHTML = categories
        .map(
            (cat) =>
                `<button class="filter-btn${cat === activeCategory ? " active" : ""}" data-filter="${window.AppCore ? window.AppCore.escapeAttribute(cat) : cat}">${window.AppCore ? window.AppCore.escapeHtml(cat) : cat}</button>`
        )
        .join("");

    bar.onclick = (e) => {
        const btn = e.target.closest(".filter-btn");
        if (!btn) return;
        bar.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeCategory = btn.dataset.filter || "All";
        applyFilters();
    };
}

function showResultsCount(count, query) {
    if (!resultsCount) return;
    resultsCount.hidden = false;
    const safe = window.AppCore ? window.AppCore.escapeHtml(query) : query;
    resultsCount.innerHTML =
        count === 0
            ? `No results for <strong>"${safe}"</strong>`
            : `<strong>${count}</strong> result${count !== 1 ? "s" : ""} for <strong>"${safe}"</strong>`;
}

function hideResultsCount() {
    if (resultsCount) resultsCount.hidden = true;
}

function highlight(text, query) {
    if (!text) return "";
    const escape = window.AppCore ? window.AppCore.escapeHtml : (s) => s;
    const safe = escape(text);
    if (!query) return safe;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escapedQuery})`, "gi");
    return safe.replace(re, `<mark class="search-highlight">$1</mark>`);
}

loadPosts();
