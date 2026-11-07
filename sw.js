// Offline support: serve from cache, refresh the cache in the background (stale-while-revalidate).
// Bump CACHE when you want every client to drop old files at once.
const CACHE = 'dilbaz-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // never cache API calls
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(e.request);
    const fresh = fetch(e.request).then((res) => {
      if (res.status === 200) cache.put(e.request, res.clone()); // never cache partial (206) audio responses
      return res;
    }).catch(() => cached);
    return cached ?? fresh;
  }));
});
