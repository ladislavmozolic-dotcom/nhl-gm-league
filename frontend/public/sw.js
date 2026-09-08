// Deliberately does nothing — no caching, no offline support. It exists purely
// because Chrome/Edge won't fire `beforeinstallprompt` (the event the "Install app"
// button listens for — see components/InstallAppButton.tsx) without a registered
// service worker that has a fetch handler. Not calling event.respondWith() here
// means every request still falls straight through to the network exactly as if
// this file didn't exist, so it can't ever serve stale content after a deploy.
self.addEventListener("fetch", () => {});
