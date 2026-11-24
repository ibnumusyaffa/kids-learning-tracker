/*
 * Service worker dasar: membuat aplikasi bisa di-install dan tetap bisa
 * dibuka saat sinyal hilang. BUKAN mode offline penuh: data selalu dari
 * server, dan perubahan tidak disimpan saat offline.
 *
 * - Aset statis (/assets/*, ikon) → cache-first (nama file sudah di-hash).
 * - Navigasi halaman → network-first, fallback ke halaman offline.
 * - API, server function, auth, dan foto → selalu jaringan, tidak di-cache.
 */
const VERSION = 'v1'
const STATIC_CACHE = `static-${VERSION}`
// Cloudflare assets menyajikan offline.html di /offline (tanpa .html).
const OFFLINE_URL = '/offline'
const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_serverFn')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  if (url.pathname.startsWith('/assets/') || PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          }),
      ),
    )
  }
})
