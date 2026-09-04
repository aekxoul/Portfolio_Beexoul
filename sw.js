// Service Worker for Beexoul Portfolio
// Provides offline capability, precaching of essential resources, and background updates.

const CACHE_NAME = "beexoul-cache-v6";
const RUNTIME_CACHE = "beexoul-runtime-v6";

// Essential resources to precache immediately on install
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./blog/blog.html",
  "./blog/assets/post/post.html",
  "./404.html",
  "./manifest.webmanifest",
  "./assets/css/color.css",
  "./assets/css/style.css",
  "./blog/assets/css/blog.css",
  "./blog/assets/post/post-css.css",
  "./assets/css/404.css",
  "./assets/js/common.js",
  "./assets/js/script.js",
  "./blog/assets/js/blog.js",
  "./blog/assets/post/post-js.js",
  "./assets/js/404.js",
  "./blog/assets/post/posts.json",
  "./assets/images/favicon.png",
  "./assets/images/hero-banner.webp",
  "./assets/images/hero-banner-sm.webp",
  "./assets/images/hero-banner-md.webp",
  "./assets/images/about-banner.webp",
  "./assets/images/html5.webp",
  "./assets/images/css3.webp",
  "./assets/images/javascript.webp",
  "./assets/images/typescript.webp",
  "./assets/images/react.webp",
  "./assets/images/bootstrap.webp",
  "./assets/images/firebase.webp",
  "./assets/images/jquery.webp",
  "./assets/images/git.webp",
  "./assets/images/npm.webp",
  "./assets/images/webpack.webp",
  "./assets/images/command.webp",
  "./assets/images/vs-code.webp",
  "./assets/images/slack.webp",
  "./assets/images/photoshop.webp",
  "./assets/images/adobe-xd.webp"
];

// Install Event - Precache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: "reload" })).catch((err) => {
              console.warn("Failed to precache resource:", url, err);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches
self.addEventListener("activate", (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !currentCaches.includes(name))
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event - Serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // HTML page navigation requests
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          // If network is offline, check cache for the specific URL
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          // Check for blog path fallback
          if (url.pathname.includes("/blog")) {
            const blogFallback = await caches.match("./blog/blog.html");
            if (blogFallback) return blogFallback;
          }

          // Default offline fallback is index.html
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;

          return caches.match("./404.html");
        })
    );
    return;
  }

  // Same-origin static assets: Stale-While-Revalidate
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // External assets (Google Fonts, Unsplash images, icons): Runtime Cache with Cache-First
  if (
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("images.unsplash.com") ||
    url.hostname.includes("unpkg.com")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => null);
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
