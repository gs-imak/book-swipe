const CACHE_NAME = 'bookswipe-v5'
const API_CACHE_NAME = 'bookswipe-api-v1'
const IMG_CACHE_NAME = 'bookswipe-images-v1'

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
]

// Max age for cached API responses (5 minutes)
const API_CACHE_MAX_AGE = 5 * 60 * 1000
// Max cached images (prevent unbounded growth)
const MAX_CACHED_IMAGES = 500

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= maxItems) return
  for (let i = 0; i < keys.length - maxItems; i++) {
    await cache.delete(keys[i])
  }
}

// Listen for skip-waiting message from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    })
  )
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME && key !== IMG_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Check if a URL is a book cover image
function isBookCoverUrl(url) {
  const coverHosts = [
    'books.google.com',
    'books.googleusercontent.com',
    'covers.openlibrary.org',
    'i.gr-assets.com',
    'm.media-amazon.com',
    'images-na.ssl-images-amazon.com',
    'www.gutenberg.org',
  ]
  return coverHosts.some(host => url.hostname === host)
}

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return

  // === Cross-origin book cover images: cache-first with network fallback ===
  if (url.origin !== self.location.origin && isBookCoverUrl(url)) {
    event.respondWith(
      caches.open(IMG_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached
          return fetch(request).then(async (response) => {
            if (response.ok) {
              cache.put(request, response.clone())
              await trimCache(IMG_CACHE_NAME, MAX_CACHED_IMAGES)
            }
            return response
          }).catch(() => {
            // Offline: return placeholder
            return new Response('', { status: 404 })
          })
        })
      })
    )
    return
  }

  // Skip other cross-origin requests
  if (url.origin !== self.location.origin) return

  // === Next.js image optimization proxy: cache-first ===
  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(
      caches.open(IMG_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) return cached
          return fetch(request).then(async (response) => {
            if (response.ok) {
              cache.put(request, response.clone())
              await trimCache(IMG_CACHE_NAME, MAX_CACHED_IMAGES)
            }
            return response
          }).catch(() => {
            return new Response('', { status: 404 })
          })
        })
      })
    )
    return
  }

  // === API routes: network-first with cache fallback ===
  if (url.pathname.startsWith('/api/books') || url.pathname.startsWith('/api/openlibrary')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(API_CACHE_NAME).then((cache) => {
              const headers = new Headers(clone.headers)
              headers.set('sw-cached-at', Date.now().toString())
              const cachedResponse = new Response(clone.body, {
                status: clone.status,
                statusText: clone.statusText,
                headers,
              })
              cache.put(request, cachedResponse)
            })
          }
          return response
        })
        .catch(() => {
          return caches.open(API_CACHE_NAME).then((cache) => {
            return cache.match(request).then((cached) => {
              if (!cached) return new Response(JSON.stringify({ items: [] }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              })
              return cached
            })
          })
        })
    )
    return
  }

  // Skip other API routes
  if (url.pathname.startsWith('/api/')) return

  // === Local images and fonts: stale-while-revalidate ===
  if (
    url.pathname.startsWith('/logo/') ||
    url.pathname.startsWith('/doodles/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        return cached || networkFetch
      })
    )
    return
  }

  // === Everything else (pages, JS, CSS): network-first ===
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || caches.match('/')
        })
      })
  )
})
