// Safar Self Drive Service Worker
const CACHE_NAME = 'safar-cache-v20261110k';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/cars.html',
  '/calculator.html',
  '/about.html',
  '/contact.html',
  '/services.html',
  '/portal.css?v=20261110k',
  '/design-system.css?v=20261110k',
  '/portal.js?v=20261110k',
  '/safar-logo.png?v=20261110k',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Do not cache API requests or non-http
  if (url.pathname.startsWith('/api/') || !url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networked = fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networked;
    })
  );
});
