const CACHE_NAME = 'bitcoin-tracker-v1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './favicon.svg',
  './icons/icon-192x192.svg',
  './icons/icon-512x512.svg'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
  caches.open(CACHE_NAME)
    .then((cache) => {
    console.log('Opened cache');
    return cache.addAll(urlsToCache);
    })
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
  caches.match(event.request)
    .then((response) => {
    // Return cached version or fetch from network
    if (response) {
      return response;
    }

    // For API requests, always try network first
    const url = event.request.url;
    if (url.includes('api.binance.com') ||
        url.includes('api.kraken.com') ||
        url.includes('api.allorigins.win') ||
        url.includes('coingecko.com')) {
      return fetch(event.request).catch(() => {
      // If network fails, return offline message for API requests
      return new Response(JSON.stringify({
        error: 'Offline - API unavailable',
        offline: true
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503,
        statusText: 'Service Unavailable'
      });
      });
    }

    return fetch(event.request);
    }
  )
  );
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
  caches.keys().then((cacheNames) => {
    return Promise.all(
    cacheNames.map((cacheName) => {
      if (cacheName !== CACHE_NAME) {
      return caches.delete(cacheName);
      }
    })
    );
  })
  );
});

// Handle push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Price Alert';
  const options = {
    body: data.body || 'Your price alert has been triggered!',
    icon: './icons/icon-192x192.svg',
    badge: './icons/icon-192x192.svg',
    tag: 'price-alert',
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: 'View App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
