const CACHE = "libro-prestamos-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request)
        .then((res) => { if (res && res.status === 200) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
