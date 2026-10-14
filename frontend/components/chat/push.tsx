"use client";

import { useCallback, useEffect, useState } from "react";

export type PushState = "unknown" | "on" | "off" | "denied" | "unsupported" | "ios-install" | "novapid";

function b64ToU8(s: string) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const post = (sub: PushSubscription) => fetch("/api/im/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/chat")) ?? (await navigator.serviceWorker.register("/chat-sw.js", { scope: "/chat" }));
}

/** Web-push state for THIS device. If permission is already granted, the device is (re)registered with the server
 *  silently on every start — so a rotated subscription or a fresh login never leaves the device without notifications. */
export function usePush(vapid: string | null) {
  const [state, setState] = useState<PushState>("unknown");

  useEffect(() => {
    (async () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      const ios = /iphone|ipad/i.test(navigator.userAgent);
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !standalone ? "ios-install" : "unsupported");
      if (!vapid) return setState("novapid");
      if (Notification.permission === "denied") return setState("denied");
      if (Notification.permission === "granted") {
        try {
          const reg = await registration();
          await navigator.serviceWorker.ready;
          const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(vapid) }));
          await post(sub); // idempotent upsert — keeps the server in sync
          return setState("on");
        } catch { return setState("off"); }
      }
      setState("off");
    })();
  }, [vapid]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!vapid) return false;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return false; }
    try {
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(vapid) }));
      await post(sub);
      setState("on");
      return true;
    } catch { setState("off"); return false; }
  }, [vapid]);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration("/chat");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await fetch("/api/im/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    setState("off");
  }, []);

  const test = useCallback(async (): Promise<number> => {
    const r = await fetch("/api/im/push/test", { method: "POST" });
    return r.ok ? ((await r.json()).sent as number) : 0;
  }, []);

  return { state, enable, disable, test };
}

export type PushApi = ReturnType<typeof usePush>;

const KEY = "unhl-chat-push-dismissed";
/** Prominent prompt (not buried in settings): shown until notifications are on; dismissed for 3 days. */
export function PushBanner({ api }: { api: PushApi }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { const t = Number(localStorage.getItem(KEY) ?? 0); setHidden(Date.now() - t < 3 * 86400_000); } catch { setHidden(false); }
  }, []);
  if (hidden || api.state !== "off") return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-sm">
      <span className="text-lg">🔔</span>
      <span className="flex-1">Zapni notifikácie, aby ti správy chodili aj keď je appka zatvorená</span>
      <button onClick={async () => { await api.enable(); }} className="rounded-lg bg-amber-500 text-black px-3 py-1.5 text-xs font-semibold">Zapnúť</button>
      <button onClick={() => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } setHidden(true); }} aria-label="Neskôr" className="text-slate-400">✕</button>
    </div>
  );
}
