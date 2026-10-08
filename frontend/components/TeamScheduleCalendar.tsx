"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import EventBadge from "@/components/EventBadge";

export type TeamScheduleGame = {
  id: number;
  season: string;
  league: string;
  round: number | null;
  gameDate: string | null;
  status: string; // "SCHEDULED" | "FINAL"
  homeTeamId: number;
  awayTeamId: number;
  homeGoals: number | null;
  awayGoals: number | null;
  winnerTeamId: number | null;
  endedIn: string | null;
  eventKind?: string | null;
  eventTitle?: string | null;
  eventVenue?: string | null;
  homeTeam: {
    code: string | null;
    name: string;
    slug?: string | null;
    logoUrl: string | null;
  };
  awayTeam: {
    code: string | null;
    name: string;
    slug?: string | null;
    logoUrl: string | null;
  };
};

export type TeamInfo = {
  id: number;
  name: string;
  code: string | null;
  slug: string;
  logoUrl: string | null;
};

const WEEKDAYS: Record<string, string[]> = {
  cs: ["Po", "Ut", "St", "Št", "Pia", "So", "Ne"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  ru: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
};

const MONTH_NAMES: Record<string, string[]> = {
  cs: [
    "Január",
    "Február",
    "Marec",
    "Apríl",
    "Máj",
    "Jún",
    "Júl",
    "August",
    "September",
    "Október",
    "November",
    "December",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  de: [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ],
  ru: [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ],
};

function TeamCrest({
  logo,
  code,
  size = 28,
}: {
  logo?: string | null;
  code?: string | null;
  size?: number;
}) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={code ?? "Team"}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain shrink-0 drop-shadow select-none"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.35)) }}
      className="rounded bg-slate-800 border border-slate-700/80 font-black flex items-center justify-center text-slate-300 shrink-0 font-mono select-none"
    >
      {code?.slice(0, 3) ?? "—"}
    </div>
  );
}

