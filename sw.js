/* ============================================================
   Talabat GFX Studio — Offline Service Worker
   Place at:  <repo root>/sw.js   (beside index.html)

   Covers BOTH pages in this repo, because they share one scope:
     ./index.html          the Studio (tabs 1-5)
     ./image-finder.html   the Image Finder, opened by "Open separately"

   That is the whole point of keeping image-finder.html in this repo
   instead of linking out to /Image-Finder/: a service worker can only
   control its own directory and below, so a sibling path could never
   be cached by this worker.
   ============================================================ */

/* Bump this string every time you publish a new index.html or
   image-finder.html. That is what pushes the update to users. */
const VERSION = 'gfx-v10';

const APP_SHELL_CACHE = `app-shell-${VERSION}`;
const RUNTIME_CACHE   = `runtime-${VERSION}`;

/* Everything needed to boot either page with zero network.
   Relative paths, so this works under /Talabat-GFX-TOOL/ on GitHub
   Pages and on a custom domain without edits.                 */
const PRECACHE_URLS = [
  './',
  './index.html',
  './image-finder.html',
  './manifest.webmanifest',
  './manifest-finder.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/finder-192.png',
  './icons/finder-512.png',
  './icons/finder-maskable-512.png',
];

/* The tutorial videos are deliberately NOT precached: together they are
   ~8.9 MB and most users never open the guide. They are cached on first
   play by the same-origin handler below. Add them here if you want them
   guaranteed offline:
     './videos/guide-studio.mp4', './videos/guide-finder.mp4'          */

/* Hosts that exist ONLY to reach the internet (CORS proxies, image
   fetchers). Never cache, never intercept -- let them fail naturally
   offline so the app's own error handling stays honest.        */
const NEVER_CACHE_HOSTS = [
  'corsproxy.io',
  'api.allorigins.win',
  'wsrv.nl',
  'images.weserv.nl',
  'cors.isomorphic-git.org',
  'cleanup.pictures',
];

// ---------------------------------------------------------------
// INSTALL
// ---------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);

    // addAll() is atomic: one 404 aborts the whole install and you
    // silently get no offline support at all. Cache individually and
    // only treat the two HTML pages as mandatory.
    const results = await Promise.allSettled(
      PRECACHE_URLS.map(async (url) => {
        // cache:'reload' bypasses the HTTP cache so we archive a truly
        // fresh copy, not a stale one from GitHub's max-age=600.
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

    for (const required of ['./index.html', './image-finder.html']) {
      if (!(await cache.match(required))) {
        throw new Error(`[sw] FATAL: ${required} could not be precached`);
      }
    }

    console.log(`[sw] ${VERSION} installed — both pages offline ready`);
  })());

  self.skipWaiting();
});

// ---------------------------------------------------------------
// ACTIVATE
// ---------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([APP_SHELL_CACHE, RUNTIME_CACHE]);
    for (const name of await caches.keys()) {
      if (!keep.has(name)) await caches.delete(name);
    }
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
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (!url.protocol.startsWith('http')) return;
  if (NEVER_CACHE_HOSTS.some((h) => url.hostname.endsWith(h))) return;

  // ---- Page loads / reloads: network-first, cache fallback ----
  // Handles BOTH index.html and image-finder.html, which is what makes
  // "Open separately" work with the network off.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      // Resolve which page was asked for, so the right one is restored.
      let key = './index.html';
      if (url.pathname.endsWith('/image-finder.html')) key = './image-finder.html';

      try {
        const preload = await event.preloadResponse;
        if (preload) {
          (await caches.open(APP_SHELL_CACHE)).put(key, preload.clone());
          return preload;
        }
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          (await caches.open(APP_SHELL_CACHE)).put(key, fresh.clone());
        }
        return fresh;
      } catch {
        const cached =
          (await caches.match(key)) ||
          (await caches.match(req)) ||
          (key === './index.html' ? await caches.match('./') : null);
        if (cached) return cached;

        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
          '<body style="font:16px system-ui;padding:40px;text-align:center">' +
          '<h2>Offline — this page was never cached</h2>' +
          '<p>Open it once while connected, then it will work offline.</p>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // ---- Same-origin assets (incl. videos on first play): cache-first ----
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok && fresh.type === 'basic') {
          (await caches.open(RUNTIME_CACHE)).put(req, fresh.clone());
        }
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })());
  }
});

// ---------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
