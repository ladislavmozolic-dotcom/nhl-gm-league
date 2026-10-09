"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import PlayerLink from "@/components/PlayerLink";
import { useLang } from "@/components/LangProvider";
import type { PlayerProgressData, PlayerProgressItem } from "@/lib/player-progress-server";

type ActiveParam = "ov" | "ck" | "pa" | "sc" | "df" | "sk" | "st" | "di" | "ph" | "fo" | "ex";
type SortMode = "risers" | "fallers" | "all";
type PosFilter = "ALL" | "F" | "D" | "G";
type LeagueFilter = "ALL" | "NHL" | "AHL";

const PARAM_OPTIONS: Array<{ key: ActiveParam; label: string; nameSk: string; nameEn: string; icon: string }> = [
  { key: "ov", label: "OVR", nameSk: "Celkovo (Overall)", nameEn: "Overall Rating", icon: "⭐" },
  { key: "ck", label: "CK", nameSk: "Fyzická hra (Checking / Hity)", nameEn: "Checking (Hits)", icon: "💥" },
  { key: "pa", label: "PA", nameSk: "Nahrávky (Passing / Asistencie)", nameEn: "Passing (Assists)", icon: "🎯" },
  { key: "sc", label: "SC", nameSk: "Streľba (Scoring / Góly)", nameEn: "Scoring (Goals)", icon: "🏒" },
  { key: "df", label: "DF", nameSk: "Obrana (Defense / Oslabenia & Bloky)", nameEn: "Defense (PK & Blocks)", icon: "🛡️" },
  { key: "sk", label: "SK", nameSk: "Korčuľovanie (Skating / Speed bursts)", nameEn: "Skating (Speed Bursts)", icon: "⚡" },
  { key: "st", label: "ST", nameSk: "Sila (Strength / Hmotnosť)", nameEn: "Strength (Weight)", icon: "💪" },
  { key: "di", label: "DI", nameSk: "Disciplína (Discipline / Tresty)", nameEn: "Discipline (PIM)", icon: "🚨" },
  { key: "ph", label: "PH", nameSk: "Práca s pukom (Puck Handling)", nameEn: "Puck Handling", icon: "🪄" },
  { key: "fo", label: "FO", nameSk: "Vhadzovania (Faceoffs)", nameEn: "Faceoffs", icon: "⭕" },
  { key: "ex", label: "EX", nameSk: "Skúsenosti (Experience / Kariérne GP)", nameEn: "Experience (Career GP)", icon: "⏳" },
];

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function getDeltaBadgeClass(delta: number): string {
  if (delta > 0) {
    if (delta >= 10) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-500/10 font-black";
    if (delta >= 5) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 font-bold";
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold";
  }
  if (delta < 0) {
    if (delta <= -10) return "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-500/10 font-black";
    if (delta <= -5) return "bg-rose-500/15 text-rose-400 border-rose-500/40 font-bold";
    return "bg-rose-500/10 text-rose-400 border-rose-500/30 font-semibold";
  }
  return "bg-slate-800/60 text-slate-400 border-slate-700 font-normal";
}

