"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import type { Lang } from "@/lib/i18n";

export type SkaterRow = {
  playerId: number;
  name: string;
  slug: string | null;
  photoUrl: string | null;
  number: number | null;
  position: string;
  rookie: boolean;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  plusMinus5v5: number;
  pim: number;
  hits: number;
  blocks: number;
  shots: number;
  shtPct: number;
  xg: number;
  gax: number;
  toiMin: number;
  toiPerGameMin: number;
  ppGoals: number;
  ppAssists: number;
  ppp: number;
  shGoals: number;
  shAssists: number;
  shp: number;
  gwg: number;
  p60: number;
};

export type GoalieRow = {
  playerId: number;
  name: string;
  slug: string | null;
  photoUrl: string | null;
  gp: number;
  wins: number;
  losses: number;
  otl: number;
  shutouts: number;
  shotsAgainst: number;
  saves: number;
  goalsAgainst: number;
  toiMin: number;
  svPct: number;
  gaa: number;
  xga: number;
  gsax: number;
  steals: number;
};

const i18nDict = {
  en: {
    pointsLeader: "Points Leader",
    goalsLeader: "Goals Leader",
    assistsLeader: "Assists Leader",
    topGoalie: "Top Goalie",
    toiLeader: "Ice Time Leader",
    tabOverview: "Overview",
    tabForwards: "Forwards",
    tabDefense: "Defense",
    tabSpecialTeams: "Special Teams",
    tabAdvanced: "Advanced",
    tabGoalies: "Goalies",
    searchPlaceholder: "Search player or number...",
    showing: "Showing",
    of: "of",
    players: "players",
    player: "Player",
    pos: "POS",
    gp: "GP",
    g: "G",
    a: "A",
    pts: "PTS",
    plusMinus: "+/-",
    pim: "PIM",
    hits: "HIT",
    blocks: "BLK",
    shots: "SHT",
    shtPct: "S%",
    toiPerGame: "TOI/GP",
    totalToi: "TOI",
    ppg: "PPG",
    ppa: "PPA",
    ppp: "PPP",
    shg: "SHG",
    sha: "SHA",
    shp: "SHP",
    gwg: "GWG",
    xg: "xG",
    gax: "G-xG",
    p60: "P/60",
    w: "W",
    l: "L",
    otl: "OTL",
    svPct: "SV%",
    gaa: "GAA",
    gsax: "GSAx",
    so: "SO",
    sa: "SA",
    sv: "SV",
    ga: "GA",
    min: "MIN",
    steals: "STL",
    noStats: "No statistics recorded yet this season.",
    skatersTitle: "Skater Statistics",
    goaliesTitle: "Goaltending Statistics",
    totals: "Totals",
  },
  cs: {
    pointsLeader: "Najproduktívnejší hráč",
    goalsLeader: "Najlepší strelec",
    assistsLeader: "Najlepší nahrávač",
    topGoalie: "Brankárska opora",
    toiLeader: "Najvyťaženejší hráč",
    tabOverview: "Prehľad",
    tabForwards: "Útočníci",
    tabDefense: "Obrancovia",
    tabSpecialTeams: "Presilovky / Oslabenia",
    tabAdvanced: "Pokročilá analytika",
    tabGoalies: "Brankári",
    searchPlaceholder: "Hľadať hráča alebo číslo...",
    showing: "Zobrazených",
    of: "z",
    players: "hráčov",
    player: "Hráč",
    pos: "POZ",
    gp: "Z",
    g: "G",
    a: "A",
    pts: "BOD",
    plusMinus: "+/-",
    pim: "TM",
    hits: "HIT",
    blocks: "BLK",
    shots: "STR",
    shtPct: "ÚSP%",
    toiPerGame: "ČAS/Z",
    totalToi: "ČAS",
    ppg: "PPG",
    ppa: "PPA",
    ppp: "PPB",
    shg: "SHG",
    sha: "SHA",
    shp: "SHB",
    gwg: "Víť.G",
    xg: "xG",
    gax: "G-xG",
    p60: "B/60",
    w: "V",
    l: "P",
    otl: "PP",
    svPct: "ÚSP%",
    gaa: "PÍG",
    gsax: "GSAx",
    so: "ČK",
    sa: "STR",
    sv: "ZÁK",
    ga: "INK",
    min: "MIN",
    steals: "UKR",
    noStats: "V tejto sezóne zatiaľ neboli zaznamenané žiadne štatistiky.",
    skatersTitle: "Štatistiky korčuliarov",
    goaliesTitle: "Štatistiky brankárov",
    totals: "Tímový súčet",
  },
};

