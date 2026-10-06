/* ============================================================
   Talabat Images Finder — Offline Service Worker
   Place at:  <repo root>/sw.js   (beside index.html)

   This repo contains ONE page: ./index.html
   (The previous worker was copied from the GFX Studio repo and
    demanded ./image-finder.html, which does not exist here. That
    404 made install() throw, so the worker never activated and
    nothing was ever cached — the tool had no offline mode at all.)

   Bump VERSION every time you publish a new index.html. That is
   what pushes the update to users.
   ============================================================ */

const VERSION = 'finder-v3';

const APP_SHELL_CACHE = `app-shell-${VERSION}`;
const RUNTIME_CACHE   = `runtime-${VERSION}`;

/* MUST exist, or there is no offline mode. Keep this list tiny. */
const REQUIRED_URLS = [
  './',
  './index.html',
];

/* Nice to have. A 404 here is logged and ignored — never fatal. */
const OPTIONAL_URLS = [
  './manifest-finder.webmanifest',
  './icons/talabat-192.png',
  './icons/talabat-512.png',
  './icons/talabat-maskable-512.png',
];

/* Hosts that exist ONLY to reach the internet. Never cache,
   never intercept — let them fail naturally offline.          */
const NEVER_CACHE_HOSTS = [
  'corsproxy.io',
  'api.allorigins.win',
  'wsrv.nl',
  'images.weserv.nl',
  'cors.isomorphic-git.org',
  'cleanup.pictures',
];

async function cacheUrl(cache, url) {
  // cache:'reload' bypasses the HTTP cache so we archive a truly fresh
  // copy, not a stale one from GitHub Pages' max-age=600.
  const res = await fetch(new Request(url, { cache: 'reload' }));
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  await cache.put(url, res);
  return url;
}

// ---------------------------------------------------------------
// INSTALL
// ---------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);

    // Optional assets first: settled individually so one 404 cannot
    // abort the install (addAll() is atomic and would).
    const opt = await Promise.allSettled(
      OPTIONAL_URLS.map((url) => cacheUrl(cache, url))
    );
    const missed = OPTIONAL_URLS.filter((_, i) => opt[i].status === 'rejected');
    if (missed.length) console.warn('[sw] optional precache misses:', missed);

    // The page itself. './' and './index.html' are the same bytes on
    // GitHub Pages, so one success is enough — cache the other from it.
    const req = await Promise.allSettled(
      REQUIRED_URLS.map((url) => cacheUrl(cache, url))
    );
    if (!req.some((r) => r.status === 'fulfilled')) {
      throw new Error('[sw] FATAL: index.html could not be precached: ' +
        req.map((r) => r.reason && r.reason.message).join(' | '));
    }
    const page = (await cache.match('./index.html')) || (await cache.match('./'));
    for (const key of REQUIRED_URLS) {
      if (!(await cache.match(key))) await cache.put(key, page.clone());
    }

    console.log(`[sw] ${VERSION} installed — Images Finder is offline ready`);
  })());

  // NOT skipWaiting() here, deliberately.
  //
  // activate calls clients.claim(), the page reloads on
  // controllerchange, and a reload destroys the whole session: the
  // loaded image folder, every match, every review decision the
  // operator has made. Skipping the wait on install means a deploy
  // silently wipes someone's work in the middle of a catalogue run.
  //
  // So the new worker waits. The page notices it (updatefound ->
  // installed), offers an Update button, and only then posts
  // SKIP_WAITING — see the message handler below. The user chooses
  // when to lose their session.
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
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const key = './index.html';
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
          (await caches.match('./')) ||
          (await caches.match(req));
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

  // ---- Same-origin assets: cache-first ----
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
