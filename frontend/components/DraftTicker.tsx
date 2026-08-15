"use client";

import { useEffect, useMemo, useState } from "react";

type Pick = { pick: number; name: string; position: string; code: string | null; logo: string | null };
const posColor: Record<string, string> = { C: "text-sky-400", LW: "text-emerald-400", RW: "text-emerald-400", D: "text-amber-400", G: "text-rose-400" };
const ROUNDS = [1, 2, 3, 4, 5, 6, 7];

/** Sticky "LIVE TRACKER" ribbon under the menu: a blinking red light, round filters
 *  (Full / R1… so GMs can watch just the current round), and a looping marquee of
 *  selections (pick #, team logo, player). Polls live and auto-fills. */
export default function DraftTicker({ year }: { year: number }) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [filter, setFilter] = useState<"full" | number>("full");

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`/api/draft/picks?year=${year}`, { cache: "no-store" });
        const j: { picks: Pick[] } = await r.json();
        if (alive && j.picks) setPicks((prev) => (prev.length === j.picks.length ? prev : j.picks));
      } catch { /* transient */ }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [year]);

  const shown = useMemo(
    () => (filter === "full" ? picks : picks.filter((p) => Math.ceil(p.pick / 32) === filter)),
    [picks, filter],
  );
  const dur = Math.max(18, shown.length * 3);

  const Item = ({ p }: { p: Pick }) => (
    <span className="inline-flex items-center gap-2 px-5 border-r border-slate-800/70">
      <span className="text-xs font-bold text-slate-500 tabular-nums">#{p.pick}</span>
      {p.logo && <img src={p.logo} alt="" className="w-6 h-6 object-contain" />}
      <span className="text-[15px] text-slate-100">{p.name}</span>
      <span className={`text-[10px] font-semibold ${posColor[p.position] ?? "text-slate-500"}`}>{p.position}</span>
    </span>
  );

  return (
    <div className="sticky top-14 z-40 -mx-4 px-4 bg-slate-950/95 backdrop-blur border-b border-slate-800">
      <style>{`@keyframes dtMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}@keyframes dtBlink{0%,60%{opacity:1}80%,100%{opacity:.25}}`}</style>
      <div className="max-w-[1400px] mx-auto">
        {/* controls row */}
        <div className="flex items-center gap-3 pt-1.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" style={{ animation: "dtBlink 1.1s infinite" }} />
            <span className="text-[11px] font-black uppercase tracking-widest text-red-400">Live Tracker</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            <button onClick={() => setFilter("full")} className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${filter === "full" ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 text-slate-400 hover:text-slate-200"}`}>Full Draft</button>
            {ROUNDS.map((r) => (
              <button key={r} onClick={() => setFilter(r)} className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${filter === r ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 text-slate-400 hover:text-slate-200"}`}>R{r}</button>
            ))}
          </div>
        </div>
        {/* marquee row */}
        <div className="overflow-hidden relative h-11 flex items-center">
          {shown.length === 0 ? (
            <span className="text-xs text-slate-600">{filter === "full" ? "No selections yet — the board updates live." : `No picks in round ${filter} yet.`}</span>
          ) : (
            <div key={`${filter}-${shown.length}`} className="flex w-max whitespace-nowrap" style={{ animation: `dtMarquee ${dur}s linear infinite` }}>
              {[0, 1].map((seg) => (
                <div key={seg} className="flex">
                  {shown.map((p, i) => <Item key={`${seg}-${p.pick}-${i}`} p={p} />)}
                  {/* loop separator so the restart doesn't blend into the last pick */}
                  <span className="inline-flex items-center px-6 text-emerald-400 font-black text-lg tracking-[0.35em] select-none">////</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
