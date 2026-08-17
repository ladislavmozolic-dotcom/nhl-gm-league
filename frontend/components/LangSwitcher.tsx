"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGS, LANG_NAMES, LANG_CODE, type Lang } from "@/lib/i18n";
import { setLang } from "@/app/lang-actions";

/** Compact language dropdown — scales to any number of languages (extra ones stay
 *  hidden in the menu until opened). Shows the current code + a list on click. */
export default function LangSwitcher({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (l: Lang) => { setOpen(false); if (l === lang) return; start(async () => { await setLang(l); router.refresh(); }); };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/60 text-[11px] font-bold text-slate-300 hover:text-white ${pending ? "opacity-60" : ""}`}>
        {LANG_CODE[lang]}<span className="text-[8px] text-slate-500">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-[#0e1e35] border border-slate-700 rounded-lg shadow-xl shadow-black/40 py-1 z-[60]">
          {LANGS.map((l) => (
            <button key={l} type="button" onClick={() => pick(l)}
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between hover:bg-slate-800 ${l === lang ? "text-blue-400 font-semibold" : "text-slate-300"}`}>
              {LANG_NAMES[l]}<span className="text-[10px] text-slate-500">{LANG_CODE[l]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
