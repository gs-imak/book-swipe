const CACHE_NAME = 'bookswipe-v4'
const API_CACHE_NAME = 'bookswipe-api-v1'

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
]

// Max age for cached API responses (5 minutes)
const API_CACHE_MAX_AGE = 5 * 60 * 1000

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

// Activate: clean up ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Fetch: network-first for everything, cache fallback only for offline
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // API routes: network-first with cache fallback for offline browsing
  if (url.pathname.startsWith('/api/books')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(API_CACHE_NAME).then((cache) => {
              // Store with timestamp header for expiry
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
          // Offline: return cached API response if fresh enough
          return caches.open(API_CACHE_NAME).then((cache) => {
            return cache.match(request).then((cached) => {
              if (!cached) return new Response(JSON.stringify({ items: [] }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              })
              // Check staleness
              const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0')
              if (Date.now() - cachedAt > API_CACHE_MAX_AGE * 12) {
                // Very stale (1 hour) — still return it but mark as stale
                return cached
              }
              return cached
            })
          })
        })
    )
    return
  }

  // Skip other API routes
  if (url.pathname.startsWith('/api/')) return

  // Images, fonts, and external covers: stale-while-revalidate
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

  // Everything else (pages, JS, CSS): network-first
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
