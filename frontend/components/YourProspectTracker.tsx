"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { epProfileUrl } from "@/lib/playerName";
import type { ProspectProjection } from "@/lib/prospect-projection";

export type TrackedProspect = {
  id: number;
  name: string;
  position: string | null;
  epUrl: string | null;
  club: string | null;
  league: string | null;
  leagueCode: string | null;
  country: string | null;
  level: string | null;
  teamLogoUrl: string | null;
  season: string | null;
  gamesPlayed: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  isGoalie: boolean;
  wins: number | null;
  savePercentage: number | null;
  developmentLevel: string | null;
  developmentRole: string;
  developmentTrend: string;
  developmentAlert: string;
  projection: ProspectProjection;
};

export type TeamOption = {
  id: number;
  name: string;
  code: string | null;
  logoUrl: string | null;
};

interface Props {
  prospects: TrackedProspect[];
  teams?: TeamOption[];
  currentTeamId?: number;
  currentTeamName?: string;
}

// Position badge color
function posBadge(pos: string | null) {
  const p = pos?.toUpperCase() ?? "";
  if (p === "C")   return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (p === "LW")  return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (p === "RW")  return "bg-teal-500/20 text-teal-300 border-teal-500/30";
  if (p === "D")   return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  if (p === "G")   return "bg-violet-500/20 text-violet-300 border-violet-500/30";
  return "bg-slate-700/50 text-slate-400 border-slate-600/30";
}

// League pill color
function leaguePill(code: string | null) {
  const c = code?.toUpperCase() ?? "";
  if (["WHL", "OHL", "QMJHL"].includes(c)) return "bg-orange-500/15 text-orange-300 border-orange-500/25";
  if (c === "AHL")   return "bg-red-500/15 text-red-300 border-red-500/25";
  if (c === "NCAA")  return "bg-blue-500/15 text-blue-300 border-blue-500/25";
  if (c === "KHL")   return "bg-red-600/15 text-red-400 border-red-500/25";
  if (c === "MHL")   return "bg-red-400/15 text-red-300 border-red-400/25";
  if (c === "VHL")   return "bg-rose-500/15 text-rose-300 border-rose-500/25";
  if (c === "LIIGA") return "bg-cyan-500/15 text-cyan-300 border-cyan-500/25";
  if (c === "SHL")   return "bg-yellow-500/15 text-yellow-300 border-yellow-500/25";
  if (["CZE", "SVK"].includes(c)) return "bg-indigo-500/15 text-indigo-300 border-indigo-500/25";
  if (c === "FIN-U20") return "bg-cyan-400/15 text-cyan-200 border-cyan-400/25";
  return "bg-slate-700/40 text-slate-300 border-slate-600/30";
}