function fmtClock(min: number): string {
  if (!min || isNaN(min)) return "0:00";
  const totalSec = Math.max(0, Math.round(min * 60));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TeamStatsView({
  skaters,
  goalies,
  lang,
}: {
  skaters: SkaterRow[];
  goalies: GoalieRow[];
  lang: Lang;
}) {
  const isCs = lang === "cs";
  const t = isCs ? i18nDict.cs : i18nDict.en;

  // Active Category Tab
  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "FORWARDS" | "DEFENSE" | "SPECIAL_TEAMS" | "ADVANCED" | "GOALIES"
  >("OVERVIEW");

  // Live text search
  const [search, setSearch] = useState("");

  // Sorting state for skaters
  const [skaterSort, setSkaterSort] = useState<{ key: keyof SkaterRow; dir: 1 | -1 }>({
    key: "points",
    dir: -1,
  });

  // Sorting state for goalies
  const [goalieSort, setGoalieSort] = useState<{ key: keyof GoalieRow; dir: 1 | -1 }>({
    key: "wins",
    dir: -1,
  });

  // 1. Top Leaders extraction
  const pointsLeader = useMemo(() => {
    return [...skaters].sort((a, b) => b.points - a.points || b.goals - a.goals)[0];
  }, [skaters]);

  const goalsLeader = useMemo(() => {
    return [...skaters].sort((a, b) => b.goals - a.goals || b.shots - a.shots)[0];
  }, [skaters]);

  const assistsLeader = useMemo(() => {
    return [...skaters].sort((a, b) => b.assists - a.assists || b.points - a.points)[0];
  }, [skaters]);

  const topGoalie = useMemo(() => {
    return [...goalies].sort((a, b) => b.wins - a.wins || b.svPct - a.svPct)[0];
  }, [goalies]);

  const toiLeader = useMemo(() => {
    return [...skaters].sort((a, b) => b.toiPerGameMin - a.toiPerGameMin)[0];
  }, [skaters]);

  // Filtered & Sorted Skaters
  const filteredSkaters = useMemo(() => {
    return skaters
      .filter((s) => {
        // Tab position filter
        if (activeTab === "FORWARDS") {
          const p = s.position.toUpperCase();
          if (p.includes("D") && !p.includes("F") && !p.includes("W") && !p.includes("C")) return false;
        }
        if (activeTab === "DEFENSE") {
          const p = s.position.toUpperCase();
          if (!p.includes("D")) return false;
        }
        // Text search
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const nameMatch = s.name.toLowerCase().includes(q);
          const numMatch = s.number != null && String(s.number).includes(q);
          if (!nameMatch && !numMatch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const av = a[skaterSort.key];
        const bv = b[skaterSort.key];
        if (typeof av === "number" && typeof bv === "number") {
          return (av - bv) * skaterSort.dir;
        }
        return String(av).localeCompare(String(bv)) * skaterSort.dir;
      });
  }, [skaters, activeTab, search, skaterSort]);

  // Filtered & Sorted Goalies
  const filteredGoalies = useMemo(() => {
    return goalies
      .filter((g) => {
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          return g.name.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        const av = a[goalieSort.key];
        const bv = b[goalieSort.key];
        if (typeof av === "number" && typeof bv === "number") {
          return (av - bv) * goalieSort.dir;
        }
        return String(av).localeCompare(String(bv)) * goalieSort.dir;
      });
  }, [goalies, search, goalieSort]);

  // Helper sort togglers
  const handleSkaterSort = (key: keyof SkaterRow) => {
    setSkaterSort((prev) =>
      prev.key === key ? { key, dir: (prev.dir * -1) as 1 | -1 } : { key, dir: -1 }
    );
  };

  const handleGoalieSort = (key: keyof GoalieRow) => {
    setGoalieSort((prev) =>
      prev.key === key ? { key, dir: (prev.dir * -1) as 1 | -1 } : { key, dir: -1 }
    );
  };

  const arrow = (currentKey: string, targetKey: string, dir: number) => {
    if (currentKey !== targetKey) return "";
    return dir === -1 ? " ▾" : " ▴";
  };

  // Totals for skaters
  const skaterTotalsRow = useMemo(() => {
    let gp = 0, g = 0, a = 0, pts = 0, pim = 0, hits = 0, blocks = 0, shots = 0, ppg = 0, ppa = 0, ppp = 0, shg = 0, sha = 0, shp = 0;
    for (const s of skaters) {
      gp = Math.max(gp, s.gp);
      g += s.goals;
      a += s.assists;
      pts += s.points;
      pim += s.pim;
      hits += s.hits;
      blocks += s.blocks;
      shots += s.shots;
      ppg += s.ppGoals;
      ppa += s.ppAssists;
      ppp += s.ppp;
      shg += s.shGoals;
      sha += s.shAssists;
      shp += s.shp;
    }
    return { gp, g, a, pts, pim, hits, blocks, shots, ppg, ppa, ppp, shg, sha, shp };
  }, [skaters]);

  return (
    <div className="space-y-6">
      {/* 1. Top Executive Leaders Deck */}
      {skaters.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Points Leader */}
          {pointsLeader && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-colors group">
              <div>
                <div className="flex items-center justify-between gap-1 mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                    🎯 {t.pointsLeader}
                  </span>
                  {pointsLeader.number != null && (
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      #{pointsLeader.number}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <PlayerAvatar
                    src={pointsLeader.photoUrl}
                    alt={pointsLeader.name}
                    size={46}
                    className="ring-2 ring-amber-500/40 shadow-md shrink-0"
                  />
                  <div className="min-w-0">
                    <Link
                      href={pointsLeader.slug ? `/players/${pointsLeader.slug}` : "#"}
                      className="font-bold text-white text-sm hover:text-amber-300 transition-colors block truncate"
                    >
                      {pointsLeader.name}
                    </Link>
                    <span className="text-xs text-slate-400 font-mono">
                      {pointsLeader.position}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-amber-400 font-mono">
                    {pointsLeader.points}
                  </span>
                  <span className="text-xs uppercase text-slate-400 ml-1 font-bold">
                    {t.pts}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {pointsLeader.goals}G · {pointsLeader.assists}A
                </span>
              </div>
            </div>
          )}

          {/* Goals Leader */}
          {goalsLeader && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-colors group">
              <div>
                <div className="flex items-center justify-between gap-1 mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                    🚨 {t.goalsLeader}
                  </span>
                  {goalsLeader.number != null && (
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      #{goalsLeader.number}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <PlayerAvatar
                    src={goalsLeader.photoUrl}
                    alt={goalsLeader.name}
                    size={46}
                    className="ring-2 ring-emerald-500/40 shadow-md shrink-0"
                  />
                  <div className="min-w-0">
                    <Link
                      href={goalsLeader.slug ? `/players/${goalsLeader.slug}` : "#"}
                      className="font-bold text-white text-sm hover:text-emerald-300 transition-colors block truncate"
                    >
                      {goalsLeader.name}
                    </Link>
                    <span className="text-xs text-slate-400 font-mono">
                      {goalsLeader.position}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {goalsLeader.goals}
                  </span>
                  <span className="text-xs uppercase text-slate-400 ml-1 font-bold">
                    {t.g}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {goalsLeader.shtPct.toFixed(1)}% {t.shtPct}
                </span>
              </div>
            </div>
          )}

          {/* Assists Leader */}
          {assistsLeader && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-colors group">
              <div>
                <div className="flex items-center justify-between gap-1 mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-sky-400">
                    🅰️ {t.assistsLeader}
                  </span>
                  {assistsLeader.number != null && (
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      #{assistsLeader.number}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <PlayerAvatar
                    src={assistsLeader.photoUrl}
                    alt={assistsLeader.name}
                    size={46}
                    className="ring-2 ring-sky-500/40 shadow-md shrink-0"
                  />
                  <div className="min-w-0">
                    <Link
                      href={assistsLeader.slug ? `/players/${assistsLeader.slug}` : "#"}
                      className="font-bold text-white text-sm hover:text-sky-300 transition-colors block truncate"
                    >
                      {assistsLeader.name}
                    </Link>
                    <span className="text-xs text-slate-400 font-mono">
                      {assistsLeader.position}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-sky-400 font-mono">
                    {assistsLeader.assists}
                  </span>
                  <span className="text-xs uppercase text-slate-400 ml-1 font-bold">
                    {t.a}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {assistsLeader.ppAssists} PPA
                </span>
              </div>
            </div>
          )}

          {/* Top Goalie */}
          {topGoalie && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-colors group">
              <div>
                <div className="flex items-center justify-between gap-1 mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400">
                    🧤 {t.topGoalie}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    G
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <PlayerAvatar
                    src={topGoalie.photoUrl}
                    alt={topGoalie.name}
                    size={46}
                    className="ring-2 ring-indigo-500/40 shadow-md shrink-0"
                  />
                  <div className="min-w-0">
                    <Link
                      href={topGoalie.slug ? `/players/${topGoalie.slug}` : "#"}
                      className="font-bold text-white text-sm hover:text-indigo-300 transition-colors block truncate"
                    >
                      {topGoalie.name}
                    </Link>
                    <span className="text-xs text-slate-400 font-mono">
                      {topGoalie.wins}W · {topGoalie.losses}L
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-indigo-400 font-mono">
                    {topGoalie.svPct.toFixed(3).replace(/^0/, "")}
                  </span>
                  <span className="text-xs uppercase text-slate-400 ml-1 font-bold">
                    {t.svPct}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {topGoalie.gaa.toFixed(2)} GAA
                </span>
              </div>
            </div>
          )}

          {/* Ice Time Leader */}
          {toiLeader && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-colors group">
              <div>
                <div className="flex items-center justify-between gap-1 mb-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">
                    ⏱️ {t.toiLeader}
                  </span>
                  {toiLeader.number != null && (
                    <span className="text-[10px] font-mono font-bold text-slate-500">
                      #{toiLeader.number}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <PlayerAvatar
                    src={toiLeader.photoUrl}
                    alt={toiLeader.name}
                    size={46}
                    className="ring-2 ring-rose-500/40 shadow-md shrink-0"
                  />
                  <div className="min-w-0">
                    <Link
                      href={toiLeader.slug ? `/players/${toiLeader.slug}` : "#"}
                      className="font-bold text-white text-sm hover:text-rose-300 transition-colors block truncate"
                    >
                      {toiLeader.name}
                    </Link>
                    <span className="text-xs text-slate-400 font-mono">
                      {toiLeader.position}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-rose-400 font-mono">
                    {fmtClock(toiLeader.toiPerGameMin)}
                  </span>
                  <span className="text-xs uppercase text-slate-400 ml-1 font-bold">
                    /GP
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {toiLeader.hits} HIT · {toiLeader.blocks} BLK
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Controls Toolbar: Category Tabs + Search Input */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: "OVERVIEW", label: t.tabOverview },
            { key: "FORWARDS", label: t.tabForwards },
            { key: "DEFENSE", label: t.tabDefense },
            { key: "SPECIAL_TEAMS", label: t.tabSpecialTeams },
            { key: "ADVANCED", label: t.tabAdvanced },
            { key: "GOALIES", label: `${t.tabGoalies} (${goalies.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live Search */}
        <div className="relative min-w-[200px] sm:min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all pl-8 shadow-sm"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
            🔍
          </span>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. SKATER STATS TABLE (Active when not GOALIES tab) */}
      {activeTab !== "GOALIES" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span>🏒</span>
              <span>{t.skatersTitle}</span>
              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 normal-case">
                {filteredSkaters.length} {t.of} {skaters.length}
              </span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400 select-none">
                  {/* Rank */}
                  <th className="px-3 py-3 text-center w-10">#</th>

                  {/* Player Name */}
                  <th
                    className="px-3 py-3 text-left cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSkaterSort("name")}
                  >
                    <span>{t.player}</span>
                    <span className="text-blue-400">{arrow(skaterSort.key, "name", skaterSort.dir)}</span>
                  </th>

                  {/* Position */}
                  <th
                    className="px-3 py-3 text-center w-14 cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSkaterSort("position")}
                  >
                    <span>{t.pos}</span>
                    <span className="text-blue-400">{arrow(skaterSort.key, "position", skaterSort.dir)}</span>
                  </th>

                  {/* GP */}
                  <th
                    className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSkaterSort("gp")}
                  >
                    <span>{t.gp}</span>
                    <span className="text-blue-400">{arrow(skaterSort.key, "gp", skaterSort.dir)}</span>
                  </th>

                  {/* Standard / Overview Columns */}
                  {(activeTab === "OVERVIEW" || activeTab === "FORWARDS" || activeTab === "DEFENSE") && (
                    <>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("goals")}
                      >
                        <span>{t.g}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "goals", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("assists")}
                      >
                        <span>{t.a}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "assists", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors text-amber-400"
                        onClick={() => handleSkaterSort("points")}
                      >
                        <span>{t.pts}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "points", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("plusMinus")}
                      >
                        <span>{t.plusMinus}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "plusMinus", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("pim")}
                      >
                        <span>{t.pim}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "pim", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("shots")}
                      >
                        <span>{t.shots}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "shots", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("shtPct")}
                      >
                        <span>{t.shtPct}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "shtPct", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("hits")}
                      >
                        <span>{t.hits}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "hits", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("blocks")}
                      >
                        <span>{t.blocks}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "blocks", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("toiPerGameMin")}
                      >
                        <span>{t.toiPerGame}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "toiPerGameMin", skaterSort.dir)}</span>
                      </th>
                    </>
                  )}

                  {/* Special Teams Columns */}
                  {activeTab === "SPECIAL_TEAMS" && (
                    <>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors text-amber-400"
                        onClick={() => handleSkaterSort("points")}
                      >
                        <span>{t.pts}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "points", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("ppGoals")}
                      >
                        <span>{t.ppg}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "ppGoals", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("ppAssists")}
                      >
                        <span>{t.ppa}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "ppAssists", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("ppp")}
                      >
                        <span>{t.ppp}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "ppp", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("shGoals")}
                      >
                        <span>{t.shg}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "shGoals", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("shAssists")}
                      >
                        <span>{t.sha}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "shAssists", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("shp")}
                      >
                        <span>{t.shp}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "shp", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("gwg")}
                      >
                        <span>{t.gwg}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "gwg", skaterSort.dir)}</span>
                      </th>
                    </>
                  )}

                  {/* Advanced Analytics Columns */}
                  {activeTab === "ADVANCED" && (
                    <>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors text-amber-400"
                        onClick={() => handleSkaterSort("points")}
                      >
                        <span>{t.pts}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "points", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("xg")}
                      >
                        <span>{t.xg}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "xg", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("gax")}
                      >
                        <span>{t.gax}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "gax", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("p60")}
                      >
                        <span>{t.p60}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "p60", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("plusMinus5v5")}
                      >
                        <span>+/- 5v5</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "plusMinus5v5", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("shtPct")}
                      >
                        <span>{t.shtPct}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "shtPct", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("toiPerGameMin")}
                      >
                        <span>{t.toiPerGame}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "toiPerGameMin", skaterSort.dir)}</span>
                      </th>
                      <th
                        className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSkaterSort("toiMin")}
                      >
                        <span>{t.totalToi}</span>
                        <span className="text-blue-400">{arrow(skaterSort.key, "toiMin", skaterSort.dir)}</span>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {filteredSkaters.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-4 py-8 text-center text-slate-500 font-sans">
                      {t.noStats}
                    </td>
                  </tr>
                ) : (
                  filteredSkaters.map((s, idx) => (
                    <tr key={s.playerId} className="hover:bg-slate-800/40 transition-colors group">
                      {/* Rank */}
                      <td className="px-3 py-2.5 text-center text-slate-500 font-normal">
                        {idx + 1}
                      </td>

                      {/* Player */}
                      <td className="px-3 py-2.5 whitespace-nowrap font-sans font-medium text-white">
                        <div className="flex items-center gap-2.5">
                          <PlayerAvatar
                            src={s.photoUrl}
                            alt={s.name}
                            size={28}
                            className="shrink-0"
                          />
                          {s.number != null && (
                            <span className="text-[11px] font-mono font-bold text-slate-500 w-5 text-right">
                              #{s.number}
                            </span>
                          )}
                          <Link
                            href={s.slug ? `/players/${s.slug}` : "#"}
                            className="font-bold hover:text-blue-400 transition-colors truncate"
                          >
                            {s.name}
                          </Link>
                          {s.rookie && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              R
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Position */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {s.position}
                        </span>
                      </td>

                      {/* GP */}
                      <td className="px-3 py-2.5 text-right text-slate-300">
                        {s.gp}
                      </td>

                      {/* Standard Overview Columns */}
                      {(activeTab === "OVERVIEW" || activeTab === "FORWARDS" || activeTab === "DEFENSE") && (
                        <>
                          <td className="px-3 py-2.5 text-right text-slate-200">
                            {s.goals}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-200">
                            {s.assists}
                          </td>
                          <td className="px-3 py-2.5 text-right font-black text-amber-400 text-sm">
                            {s.points}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span
                              className={`font-semibold ${
                                s.plusMinus > 0
                                  ? "text-emerald-400"
                                  : s.plusMinus < 0
                                  ? "text-rose-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-400">
                            {s.pim}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-300">
                            {s.shots}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-400">
                            {s.shtPct.toFixed(1)}%
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-400">
                            {s.hits}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-400">
                            {s.blocks}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-300 font-medium">
                            {fmtClock(s.toiPerGameMin)}
                          </td>
                        </>
                      )}

                      {/* Special Teams Columns */}
                      {activeTab === "SPECIAL_TEAMS" && (
                        <>
                          <td className="px-3 py-2.5 text-right font-black text-amber-400 text-sm">
                            {s.points}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-200">
                            {s.ppGoals}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-200">
                            {s.ppAssists}
                          </td>
                          <td className="px-3 py-2.5 text-right text-sky-300 font-bold">
                            {s.ppp}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-200">
                            {s.shGoals}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-200">
                            {s.shAssists}
                          </td>
                          <td className="px-3 py-2.5 text-right text-indigo-300 font-bold">
                            {s.shp}
                          </td>
                          <td className="px-3 py-2.5 text-right text-amber-400 font-bold">
                            {s.gwg}
                          </td>
                        </>
                      )}

                      {/* Advanced Analytics Columns */}
                      {activeTab === "ADVANCED" && (
                        <>
                          <td className="px-3 py-2.5 text-right font-black text-amber-400 text-sm">
                            {s.points}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-300">
                            {s.xg.toFixed(1)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span
                              className={`font-semibold ${
                                s.gax > 0
                                  ? "text-emerald-400"
                                  : s.gax < 0
                                  ? "text-rose-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {s.gax > 0 ? `+${s.gax.toFixed(1)}` : s.gax.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-300">
                            {s.p60.toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span
                              className={`font-semibold ${
                                s.plusMinus5v5 > 0
                                  ? "text-emerald-400"
                                  : s.plusMinus5v5 < 0
                                  ? "text-rose-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {s.plusMinus5v5 > 0 ? `+${s.plusMinus5v5}` : s.plusMinus5v5}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-400">
                            {s.shtPct.toFixed(1)}%
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-300">
                            {fmtClock(s.toiPerGameMin)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-400">
                            {Math.round(s.toiMin)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>

              {/* Totals Footer Row */}
              {filteredSkaters.length > 0 && activeTab === "OVERVIEW" && (
                <tfoot>
                  <tr className="bg-slate-950/90 font-black text-white text-xs border-t-2 border-slate-700">
                    <td className="px-3 py-3 text-center text-slate-500 font-normal">Σ</td>
                    <td className="px-3 py-3 font-sans font-bold uppercase tracking-wider text-slate-300">
                      {t.totals}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-500">—</td>
                    <td className="px-3 py-3 text-right">{skaterTotalsRow.gp}</td>
                    <td className="px-3 py-3 text-right text-slate-200">{skaterTotalsRow.g}</td>
                    <td className="px-3 py-3 text-right text-slate-200">{skaterTotalsRow.a}</td>
                    <td className="px-3 py-3 text-right text-amber-400 text-sm font-black">
                      {skaterTotalsRow.pts}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-400">—</td>
                    <td className="px-3 py-3 text-right text-slate-400">{skaterTotalsRow.pim}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{skaterTotalsRow.shots}</td>
                    <td className="px-3 py-3 text-right text-slate-400">
                      {skaterTotalsRow.shots ? ((skaterTotalsRow.g / skaterTotalsRow.shots) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="px-3 py-3 text-right text-slate-400">{skaterTotalsRow.hits}</td>
                    <td className="px-3 py-3 text-right text-slate-400">{skaterTotalsRow.blocks}</td>
                    <td className="px-3 py-3 text-right text-slate-500">—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* 4. GOALIE STATS TABLE */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <span>🧤</span>
            <span>{t.goaliesTitle}</span>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 normal-case">
              {filteredGoalies.length} {t.of} {goalies.length}
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400 select-none">
                <th className="px-3 py-3 text-center w-10">#</th>
                <th
                  className="px-3 py-3 text-left cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleGoalieSort("name")}
                >
                  <span>{t.player}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "name", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleGoalieSort("gp")}
                >
                  <span>{t.gp}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "gp", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors text-emerald-400"
                  onClick={() => handleGoalieSort("wins")}
                >
                  <span>{t.w}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "wins", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors text-rose-400"
                  onClick={() => handleGoalieSort("losses")}
                >
                  <span>{t.l}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "losses", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors text-amber-400"
                  onClick={() => handleGoalieSort("otl")}
                >
                  <span>{t.otl}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "otl", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors text-indigo-400"
                  onClick={() => handleGoalieSort("svPct")}
                >
                  <span>{t.svPct}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "svPct", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleGoalieSort("gaa")}
                >
                  <span>{t.gaa}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "gaa", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleGoalieSort("gsax")}
                >
                  <span>{t.gsax}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "gsax", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleGoalieSort("shutouts")}
                >
                  <span>{t.so}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "shutouts", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleGoalieSort("shotsAgainst")}
                >
                  <span>{t.sa}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "shotsAgainst", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleGoalieSort("saves")}
                >
                  <span>{t.sv}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "saves", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleGoalieSort("goalsAgainst")}
                >
                  <span>{t.ga}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "goalsAgainst", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleGoalieSort("steals")}
                >
                  <span>{t.steals}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "steals", goalieSort.dir)}</span>
                </th>
                <th
                  className="px-3 py-3 text-right cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleGoalieSort("toiMin")}
                >
                  <span>{t.min}</span>
                  <span className="text-blue-400">{arrow(goalieSort.key, "toiMin", goalieSort.dir)}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {filteredGoalies.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-slate-500 font-sans">
                    {t.noStats}
                  </td>
                </tr>
              ) : (
                filteredGoalies.map((g, idx) => (
                  <tr key={g.playerId} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="px-3 py-2.5 text-center text-slate-500 font-normal">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-sans font-medium text-white">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar
                          src={g.photoUrl}
                          alt={g.name}
                          size={28}
                          className="shrink-0"
                        />
                        <Link
                          href={g.slug ? `/players/${g.slug}` : "#"}
                          className="font-bold hover:text-blue-400 transition-colors truncate"
                        >
                          {g.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{g.gp}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-400 font-bold">{g.wins}</td>
                    <td className="px-3 py-2.5 text-right text-rose-400">{g.losses}</td>
                    <td className="px-3 py-2.5 text-right text-amber-400">{g.otl}</td>
                    <td className="px-3 py-2.5 text-right font-black text-indigo-400 text-sm">
                      {g.svPct.toFixed(3).replace(/^0/, "")}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-200">{g.gaa.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={`font-semibold ${
                          g.gsax > 0
                            ? "text-emerald-400"
                            : g.gsax < 0
                            ? "text-rose-400"
                            : "text-slate-400"
                        }`}
                      >
                        {g.gsax > 0 ? `+${g.gsax.toFixed(1)}` : g.gsax.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-400 font-bold">{g.shutouts}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{g.shotsAgainst}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">{g.saves}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">{g.goalsAgainst}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300 font-bold">{g.steals}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400">{Math.round(g.toiMin)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
