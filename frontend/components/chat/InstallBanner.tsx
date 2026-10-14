"use client";

import { useEffect, useRef, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// "Pridať na plochu" — one-tap install on Android/Chrome, a link to the how-to on iPhone/others.
// Hidden once the chat already runs as an installed app, or after the GM dismisses it.
export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [native, setNative] = useState(false);
  const ev = useRef<BIPEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    let dismissed = false;
    try { dismissed = localStorage.getItem("unhl-chat-install-dismissed") === "1"; } catch { /* private mode */ }
    if (standalone || dismissed) return;
    const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (mobile) setShow(true);
    const h = (e: Event) => { e.preventDefault(); ev.current = e as BIPEvent; setNative(true); setShow(true); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  if (!show) return null;
  const close = () => { setShow(false); try { localStorage.setItem("unhl-chat-install-dismissed", "1"); } catch { /* ignore */ } };
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-600/15 border-b border-blue-500/30 text-sm">
      <span className="text-lg">📲</span>
      <span className="flex-1">Pridaj chat na plochu ako appku</span>
      {native
        ? <button onClick={async () => { await ev.current?.prompt(); const r = await ev.current?.userChoice; if (r?.outcome === "accepted") setShow(false); }} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium">Pridať</button>
        : <a href="/chat/install" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium">Ako na to</a>}
      <button onClick={close} aria-label="Zavrieť" className="text-slate-400">✕</button>
    </div>
  );
}
