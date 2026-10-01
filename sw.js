/* ============================================================
   Talabat Food Catalog Studio — Offline Service Worker
   Place this file at:  <repo-root>/ToolsTest/sw.js
   (it MUST sit next to index.html so its scope covers the app)
   ============================================================ */

/* Bump this string every time you publish a new index.html.
   That is what forces users to pick up your update.          */
const VERSION = 'tcs-v1';

const APP_SHELL_CACHE = `app-shell-${VERSION}`;
const RUNTIME_CACHE   = `runtime-${VERSION}`;

/* Everything the app needs to boot with zero network.
   Paths are relative so this works under /ToolsTest/ on
   GitHub Pages AND on a custom domain without edits.         */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

/* Hosts that exist ONLY to reach the internet (CORS proxies,
   image fetchers). Never cache, never intercept — let them
   fail naturally offline so the app's own error handling and
   the "OFFLINE MODE" badge behave correctly.                 */
const NEVER_CACHE_HOSTS = [
  'corsproxy.io',
  'api.allorigins.win',
  'wsrv.nl',
  'images.weserv.nl',
  'cors.isomorphic-git.org',
  'cleanup.pictures',
];

// ---------------------------------------------------------------
// INSTALL — download and store the shell
// ---------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);

    // addAll() is atomic: one 404 aborts the whole install and you
    // silently get no offline support. Cache items individually and
    // only treat the main document as mandatory.
    const results = await Promise.allSettled(
      PRECACHE_URLS.map(async (url) => {
        // cache:'reload' bypasses the HTTP cache so we archive a
        // genuinely fresh copy, not a stale 10-minute-old one.
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
        await cache.put(url, res);
        return url;
      })
    );

    const failed = results
      .map((r, i) => (r.status === 'rejected' ? PRECACHE_URLS[i] : null))
      .filter(Boolean);
    if (failed.length) console.warn('[sw] precache misses (non-fatal):', failed);

    // Hard requirement: the app document itself must be cached.
    const doc = await cache.match('./index.html');
    if (!doc) throw new Error('[sw] FATAL: index.html could not be precached');

    console.log(`[sw] ${VERSION} installed — offline ready`);
  })());

  // Activate as soon as install finishes instead of waiting for
  // every old tab to close.
  self.skipWaiting();
});

// ---------------------------------------------------------------
// ACTIVATE — delete caches from previous versions
// ---------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([APP_SHELL_CACHE, RUNTIME_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.map((n) => (keep.has(n) ? null : caches.delete(n))));

    // Navigation Preload shaves latency off the online path.
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }

    await self.clients.claim();
    console.log(`[sw] ${VERSION} active`);
  })());
});

// ---------------------------------------------------------------
// FETCH
// ---------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only GET is cacheable.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // Ignore non-http(s) (chrome-extension:, blob:, data: ...).
  if (!url.protocol.startsWith('http')) return;

  // Let outbound proxy/API traffic pass straight through.
  if (NEVER_CACHE_HOSTS.some((h) => url.hostname.endsWith(h))) return;

  // ---- Page loads / reloads: network-first, cache fallback ----
  // This is THE fix for "page not responding with Wi-Fi off".
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) {
          const c = await caches.open(APP_SHELL_CACHE);
          c.put('./index.html', preload.clone());
          return preload;
        }
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const c = await caches.open(APP_SHELL_CACHE);
          c.put('./index.html', fresh.clone());   // keep the archive current
        }
        return fresh;
      } catch {
        // Offline (or GitHub Pages unreachable) — serve the archive.
        const cached =
          (await caches.match('./index.html')) ||
          (await caches.match('./')) ||
          (await caches.match(req));
        if (cached) return cached;
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
          '<body style="font:16px system-ui;padding:40px;text-align:center">' +
          '<h2>Offline — app not cached yet</h2>' +
          '<p>Open this page once while connected, then it will work offline.</p>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // ---- Same-origin assets: cache-first ----
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && fresh.type === 'basic') {
          const c = await caches.open(RUNTIME_CACHE);
          c.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })());
  }
  // Cross-origin non-proxy requests: leave to the browser.
});

// ---------------------------------------------------------------
// Allow the page to trigger an immediate update
// ---------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
