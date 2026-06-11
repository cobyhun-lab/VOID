// VOID RUNNER service worker — v13.1.1
// Strategy:
//  - HTML (the game itself): NETWORK-FIRST. A bad cached copy can never
//    strand players again — cache is only the offline fallback.
//  - Static assets (icons, manifest): stale-while-revalidate.
//  - Leaderboard/worker API: never touched.
const CACHE = 'void-runner-v13_1_1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Never cache the leaderboard/worker API — always network
  if (url.hostname.endsWith('workers.dev')) return;
  if (e.request.method !== 'GET') return;

  const isHTML = e.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') || url.pathname.endsWith('/') ||
    url.pathname.endsWith('/VOID');

  if (isHTML) {
    // NETWORK-FIRST: fresh game every launch; cache only as offline fallback.
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(resp => {
        if (resp && resp.ok && url.origin === location.origin) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
    }
        return resp;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
