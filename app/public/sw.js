/* Nexora service worker — cache mínimo para instalação PWA confiável. */
const CACHE = "nexora-static-v1";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Nunca interceptar API/WS/trpc.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/ws")
  )
    return;

  // Navegações: rede primeiro com fallback offline simples.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Assets estáticos: cache-first.
  if (url.pathname.startsWith("/assets/") || url.pathname === "/manifest.json") {
    event.respondWith(
      caches.match(req).then(
        hit =>
          hit ||
          fetch(req).then(res => {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
            return res;
          })
      )
    );
  }
});
