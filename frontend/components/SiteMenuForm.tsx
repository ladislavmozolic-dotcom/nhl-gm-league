"use client";

import { useState, useTransition } from "react";
import { saveMenu } from "@/app/admin/site-editor/actions";

type Row = { key: string; label: string; hidden: boolean; custom: boolean };

/** Menu editor — reorder (▲▼) + show/hide each top-nav item. Saves { order, hidden }. */
export default function SiteMenuForm({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const dirty = () => setSaved(false);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next); dirty();
  };
  const toggle = (i: number) => { setRows((p) => p.map((r, idx) => idx === i ? { ...r, hidden: !r.hidden } : r)); dirty(); };

  const onSave = () => {
    const order = rows.map((r) => r.key);
    const hidden = rows.filter((r) => r.hidden).map((r) => r.key);
    start(async () => { await saveMenu(order, hidden); setSaved(true); });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Presúvaj položky (▲▼) a zapni/vypni ich viditeľnosť v hornom menu. „Teams" je špeciálny rozbaľovač tímov.</p>
      <div className="rounded-lg border border-slate-800 divide-y divide-slate-800/70">
        {rows.map((r, i) => (
          <div key={r.key} className={`flex items-center gap-3 px-3 py-2 ${r.hidden ? "opacity-45" : ""}`}>
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-500 hover:text-white disabled:opacity-20 leading-none text-xs">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="text-slate-500 hover:text-white disabled:opacity-20 leading-none text-xs">▼</button>
            </div>
            <span className="flex-1 text-sm font-medium text-slate-200">{r.label}{r.custom && <span className="ml-2 text-[10px] text-blue-400 uppercase">page</span>}</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={!r.hidden} onChange={() => toggle(i)} className="accent-blue-500" />
              {r.hidden ? "skryté" : "viditeľné"}
            </label>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onSave} disabled={pending} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold">
          {pending ? "Ukladám…" : "Uložiť menu"}</button>
        {saved && <span className="text-emerald-400 text-sm">✓ Uložené — obnov stránku</span>}
      </div>
    </div>
  );
}
