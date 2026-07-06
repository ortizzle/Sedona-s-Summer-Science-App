// Service worker for Sedona's Learning Lab — makes the PWA genuinely work offline.
// Strategy:
//   • App shell (index.html): network-first, so updates arrive when online,
//     with the cached copy as the offline fallback.
//   • Everything else (fonts, KaTeX CDN, icons): cache-first, populated at runtime.
// Bump CACHE_VERSION whenever caching behavior changes.
const CACHE_VERSION = 'sedona-lab-v1';
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  const isShell = url.origin === self.location.origin &&
    (url.pathname.endsWith('/') || url.pathname.endsWith('index.html'));

  if (isShell) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      // Cache successful responses, including opaque cross-origin ones
      // (Google Fonts / jsDelivr are fetched no-cors by <link>/<script> tags).
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
