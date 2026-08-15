"use client";

import { useState, useTransition } from "react";

type Team = { id: number; name: string; logoUrl: string | null; popularity: number };

export default function PopularityEditor({ teams, onSave }: {
  teams: Team[]; onSave: (rows: Array<{ id: number; popularity: number }>) => Promise<void>;
}) {
  const [rows, setRows] = useState<Team[]>(teams);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const set = (id: number, v: number) => { setRows((p) => p.map((t) => (t.id === id ? { ...t, popularity: v } : t))); setSaved(false); };
  const save = () => start(async () => { await onSave(rows.map((r) => ({ id: r.id, popularity: r.popularity }))); setSaved(true); });

  return (
    <div className="pb-24">
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl divide-y divide-slate-800/60">
        {rows.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-2">
            {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain" />}
            <span className="flex-1 text-sm">{t.name}</span>
            <input type="range" min={0} max={200} step={5} value={t.popularity}
              onChange={(e) => set(t.id, Number(e.target.value))} className="w-40 accent-blue-500" />
            <input type="number" min={0} max={200} value={t.popularity}
              onChange={(e) => set(t.id, Number(e.target.value))}
              className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right tabular-nums text-sm" />
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800 backdrop-blur px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={save} disabled={pending} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-50">
            {pending ? "Saving…" : "Save & recompute"}
          </button>
          {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}
