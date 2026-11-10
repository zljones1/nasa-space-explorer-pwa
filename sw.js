/* NASA Space Explorer PWA service worker
 * - App shell: cache-first
 * - NASA API + image hosts: network-first with cache fallback
 */
const CACHE_VERSION = 'space-explorer-pwa-v2';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const SHELL_URLS = [
  './',
  './index.html',
  './style.css',
  './js/script.js',
  './js/dateRange.js',
  './js/pwa.js',
  './img/nasa-worm-logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './manifest.json'
];

function isApiOrMedia(url) {
  const host = url.hostname;
  return (
    host === 'api.nasa.gov' ||
    host.endsWith('nasa.gov') ||
    host === 'cdn.jsdelivr.net' ||
    host === 'web.archive.org' ||
    host.endsWith('apod.nasa.gov') ||
    host.endsWith('science.nasa.gov') ||
    /\.(jpg|jpeg|png|gif|webp|mp4)(\?|$)/i.test(url.pathname)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Same-origin app shell → cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // NASA API + remote images → network-first, cache on success, fall back to cache
  if (isApiOrMedia(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) {
            // Tell clients we served cached API/media while offline
            const clients = await self.clients.matchAll({ type: 'window' });
            clients.forEach((client) => {
              client.postMessage({ type: 'OFFLINE_CACHE_HIT', url: event.request.url });
            });
            return cached;
          }
          return Response.error();
        })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
