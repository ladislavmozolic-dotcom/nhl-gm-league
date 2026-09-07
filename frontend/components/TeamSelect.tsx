"use client";

import { useState } from "react";

type TeamOpt = { id: number; name: string; logoUrl: string | null };

/** A team picker with logos, for use inside a plain (non-JS-submit) <form> —
 *  drives a hidden input the same way a native <select name=...> would, since
 *  a native <select>'s <option> can't render an image. */
export default function TeamSelect({ name, placeholder, teams, defaultValue }: {
  name: string; placeholder: string; teams: TeamOpt[]; defaultValue?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<number | null>(defaultValue ?? null);
  const [q, setQ] = useState("");
  const selected = teams.find((t) => t.id === value);
  const filtered = q.trim() ? teams.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase())) : teams;

  return (
    <div className="relative flex-1">
      <input type="hidden" name={name} value={value ?? ""} />
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-left text-sm">
        {selected ? (
          <>
            {selected.logoUrl && <img src={selected.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
            <span className="truncate">{selected.name}</span>
          </>
        ) : <span className="text-slate-500">{placeholder}</span>}
        <span className="ml-auto text-slate-500 text-xs shrink-0">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto bg-[#0f1d32] border border-slate-700 rounded-lg shadow-2xl shadow-black/50">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" autoFocus
              className="w-full px-3 py-2 text-sm bg-slate-900 border-b border-slate-700 outline-none sticky top-0" />
            {filtered.map((t) => (
              <button key={t.id} type="button" onClick={() => { setValue(t.id); setOpen(false); setQ(""); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-700/40 text-left transition-colors">
                {t.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
                <span className="truncate">{t.name}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-3 text-sm text-slate-500">No match.</div>}
          </div>
        </>
      )}
    </div>
  );
}
