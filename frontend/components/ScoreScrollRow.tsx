"use client";

import { useRef, type ReactNode } from "react";

// Mouse users have no touchpad swipe/trackpad scroll for a horizontal row — give
// them a pair of arrow buttons fixed at the end of the Scores banner so they can
// still reach cards off-screen either direction.
export default function ScoreScrollRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 300, behavior: "smooth" });

  return (
    <>
      <div ref={ref} className="flex gap-2 overflow-x-auto p-2 no-scrollbar flex-1 min-w-0">
        {children}
      </div>
      <div className="shrink-0 flex items-center gap-1 px-2 border-l border-slate-800">
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label="Scroll left"
          className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label="Scroll right"
          className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-800/70 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          ›
        </button>
      </div>
    </>
  );
}
