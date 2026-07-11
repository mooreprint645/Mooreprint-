const CACHE_NAME = 'mooreprint-v22';
const APP_SHELL = [
  './', './index.html', './styles.css', './brand-theme.css', './advanced-features.css', './access-control.css', './supplier-catalog.css', './monthly-overhead.css', './branch-access.css', './usability.css', './mobile-fixes.css',
  './files-db.js', './app-core.js', './app-render-main.js', './app-render-finance.js',
  './app-contacts.js', './app-catalog.js', './app-documents.js', './app-finance.js',
  './app-tools.js', './advanced-fixes.js', './advanced-features.js', './performance-fixes.js', './team-workflow.js', './state-bridge.js', './team-improvements.js', './supplier-catalog.js', './monthly-overhead.js', './branch-access.js', './catalog-cloud.js', './overhead-cloud.js', './usability.js', './mobile-fixes.js', './supabase-config.js', './supabase-cloud.js',
  './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request);
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    return response;
  } catch (error) {
    return (await caches.match(request)) || (fallback ? caches.match(fallback) : Response.error());
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, './index.html'));
    return;
  }

  if (url.origin === self.location.origin) {
    const freshAsset = /\.(?:js|css|webmanifest)$/.test(url.pathname);
    if (freshAsset) {
      event.respondWith(networkFirst(event.request));
      return;
    }
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    })));
    return;
  }

  if (url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    })));
  }
});
