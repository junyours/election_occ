/* public/sw.js — OCC Election System service worker
 *
 * Rules:
 *  - Only the app shell is cached (built JS/CSS under /build/assets/ and the icons).
 *  - NEVER cache the API, auth, storage or broadcasting requests: votes, login,
 *    OTP and live results must always come from the network.
 *  - HTML pages are not cached (they carry the CSRF token and the hashed
 *    asset names). Offline navigation falls back to /offline.html.
 *
 * To force every user to refresh the cache, bump VERSION.
 */
const VERSION = "v1";
const SHELL_CACHE = `occ-shell-${VERSION}`;
const ASSET_CACHE = `occ-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [
    OFFLINE_URL,
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/manifest.webmanifest",
];

const NEVER_CACHE_PREFIXES = [
    "/api",
    "/sanctum",
    "/storage",
    "/broadcasting",
    "/_ignition",
    "/@vite",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(SHELL_CACHE)
            .then((cache) => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
                        .map((k) => caches.delete(k)),
                ),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener("fetch", (event) => {
    const req = event.request;

    // Only handle GET requests to our own origin
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // Never touch API / auth / uploads: let the browser go straight to the network
    if (NEVER_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

    // Page navigations: network first, offline page if the network is down
    if (req.mode === "navigate") {
        event.respondWith(
            fetch(req).catch(() =>
                caches
                    .match(OFFLINE_URL)
                    .then((r) => r || Response.error()),
            ),
        );
        return;
    }

    // Built assets have hashed filenames, so cache-first is safe
    if (
        url.pathname.startsWith("/build/assets/") ||
        url.pathname.startsWith("/icons/")
    ) {
        event.respondWith(
            caches.open(ASSET_CACHE).then((cache) =>
                cache.match(req).then(
                    (hit) =>
                        hit ||
                        fetch(req).then((res) => {
                            if (res && res.status === 200) {
                                cache.put(req, res.clone());
                            }
                            return res;
                        }),
                ),
            ),
        );
        return;
    }

    // Everything else: default browser behaviour (network)
});
