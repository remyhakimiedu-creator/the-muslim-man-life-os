/* Life OS service worker. vite.config.js fills in the two placeholders at build time. */
const VERSION = '__VERSION__';
const SHELL_CACHE = `life-os-shell-${VERSION}`;
const PRECACHE = __PRECACHE__;

// ignoreVary: some hosts send "Vary: Origin", which would otherwise make the
// cached copy miss for <script type="module" crossorigin> requests.
const MATCH = { ignoreSearch: true, ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // cache: 'reload' skips the HTTP cache so a new build is never half old.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Only the app's own files are served from here. Prayer times and weather go
  // straight to the network on purpose: the app keeps its own dated copy of
  // them, so anything shown offline is honestly labelled as a saved copy.
  if (new URL(request.url).origin !== self.location.origin) return;

  // App shell: answer from the cache first so launch is instant and offline-proof.
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const indexUrl = new URL('./index.html', self.registration.scope).href;
      const hit = await cache.match(request.mode === 'navigate' ? indexUrl : request, MATCH);
      if (hit) return hit;
      try {
        return await fetch(request);
      } catch {
        // Unknown path while offline: only a page navigation may fall back to the app.
        if (request.mode === 'navigate') return (await cache.match(indexUrl, MATCH)) || Response.error();
        return Response.error();
      }
    })(),
  );
});
