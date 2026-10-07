"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import EventBadge from "@/components/EventBadge";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export type ScheduleGameItem = {
  id: number;
  league: string;
  season: string;
  status: string;
  gameDate: string | null;
  round: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  endedIn: string | null;
  eventKind: string | null;
  eventTitle: string | null;
  eventVenue: string | null;
  isPre: boolean;
  gameNumber?: number;
  homeTeam: {
    code: string | null;
    name: string;
    logoUrl: string | null;
  };
  awayTeam: {
    code: string | null;
    name: string;
    logoUrl: string | null;
  };
};

export type ScheduleTeamOption = {
  code: string;
  name: string;
  logoUrl: string | null;
};

interface ScheduleViewProps {
  games: ScheduleGameItem[];
  teams: ScheduleTeamOption[];
  league: "NHL" | "AHL";
  season: string;
  currentId?: number | null;
  initialMonth?: string | null;
  lang: Lang;
}

export default function ScheduleView({
  games,
  teams,
  league,
  season,
  currentId,
  initialMonth,
  lang,
}: ScheduleViewProps) {
  const isCs = lang === "cs";
  const locale = isCs ? "sk-SK" : lang === "de" ? "de-DE" : lang === "ru" ? "ru-RU" : "en-US";

  // Filter states: default to current active month if available, else ALL
  const [selectedTeam, setSelectedTeam] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UPCOMING" | "COMPLETED">("ALL");
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth ?? "ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Smooth auto-scroll to current day on page mount
  useEffect(() => {
    const el = document.getElementById("current-day");
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [selectedMonth]);

  // Total summary counts
  const totalGames = games.length;
  const completedGames = useMemo(() => games.filter((g) => g.status === "FINAL").length, [games]);
  const remainingGames = totalGames - completedGames;

  // Next game day date
  const nextGameDayStr = useMemo(() => {
    const upcoming = games.find((g) => g.status !== "FINAL" && g.gameDate);
    if (!upcoming || !upcoming.gameDate) return "—";
    const d = new Date(upcoming.gameDate);
    return d.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      weekday: "short",
      timeZone: "UTC",
    });
  }, [games, locale]);

  // Extract unique months from all games for tabs
  const monthOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    for (const g of games) {
      if (!g.gameDate) continue;
      const d = new Date(g.gameDate);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
      const cur = map.get(key) ?? { key, label, count: 0 };
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values());
  }, [games, locale]);

  // Apply filters
  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      // 1. Team filter
      if (selectedTeam !== "ALL") {
        if (g.homeTeam.code !== selectedTeam && g.awayTeam.code !== selectedTeam) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter === "UPCOMING" && g.status === "FINAL") return false;
      if (statusFilter === "COMPLETED" && g.status !== "FINAL") return false;

      // 3. Month filter
      if (selectedMonth !== "ALL" && g.gameDate) {
        const d = new Date(g.gameDate);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        if (key !== selectedMonth) return false;
      }

      // 4. Search query (team name or code)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const homeMatch = g.homeTeam.name.toLowerCase().includes(q) || (g.homeTeam.code?.toLowerCase().includes(q) ?? false);
        const awayMatch = g.awayTeam.name.toLowerCase().includes(q) || (g.awayTeam.code?.toLowerCase().includes(q) ?? false);
        if (!homeMatch && !awayMatch) return false;
      }

      return true;
    });
  }, [games, selectedTeam, statusFilter, selectedMonth, searchQuery]);

  // Group filtered games by month, then by day
  const groupedMonths = useMemo(() => {
    type DayGroup = {
      key: string;
      label: string;
      shortLabel: string;
      isTodayOrNext: boolean;
      games: ScheduleGameItem[];
    };
    type MonthGroup = {
      key: string;
      label: string;
      totalGames: number;
      days: DayGroup[];
    };

    const result: MonthGroup[] = [];

    for (const g of filteredGames) {
      const d = g.gameDate ? new Date(g.gameDate) : null;
      const mk = d ? `${d.getUTCFullYear()}-${d.getUTCMonth()}` : "tbd";
      const mLabel = d
        ? d.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" })
        : isCs
        ? "Unscheduled"
        : "Unscheduled";

      let m = result[result.length - 1];
      if (!m || m.key !== mk) {
        m = { key: mk, label: mLabel, totalGames: 0, days: [] };
        result.push(m);
      }
      m.totalGames++;

      const dk = d ? d.toISOString().slice(0, 10) : "tbd";
      const dLabel = d
        ? d.toLocaleDateString(locale, {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : isCs
        ? "Unscheduled"
        : "Unscheduled";
      const dShort = d
        ? d.toLocaleDateString(locale, {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })
        : "—";

      let day = m.days[m.days.length - 1];
      if (!day || day.key !== dk) {
        day = {
          key: dk,
          label: dLabel,
          shortLabel: dShort,
          isTodayOrNext: false,
          games: [],
        };
        m.days.push(day);
      }
      if (g.id === currentId) {
        day.isTodayOrNext = true;
      }
      day.games.push(g);
    }

    return result;
  }, [filteredGames, locale, isCs, currentId]);

  const scrollToCurrentDay = () => {
    // If the current game's month is hidden by the selected month filter, reset month to initial or ALL
    if (initialMonth && selectedMonth !== initialMonth && selectedMonth !== "ALL") {
      setSelectedMonth(initialMonth);
    }
    setTimeout(() => {
      const el = document.getElementById("current-day");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  return (
    <div className="space-y-6">
      {/* 1. Executive Top Deck: Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Tile 1: Total Games */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
              {t(lang, "schedule.statTotal")}
            </span>
            <span className="text-base">📅</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {totalGames}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {league} • {season}
            </p>
          </div>
        </div>

        {/* Tile 2: Completed Games */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
              {t(lang, "schedule.statPlayed")}
            </span>
            <span className="text-base">✅</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
              {completedGames}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0}% {isCs ? "sezóny" : "completed"}
            </p>
          </div>
        </div>

        {/* Tile 3: Remaining Games */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
              {t(lang, "schedule.statRemaining")}
            </span>
            <span className="text-base">⏳</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-sky-400 tracking-tight">
              {remainingGames}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isCs ? "zostáva odohrať" : "games left to play"}
            </p>
          </div>
        </div>

        {/* Tile 4: Next Game Day & Fast Jump */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
              {t(lang, "schedule.statNextDate")}
            </span>
            <span className="text-base">⚡</span>
          </div>
          <div>
            <div className="text-base sm:text-lg font-black text-amber-300 tracking-tight capitalize truncate">
              {nextGameDayStr}
            </div>
            <div className="mt-1">
              {currentId ? (
                <button
                  type="button"
                  onClick={scrollToCurrentDay}
                  className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-bold transition-colors"
                >
                  <span>🎯 {t(lang, "schedule.jumpToCurrent")}</span>
                  <span>↓</span>
                </button>
              ) : (
                <span className="text-xs text-slate-400">{isCs ? "Všetky zápasy odohrané" : "Season finished"}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Control Bar: Filters, Teams Dropdown, Months */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === "ALL"
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t(lang, "schedule.statusAll")} ({totalGames})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("UPCOMING")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === "UPCOMING"
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t(lang, "schedule.statusUpcoming")} ({remainingGames})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("COMPLETED")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === "COMPLETED"
                  ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t(lang, "schedule.statusCompleted")} ({completedGames})
            </button>
          </div>

          {/* Team Dropdown & Search Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Team select */}
            <div className="relative">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="bg-slate-950/90 border border-slate-800 text-slate-200 text-xs font-medium rounded-xl px-3 py-2 pr-8 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="ALL">🏒 {t(lang, "schedule.allTeams")}</option>
                {teams.map((tm) => (
                  <option key={tm.code} value={tm.code}>
                    {tm.code} — {tm.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>

            {/* Quick text filter */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(lang, "schedule.filterTeam")}
                className="bg-slate-950/90 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36 sm:w-48"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Jump Button (if currentId) */}
            {currentId && (
              <button
                type="button"
                onClick={scrollToCurrentDay}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold border border-slate-700/80 transition-colors flex items-center gap-1.5 shadow-sm"
                title={t(lang, "schedule.jumpToCurrent")}
              >
                <span>⚡</span>
                <span className="hidden sm:inline">{t(lang, "schedule.jumpToCurrent")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Month Pills Ribbon */}
        {monthOptions.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-800/60">
            <button
              type="button"
              onClick={() => setSelectedMonth("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                selectedMonth === "ALL"
                  ? "bg-slate-800 text-white font-bold border border-slate-700 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              {t(lang, "schedule.allMonths")}
            </button>
            {monthOptions.map((m) => {
              const isCurrentActive = initialMonth === m.key;
              const isSelected = selectedMonth === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedMonth(m.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 capitalize flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-blue-600 text-white font-bold shadow-sm"
                      : isCurrentActive
                      ? "text-sky-300 bg-sky-950/60 border border-sky-800/50 hover:bg-sky-900/60"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                  }`}
                >
                  {isCurrentActive && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />}
                  <span>{m.label} ({m.count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Empty State if Filter matches nothing */}
      {filteredGames.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center shadow-xl">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-2xl shadow-inner">
            📅
          </div>
          <h3 className="text-base font-bold text-white mb-1.5">
            {t(lang, "schedule.noGamesFound")}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isCs
              ? "Try adjusting the team filter, the selected month or the search query."
              : "Try adjusting the selected team, month tab or search filter."}
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                setSelectedTeam("ALL");
                setSelectedMonth("ALL");
                setStatusFilter("ALL");
                setSearchQuery("");
              }}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-colors"
            >
              {isCs ? "Resetovať filtre" : "Reset Filters"}
            </button>
          </div>
        </div>
      )}

      {/* 4. Grouped Schedule Calendar Accordion */}
      {groupedMonths.map((m) => (
        <div key={m.key} className="space-y-4">
          {/* Month Header Banner */}
          <div className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900/90 to-slate-900/70 border border-emerald-500/30 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-sm font-black text-emerald-300 uppercase tracking-wider capitalize">
                {m.label}
              </span>
            </div>
            <span className="text-xs text-emerald-400/80 font-mono font-bold bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              {m.totalGames} {m.totalGames === 1 ? t(lang, "schedule.oneGame") : t(lang, "schedule.gamesCount")}
            </span>
          </div>

          {/* Days in Month */}
          <div className="space-y-3">
            {m.days.map((d) => (
              <div
                key={d.key}
                id={d.isTodayOrNext ? "current-day" : undefined}
                className={`bg-slate-900/70 border rounded-2xl overflow-hidden shadow-lg transition-all ${
                  d.isTodayOrNext
                    ? "border-sky-500/60 ring-1 ring-sky-500/40 shadow-[0_0_20px_rgba(14,165,233,0.15)] scroll-mt-28"
                    : "border-slate-800/90"
                }`}
              >
                {/* Day Header Sub-banner */}
                <div
                  className={`px-4 py-2 border-b flex items-center justify-between ${
                    d.isTodayOrNext
                      ? "bg-gradient-to-r from-sky-950/70 to-slate-850 border-sky-800/50"
                      : "bg-slate-800/60 border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        d.isTodayOrNext ? "bg-amber-400 animate-pulse" : "bg-sky-400"
                      }`}
                    />
                    <span
                      className={`text-xs font-black tracking-wide capitalize ${
                        d.isTodayOrNext ? "text-amber-300 font-extrabold" : "text-slate-200"
                      }`}
                    >
                      {d.label}
                    </span>
                    {d.isTodayOrNext && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        ⚡ {t(lang, "schedule.jumpToCurrent")}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {d.games.length} {d.games.length === 1 ? t(lang, "schedule.oneGame") : t(lang, "schedule.gamesCount")}
                  </span>
                </div>

                {/* Game Matchup Rows */}
                <div className="divide-y divide-slate-800/60">
                  {d.games.map((g) => {
                    const isFinal = g.status === "FINAL";
                    const awayWin = isFinal && (g.awayGoals ?? 0) > (g.homeGoals ?? 0);
                    const homeWin = isFinal && (g.homeGoals ?? 0) > (g.awayGoals ?? 0);
                    const tag = g.endedIn && g.endedIn !== "REG" ? g.endedIn : "";

                    return (
                      <div
                        key={g.id}
                        className={`transition-colors hover:bg-slate-800/40 ${
                          g.isPre ? "bg-sky-950/15" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3">
                          {/* Left: Tag # or PRE */}
                          <div className="w-10 sm:w-12 shrink-0">
                            {g.isPre ? (
                              <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 inline-block text-center w-full">
                                {t(lang, "schedule.preseasonBadge")}
                              </span>
                            ) : (
                              <span className="text-xs font-mono font-bold text-slate-400">
                                #{g.gameNumber ?? g.id}
                              </span>
                            )}
                          </div>

                          {/* Date Short Label (Desktop only) */}
                          <div className="hidden md:block w-28 shrink-0 text-xs text-slate-400 font-medium capitalize truncate">
                            {d.shortLabel}
                          </div>

                          {/* Center: Matchup Duel Container */}
                          <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 min-w-0">
                            {/* Away Team (Visitor) */}
                            <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0 text-right">
                              <span
                                className={`truncate text-sm sm:text-base ${
                                  awayWin ? "font-black text-white" : "font-semibold text-slate-300"
                                }`}
                              >
                                <span className="hidden sm:inline">{g.awayTeam.name}</span>
                                <span className="sm:hidden">{g.awayTeam.code ?? g.awayTeam.name}</span>
                              </span>
                              {g.awayTeam.logoUrl && (
                                <img
                                  src={g.awayTeam.logoUrl}
                                  alt=""
                                  className="w-5 h-5 sm:w-7 sm:h-7 object-contain shrink-0 filter drop-shadow"
                                />
                              )}
                              {isFinal && g.awayGoals != null && (
                                <span
                                  className={`tabular-nums text-sm sm:text-base px-2 py-0.5 rounded-lg font-black shrink-0 ${
                                    awayWin
                                      ? "bg-white/15 text-white border border-white/20"
                                      : "text-slate-400 bg-slate-950/60"
                                  }`}
                                >
                                  {g.awayGoals}
                                </span>
                              )}
                            </div>

                            {/* Separator */}
                            <div className="text-xs font-black text-slate-500 px-1 text-center shrink-0">
                              {isFinal ? ":" : "@"}
                            </div>

                            {/* Home Team */}
                            <div className="flex items-center justify-start gap-2 sm:gap-3 min-w-0 text-left">
                              {isFinal && g.homeGoals != null && (
                                <span
                                  className={`tabular-nums text-sm sm:text-base px-2 py-0.5 rounded-lg font-black shrink-0 ${
                                    homeWin
                                      ? "bg-white/15 text-white border border-white/20"
                                      : "text-slate-400 bg-slate-950/60"
                                  }`}
                                >
                                  {g.homeGoals}
                                </span>
                              )}
                              {g.homeTeam.logoUrl && (
                                <img
                                  src={g.homeTeam.logoUrl}
                                  alt=""
                                  className="w-5 h-5 sm:w-7 sm:h-7 object-contain shrink-0 filter drop-shadow"
                                />
                              )}
                              <span
                                className={`truncate text-sm sm:text-base ${
                                  homeWin ? "font-black text-white" : "font-semibold text-slate-300"
                                }`}
                              >
                                <span className="hidden sm:inline">{g.homeTeam.name}</span>
                                <span className="sm:hidden">{g.homeTeam.code ?? g.homeTeam.name}</span>
                              </span>
                            </div>
                          </div>

                          {/* Right: Event Badge & Status */}
                          <div className="flex items-center justify-end gap-2 w-24 sm:w-36 shrink-0 text-right">
                            {g.eventKind && (
                              <EventBadge
                                kind={g.eventKind as any}
                                title={g.eventTitle}
                                venue={g.eventVenue}
                                size={26}
                                className="hidden sm:inline-block align-middle"
                              />
                            )}

                            {isFinal ? (
                              <Link
                                href={`/games/${g.id}`}
                                className="group/btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-blue-600 text-slate-200 hover:text-white text-[11px] font-bold border border-slate-700 hover:border-blue-500 transition-all shadow-sm"
                              >
                                <span>
                                  {t(lang, "schedule.final")}
                                  {tag ? `/${tag}` : ""}
                                </span>
                                <span className="text-[10px] text-slate-400 group-hover/btn:text-white transition-colors">
                                  →
                                </span>
                              </Link>
                            ) : (
                              <span className="inline-block text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-xl border border-sky-500/20 tracking-wider">
                                {t(lang, "schedule.scheduled")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
