/* TransformerPath service worker — offline support + always-fresh HTML */
const CACHE = 'transformerpath-v1';
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

  // Cache-first for static assets (css, images, icons).
  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return r;
    }).catch(() => m))
  );
});
