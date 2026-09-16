/* StockCard service worker: liquidation alerts (T059) + a minimal offline shell (T042).
 * Payload from /api/alerts/check: { title, body, market, band, url }.
 */
const VERSION = "stockcard-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
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
    icon: "/icon-192.png",
    badge: "/icon-192.png",
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
