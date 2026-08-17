"use client";

import { useState, useTransition } from "react";
import { saveHomeBlocks, type HomeBlock } from "@/app/admin/site-editor/actions";

/** Homepage custom blocks — admin-authored content (title + markdown) shown ABOVE the
 *  dashboard. Reorder (▲▼), show/hide, add/remove. The live dashboard is untouched. */
export default function SiteHomeForm({ initial }: { initial: HomeBlock[] }) {
  const [blocks, setBlocks] = useState<HomeBlock[]>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const dirty = () => setSaved(false);

  const add = () => { setBlocks((p) => [...p, { id: crypto.randomUUID(), title: "", body: "", visible: true }]); dirty(); };
  const upd = (i: number, patch: Partial<HomeBlock>) => { setBlocks((p) => p.map((b, idx) => idx === i ? { ...b, ...patch } : b)); dirty(); };
  const del = (i: number) => { setBlocks((p) => p.filter((_, idx) => idx !== i)); dirty(); };
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= blocks.length) return; const n = [...blocks]; [n[i], n[j]] = [n[j], n[i]]; setBlocks(n); dirty(); };
  const save = () => start(async () => { await saveHomeBlocks(blocks); setSaved(true); });

  const field = "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm";
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Vlastné bloky (nadpis + text v Markdowne) sa zobrazia <b>nad</b> dashboardom na domovskej stránke. Dashboard (skóre, tabuľka, leaders) zostáva.</p>
      {blocks.map((b, i) => (
        <div key={b.id} className={`rounded-lg border border-slate-800 p-3 space-y-2 ${!b.visible ? "opacity-50" : ""}`}>
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-500 hover:text-white disabled:opacity-20 text-xs leading-none">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="text-slate-500 hover:text-white disabled:opacity-20 text-xs leading-none">▼</button>
            </div>
            <input value={b.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Nadpis bloku (voliteľné)" className={`${field} flex-1`} />
            <label className="flex items-center gap-1.5 text-xs text-slate-400"><input type="checkbox" checked={b.visible} onChange={(e) => upd(i, { visible: e.target.checked })} className="accent-blue-500" />viditeľné</label>
            <button onClick={() => del(i)} className="text-red-400 hover:text-red-300 text-sm px-1">✕</button>
          </div>
          <textarea value={b.body} onChange={(e) => upd(i, { body: e.target.value })} rows={4} placeholder="Text (Markdown — # nadpis, **tučné**, - zoznam, [text](url))" className={`${field} font-mono text-[13px]`} />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button onClick={add} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">+ Pridať blok</button>
        <button onClick={save} disabled={pending} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold">{pending ? "Ukladám…" : "Uložiť bloky"}</button>
        {saved && <span className="text-emerald-400 text-sm">✓ Uložené — obnov domovskú stránku</span>}
      </div>
    </div>
  );
}
