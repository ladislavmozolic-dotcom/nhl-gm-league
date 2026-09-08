"use client";

import { useEffect, useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n";

type HintKind = "ios" | "macSafari" | "android";

/** "Install app" button for Add-to-Home-Screen / Add-to-Dock. Renders nothing once
 *  the site is already running standalone (installed), or on a browser that offers
 *  no install path we can act on. Chrome/Edge (incl. on a Mac) gets a real one-tap
 *  install via `beforeinstallprompt` — a Chromium-only API Firefox has never
 *  implemented on any platform. Safari (iOS or macOS) and Firefox (Android only —
 *  Firefox Desktop dropped PWA installation entirely) fall back to manual steps
 *  instead, since that's the only way each of them allows it to happen. */
export default function InstallAppButton({ lang = "en", className }: { lang?: Lang; className?: string }) {
  const [visible, setVisible] = useState(false);
  const [hintKind, setHintKind] = useState<HintKind>("android");
  const [showHint, setShowHint] = useState(false);
  const deferredPrompt = useRef<{ prompt: () => void; userChoice: Promise<unknown> } | null>(null);

  useEffect(() => {
    // Chrome/Edge won't fire `beforeinstallprompt` below without a registered service
    // worker that has a fetch handler — sw.js deliberately does nothing else. register()
    // is idempotent, so mounting this twice (desktop nav + mobile drawer) is harmless.
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const ua = nav.userAgent;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (standalone) return;

    const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    // Chrome/Edge/Opera on a Mac also match "Safari" in their UA string — only a
    // real Safari (no Chromium browser token present) needs the manual Add-to-Dock hint.
    const isMacSafari = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS|Edg|OPR/.test(ua);
    // Firefox never fires beforeinstallprompt on any platform. On Android it still has
    // its own manual "Install" menu item (same steps as the generic Android hint below);
    // on desktop it has no install path at all as of this writing, so nothing to show.
    const isFirefoxAndroid = /Firefox/.test(ua) && /Android/.test(ua);
    if (isIOS) { setHintKind("ios"); setVisible(true); }
    else if (isMacSafari) { setHintKind("macSafari"); setVisible(true); }
    else if (isFirefoxAndroid) { setHintKind("android"); setVisible(true); }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as unknown as { prompt: () => void; userChoice: Promise<unknown> };
      setHintKind("android");
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!visible) return null;

  const onClick = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
      setVisible(false);
      return;
    }
    setShowHint((v) => !v);
  };

  const hintKey = hintKind === "ios" ? "ui.installHintIOS" : hintKind === "macSafari" ? "ui.installHintMac" : "ui.installHintAndroid";

  return (
    <div className="relative">
      <button onClick={onClick} className={className}>📲 {t(lang, "ui.installApp")}</button>
      {showHint && (
        <div className="absolute z-50 top-full mt-1 left-0 w-64 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-xs p-3 shadow-xl">
          {t(lang, hintKey)}
          <button onClick={() => setShowHint(false)} className="block mt-2 text-blue-400 text-xs font-semibold">OK</button>
        </div>
      )}
    </div>
  );
}
