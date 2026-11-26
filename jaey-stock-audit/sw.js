const CACHE = 'jaey-audit-v151';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Network-only for external services
  if (url.hostname !== self.location.hostname) {
    e.respondWith(fetch(e.request).catch(() => new Response('', {status: 503})));
    return;
  }
  // Network-FIRST for the app page itself (HTML/navigation) so a new deploy always shows up
  // when online; fall back to the cached copy only when offline. This stops the app ever being
  // stuck on an old version.
  const isHTML = e.request.mode === 'navigate'
    || url.pathname === '/' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(resp => {
        caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        return resp;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('/index.html') || caches.match('/')))
    );
    return;
  }
  // Cache-first for other static assets.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(resp => {
        caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
