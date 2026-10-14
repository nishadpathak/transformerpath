/* TransformerPath service worker — offline shell + always-fresh HTML
 *
 * Do NOT precache generated HTML (index/intel/manufacturers/…). Precached
 * pages from a prior release survive across deploys and create mixed-generation
 * public truth. Navigate/HTML is network-first; only the offline shell + static
 * brand assets are installed into the core cache.
 */
const CACHE = 'transformerpath-v14';
const CORE = [
  'offline.html',
  'style.css?v=14',
  'brand/favicon-32.png',
  'brand/icon-192.png',
  'manifest.webmanifest'
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
  const path = new URL(req.url).pathname;

  // Network-first for pages AND build/data JSON so release provenance and
  // freshness clocks cannot stick to an older generation in the SW cache.
  const isHtml = req.mode === 'navigate' || accept.includes('text/html');
  const isReleaseData = /\.(?:html?)$/i.test(path) ||
    path === '/data/freshness.json' ||
    path === '/data/build-provenance.json' ||
    path === '/data/site-stats.json' ||
    path.startsWith('/data/gcc-');
  if (isHtml || isReleaseData) {
    e.respondWith(
      fetch(req).then(r => {
        // Cache successful HTML only as offline fallback — never prefer it online.
        if (isHtml && r && r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return r;
      }).catch(() => caches.match(req).then(m => m || caches.match('offline.html')))
    );
    return;
  }

  // Immutable vendor libs: cache-first (never change without a filename change).
  if (path.startsWith('/vendor/')) {
    e.respondWith(caches.match(req).then(m => m || fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return r;
    })));
    return;
  }

  // Everything else (css, js, images, other json): stale-while-revalidate —
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