export default function YourProspectTracker({
  prospects,
  teams = [],
  currentTeamId,
  currentTeamName,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "live" | "pending" | "waiting">("all");
  const [query, setQuery] = useState("");

  const withStats = prospects.filter((p) => p.gamesPlayed !== null).length;
  const assigned = prospects.filter((p) => p.club !== null).length;
  const pendingSeason = assigned - withStats;
  const unassigned = prospects.length - assigned;

  const filtered = useMemo(() => {
    return prospects.filter((p) => {
      if (filter === "live" && p.gamesPlayed === null) return false;
      if (filter === "pending" && (p.gamesPlayed !== null || !p.club)) return false;
      if (filter === "waiting" && p.club !== null) return false;
      if (!query) return true;
      const haystack = `${p.name} ${p.club ?? ""} ${p.league ?? ""} ${p.position ?? ""}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [prospects, filter, query]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-black/30">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-r from-amber-500/10 via-slate-900/50 to-sky-500/5 px-5 py-5">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-400/5 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 text-xl shadow-inner shadow-amber-400/10">⭐</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">Prospect Tracker</h2>
                {currentTeamName && (
                  <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-bold text-amber-300">
                    {currentTeamName}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Live tracking · junior, collegiate, AHL &amp; European leagues
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {teams.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="team-select" className="text-xs font-medium text-slate-500">Team:</label>
                <select
                  id="team-select"
                  value={currentTeamId ?? ""}
                  onChange={(e) => router.push(`/around-the-world?team=${e.target.value}`)}
                  className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-bold text-slate-200 outline-none focus:border-amber-400/60"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Summary badges */}
            <span className="rounded-lg border border-slate-700/80 bg-slate-800/60 px-2.5 py-1 text-xs font-bold text-slate-300">
              {prospects.length} prospects
            </span>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
              ● {withStats} live
            </span>
            {pendingSeason > 0 && (
              <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-300">
                {pendingSeason} pending
              </span>
            )}

            <Link
              href="/draft/rankings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 transition-all shadow-sm"
              title="Go to private GM draft board"
            >
              <span>📋</span>
              <span>Draft Board →</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Filter + Search bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 bg-slate-950/50 px-5 py-3">
        {([
          ["all", `All (${prospects.length})`],
          ["live", `● Live (${withStats})`],
          ["pending", `Season pending (${pendingSeason})`],
          ...(unassigned > 0 ? [["waiting", `Unassigned (${unassigned})`]] : []),
        ] as [string, string][]).map(([val, lbl]) => (
          <button
            key={val}
            type="button"
            onClick={() => setFilter(val as typeof filter)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              filter === val
                ? "bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-sm"
                : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            {lbl}
          </button>
        ))}

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player, club, league…"
          aria-label="Search prospects"
          className="ml-auto min-w-[180px] rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-amber-400/50 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="max-h-[720px] overflow-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 backdrop-blur text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-5 py-3 text-left">Prospect</th>
              <th className="px-4 py-3 text-left">Projection</th>
              <th className="px-4 py-3 text-left">Club</th>
              <th className="px-4 py-3 text-left">League</th>
              <th className="px-5 py-3 text-right">2026-27 Stats</th>
              <th className="px-5 py-3 text-right">EP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {filtered.map((p) => (
              <tr key={p.id} className="group hover:bg-sky-500/[0.04] transition-colors">
                {/* Prospect name + position */}
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`shrink-0 inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-black tracking-wide ${posBadge(p.position)}`}>
                      {p.position || "?"}
                    </span>
                    <a
                      href={p.epUrl || epProfileUrl(p.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-slate-100 hover:text-sky-300 hover:underline transition-colors inline-flex items-center gap-1 group/pname"
                      title="Open EliteProspects profile"
                    >
                      <span>{p.name}</span>
                      <span className="text-[10px] text-sky-400/60 group-hover/pname:text-sky-300">↗</span>
                    </a>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <div className="min-w-[210px] rounded-lg border border-slate-700/70 bg-slate-950/40 px-2.5 py-2 shadow-inner">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-black ${p.projection.grade === "A" ? "bg-emerald-400/20 text-emerald-300" : p.projection.grade === "B" ? "bg-sky-400/20 text-sky-300" : p.projection.grade === "C" ? "bg-violet-400/20 text-violet-300" : p.projection.grade === "D" ? "bg-amber-400/20 text-amber-300" : "bg-slate-700 text-slate-400"}`}>{p.projection.grade}</span>
                      <span className="text-[11px] font-bold text-slate-200">{p.projection.role}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
                      <span className="text-slate-500">ETA {p.projection.eta}</span>
                      <span className="font-bold text-sky-300">{p.projection.confidence}% · {p.projection.risk} risk</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-400" style={{ width: `${p.projection.score}%` }} /></div>
                    <p className="mt-1.5 text-[10px] text-slate-500">{p.projection.summary} · UNHL value {p.projection.futureValue}</p>
                  </div>
                </td>

                {/* Club */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.teamLogoUrl && (
                      <img src={p.teamLogoUrl} alt="" className="h-5 w-5 object-contain opacity-90" />
                    )}
                    <span className={p.club ? "font-semibold text-slate-200" : "text-slate-600 italic text-xs"}>
                      {p.club || "Not assigned"}
                    </span>
                  </div>
                </td>

                {/* League */}
                <td className="px-4 py-3">
                  {p.league ? (
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${leaguePill(p.leagueCode)}`}>
                        {p.leagueCode || p.league}
                      </span>
                      {p.country && (
                        <span className="text-[10px] text-slate-500 font-medium">{p.country}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-600">—</span>
                  )}
                </td>

                {/* Stats */}
                <td className="px-5 py-3 text-right">
                  {p.gamesPlayed !== null ? (
                    <div className="inline-flex flex-col items-end gap-0.5">
                      {p.isGoalie ? (
                        <>
                          <div className="flex items-center gap-2 tabular-nums">
                            <span className="text-[11px] text-slate-500">GP</span>
                            <span className="font-black text-slate-200">{p.gamesPlayed}</span>
                            <span className="text-[11px] text-slate-500">W</span>
                            <span className="font-black text-violet-300">{p.wins ?? 0}</span>
                          </div>
                          {p.savePercentage != null && (
                            <span className="text-[10px] text-slate-500 tabular-nums">
                              {(p.savePercentage <= 1 ? p.savePercentage * 100 : p.savePercentage).toFixed(1)}% SV
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5 tabular-nums">
                            <span className="text-[10px] text-slate-500 font-medium">GP</span>
                            <span className="font-bold text-slate-300">{p.gamesPlayed}</span>
                            <span className="mx-0.5 text-slate-700">·</span>
                            <span className="text-[10px] text-slate-500">G</span>
                            <span className="font-bold text-emerald-400">{p.goals ?? 0}</span>
                            <span className="text-[10px] text-slate-500">A</span>
                            <span className="font-bold text-sky-400">{p.assists ?? 0}</span>
                            <span className="text-[10px] text-slate-500">P</span>
                            <span className="font-black text-white text-base leading-none">{p.points ?? 0}</span>
                          </div>
                          <span className="text-[10px] text-slate-600">{p.season || "2026-27"}</span>
                        </>
                      )}
                    </div>
                  ) : p.club ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/8 px-2.5 py-0.5 text-[11px] font-semibold text-sky-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                      Season pending
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-600">—</span>
                  )}
                </td>

                {/* EP link */}
                <td className="px-5 py-3 text-right">
                  <a
                    href={p.epUrl || epProfileUrl(p.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 transition-all"
                    title="Open EliteProspects profile"
                  >
                    EP ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!filtered.length && (
          <div className="flex flex-col items-center gap-2 p-14 text-center">
            <span className="text-2xl">🔍</span>
            <p className="text-sm font-semibold text-slate-400">No prospects match this filter.</p>
            <p className="text-xs text-slate-600">Try changing the filter or search query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
