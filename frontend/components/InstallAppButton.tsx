"use client";

import { useEffect, useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n";

/** "Install app" button for Add-to-Home-Screen. Renders nothing once the site is
 *  already running standalone (installed), or on a browser that offers no install
 *  path we can act on. Android/Chrome gets a real one-tap install via
 *  `beforeinstallprompt`; iOS Safari has no such API, so tapping there just shows
 *  the "Share → Add to Home Screen" instructions Apple requires doing manually. */
export default function InstallAppButton({ lang = "en", className }: { lang?: Lang; className?: string }) {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const deferredPrompt = useRef<{ prompt: () => void; userChoice: Promise<unknown> } | null>(null);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    if (standalone) return;

    const iOS = /iPad|iPhone|iPod/.test(nav.userAgent) && !("MSStream" in window);
    setIsIOS(iOS);
    if (iOS) setVisible(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as unknown as { prompt: () => void; userChoice: Promise<unknown> };
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

  return (
    <div className="relative">
      <button onClick={onClick} className={className}>📲 {t(lang, "ui.installApp")}</button>
      {showHint && (
        <div className="absolute z-50 top-full mt-1 left-0 w-64 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-xs p-3 shadow-xl">
          {t(lang, isIOS ? "ui.installHintIOS" : "ui.installHintAndroid")}
          <button onClick={() => setShowHint(false)} className="block mt-2 text-blue-400 text-xs font-semibold">OK</button>
        </div>
      )}
    </div>
  );
}
