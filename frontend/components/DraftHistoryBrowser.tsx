"use client";

import { useState, useMemo, useEffect, useRef } from "react";

export type HistPick = { id: number; pick: number; name: string; position: string; flag: string; teamCode: string; teamLogo: string | null; league: string };
export type HistDraft = { year: number; season: string; complete: boolean; picks: HistPick[] };

const posColor: Record<string, string> = { C: "text-sky-400", LW: "text-emerald-400", RW: "text-emerald-400", D: "text-amber-400", G: "text-rose-400" };
const PPR = 32;

export default function DraftHistoryBrowser({ drafts }: { drafts: HistDraft[] }) {
  const defaultYear = (drafts.find((d) => d.complete) ?? drafts[0])?.year;
  const [year, setYear] = useState<number | undefined>(defaultYear);
  const [q, setQ] = useState("");
  const [highlight, setHighlight] = useState<number | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const selected = drafts.find((d) => d.year === year);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const out: (HistPick & { year: number })[] = [];
    for (const d of drafts) for (const p of d.picks) if (p.name.toLowerCase().includes(s)) out.push({ ...p, year: d.year });
    return out.slice(0, 8);
  }, [q, drafts]);

  const jumpTo = (m: HistPick & { year: number }) => { setYear(m.year); setHighlight(m.id); setQ(""); };

  useEffect(() => {
    if (highlight == null) return;
    const el = rowRefs.current.get(highlight);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setHighlight(null), 2600);
    return () => clearTimeout(t);
  }, [highlight, year]);

  if (drafts.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* search */}
      <div className="relative max-w-md">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="🔎 Search a player — jump to his draft & pick"
          className="w-full rounded-xl bg-slate-900 border border-slate-700 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        />
        {matches.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-xl shadow-black/40 overflow-hidden">
            {matches.map((m) => (
              <button key={`${m.year}-${m.id}`} onClick={() => jumpTo(m)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-800/70">
                {m.teamLogo && <img src={m.teamLogo} alt="" className="w-5 h-5 object-contain" />}
                <span className="font-medium text-slate-100">{m.name}</span>
                <span className={`text-xs ${posColor[m.position] ?? "text-slate-400"}`}>{m.position}</span>
                <span className="ml-auto text-xs text-slate-500 tabular-nums">{m.year} · #{m.pick} · {m.teamCode}</span>
              </button>
            ))}
          </div>
        )}
        {q.trim().length >= 2 && matches.length === 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-500">No player found.</div>
        )}
      </div>

      {/* year tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {drafts.map((d) => (
          <button key={d.year} onClick={() => setYear(d.year)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${d.year === year ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-600"}`}>
            {d.year} Entry Draft{!d.complete && <span className="ml-1.5 text-[10px] text-amber-400">● live</span>}
          </button>
        ))}
      </div>

      {/* selected draft board */}
      {selected && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-bold text-slate-100">{selected.year} Entry Draft</h2>
            <span className="text-sm text-slate-500">{selected.season} season · {selected.complete ? `${selected.picks.length} selections` : "in progress"}</span>
          </div>

          {!selected.complete && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
              📋 The {selected.year} draft is still underway. The full board fills in here automatically once it completes in the Draft Room{selected.picks.length > 0 ? ` — ${selected.picks.length} pick${selected.picks.length === 1 ? "" : "s"} made so far.` : "."}
            </div>
          )}

          <div className="space-y-1">
            {selected.picks.map((p) => {
              const newRound = (p.pick - 1) % PPR === 0;
              const hot = highlight === p.id;
              return (
                <div key={p.id}>
                  {newRound && <div className="text-[10px] uppercase tracking-wider text-slate-600 pt-2 pb-1 px-1">Round {Math.ceil(p.pick / PPR)}</div>}
                  <div ref={(el) => { if (el) rowRefs.current.set(p.id, el); }}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-1.5 transition-colors ${hot ? "border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/60" : "border-slate-800/70 bg-slate-900/40"}`}>
                    <span className="w-8 text-center text-sm font-bold text-slate-500 tabular-nums">{p.pick}</span>
                    {p.teamLogo && <img src={p.teamLogo} alt="" className="w-6 h-6 object-contain" />}
                    <span className="mr-0.5">{p.flag}</span>
                    <span className="font-medium text-slate-100">{p.name}</span>
                    <span className={`text-xs ${posColor[p.position] ?? "text-slate-400"}`}>{p.position}</span>
                    <span className="ml-auto text-xs text-slate-500 truncate">{p.teamCode}{p.league ? ` · ${p.league}` : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
