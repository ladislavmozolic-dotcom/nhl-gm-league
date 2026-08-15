"use client";

import { useState, useTransition } from "react";
import { searchRatings, savePlayerRatings, SKATER_FIELDS, type FoundRating } from "@/app/admin/ratings/actions";

const LABEL: Record<string, string> = { overall: "OV", sc: "SC", pa: "PA", sk: "SK", df: "DF", ck: "CK", st: "ST", fo: "FO", ex: "EX", ld: "LD" };

function Row({ p }: { p: FoundRating }) {
  const [v, setV] = useState<Record<string, number>>(() => {
    const o: Record<string, number> = {}; for (const f of SKATER_FIELDS) o[f] = p.values[f] ?? 50; return o;
  });
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const set = (f: string, n: number) => { setV((c) => ({ ...c, [f]: n })); setSaved(false); };
  const save = () => start(async () => { await savePlayerRatings(p.id, v); setSaved(true); });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 border-b border-slate-800/60">
      <div className="w-44 min-w-44">
        <div className="text-sm font-semibold text-slate-100 truncate">{p.name}</div>
        <div className="text-[11px] text-slate-500 truncate">{p.teamName ?? "—"}</div>
      </div>
      {SKATER_FIELDS.map((f) => (
        <label key={f} className="flex flex-col items-center">
          <span className={`text-[10px] font-bold uppercase ${f === "overall" ? "text-blue-400" : "text-slate-500"}`}>{LABEL[f]}</span>
          <input type="number" min={20} max={99} value={v[f]} onChange={(e) => set(f, Number(e.target.value))}
            className={`w-12 text-center tabular-nums bg-slate-900 border rounded px-1 py-1 text-sm ${f === "overall" ? "border-blue-700 font-bold" : "border-slate-700"}`} />
        </label>
      ))}
      <button onClick={save} disabled={pending}
        className="ml-auto px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-semibold disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
      {saved && <span className="text-green-400 text-xs">✓</span>}
    </div>
  );
}

export default function RatingsEditor() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FoundRating[]>([]);
  const [pending, start] = useTransition();
  const run = (query: string) => {
    setQ(query);
    if (query.trim().length < 2) { setRows([]); return; }
    start(async () => setRows(await searchRatings(query)));
  };
  return (
    <div className="space-y-4">
      <input value={q} onChange={(e) => run(e.target.value)} placeholder="Search a player by name…"
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 overflow-x-auto">
        {pending && <p className="py-4 text-sm text-slate-500">Searching…</p>}
        {!pending && q.trim().length >= 2 && rows.length === 0 && <p className="py-4 text-sm text-slate-500">No players found.</p>}
        {rows.map((p) => <Row key={p.id} p={p} />)}
      </div>
      <p className="text-[11px] text-slate-500">
        SC scoring · PA passing · SK skating · DF defense · CK checking · ST strength · FO faceoffs · EX experience · LD leadership.
        These drive the sim directly — raise an elite&apos;s SC/PA/OV to make him lead the scoring, or a team&apos;s OVs to climb the standings.
      </p>
    </div>
  );
}
