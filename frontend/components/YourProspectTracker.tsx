"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-xl shadow-black/20">
      {/* Header with Organization Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-5 py-5 bg-gradient-to-r from-amber-500/10 via-transparent to-sky-500/5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 text-xl">⭐</span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">Prospect Tracker</h2>
              {currentTeamName && (
                <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-bold text-amber-300">
                  {currentTeamName}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Live prospect pool tracking across junior, collegiate, AHL and European leagues.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {teams.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="team-select" className="text-xs font-medium text-slate-400">
                Team:
              </label>
              <select
                id="team-select"
                value={currentTeamId ?? ""}
                onChange={(e) => {
                  router.push(`/around-the-world?team=${e.target.value}`);
                }}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-slate-200 outline-none focus:border-amber-400/60"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 text-xs font-bold">
            <span className="rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 text-slate-200">
              {prospects.length} prospects
            </span>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-300">
              {withStats} with stats
            </span>
            {pendingSeason > 0 && (
              <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-sky-300">
                {pendingSeason} pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-5 py-3 bg-slate-950/40">
        {[
          ["all", `All (${prospects.length})`],
          ["live", `Live stats (${withStats})`],
          ["pending", `Season pending (${pendingSeason})`],
          ...(unassigned > 0 ? [["waiting", `Unassigned (${unassigned})`]] : []),
        ].map(([val, lbl]) => (
          <button
            key={val}
            type="button"
            onClick={() => setFilter(val as typeof filter)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              filter === val
                ? "bg-amber-400/15 text-amber-300 border border-amber-400/30"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {lbl}
          </button>
        ))}

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by player or club…"
          aria-label="Search prospects"
          className="ml-auto min-w-[200px] rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400/50"
        />
      </div>

      {/* Prospects Table */}
      <div className="max-h-[680px] overflow-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-5 py-3 text-left">Prospect</th>
              <th className="px-4 py-3 text-left">Current Club</th>
              <th className="px-4 py-3 text-left">League / Competition</th>
              <th className="px-4 py-3 text-right">Season Stats</th>
              <th className="px-5 py-3 text-right">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-sky-500/5 transition-colors">
                {/* Player info */}
                <td className="px-5 py-3.5">
                  <div className="font-bold text-slate-100">{p.name}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400 font-medium">
                    {p.position || "—"}
                  </div>
                </td>

                {/* Real-world team */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    {p.teamLogoUrl && (
                      <img src={p.teamLogoUrl} alt="" className="h-6 w-6 object-contain" />
                    )}
                    <span className={p.club ? "font-semibold text-slate-200" : "text-slate-500 italic"}>
                      {p.club || "Not assigned yet"}
                    </span>
                  </div>
                </td>

                {/* Competition */}
                <td className="px-4 py-3.5">
                  {p.league ? (
                    <div>
                      <span className="font-semibold text-sky-300">{p.league}</span>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {p.country || "North America"}
                        {p.level && ` · ${p.level}`}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-600 text-xs">Awaiting league match</span>
                  )}
                </td>

                {/* Season Stats */}
                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  {p.gamesPlayed !== null ? (
                    <div>
                      <div className="font-bold tabular-nums text-emerald-300">
                        {p.isGoalie
                          ? `${p.gamesPlayed} GP · ${p.wins ?? 0} W`
                          : `${p.gamesPlayed} GP · ${p.goals ?? 0} G · ${p.assists ?? 0} A · ${p.points ?? 0} P`}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                        {p.season || "2026-27"}
                        {p.isGoalie && p.savePercentage != null && (
                          ` · ${(p.savePercentage <= 1 ? p.savePercentage * 100 : p.savePercentage).toFixed(1)} SV%`
                        )}
                      </div>
                    </div>
                  ) : p.club ? (
                    <div>
                      <span className="inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                        Season pending
                      </span>
                      <div className="mt-0.5 text-[11px] text-slate-500 font-medium">
                        2026-27 roster
                      </div>
                    </div>
                  ) : (
                    <span className="inline-flex rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[11px] text-slate-500">
                      Unassigned
                    </span>
                  )}
                </td>

                {/* External links */}
                <td className="px-5 py-3.5 text-right">
                  {p.epUrl ? (
                    <a
                      href={p.epUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      EP ↗
                    </a>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!filtered.length && (
          <div className="p-12 text-center text-sm text-slate-400">
            No prospects match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

