/**
 * Vocal Studio AI - Service Worker (Stage 6)
 * Enables offline shell access, asset caching, and desktop PWA support.
 */

const CACHE_NAME = 'vocal-studio-ai-v1.2.3';

// Core Application Shell assets to cache immediately
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/favicon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// Install Event - Precache critical shell files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(SHELL_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key.startsWith('vocal-studio-ai-'))
            .map((oldKey) => caches.delete(oldKey))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event - Strategic routing
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Bypass Service Worker entirely for local Python engine (127.0.0.1:8524)
  if (url.port === '8524' || url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
    if (url.port === '8524') {
      return; // Direct network pass-through
    }
  }

  // 2. Only cache GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 3. Navigation requests (HTML documents) -> Network-First with SPA index.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;

          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) return offlinePage;

          return new Response('Offline - Vocal Studio AI', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // 4. Static versioned assets (JS, CSS, images, fonts) -> Cache-First with Network fallback
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 5. Default: Network-first
  event.respondWith(
    fetch(request).catch(() => {
      return caches.match(request);
    })
  );
});

// Listen for message to skip waiting when user confirms update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