function posBadge(pos: string | null): { text: string; bg: string } {
  const p = (pos || "F").toUpperCase();
  if (p === "G") return { text: "G", bg: "bg-purple-500/15 text-purple-300 border-purple-500/30" };
  if (p.includes("D") && !/[CW]/.test(p)) return { text: "D", bg: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  if (p.includes("C")) return { text: p, bg: "bg-blue-500/15 text-blue-300 border-blue-500/30" };
  return { text: p, bg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
}

export default function PlayerProgressView({ data }: { data: PlayerProgressData }) {
  const lang = useLang();
  const isSk = lang === "cs";

  const [activeParam, setActiveParam] = useState<ActiveParam>("ov");
  const [sortMode, setSortMode] = useState<SortMode>("risers");
  const [posFilter, setPosFilter] = useState<PosFilter>("ALL");
  const [leagueFilter, setLeagueFilter] = useState<LeagueFilter>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [minGpOnly, setMinGpOnly] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState<number>(1);

  // Helper to extract param value for current player
  const getParamInfo = (player: PlayerProgressItem, paramKey: ActiveParam) => {
    if (paramKey === "ov") return player.ov;
    if (player.allParams[paramKey]) return player.allParams[paramKey];
    return { actual: 0, projected: 0, delta: 0 };
  };

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    let list = data.players;

    // Filter position
    if (posFilter === "G") {
      list = list.filter((p) => p.isGoalie || p.position === "G");
    } else if (posFilter === "D") {
      list = list.filter((p) => !p.isGoalie && (p.position?.toUpperCase().includes("D") && !/[CW]/.test(p.position?.toUpperCase() || "")));
    } else if (posFilter === "F") {
      list = list.filter((p) => !p.isGoalie && !p.position?.toUpperCase().includes("D"));
    }

    // Filter league
    if (leagueFilter === "NHL") {
      list = list.filter((p) => p.classification === "NHL" || p.team.league === "NHL");
    } else if (leagueFilter === "AHL") {
      list = list.filter((p) => p.classification === "AHL/FARM" || p.team.league === "AHL");
    }

    // Filter team
    if (teamFilter !== "ALL") {
      const teamId = Number(teamFilter);
      list = list.filter((p) => p.team.id === teamId);
    }

    // Filter Min GP
    if (minGpOnly) {
      list = list.filter((p) => p.gp >= 1);
    }

    // Filter Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.cleanName.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.team.name.toLowerCase().includes(q) ||
          (p.team.code && p.team.code.toLowerCase().includes(q))
      );
    }

    // Sort based on selected param delta
    const sorted = [...list].sort((a, b) => {
      const aVal = getParamInfo(a, activeParam);
      const bVal = getParamInfo(b, activeParam);

      if (sortMode === "risers") {
        if (bVal.delta !== aVal.delta) return bVal.delta - aVal.delta;
        return bVal.projected - aVal.projected;
      }
      if (sortMode === "fallers") {
        if (aVal.delta !== bVal.delta) return aVal.delta - bVal.delta;
        return aVal.actual - bVal.actual;
      }
      // "all" -> sort by absolute delta
      const aAbs = Math.abs(aVal.delta);
      const bAbs = Math.abs(bVal.delta);
      if (bAbs !== aAbs) return bAbs - aAbs;
      return bVal.delta - aVal.delta;
    });

    return sorted;
  }, [
    data.players,
    activeParam,
    sortMode,
    posFilter,
    leagueFilter,
    teamFilter,
    minGpOnly,
    searchQuery,
  ]);

  // Top 3 Podium Highlights for current param & mode
  const podiumPlayers = useMemo(() => {
    return filteredAndSortedPlayers.slice(0, 3);
  }, [filteredAndSortedPlayers]);

  // Paginated players
  const totalPages = Math.ceil(filteredAndSortedPlayers.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const pagedPlayers = useMemo(() => {
    if (pageSize >= 9999) return filteredAndSortedPlayers;
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedPlayers.slice(start, start + pageSize);
  }, [filteredAndSortedPlayers, currentPage, pageSize]);

  // Formatted last calculated time
  const lastCalcFormatted = useMemo(() => {
    if (!data.lastCalculatedAt) return isSk ? "Zatiaľ neprepočítané" : "Not yet calculated";
    try {
      const d = new Date(data.lastCalculatedAt);
      return d.toLocaleString(isSk ? "sk-SK" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return data.lastCalculatedAt;
    }
  }, [data.lastCalculatedAt, isSk]);

  const activeParamMeta = PARAM_OPTIONS.find((p) => p.key === activeParam) || PARAM_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Top Banner & Navigation */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-base shadow-sm">
                📈
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white">
                {isSk ? "Prehľad progresu hráčov" : "Player Rating Progress Watch"}
              </h2>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/25">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              {isSk
                ? "Sledujte odozvu hráčov na prepočet parametrov a nastavené váhy. Rýchle filtrovanie najväčších skokanov a prepadov pre hlavné atribúty."
                : "Inspect player rating response to formula recomputations and weight settings. Fast filtering of top risers and fallers across key attributes."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <span className="text-slate-400">🕒 {isSk ? "Prepočet:" : "Recomputed:"}</span>
              <span className="font-semibold text-white">{lastCalcFormatted}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <span className="text-slate-400">⚖️ {isSk ? "Váhy:" : "Weights:"}</span>
              <span className="font-semibold text-white">
                {Math.round(data.latestWeight * 100)}% / {Math.round(data.previousWeight * 100)}%
              </span>
            </div>
            <Link
              href="/tools/player-calculator"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-all hover:scale-102"
            >
              <span>←</span>
              <span>{isSk ? "Späť do kalkulátora" : "Back to Live Calc"}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Parameter Selection Pills & Mode Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
        {/* Main 5 Parameters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
            {isSk ? "Parameter:" : "Parameter:"}
          </span>
          {PARAM_OPTIONS.slice(0, 5).map((param) => {
            const isSelected = activeParam === param.key;
            return (
              <button
                key={param.key}
                type="button"
                onClick={() => {
                  setActiveParam(param.key);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400/50"
                    : "bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50"
                }`}
              >
                <span>{param.icon}</span>
                <span>{param.label}</span>
                <span className="text-[10px] font-normal opacity-80 hidden sm:inline">
                  {param.key === "ov" ? (isSk ? "Celkovo" : "Overall") : param.label}
                </span>
              </button>
            );
          })}

          {/* Secondary Parameters Dropdown */}
          <div className="relative">
            <select
              aria-label={isSk ? "Ďalšie parametre" : "More parameters"}
              value={PARAM_OPTIONS.slice(5).some((p) => p.key === activeParam) ? activeParam : ""}
              onChange={(e) => {
                if (e.target.value) {
                  setActiveParam(e.target.value as ActiveParam);
                  setPage(1);
                }
              }}
              className={`text-xs px-2.5 py-1.5 rounded-xl border appearance-none pr-7 font-medium transition-all ${
                PARAM_OPTIONS.slice(5).some((p) => p.key === activeParam)
                  ? "bg-indigo-600 text-white border-indigo-400"
                  : "bg-slate-800/70 text-slate-400 border-slate-700/50 hover:text-white"
              }`}
            >
              <option value="" disabled className="bg-slate-900 text-slate-400">
                {isSk ? "➕ Ďalšie atribúty..." : "➕ More attributes..."}
              </option>
              {PARAM_OPTIONS.slice(5).map((param) => (
                <option key={param.key} value={param.key} className="bg-slate-900 text-white">
                  {param.label} – {isSk ? param.nameSk : param.nameEn}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
              ▼
            </div>
          </div>
        </div>

        {/* Direction Switch (Risers vs Fallers) */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => {
              setSortMode("risers");
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.2 rounded-lg text-xs font-bold transition-all ${
              sortMode === "risers"
                ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/25"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🟢</span>
            <span>{isSk ? "Najväčší nárast" : "Top Risers"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSortMode("fallers");
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.2 rounded-lg text-xs font-bold transition-all ${
              sortMode === "fallers"
                ? "bg-rose-500 text-white shadow-sm shadow-rose-500/25"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🔴</span>
            <span>{isSk ? "Najväčší pokles" : "Top Fallers"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSortMode("all");
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg text-xs font-semibold transition-all ${
              sortMode === "all"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>⚖️</span>
            <span>{isSk ? "Všetky zmeny" : "All Changes"}</span>
          </button>
        </div>
      </div>

      {/* Podium Cards for Top 3 */}
      {podiumPlayers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <span>🏆</span>
              <span>
                {isSk
                  ? `Top 3 v parametri ${activeParamMeta.label} (${sortMode === "fallers" ? "Pokles" : "Nárast"})`
                  : `Top 3 in ${activeParamMeta.label} (${sortMode === "fallers" ? "Fallers" : "Risers"})`}
              </span>
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {isSk ? activeParamMeta.nameSk : activeParamMeta.nameEn}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {podiumPlayers.map((player, idx) => {
              const paramInfo = getParamInfo(player, activeParam);
              const pos = posBadge(player.position);
              const rankColor =
                idx === 0
                  ? "from-amber-500/20 via-slate-900 to-slate-950 border-amber-500/40 text-amber-400"
                  : idx === 1
                  ? "from-slate-400/15 via-slate-900 to-slate-950 border-slate-500/40 text-slate-300"
                  : "from-amber-700/15 via-slate-900 to-slate-950 border-amber-700/40 text-amber-500";

              const medal = idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : "🥉 #3";

              return (
                <div
                  key={player.id}
                  className={`relative rounded-2xl border bg-gradient-to-br ${rankColor} p-4 shadow-lg backdrop-blur-md transition-all hover:border-blue-500/50 flex flex-col justify-between gap-3`}
                >
                  <div className="flex items-start justify-between">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-900/80 border border-slate-700">
                      {medal}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${pos.bg}`}>
                        {pos.text}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {player.classification}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <PlayerAvatar src={player.photoUrl} alt={player.name} size={48} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-white text-sm hover:text-blue-400 transition-colors">
                        <PlayerLink slug={player.slug} name={player.cleanName} />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        {player.team.logoUrl && (
                          <img
                            src={player.team.logoUrl}
                            alt={player.team.name}
                            className="w-4 h-4 object-contain inline-block"
                          />
                        )}
                        <span className="truncate">{player.team.code || player.team.name}</span>
                        <span>•</span>
                        <span>{player.gp} GP</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating comparison & big delta */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        {activeParamMeta.label} {isSk ? "Posun" : "Shift"}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span className="font-semibold">{paramInfo.actual}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-bold text-white">{paramInfo.projected}</span>
                      </div>
                    </div>

                    <div
                      className={`px-3 py-1 rounded-xl text-base border shadow-sm ${getDeltaBadgeClass(
                        paramInfo.delta
                      )}`}
                    >
                      {formatDelta(paramInfo.delta)}
                    </div>
                  </div>

                  {/* Mini-snapshot of other 4 core stats */}
                  <div className="grid grid-cols-4 gap-1 pt-1.5 border-t border-slate-800/50 text-[10px]">
                    {(["ck", "pa", "sc", "df"] as const).map((k) => {
                      if (k === activeParam) {
                        return (
                          <div key={k} className="text-center bg-blue-500/10 rounded py-0.5 border border-blue-500/20">
                            <span className="text-blue-400 font-bold uppercase">{k}: </span>
                            <span className="font-bold text-white">{player[k].projected}</span>
                          </div>
                        );
                      }
                      const d = player[k].delta;
                      const dColor = d > 0 ? "text-emerald-400" : d < 0 ? "text-rose-400" : "text-slate-400";
                      return (
                        <div key={k} className="text-center bg-slate-900/60 rounded py-0.5 border border-slate-800">
                          <span className="text-slate-400 uppercase font-medium">{k}: </span>
                          <span className={`font-semibold ${dColor}`}>{d > 0 ? `+${d}` : d}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative min-w-[200px]">
            <input
              type="text"
              placeholder={isSk ? "Hľadať hráča alebo tím..." : "Search player or team..."}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 pl-8"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">🔍</span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Position Filter */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
            {(["ALL", "F", "D", "G"] as const).map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => {
                  setPosFilter(pos);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  posFilter === pos ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {pos === "ALL" ? (isSk ? "Všetky" : "All") : pos}
              </button>
            ))}
          </div>

          {/* League Filter */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
            {(["ALL", "NHL", "AHL"] as const).map((league) => (
              <button
                key={league}
                type="button"
                onClick={() => {
                  setLeagueFilter(league);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  leagueFilter === league
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {league === "ALL" ? (isSk ? "Ligy" : "Leagues") : league}
              </button>
            ))}
          </div>

          {/* Team Dropdown */}
          <select
            aria-label={isSk ? "Filtrovať podľa tímu" : "Filter by team"}
            value={teamFilter}
            onChange={(e) => {
              setTeamFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">{isSk ? "Všetky tímy (All Teams)" : "All Teams"}</option>
            {data.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.code ? `(${t.code})` : ""}
              </option>
            ))}
          </select>

          {/* Min GP Checkbox */}
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer ml-1">
            <input
              type="checkbox"
              checked={minGpOnly}
              onChange={(e) => {
                setMinGpOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
            />
            <span>{isSk ? "Iba s odohranými zápasmi (GP > 0)" : "Active GP only (GP > 0)"}</span>
          </label>
        </div>

        {/* Count & Page Size */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            {isSk ? "Nájdených:" : "Found:"}{" "}
            <strong className="text-white">{filteredAndSortedPlayers.length}</strong>{" "}
            {isSk ? "hráčov" : "players"}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">{isSk ? "Na stranu:" : "Per page:"}</span>
            <select
              aria-label={isSk ? "Počet hráčov na stranu" : "Players per page"}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-300"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={9999}>{isSk ? "Všetci" : "All"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Players Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-4">{isSk ? "Hráč" : "Player"}</th>
                <th className="py-3 px-3">{isSk ? "Tím" : "Team"}</th>
                <th className="py-3 px-2 text-center">{isSk ? "Poz." : "Pos."}</th>
                <th className="py-3 px-2 text-center">GP</th>
                <th className="py-3 px-3 text-center bg-slate-900/40">{isSk ? "Pôvodné" : "Base"}</th>
                <th className="py-3 px-3 text-center bg-slate-900/40">{isSk ? "Nové" : "Proj."}</th>
                <th className="py-3 px-4 text-center bg-blue-950/30 font-black text-blue-300">
                  {activeParamMeta.label} {isSk ? "Posun" : "Delta"}
                </th>
                <th className="py-3 px-2 text-center text-slate-400">OVR</th>
                <th className="py-3 px-2 text-center text-slate-400">CK</th>
                <th className="py-3 px-2 text-center text-slate-400">PA</th>
                <th className="py-3 px-2 text-center text-slate-400">SC</th>
                <th className="py-3 px-2 text-center text-slate-400">DF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {pagedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500">
                    <div className="text-3xl mb-2">🔍</div>
                    <div className="font-medium text-sm text-slate-300">
                      {isSk ? "Nenašli sa žiadni hráči" : "No players found"}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {isSk
                        ? "Skúste upraviť vyhľadávacie kritériá alebo filtre."
                        : "Try adjusting your search query or filter settings."}
                    </p>
                  </td>
                </tr>
              ) : (
                pagedPlayers.map((player, idx) => {
                  const rank = (currentPage - 1) * pageSize + idx + 1;
                  const paramInfo = getParamInfo(player, activeParam);
                  const pos = posBadge(player.position);

                  return (
                    <tr
                      key={player.id}
                      className="transition-colors hover:bg-slate-800/40 group"
                    >
                      {/* Rank */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-500 group-hover:text-slate-300">
                        {rank}
                      </td>

                      {/* Player Name, Avatar, Age */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <PlayerAvatar src={player.photoUrl} alt={player.name} size={32} />
                          <div className="min-w-0">
                            <div className="font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                              <PlayerLink slug={player.slug} name={player.cleanName} />
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              {player.age ? <span>{player.age} r.</span> : null}
                              {player.number ? <span>#{player.number}</span> : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Team */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          {player.team.logoUrl ? (
                            <img
                              src={player.team.logoUrl}
                              alt={player.team.name}
                              className="w-5 h-5 object-contain shrink-0"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-200 truncate max-w-[130px]">
                              {player.team.code || player.team.name}
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase">
                              {player.classification}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${pos.bg}`}>
                          {pos.text}
                        </span>
                      </td>

                      {/* GP */}
                      <td className="py-2.5 px-2 text-center font-semibold text-slate-300">
                        {player.gp}
                      </td>

                      {/* Param Base */}
                      <td className="py-2.5 px-3 text-center bg-slate-900/30 font-medium text-slate-400">
                        {paramInfo.actual}
                      </td>

                      {/* Param Proj */}
                      <td className="py-2.5 px-3 text-center bg-slate-900/30 font-bold text-white">
                        {paramInfo.projected}
                      </td>

                      {/* Param Delta Badge */}
                      <td className="py-2.5 px-4 text-center bg-blue-950/20">
                        <span
                          className={`inline-block min-w-[42px] px-2 py-0.5 rounded-lg text-xs border ${getDeltaBadgeClass(
                            paramInfo.delta
                          )}`}
                        >
                          {formatDelta(paramInfo.delta)}
                        </span>
                      </td>

                      {/* Snapshot deltas for OVR, CK, PA, SC, DF */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`text-[11px] font-bold ${
                            player.ov.delta > 0
                              ? "text-emerald-400"
                              : player.ov.delta < 0
                              ? "text-rose-400"
                              : "text-slate-400"
                          }`}
                        >
                          {player.ov.delta > 0 ? `+${player.ov.delta}` : player.ov.delta}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`text-[11px] font-semibold ${
                            player.ck.delta > 0
                              ? "text-emerald-400"
                              : player.ck.delta < 0
                              ? "text-rose-400"
                              : "text-slate-400"
                          }`}
                        >
                          {player.ck.delta > 0 ? `+${player.ck.delta}` : player.ck.delta}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`text-[11px] font-semibold ${
                            player.pa.delta > 0
                              ? "text-emerald-400"
                              : player.pa.delta < 0
                              ? "text-rose-400"
                              : "text-slate-400"
                          }`}
                        >
                          {player.pa.delta > 0 ? `+${player.pa.delta}` : player.pa.delta}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`text-[11px] font-semibold ${
                            player.sc.delta > 0
                              ? "text-emerald-400"
                              : player.sc.delta < 0
                              ? "text-rose-400"
                              : "text-slate-400"
                          }`}
                        >
                          {player.sc.delta > 0 ? `+${player.sc.delta}` : player.sc.delta}
                        </span>
                      </td>

                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`text-[11px] font-semibold ${
                            player.df.delta > 0
                              ? "text-emerald-400"
                              : player.df.delta < 0
                              ? "text-rose-400"
                              : "text-slate-400"
                          }`}
                        >
                          {player.df.delta > 0 ? `+${player.df.delta}` : player.df.delta}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/60 text-xs">
            <span className="text-slate-400">
              {isSk ? "Strana" : "Page"}{" "}
              <strong className="text-white">{currentPage}</strong> / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
              >
                ← {isSk ? "Predchádzajúca" : "Prev"}
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pNum = currentPage - 3 + i;
                    if (pNum > totalPages) pNum = totalPages - (4 - i);
                  }
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setPage(pNum)}
                      className={`w-7 h-7 rounded-lg font-bold transition-all ${
                        currentPage === pNum
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
              >
                {isSk ? "Nasledujúca" : "Next"} →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
