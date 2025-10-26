// Conservative service worker: avoids intercepting Next.js build assets and scripts

const CACHE = "dorm-static-v3"

// Utility: cache-first
async function cacheFirst(req) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(req)
  if (cached) return cached
  const res = await fetch(req)
  if (res && res.ok) {
    cache.put(req, res.clone()).catch(() => {})
  }
  return res
}

// Utility: network-first for HTML navigations
async function networkFirst(req) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    if (res && res.ok) {
      cache.put(req, res.clone()).catch(() => {})
    }
    return res
  } catch {
    const cached = await cache.match(req)
    return cached || new Response("", { status: 504 })
  }
}

self.addEventListener("install", (event) => {
  // Skip waiting to activate updated SW quickly
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)

  // 1) Always BYPASS Next.js build assets and script/style/font/worker requests
  const isNextAsset = url.pathname.startsWith("/_next/")
  const isCode = ["script", "style", "font", "worker"].includes(req.destination)
  if (isNextAsset || isCode) {
    return // let the browser handle normally
  }

  // 2) HTML navigations -> network-first (avoid stale HTML causing MIME issues)
  const isHTML =
    req.mode === "navigate" || (req.headers.get("accept") && req.headers.get("accept").includes("text/html"))
  if (isHTML) {
    event.respondWith(networkFirst(req))
    return
  }

  // 3) Icons/manifest/images -> cache-first
  const isIconOrManifest =
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith("/favicon.ico") ||
    url.pathname.endsWith("manifest.webmanifest") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".gif") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webp")
  if (isIconOrManifest) {
    event.respondWith(cacheFirst(req))
    return
  }

  // 4) Default: network-first (safe choice)
  event.respondWith(networkFirst(req))
})

// Push: display incoming notifications
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "알림", body: event.data?.text() ?? "" }
  }
  const title = data.title || "Dorm Manager"
  const body = data.body || "새로운 알림이 도착했습니다."
  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: data.data || {},
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const url = "/"
      const hadWindow = clientsArr.some((client) => {
        if ("focus" in client) {
          client.focus()
          return true
        }
        return false
      })
      if (!hadWindow && self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    }),
  )
})
