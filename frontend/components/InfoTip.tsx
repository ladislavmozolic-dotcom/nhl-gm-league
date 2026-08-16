"use client";

import { useState, useId, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

// A small "ⓘ" that reveals a short explanation on hover / focus / tap. Use it
// next to a heading, a column label, or a stat abbreviation to say what it means.
//   <InfoTip text="Goals Saved Above Expected — save quality vs an average goalie." />
//
// The bubble is rendered into <body> with fixed positioning and clamped to the
// viewport, so it never gets clipped by a Card's overflow or the screen edge.
export default function InfoTip({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const b = btnRef.current.getBoundingClientRect();
    const tw = tipRef.current?.offsetWidth ?? 260;
    const th = tipRef.current?.offsetHeight ?? 44;
    const m = 8; // keep this far from every viewport edge
    const left = Math.max(m, Math.min(b.left + b.width / 2 - tw / 2, window.innerWidth - tw - m));
    // prefer above; drop below if there isn't room up top
    const above = b.top - th - 6 >= m;
    const top = above ? b.top - th - 6 : Math.min(b.bottom + 6, window.innerHeight - th - m);
    setPos({ left, top });
  }, [open, text]);

  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        ref={btnRef}
        type="button"
        aria-label={label ?? "What does this mean?"}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="ml-1 inline-grid place-items-center w-4 h-4 rounded-full border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400 text-[10px] leading-none cursor-help"
      >
        i
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <span
          ref={tipRef}
          id={id}
          role="tooltip"
          style={{ position: "fixed", left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
          className="z-[100] w-max max-w-[280px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-200 shadow-xl pointer-events-none"
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}
