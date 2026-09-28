"use client";

import { useMemo, useState } from "react";

export type TrackedProspect = {
  id: number; name: string; position: string | null; epUrl: string | null;
  club: string | null; league: string | null; leagueCode: string | null; country: string | null;
  level: string | null; teamLogoUrl: string | null; season: string | null;
  gamesPlayed: number | null; goals: number | null; assists: number | null; points: number | null;
  isGoalie: boolean; wins: number | null; savePercentage: number | null;
};

export default function YourProspectTracker({ prospects }: { prospects: TrackedProspect[] }) {
  const [filter, setFilter] = useState<"all" | "live" | "waiting">("all");
  const [query, setQuery] = useState("");
  const live = prospects.filter((p) => p.gamesPlayed !== null).length;
  const filtered = useMemo(() => prospects.filter((p) =>
    (filter === "all" || (filter === "live" ? p.gamesPlayed !== null : p.gamesPlayed === null)) &&
    (!query || `${p.name} ${p.club ?? ""} ${p.league ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  ), [prospects, filter, query]);

  return <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-xl shadow-black/20">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-5 py-5 bg-gradient-to-r from-amber-500/10 via-transparent to-sky-500/5">
      <div><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-lg">⭐</span><h2 className="text-lg font-black tracking-tight text-white">Your Prospect Tracker</h2></div><p className="mt-1 pl-12 text-xs text-slate-400">Your full prospect pool, with live real-world stats where available.</p></div>
      <div className="flex gap-2 text-xs font-bold"><span className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-slate-200">{prospects.length} prospects</span><span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-300">{live} live</span></div>
    </div>
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-5 py-3">{([ ["all", `All (${prospects.length})`], ["live", `With stats (${live})`], ["waiting", `Awaiting data (${prospects.length - live})`] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${filter === value ? "bg-amber-400/15 text-amber-300" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>{label}</button>)}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search prospects…" aria-label="Search prospects" className="ml-auto min-w-[190px] rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-amber-400/50" /></div>
    <div className="max-h-[650px] overflow-auto"><table className="w-full min-w-[760px] text-sm"><thead className="sticky top-0 z-10 bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 text-left">Prospect</th><th className="px-4 py-3 text-left">Real-world team</th><th className="px-4 py-3 text-left">Competition</th><th className="px-4 py-3 text-right">Season stats</th><th className="px-5 py-3 text-right">Profile</th></tr></thead><tbody>{filtered.map((p) => <tr key={p.id} className="border-t border-slate-800/70 odd:bg-slate-900/20 hover:bg-sky-500/5"><td className="px-5 py-3"><div className="font-bold text-slate-100">{p.name}</div><div className="mt-0.5 text-[11px] text-slate-500">{p.position || "—"}</div></td><td className="px-4 py-3"><div className="flex items-center gap-2">{p.teamLogoUrl && <img src={p.teamLogoUrl} alt="" className="h-6 w-6 object-contain" />}<span className={p.club ? "font-medium text-slate-200" : "text-slate-500"}>{p.club || "Not linked yet"}</span></div></td><td className="px-4 py-3">{p.league ? <><span className="text-slate-200">{p.league}</span><div className="mt-0.5 text-[11px] text-slate-500">{p.country}{p.level && ` · ${p.level}`}</div></> : <span className="text-slate-600">Awaiting real-world match</span>}</td><td className="px-4 py-3 text-right whitespace-nowrap">{p.gamesPlayed !== null ? <><span className="font-bold tabular-nums text-sky-300">{p.isGoalie ? `${p.gamesPlayed} GP · ${p.wins ?? 0} W` : `${p.gamesPlayed} GP · ${p.goals ?? 0} G · ${p.assists ?? 0} A · ${p.points ?? 0} P`}</span><div className="mt-0.5 text-[11px] text-slate-500">{p.season}{p.isGoalie && p.savePercentage != null && ` · ${(p.savePercentage <= 1 ? p.savePercentage * 100 : p.savePercentage).toFixed(1)} SV%`}</div></> : <span className="rounded-full border border-slate-700 bg-slate-800/70 px-2 py-1 text-[11px] text-slate-400">Awaiting stats</span>}</td><td className="px-5 py-3 text-right">{p.epUrl ? <a href={p.epUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-400 hover:text-blue-300">{p.epUrl.includes("/search/player?") ? "Search EP ↗" : "EliteProspects ↗"}</a> : <span className="text-slate-600">—</span>}</td></tr>)}</tbody></table>{!filtered.length && <div className="p-10 text-center text-sm text-slate-500">No prospects match this filter.</div>}</div>
  </div>;
}
