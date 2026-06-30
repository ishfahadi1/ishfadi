/* ISHFADI Service Worker
 * Strategy:
 *  - App shell: cache-first (precache on install)
 *  - Navigations (HTML): network-first, fallback to cached index then offline.html
 *  - Same-origin static assets (css/js/img/font): stale-while-revalidate
 *  - Cross-origin (fonts/leaflet/tailwind CDN): stale-while-revalidate (best-effort)
 *  - Tile / API requests: network-only (never cached)
 * Versioning: bump CACHE_VERSION on every release; old caches are deleted on activate.
 */
const CACHE_VERSION = 'v1.0.1';
const PRECACHE      = `ishfadi-precache-${CACHE_VERSION}`;
const RUNTIME       = `ishfadi-runtime-${CACHE_VERSION}`;
const OFFLINE_URL   = '/offline.html';

const APP_SHELL = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png'
];

// ---------- install ----------
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    // addAll is atomic; use Promise.allSettled-style loop to avoid total failure on one 404.
    await Promise.all(APP_SHELL.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
    ));
    self.skipWaiting();
  })());
});

// ---------- activate ----------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map(n => {
      if (n !== PRECACHE && n !== RUNTIME && n.startsWith('ishfadi-')) return caches.delete(n);
    }));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

// ---------- messages (update flow) ----------
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

// ---------- helpers ----------
const isHTML = (req) =>
  req.mode === 'navigate' ||
  (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));

const isStaticAsset = (url) =>
  /\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname);

const isTileOrAPI = (url) =>
  /tile\.openstreetmap\.org|\/api\//i.test(url.href);

// network-first, fallback to cache, fallback to offline
async function networkFirstHTML(event) {
  const cache = await caches.open(RUNTIME);
  try {
    const preload = await event.preloadResponse;
    const fresh = preload || await fetch(event.request);
    cache.put(event.request, fresh.clone()).catch(()=>{});
    return fresh;
  } catch (err) {
    const cached = await caches.match(event.request) || await caches.match('/index.html');
    return cached || caches.match(OFFLINE_URL);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone()).catch(()=>{});
    return res;
  }).catch(() => null);
  return cached || network || new Response('', { status: 504 });
}

// ---------- fetch ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (isTileOrAPI(url)) return; // bypass

  if (isHTML(req)) {
    event.respondWith(networkFirstHTML(event));
    return;
  }

  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Cross-origin CDN assets (fonts, tailwind, leaflet) – best effort SWR
  if (url.origin !== self.location.origin && /fonts\.|unpkg\.com|cdn\./i.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
});

// ---------- future-ready: push & background sync hooks ----------
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'ISHFADI';
  const opts = {
    body: data.body || 'You have a new update.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    data: data.url || '/',
    tag: data.tag || 'ishfadi-notif'
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data || '/';
  event.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) { if ('focus' in c) return c.navigate(target).then(() => c.focus()); }
    if (clients.openWindow) return clients.openWindow(target);
  }));
});

self.addEventListener('sync', (event) => {
  // Reserved for future background sync (favorites, saved searches)
  if (event.tag === 'ishfadi-sync-favorites') {
    // event.waitUntil(syncFavorites());
  }
});
