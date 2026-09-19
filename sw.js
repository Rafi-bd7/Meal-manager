// MealManager Service Worker — v15.0
const CACHE_NAME = 'mealmanager-v15';
const OFFLINE_URL = 'login.html';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  './',
  'index.html',
  'login.html',
  'user-dashboard.html',
  'admin-dashboard.html',
  'css/styles.css',
  'js/api.js',
  'js/auth.js',
  'js/admin.js',
  'js/user.js',
  'js/chat.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// ── Install: Pre-cache static assets ──────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
        .catch(() => {});
    })
  );
});

// ── Activate: Clean old caches immediately ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Network-first for HTML/CSS/JS/API, Cache-first for others ───────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) {
    // External CDN fonts/icons → Cache-first with network fallback
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return resp;
        }).catch(() => cached);
      })
    );
    return;
  }

  // API calls → Network only (never cache PHP responses)
  if (url.pathname.includes('/api/') || url.pathname.endsWith('.php')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => {
        return new Response(JSON.stringify({ error: 'You are offline. Please check your connection.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  // HTML pages, CSS and JS files → Network-first (so dashboard and app logic always stay fresh)
  if (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css')  ||
    url.pathname.endsWith('.js')   ||
    url.pathname === '/'           ||
    url.pathname.endsWith('/')
  ) {
    event.respondWith(
      fetch(event.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      }).catch(() => caches.match(event.request).then(c => c || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Other static media assets (icons, images) → Cache-first with background revalidation
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      }).catch(() => null);

      return cached || networkFetch;
    })
  );
});

// ── Background Sync: Retry failed API calls when back online ──────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-meals') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // Notify clients to re-sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_NOW' }));
}

// ── Push Notifications ────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'MealManager', body: 'You have a new notification!' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'MealManager', {
      body: data.body || 'Check your meal dashboard.',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
