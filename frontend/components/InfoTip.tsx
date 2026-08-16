"use client";

import { useState, useId } from "react";

// A small "ⓘ" that reveals a short explanation on hover / focus / tap. Use it
// next to a heading, a column label, or a stat abbreviation to say what it means.
//   <InfoTip text="Goals Saved Above Expected — save quality vs an average goalie." />
export default function InfoTip({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex items-center align-middle">
      <button
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
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 bottom-full z-50 mb-1.5 -translate-x-1/2 w-max max-w-[260px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-normal normal-case tracking-normal text-slate-200 shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  );
}
