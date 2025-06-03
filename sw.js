// BWV Universal Player - Service Worker
// Version 1.0.0

const CACHE_NAME = 'bwv-player-v1';
const STATIC_CACHE_NAME = 'bwv-player-static-v1';

// Core app files that should always be cached
const CORE_FILES = [
  '/',
  '/index.html',
  '/index.js',
  '/bars.js',
  '/manifest.json',
  '/media/bach-seal.svg',
  '/media/Wikipedia\'s_W.svg',
  '/media/up-arrow-svgrepo-com.svg'
];

// External resources (CDN files)
const EXTERNAL_RESOURCES = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.6/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js'
];

// Install event - cache core files
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache core app files
      caches.open(STATIC_CACHE_NAME).then(cache => {
        console.log('Service Worker: Caching core app files');
        return cache.addAll(CORE_FILES);
      }),
      // Cache external resources
      caches.open(CACHE_NAME).then(cache => {
        console.log('Service Worker: Caching external resources');
        return cache.addAll(EXTERNAL_RESOURCES);
      })
    ]).then(() => {
      console.log('Service Worker: Installation complete');
      // Skip waiting to activate immediately
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old cache versions
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activation complete');
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle different types of requests
  if (isStaticAsset(event.request)) {
    // Static assets: Cache first, then network
    event.respondWith(cacheFirst(event.request));
  } else if (isWorkContent(event.request)) {
    // Musical work content: Network first, then cache
    event.respondWith(networkFirst(event.request));
  } else if (isExternalResource(event.request)) {
    // External CDN resources: Cache first
    event.respondWith(cacheFirst(event.request));
  } else {
    // Everything else: Network first
    event.respondWith(networkFirst(event.request));
  }
});

// Cache-first strategy (for static assets and external resources)
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Cache-first failed:', error);
    return new Response('Offline - resource not available', { status: 503 });
  }
}

// Network-first strategy (for dynamic content)
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    
    return new Response('Offline - resource not available', { status: 503 });
  }
}

// Helper functions to categorize requests
function isStaticAsset(request) {
  const url = new URL(request.url);
  return CORE_FILES.some(file => url.pathname.endsWith(file)) ||
         url.pathname.includes('/media/') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.svg') ||
         url.pathname.endsWith('.png') ||
         url.pathname.endsWith('.ico');
}

function isWorkContent(request) {
  const url = new URL(request.url);
  return url.pathname.includes('/exports/') ||
         url.pathname.endsWith('.yaml') ||
         url.pathname.endsWith('.json') ||
         url.pathname.endsWith('.svg') ||
         url.pathname.endsWith('.wav') ||
         url.pathname.endsWith('.mp3');
}

function isExternalResource(request) {
  const url = new URL(request.url);
  return !url.origin.includes(self.location.origin);
}

// Handle background sync (future feature)
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered');
});

// Handle push notifications (future feature)
self.addEventListener('push', event => {
  console.log('Service Worker: Push message received');
});

// Log service worker updates
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('Service Worker: Script loaded');