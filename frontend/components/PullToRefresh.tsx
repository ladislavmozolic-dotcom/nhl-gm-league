"use client";

import { useEffect, useRef, useState } from "react";

const THRESHOLD = 70; // px pulled down before a release triggers a reload

/** Installed (standalone) PWAs lose the browser's native pull-to-refresh — there's no
 *  browser chrome left to drive it. Only active in standalone mode: a regular browser
 *  tab already has its own pull-to-refresh, so this would just be a redundant second
 *  gesture fighting the first. Ships with a small floating refresh button too, since a
 *  gesture nobody told you about is easy to miss the first time. */
export default function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const startY = useRef<number | null>(null);
  const pullDist = useRef(0);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    setStandalone(isStandalone);
    if (!isStandalone) return;

    // Returns true when the touch originates inside a scrollable overflow
    // container (e.g. the mobile menu drawer).  In that case pull-to-refresh
    // must be suppressed — window.scrollY stays 0 while the inner div scrolls,
    // so without this guard the gesture was treated as a page pull and
    // window.location.reload() fired once the 70 px threshold was crossed.
    const isInsideScrollable = (target: EventTarget | null): boolean => {
      let el = target as HTMLElement | null;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) {
          return true;
        }
        el = el.parentElement;
      }
      return false;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY !== 0 || isInsideScrollable(e.target)) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null || window.scrollY > 0) return;
      const dy = e.touches[0].clientY - startY.current;
      const clamped = Math.max(0, Math.min(dy, 120));
      pullDist.current = clamped;
      setPull(clamped);
    };
    const onTouchEnd = () => {
      if (pullDist.current > THRESHOLD) {
        setRefreshing(true);
        window.location.reload();
      } else {
        setPull(0);
        pullDist.current = 0;
      }
      startY.current = null;
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  if (!standalone) return null;

  const progress = Math.min(pull / THRESHOLD, 1);

  return (
    <>
      {/* the pull-down indicator, hugging the top edge, sliding into view with the drag */}
      <div
        aria-hidden
        style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 50, zIndex: 200, pointerEvents: "none",
          display: "flex", justifyContent: "center", alignItems: "center",
          transform: `translateY(${pull > 0 ? Math.min(pull, 60) - 50 : -50}px)`,
          transition: pull === 0 ? "transform 0.2s ease" : "none",
        }}
      >
        <div
          style={{
            width: 26, height: 26, borderRadius: "50%", opacity: refreshing ? 1 : progress,
            border: "3px solid rgba(148,163,184,0.35)", borderTopColor: "#60a5fa",
            transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
            animation: refreshing ? "ptr-spin 0.7s linear infinite" : undefined,
          }}
        />
      </div>
      {/* fallback for anyone who doesn't discover the gesture */}
      <button
        onClick={() => { setRefreshing(true); window.location.reload(); }}
        aria-label="Refresh"
        title="Refresh"
        className="fixed bottom-5 right-4 z-[200] w-11 h-11 rounded-full bg-slate-800/90 border border-slate-600 text-lg shadow-lg shadow-black/40 grid place-items-center active:scale-95"
      >
        {refreshing ? <span style={{ display: "inline-block", animation: "ptr-spin 0.7s linear infinite" }}>🔄</span> : "🔄"}
      </button>
      <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