function ResultBadge({
  result,
  endedIn,
}: {
  result: "W" | "L" | "OTL";
  endedIn?: string | null;
}) {
  const isOt = endedIn && endedIn !== "REG";
  const cls =
    result === "W"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : result === "OTL"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : "bg-rose-500/20 text-rose-300 border-rose-500/40";

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider border font-mono ${cls}`}
    >
      <span>{result}</span>
      {isOt && <span className="text-[9px] opacity-80">({endedIn})</span>}
    </span>
  );
}

export default function TeamScheduleCalendar({
  team,
  games,
  preGames = [],
  leagueDateIso,
  lang,
}: {
  team: TeamInfo;
  games: TeamScheduleGame[];
  preGames?: TeamScheduleGame[];
  leagueDateIso?: string | null;
  lang: Lang;
}) {
  const isCs = lang === "cs";
  const langKey = isCs ? "cs" : lang === "de" ? "de" : lang === "ru" ? "ru" : "en";
  const weekdays = WEEKDAYS[langKey] ?? WEEKDAYS.en;
  const monthNames = MONTH_NAMES[langKey] ?? MONTH_NAMES.en;

  // View state: "CALENDAR" (grid) or "LIST" (table/cards)
  const [viewMode, setViewMode] = useState<"CALENDAR" | "LIST">("CALENDAR");
  // Location filter: "ALL" | "HOME" | "AWAY"
  const [locationFilter, setLocationFilter] = useState<"ALL" | "HOME" | "AWAY">("ALL");
  // Phase tab: "REGULAR" or "PRE"
  const [phaseTab, setPhaseTab] = useState<"REGULAR" | "PRE">("REGULAR");

  const currentPool = phaseTab === "PRE" ? preGames : games;

  // Extract distinct chronological months from currentPool
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const g of currentPool) {
      if (g.gameDate) {
        set.add(g.gameDate.slice(0, 7)); // "YYYY-MM"
      }
    }
    return Array.from(set).sort();
  }, [currentPool]);

  // Determine smart default month:
  // 1. Month containing next unplayed game
  // 2. Month matching leagueDateIso
  // 3. Last played game month
  // 4. First available month
  const defaultMonth = useMemo(() => {
    if (availableMonths.length === 0) return "";
    const firstUnplayed = currentPool.find((g) => g.status !== "FINAL" && g.gameDate);
    if (firstUnplayed && firstUnplayed.gameDate) {
      const ym = firstUnplayed.gameDate.slice(0, 7);
      if (availableMonths.includes(ym)) return ym;
    }
    if (leagueDateIso) {
      const ym = leagueDateIso.slice(0, 7);
      if (availableMonths.includes(ym)) return ym;
    }
    const lastPlayed = [...currentPool].reverse().find((g) => g.status === "FINAL" && g.gameDate);
    if (lastPlayed && lastPlayed.gameDate) {
      const ym = lastPlayed.gameDate.slice(0, 7);
      if (availableMonths.includes(ym)) return ym;
    }
    return availableMonths[0] ?? "";
  }, [availableMonths, currentPool, leagueDateIso]);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth || (availableMonths[0] ?? ""));

  // If available months change and selectedMonth isn't in it, reset
  const activeMonth = availableMonths.includes(selectedMonth) ? selectedMonth : (availableMonths[0] ?? "");

  const activeMonthIndex = availableMonths.indexOf(activeMonth);
  const prevMonth = activeMonthIndex > 0 ? availableMonths[activeMonthIndex - 1] : null;
  const nextMonth =
    activeMonthIndex >= 0 && activeMonthIndex < availableMonths.length - 1
      ? availableMonths[activeMonthIndex + 1]
      : null;

  // Parse Year & Month for activeMonth
  const [yearNum, monthNum] = activeMonth
    ? activeMonth.split("-").map(Number)
    : [2026, 10]; // monthNum: 1-12
  const monthName = monthNames[monthNum - 1] ?? "";

  // Games in selected month filtered by location
  const monthGames = useMemo(() => {
    return currentPool.filter((g) => {
      if (!g.gameDate) return false;
      if (g.gameDate.slice(0, 7) !== activeMonth) return false;
      const isHome = g.homeTeamId === team.id;
      if (locationFilter === "HOME" && !isHome) return false;
      if (locationFilter === "AWAY" && isHome) return false;
      return true;
    });
  }, [currentPool, activeMonth, locationFilter, team.id]);

  // Map games by exact UTC day: "YYYY-MM-DD"
  const gamesByDay = useMemo(() => {
    const map = new Map<string, TeamScheduleGame[]>();
    for (const g of monthGames) {
      if (!g.gameDate) continue;
      const dayKey = g.gameDate.slice(0, 10);
      const existing = map.get(dayKey) ?? [];
      existing.push(g);
      map.set(dayKey, existing);
    }
    return map;
  }, [monthGames]);

  // Overall Season KPIs for this team
  const seasonStats = useMemo(() => {
    const total = currentPool.length;
    const finalGames = currentPool.filter((g) => g.status === "FINAL");
    let wins = 0;
    let losses = 0;
    let otl = 0;
    let gf = 0;
    let ga = 0;

    for (const g of finalGames) {
      const isHome = g.homeTeamId === team.id;
      const tGoals = (isHome ? g.homeGoals : g.awayGoals) ?? 0;
      const oGoals = (isHome ? g.awayGoals : g.homeGoals) ?? 0;
      gf += tGoals;
      ga += oGoals;

      if (g.winnerTeamId === team.id) {
        wins++;
      } else if (g.endedIn && g.endedIn !== "REG") {
        otl++;
      } else {
        losses++;
      }
    }
    const points = wins * 2 + otl;
    return {
      total,
      played: finalGames.length,
      remaining: total - finalGames.length,
      wins,
      losses,
      otl,
      points,
      gf,
      ga,
    };
  }, [currentPool, team.id]);

  // Monthly KPIs for the selected month
  const monthStats = useMemo(() => {
    const total = monthGames.length;
    const finalGames = monthGames.filter((g) => g.status === "FINAL");
    let wins = 0;
    let losses = 0;
    let otl = 0;
    let gf = 0;
    let ga = 0;
    let homeWins = 0;
    let homeGames = 0;
    let awayWins = 0;
    let awayGames = 0;

    for (const g of finalGames) {
      const isHome = g.homeTeamId === team.id;
      const tGoals = (isHome ? g.homeGoals : g.awayGoals) ?? 0;
      const oGoals = (isHome ? g.awayGoals : g.homeGoals) ?? 0;
      gf += tGoals;
      ga += oGoals;

      if (isHome) homeGames++;
      else awayGames++;

      if (g.winnerTeamId === team.id) {
        wins++;
        if (isHome) homeWins++;
        else awayWins++;
      } else if (g.endedIn && g.endedIn !== "REG") {
        otl++;
      } else {
        losses++;
      }
    }
    const points = wins * 2 + otl;
    return {
      total,
      played: finalGames.length,
      wins,
      losses,
      otl,
      points,
      gf,
      ga,
      homeWins,
      homeGames,
      awayWins,
      awayGames,
    };
  }, [monthGames, team.id]);

  // Calendar Grid Cells generation
  const calendarCells = useMemo(() => {
    if (!activeMonth) return [];

    // UTC days count in this month
    const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
    // Weekday of 1st day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const firstDayUtc = new Date(Date.UTC(yearNum, monthNum - 1, 1)).getUTCDay();
    // European start col (0 = Monday, ..., 6 = Sunday)
    const startCol = (firstDayUtc + 6) % 7;

    const cells: {
      type: "padding" | "day";
      dayNum?: number;
      dateKey?: string;
      isToday?: boolean;
      games?: TeamScheduleGame[];
    }[] = [];

    // Leading padding cells
    for (let i = 0; i < startCol; i++) {
      cells.push({ type: "padding" });
    }

    // Days in month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayKey = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isToday = leagueDateIso ? dayKey === leagueDateIso.slice(0, 10) : false;
      const dayGameList = gamesByDay.get(dayKey) ?? [];

      cells.push({
        type: "day",
        dayNum: day,
        dateKey: dayKey,
        isToday,
        games: dayGameList,
      });
    }

    // Trailing padding cells to complete final row
    const remainder = cells.length % 7;
    if (remainder > 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        cells.push({ type: "padding" });
      }
    }

    return cells;
  }, [activeMonth, yearNum, monthNum, gamesByDay, leagueDateIso]);

  return (
    <div className="space-y-6">
      {/* 1. Top HUD KPI Deck */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Games */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <span>📅 {isCs ? "Zápasy sezóny" : "Season Schedule"}</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {seasonStats.total}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span className="text-emerald-400 font-semibold">{seasonStats.played} {isCs ? "odohraných" : "played"}</span>
              <span>·</span>
              <span className="text-sky-400">{seasonStats.remaining} {isCs ? "zostáva" : "left"}</span>
            </div>
          </div>
        </div>

        {/* Season Record */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <span>🏆 {isCs ? "Bilancia tímu" : "Season Record"}</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {seasonStats.wins}-{seasonStats.losses}-{seasonStats.otl}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              <strong className="text-amber-400 font-bold">{seasonStats.points} {isCs ? "bodov" : "pts"}</strong>
              <span className="text-slate-500 ml-1.5">
                ({seasonStats.gf}:{seasonStats.ga})
              </span>
            </div>
          </div>
        </div>

        {/* Monthly Record */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <span>📊 {isCs ? `Bilancia (${monthName})` : `${monthName} Form`}</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              {monthStats.wins}-{monthStats.losses}-{monthStats.otl}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              <strong className="text-white font-semibold">{monthStats.points} {isCs ? "b." : "pts"}</strong> {isCs ? "v tomto mesiaci" : "this month"}
            </div>
          </div>
        </div>

        {/* Monthly Games & Split */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <span>🏠 {isCs ? "Doma / Vonku" : "Home / Away"}</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-sky-400 font-mono">
              {monthStats.played} / {monthStats.total}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              <span>{monthStats.homeGames} {isCs ? "doma" : "home"} · {monthStats.awayGames} {isCs ? "vonku" : "away"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls & Month Switcher Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        {/* Top Control Bar: Phase Tab, View Mode Toggle, Location Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          {/* Phase selector (Regular Season vs Pre-season) */}
          <div className="flex items-center gap-2">
            {preGames.length > 0 && (
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPhaseTab("REGULAR")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    phaseTab === "REGULAR"
                      ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {isCs ? "Základná časť" : "Regular Season"} ({games.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPhaseTab("PRE")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    phaseTab === "PRE"
                      ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {isCs ? "Príprava" : "Pre-season"} ({preGames.length})
                </button>
              </div>
            )}

            {/* View Mode Switcher */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("CALENDAR")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === "CALENDAR"
                    ? "bg-slate-800 text-white font-bold border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>📅</span>
                <span>{isCs ? "Kalendár" : "Calendar"}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("LIST")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === "LIST"
                    ? "bg-slate-800 text-white font-bold border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>📋</span>
                <span>{isCs ? "Zoznam" : "List"}</span>
              </button>
            </div>
          </div>

          {/* Location filter (All / Home / Away) */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold self-start md:self-auto">
            <button
              type="button"
              onClick={() => setLocationFilter("ALL")}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                locationFilter === "ALL"
                  ? "bg-blue-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {isCs ? "Všetky" : "All"}
            </button>
            <button
              type="button"
              onClick={() => setLocationFilter("HOME")}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                locationFilter === "HOME"
                  ? "bg-blue-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {isCs ? "Doma" : "Home"}
            </button>
            <button
              type="button"
              onClick={() => setLocationFilter("AWAY")}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                locationFilter === "AWAY"
                  ? "bg-blue-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {isCs ? "Vonku" : "Away"}
            </button>
          </div>
        </div>

        {/* Month Navigator Header (Arrows + Active Month Label) */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={!prevMonth}
            onClick={() => prevMonth && setSelectedMonth(prevMonth)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              prevMonth
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 shadow-sm"
                : "bg-slate-900 text-slate-600 border border-transparent cursor-not-allowed"
            }`}
          >
            <span>←</span>
            <span className="hidden sm:inline">{isCs ? "Predchádzajúci mesiac" : "Previous Month"}</span>
          </button>

          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <span>{monthName}</span>
              <span className="text-slate-400 font-mono">{yearNum}</span>
            </h2>
            <div className="text-xs text-slate-400 mt-0.5">
              {monthGames.length} {isCs ? "zápasov" : "games"} ·{" "}
              <span className="text-emerald-400 font-bold font-mono">
                {monthStats.wins}-{monthStats.losses}-{monthStats.otl}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={!nextMonth}
            onClick={() => nextMonth && setSelectedMonth(nextMonth)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              nextMonth
                ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 shadow-sm"
                : "bg-slate-900 text-slate-600 border border-transparent cursor-not-allowed"
            }`}
          >
            <span className="hidden sm:inline">{isCs ? "Nasledujúci mesiac" : "Next Month"}</span>
            <span>→</span>
          </button>
        </div>

        {/* Horizontal Month Ribbon Tabs */}
        {availableMonths.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-800/80">
            {availableMonths.map((mKey) => {
              const [y, m] = mKey.split("-").map(Number);
              const mLabel = monthNames[m - 1] ?? mKey;
              const isSelected = activeMonth === mKey;
              const count = currentPool.filter((g) => g.gameDate?.slice(0, 7) === mKey).length;

              return (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => setSelectedMonth(mKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                      : "bg-slate-800/50 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <span>{mLabel}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isSelected ? "bg-blue-700 text-white" : "bg-slate-700 text-slate-300"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. CALENDAR GRID VIEW */}
      {viewMode === "CALENDAR" && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-2 sm:p-4 shadow-xl overflow-hidden">
          {/* Weekday Columns Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
            {weekdays.map((wd, i) => (
              <div
                key={wd}
                className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg ${
                  i >= 5 ? "text-amber-400/80 bg-amber-950/10" : "text-slate-400 bg-slate-900/50"
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarCells.map((cell, idx) => {
              if (cell.type === "padding") {
                return (
                  <div
                    key={`pad-${idx}`}
                    className="min-h-[90px] sm:min-h-[120px] rounded-xl bg-slate-950/20 border border-slate-900/40 select-none opacity-40"
                  />
                );
              }

              const hasGames = cell.games && cell.games.length > 0;

              return (
                <div
                  key={cell.dateKey ?? `day-${cell.dayNum}`}
                  className={`min-h-[90px] sm:min-h-[120px] rounded-xl p-1.5 sm:p-2 flex flex-col justify-between transition-all relative ${
                    cell.isToday
                      ? "bg-slate-900/90 border-2 border-sky-400/60 shadow-lg shadow-sky-950/50"
                      : hasGames
                      ? "bg-slate-900/80 border border-slate-800 hover:border-slate-700"
                      : "bg-slate-950/40 border border-slate-900/80"
                  }`}
                >
                  {/* Top Bar inside cell: Day number + Today badge */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono ${
                        cell.isToday
                          ? "text-sky-300 font-black"
                          : hasGames
                          ? "text-white"
                          : "text-slate-600"
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {cell.isToday && (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {isCs ? "Dnes" : "Today"}
                      </span>
                    )}
                  </div>

                  {/* Games inside this day */}
                  {hasGames ? (
                    <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                      {cell.games!.map((g) => {
                        const isHome = g.homeTeamId === team.id;
                        const opp = isHome ? g.awayTeam : g.homeTeam;
                        const isFinal = g.status === "FINAL";
                        const teamGoals = isHome ? g.homeGoals : g.awayGoals;
                        const oppGoals = isHome ? g.awayGoals : g.homeGoals;
                        const won = g.winnerTeamId === team.id;
                        const result: "W" | "L" | "OTL" = won
                          ? "W"
                          : g.endedIn && g.endedIn !== "REG"
                          ? "OTL"
                          : "L";

                        const cardBorder = isFinal
                          ? result === "W"
                            ? "border-emerald-500/40 hover:border-emerald-400 bg-emerald-950/10"
                            : result === "OTL"
                            ? "border-amber-500/40 hover:border-amber-400 bg-amber-950/10"
                            : "border-rose-500/40 hover:border-rose-400 bg-rose-950/10"
                          : "border-slate-700/60 hover:border-sky-500/60 bg-slate-800/40";

                        const inner = (
                          <div
                            className={`rounded-lg p-1.5 sm:p-2 border transition-all text-left flex flex-col justify-between group ${cardBorder}`}
                          >
                            {/* Opponent row */}
                            <div className="flex items-center gap-1.5 mb-1">
                              <TeamCrest logo={opp.logoUrl} code={opp.code} size={22} />
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] sm:text-xs font-black text-white truncate flex items-center gap-1">
                                  <span className="text-slate-400 font-mono text-[10px]">
                                    {isHome ? "vs" : "@"}
                                  </span>
                                  <span>{opp.code}</span>
                                </div>
                              </div>
                              <span
                                className={`text-[9px] font-bold px-1 py-0.2 rounded uppercase ${
                                  isHome
                                    ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {isHome ? (isCs ? "DOM" : "HM") : (isCs ? "VON" : "AW")}
                              </span>
                            </div>

                            {/* Score / Status row */}
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/60">
                              {isFinal ? (
                                <>
                                  <span className="tabular-nums font-black font-mono text-xs sm:text-sm text-white group-hover:text-blue-300 transition-colors">
                                    {teamGoals}:{oppGoals}
                                  </span>
                                  <ResultBadge result={result} endedIn={g.endedIn} />
                                </>
                              ) : (
                                <span className="text-[10px] font-semibold text-sky-400/90 truncate">
                                  {isCs ? "Plán" : "Sched"}
                                </span>
                              )}
                            </div>
                          </div>
                        );

                        return isFinal ? (
                          <Link
                            key={g.id}
                            href={`/games/${g.id}`}
                            className="block"
                            title={`${team.name} ${teamGoals}:${oppGoals} ${opp.name} — Box Score`}
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div key={g.id}>{inner}</div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. LIST / AGENDA VIEW */}
      {viewMode === "LIST" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-bold">
                  <th className="px-4 py-3 text-left w-32">
                    {isCs ? "Dátum" : "Date"}
                  </th>
                  <th className="px-4 py-3 text-left">
                    {isCs ? "Súper" : "Opponent"}
                  </th>
                  <th className="px-4 py-3 text-center w-28">
                    {isCs ? "Miesto" : "Venue"}
                  </th>
                  <th className="px-4 py-3 text-right w-36">
                    {isCs ? "Výsledok / Stav" : "Result / Status"}
                  </th>
                  <th className="px-4 py-3 text-right w-24">
                    {isCs ? "Zápis" : "Link"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {monthGames.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      {isCs ? "Žiadne zápasy v tomto mesiaci." : "No games scheduled for this month."}
                    </td>
                  </tr>
                ) : (
                  monthGames.map((g) => {
                    const isHome = g.homeTeamId === team.id;
                    const opp = isHome ? g.awayTeam : g.homeTeam;
                    const isFinal = g.status === "FINAL";
                    const teamGoals = isHome ? g.homeGoals : g.awayGoals;
                    const oppGoals = isHome ? g.awayGoals : g.homeGoals;
                    const won = g.winnerTeamId === team.id;
                    const result: "W" | "L" | "OTL" = won
                      ? "W"
                      : g.endedIn && g.endedIn !== "REG"
                      ? "OTL"
                      : "L";

                    const dateObj = g.gameDate ? new Date(g.gameDate) : null;
                    const dateFormatted = dateObj
                      ? dateObj.toLocaleDateString(isCs ? "sk-SK" : "en-US", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          timeZone: "UTC",
                        })
                      : "—";

                    return (
                      <tr
                        key={g.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Date */}
                        <td className="px-4 py-3 text-slate-300 font-medium whitespace-nowrap">
                          {dateFormatted}
                        </td>

                        {/* Opponent */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-slate-500 w-5 text-xs font-bold">
                              {isHome ? "vs" : "@"}
                            </span>
                            <TeamCrest logo={opp.logoUrl} code={opp.code} size={24} />
                            <div>
                              <span className="font-bold text-white mr-1.5">{opp.code}</span>
                              <span className="text-xs text-slate-400 hidden sm:inline">
                                ({opp.name})
                              </span>
                            </div>
                            {g.eventTitle && (
                              <EventBadge kind={g.eventKind} title={g.eventTitle} venue={g.eventVenue} size={20} />
                            )}
                          </div>
                        </td>

                        {/* Venue (Home / Away) */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              isHome
                                ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {isHome ? (isCs ? "DOMA" : "HOME") : (isCs ? "VONKU" : "AWAY")}
                          </span>
                        </td>

                        {/* Result / Status */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isFinal ? (
                            <div className="inline-flex items-center gap-2">
                              <span className="tabular-nums font-black font-mono text-white text-base">
                                {teamGoals} : {oppGoals}
                              </span>
                              <ResultBadge result={result} endedIn={g.endedIn} />
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-sky-400/90 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                              {isCs ? "Naplánované" : "Scheduled"}
                            </span>
                          )}
                        </td>

                        {/* Link to Box Score */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isFinal ? (
                            <Link
                              href={`/games/${g.id}`}
                              className="text-xs font-bold text-blue-400 hover:text-blue-300 hover:underline"
                            >
                              {isCs ? "Zápis →" : "Box score →"}
                            </Link>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
