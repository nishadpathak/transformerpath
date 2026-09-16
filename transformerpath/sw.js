/* TransformerPath service worker — offline support + always-fresh HTML */
const CACHE = 'transformerpath-v3';
const CORE = [
  'index.html', 'style.css', 'intel.html', 'manufacturers.html', 'events.html',
  'grids.html', 'learn.html', 'resources.html', 'subscribe.html',
  'explorer.html', 'vendor/three.min.js', 'offline.html',
  'brand/favicon-32.png', 'brand/icon-192.png', 'manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Never intercept cross-origin requests (geolocation API, analytics, Stripe) —
  // caching them would serve stale location data forever.
  if (new URL(req.url).origin !== self.location.origin) return;
  const accept = req.headers.get('accept') || '';

  // Network-first for pages, so daily intel + data are never stale; fall back to cache offline.
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req).then(m => m || caches.match('offline.html')))
    );
    return;
  }

  // Immutable vendor libs: cache-first (never change without a filename change).
  if (new URL(req.url).pathname.startsWith('/vendor/')) {
    e.respondWith(caches.match(req).then(m => m || fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return r;
    })));
    return;
  }

  // Everything else (css, js, images, json): stale-while-revalidate —
  // serve from cache instantly but refresh the cache in the background,
  // so style/data updates reach returning visitors on their next view.
  e.respondWith(
    caches.match(req).then(cached => {
      // no-cache: revalidate with the server (ETag) instead of trusting the
      // browser HTTP cache, so updated CSS/JS actually reaches the SW cache.
      const refresh = fetch(req, { cache: 'no-cache' }).then(r => {
        if (r && r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return r;
      }).catch(() => cached);
      return cached || refresh;
    })
  );
});
