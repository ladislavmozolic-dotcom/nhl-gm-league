"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";

export type HotColdForm = {
  id: number;
  goalStreak: number;
  pointStreak: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  gp: number;
  playedLast7: boolean;
  gamesLast14: number;
  name: string;
  slug: string;
  position: string;
  photoUrl: string | null;
  teamCode: string | null;
  teamSlug: string | null;
  teamLogoUrl: string | null;
};

const isForward = (pos: string) => ["C", "LW", "RW", "W", "F"].includes(pos.toUpperCase());
const isDefense = (pos: string) => ["D", "LD", "RD"].includes(pos.toUpperCase());

export default function HotColdView({
  hot,
  cold,
  refLabel,
  season,
  lang = "en",
}: {
  hot: HotColdForm[];
  cold: HotColdForm[];
  refLabel: string;
  season: string;
  lang?: string;
}) {
  const isCs = lang === "cs";

  const [activeTab, setActiveTab] = useState<"BOTH" | "HOT" | "COLD">("BOTH");
  const [q, setQ] = useState("");
  const [posFilter, setPosFilter] = useState<"ALL" | "F" | "D">("ALL");

  const filterList = (list: HotColdForm[]) => {
    const query = q.trim().toLowerCase();
    return list.filter((p) => {
      if (query) {
        const matchName = cleanName(p.name).toLowerCase().includes(query);
        const matchTeam = p.teamCode?.toLowerCase().includes(query) ?? false;
        if (!matchName && !matchTeam) return false;
      }
      if (posFilter === "F" && !isForward(p.position)) return false;
      if (posFilter === "D" && !isDefense(p.position)) return false;
      return true;
    });
  };

  const filteredHot = useMemo(() => filterList(hot), [hot, q, posFilter]);
  const filteredCold = useMemo(() => filterList(cold), [cold, q, posFilter]);

  const topHot = hot[0] ?? null;
  const topCold = cold[0] ?? null;

  const renderTable = (rows: HotColdForm[], tone: "hot" | "cold") => {
    const isToneHot = tone === "hot";
    const streakAccent = isToneHot ? "text-amber-400" : "text-sky-400";

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 shadow-md">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/40 border-b border-slate-800">
              <th className="text-center px-3 py-3 w-12">#</th>
              <th className="text-left px-4 py-3">{isCs ? "Hráč" : "Player"}</th>
              <th className="text-left px-3 py-3">{isCs ? "Tím" : "Team"}</th>
              <th className="text-center px-2 py-3">{isCs ? "Poz" : "Pos"}</th>
              <th className="text-right px-3 py-3">{isCs ? "Gólová séria" : "Goal Streak"}</th>
              <th className="text-right px-3 py-3">{isCs ? "Bodová séria" : "Point Streak"}</th>
              <th className="text-right px-3 py-3">{isCs ? "Tento týždeň" : "This Week"}</th>
              <th className="text-right px-3 py-3">{isCs ? "Tento mesiac" : "This Month"}</th>
              <th className="text-right px-4 py-3">{isCs ? "Sezóna celkom" : "Season Pts"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((f, i) => (
              <tr key={f.id} className="hover:bg-slate-800/40 transition-colors">
                {/* Rank Badge */}
                <td className="px-3 py-3 text-center">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-black ${
                      isToneHot
                        ? i === 0
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "text-slate-500"
                        : i === 0
                        ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                        : "text-slate-500"
                    }`}
                  >
                    {i + 1}
                  </span>
                </td>

                {/* Player Name & Avatar */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar src={f.photoUrl} alt={f.name} size={32} />
                    <Link
                      href={`/players/${f.slug}`}
                      className="font-bold text-white hover:text-blue-400 transition-colors"
                    >
                      {cleanName(f.name)}
                    </Link>
                  </div>
                </td>

                {/* Team */}
                <td className="px-3 py-3">
                  {f.teamSlug ? (
                    <Link
                      href={`/teams/${f.teamSlug}`}
                      className="inline-flex items-center gap-1.5 text-slate-300 hover:text-blue-400 transition-colors"
                    >
                      {f.teamLogoUrl && (
                        <img src={f.teamLogoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
                      )}
                      <span className="font-semibold text-xs tracking-wider">{f.teamCode}</span>
                    </Link>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>

                {/* Pos */}
                <td className="px-2 py-3 text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    {f.position}
                  </span>
                </td>

                {/* Goal Streak */}
                <td className="px-3 py-3 text-right tabular-nums">
                  {f.goalStreak > 0 ? (
                    <span className="inline-block px-2 py-0.5 rounded font-black text-amber-400 bg-amber-500/10 border border-amber-500/20">
                      {f.goalStreak}G
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">0</span>
                  )}
                </td>

                {/* Point Streak */}
                <td className="px-3 py-3 text-right tabular-nums">
                  {f.pointStreak > 0 ? (
                    <span className={`inline-block px-2 py-0.5 rounded font-black ${streakAccent} bg-slate-800 border border-slate-700`}>
                      {f.pointStreak} {isCs ? "záp." : "GP"}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">0</span>
                  )}
                </td>

                {/* This Week */}
                <td className="px-3 py-3 text-right tabular-nums font-bold text-white">
                  {f.thisWeek > 0 ? (
                    <span className="text-emerald-400 font-extrabold">{f.thisWeek}</span>
                  ) : (
                    <span className="text-slate-500">0</span>
                  )}
                </td>

                {/* This Month */}
                <td className="px-3 py-3 text-right tabular-nums text-slate-300 font-medium">
                  {f.thisMonth}
                </td>

                {/* Season Total */}
                <td className="px-4 py-3 text-right tabular-nums font-mono font-bold text-slate-200">
                  {f.thisYear}
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  {isCs ? "Žiadni hráči nevyhovujú zvoleným filtrom." : "No players match the selected filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero Spotlight Deck */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hottest Player Card */}
        {topHot && (
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 p-5 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                🔥 {isCs ? "Najhorúcejšia forma ligy" : "Hottest in the League"}
              </span>
              <span className="text-xs text-amber-400/80 font-mono">
                {topHot.pointStreak} {isCs ? "zápasová bodová séria" : "game point streak"}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <PlayerAvatar src={topHot.photoUrl} alt={topHot.name} size={64} className="ring-2 ring-amber-500/50" />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/players/${topHot.slug}`}
                  className="text-lg font-black text-white hover:text-amber-400 transition-colors truncate block"
                >
                  {cleanName(topHot.name)}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  {topHot.teamLogoUrl && (
                    <img src={topHot.teamLogoUrl} alt="" className="w-4 h-4 object-contain" />
                  )}
                  <span className="text-xs font-semibold text-slate-300">{topHot.teamCode}</span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-400">{topHot.position}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-3xl font-black text-amber-400 tabular-nums">
                  {topHot.thisWeek} <span className="text-xs font-medium text-slate-400">{isCs ? "b / týž." : "pts/wk"}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {topHot.thisMonth} {isCs ? "b tento mesiac" : "pts this month"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Coldest Player Card */}
        {topCold && (
          <div className="relative overflow-hidden rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/30 via-slate-900 to-slate-950 p-5 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm">
                🧊 {isCs ? "Najväčší gólový útlm" : "Ice Cold Slump"}
              </span>
              <span className="text-xs text-sky-400/80 font-mono">
                {topCold.gamesLast14} {isCs ? "zápasov bez bodu" : "games scoreless"}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <PlayerAvatar src={topCold.photoUrl} alt={topCold.name} size={64} className="ring-2 ring-sky-500/50" />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/players/${topCold.slug}`}
                  className="text-lg font-black text-white hover:text-sky-400 transition-colors truncate block"
                >
                  {cleanName(topCold.name)}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  {topCold.teamLogoUrl && (
                    <img src={topCold.teamLogoUrl} alt="" className="w-4 h-4 object-contain" />
                  )}
                  <span className="text-xs font-semibold text-slate-300">{topCold.teamCode}</span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-400">{topCold.position}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-3xl font-black text-sky-400 tabular-nums">
                  0 <span className="text-xs font-medium text-slate-400">{isCs ? "bodov" : "pts"}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {topCold.gamesLast14} {isCs ? "posledných záp." : "last 14 days GP"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 backdrop-blur">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isCs ? "Hľadať hráča alebo tím..." : "Search player or team..."}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
            <button
              onClick={() => setActiveTab("BOTH")}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                activeTab === "BOTH" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              {isCs ? "Všetko" : "All"}
            </button>
            <button
              onClick={() => setActiveTab("HOT")}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                activeTab === "HOT" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              🔥 {isCs ? "Horúci" : "Hot"}
            </button>
            <button
              onClick={() => setActiveTab("COLD")}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                activeTab === "COLD" ? "bg-sky-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              🧊 {isCs ? "Studení" : "Cold"}
            </button>
          </div>

          {/* Position Pills */}
          <div className="inline-flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
            {(["ALL", "F", "D"] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  posFilter === pos ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                {pos === "ALL" ? (isCs ? "Všetky" : "All Pos") : pos === "F" ? (isCs ? "Útočníci" : "Forwards") : (isCs ? "Obrancovia" : "Defense")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="space-y-8">
        {(activeTab === "BOTH" || activeTab === "HOT") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-amber-400 flex items-center gap-2">
                <span>🔥</span>
                <span>{isCs ? "Horúci hráči — bodové a gólové série" : "Hot Players — Riding a Scoring Streak"}</span>
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {filteredHot.length} {isCs ? "hráčov" : "players"}
              </span>
            </div>
            {renderTable(filteredHot, "hot")}
          </div>
        )}

        {(activeTab === "BOTH" || activeTab === "COLD") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-sky-400 flex items-center gap-2">
                <span>🧊</span>
                <span>{isCs ? "Studení hráči — bez bodu v poslednom období (3+ zápasy)" : "Cold Players — Pointless of Late (3+ GP in last 14d)"}</span>
              </h2>
              <span className="text-xs text-slate-500 font-mono">
                {filteredCold.length} {isCs ? "hráčov" : "players"}
              </span>
            </div>
            {renderTable(filteredCold, "cold")}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-500 px-1 pt-2 border-t border-slate-800">
        {isCs
          ? `Forma hráčov prepočítaná ku dňu ${refLabel} (posledný odohratý zápas) — NHL ${season} základná časť.`
          : `Scoring form calculated as of ${refLabel} (latest completed game) — NHL ${season} regular season.`}
      </div>
    </div>
  );
}
