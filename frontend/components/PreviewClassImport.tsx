"use client";

import { useState, useTransition } from "react";
import { importPreviewClassAction, importTankathonAction } from "@/app/admin/real-drafts/actions";

/** Admin: paste an early ranking (e.g. from EliteProspects) as a preview draft class. */
export default function PreviewClassImport({ year }: { year: number }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    const r = await importPreviewClassAction(year, text);
    setMsg(r.ok ? `Imported ${r.imported} prospects${r.skipped ? ` (${r.skipped} lines skipped)` : ""}.` : r.error);
  });
  const tank = () => start(async () => {
    const r = await importTankathonAction();
    setMsg(r.ok ? `Imported ${r.imported} prospects from Tankathon.` : r.error);
  });
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
      <h3 className="font-semibold text-slate-100">{year} preview class (before Central Scouting)</h3>
      <p className="text-xs text-slate-400">
        One prospect per line, best first: <code>Name ; Pos ; Birth YYYY-MM-DD ; Country ; Club ; League</code> (tab, ; or | separated — only the name is required).
        Replaces the undrafted pool. Once NHL Central Scouting publishes, the automatic import overwrites this list.
      </p>
      <button onClick={tank} disabled={pending} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">
        {pending ? "Importing…" : "Import Tankathon big board"}
      </button>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10}
        className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm font-mono text-slate-200" placeholder="Gavin McKenna ; LW ; 2006-12-20 ; CAN ; Penn State ; NCAA" />
      <button onClick={go} disabled={pending || !text.trim()} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50">
        {pending ? "Importing…" : "Import preview class"}
      </button>
      {msg && <p className="text-sm text-amber-300">{msg}</p>}
    </div>
  );
}
