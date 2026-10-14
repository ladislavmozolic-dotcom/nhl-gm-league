// UNHL Chat service worker — scope /chat only. Handles web push + notification clicks.
// The fetch handler is a deliberate no-op (needed for installability) so nothing is cached.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { /* ignore */ }
  event.waitUntil((async () => {
    // if the chat is open and focused, the in-app UI already shows it
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (!d.force && wins.some((w) => w.visibilityState === "visible" && w.focused)) return;
    // app-icon badge (Dock / taskbar / home screen) with the unread total, even while the app is closed
    try { if (typeof d.badge === "number" && self.navigator.setAppBadge) await (d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge()); } catch { /* unsupported */ }
    await self.registration.showNotification(d.title || "UNHL Chat", {
      body: d.body || "", tag: d.tag, renotify: true, vibrate: [120, 60, 120], icon: "/icons/chat-192.png", badge: "/icons/chat-192.png", data: { url: d.url || "/chat" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/chat";
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) if (w.url.includes("/chat")) return w.focus();
    return self.clients.openWindow(url);
  })());
});
