/* StockCard service worker: liquidation alerts (T059) + a minimal offline shell (T042).
 * Payload from /api/alerts/check: { title, body, market, band, url }.
 */
const VERSION = "stockcard-v2";
const APP_SHELL = [
  "/",
  "/borrow",
  "/card",
  "/portfolio",
  "/savings",
  "/cashback",
  "/bank",
  "/shop",
  "/admin",
  "/favicon.ico",
  "/icons/192",
  "/icons/512",
  "/icons/maskable-512",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isNavigation = request.mode === "navigate";
  const isAsset = url.origin === self.location.origin && request.destination !== "";
  if (!isNavigation && !isAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "StockCard", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "StockCard";
  const options = {
    body: data.body || "",
    tag: data.market ? `stockcard-${data.market}` : "stockcard",
    renotify: true,
    data: { url: data.url || "/" },
    icon: "/icons/192",
    badge: "/icons/192",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
