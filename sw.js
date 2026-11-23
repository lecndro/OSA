/* Offline-Speicher der OSA-App. Die VERSION wird von "Handy-App aktualisieren.bat" automatisch erhöht. */
const VERSION = "osa-v53";
const DATEIEN = ["./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];
/* cache: "no-cache" = immer bei GitHub nachfragen, ob es eine neuere Datei gibt (GitHub erlaubt sonst 10 Minuten Zwischenspeicher) */
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(DATEIEN.map(d => new Request(d, { cache: "no-cache" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Erst aus dem Netz (damit Updates sofort ankommen), ohne Netz aus dem Speicher */
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;   // Ferien, Wetter, Schriften: direkt aus dem Netz
  e.respondWith(fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(r => { if (r.ok) { const k = r.clone(); caches.open(VERSION).then(c => c.put(e.request, k)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("./index.html"))));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => l.length ? l[0].focus() : self.clients.openWindow("./index.html")));
});
