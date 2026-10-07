"use client";

import { useMemo, useState } from "react";
import { accruedCapSpace, money } from "@/lib/finance";
import { daysBetween, addDays, fmtLeagueDate } from "@/lib/calendar";
import { t, type Lang } from "@/lib/i18n";

type Team = { name: string; code: string | null; capHit: number; logoUrl: string | null };
type GameEntry = { oppCode: string | null; oppName: string; oppLogo: string | null; home: boolean };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthOf = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

const Out = ({
  label,
  value,
  big,
  tone,
  sub,
}: {
  label: string;
  value: string;
  big?: boolean;
  tone?: "good" | "bad" | "neutral";
  sub?: string;
}) => (
  <div className="flex items-start justify-between px-5 py-4 border-b border-slate-800/60 last:border-0 hover:bg-slate-800/20 transition-colors">
    <div className="min-w-0 pr-4">
      <div className="text-sm font-semibold text-slate-200">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{sub}</div>}
    </div>
    <span
      className={`tabular-nums shrink-0 font-mono ${
        big ? "text-2xl sm:text-3xl font-black" : "text-base sm:text-lg font-bold"
      } ${
        tone === "good"
          ? "text-emerald-400"
          : tone === "bad"
          ? "text-rose-400"
          : "text-slate-100"
      }`}
    >
      {value}
    </span>
  </div>
);

const PresetBtn = ({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
      active
        ? "bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/30"
        : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
    }`}
  >
    {label}
  </button>
);

export default function CapCalculator({
  ceiling,
  teams,
  seasonStart,
  seasonEnd,
  daysTotal,
  defaultDate,
  schedule,
  initialTeam,
  lang = "en",
}: {
  ceiling: number;
  teams: Team[];
  seasonStart: string;
  seasonEnd: string;
  daysTotal: number;
  defaultDate: string;
  schedule: Record<string, Record<string, GameEntry>>;
  initialTeam?: string;
  lang?: Lang;
}) {
  const isCs = lang === "cs";
  const locale = isCs ? "sk-SK" : lang === "de" ? "de-DE" : lang === "ru" ? "ru-RU" : "en-US";
  const weekdays = isCs
    ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
    : lang === "de"
    ? ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
    : lang === "ru"
    ? ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const preselected = initialTeam ? teams.find((t) => t.code === initialTeam) : undefined;
  const [capM, setCapM] = useState(preselected ? (preselected.capHit / 1_000_000).toFixed(2) : "81.60");
  const [date, setDate] = useState(defaultDate);
  const [teamCode, setTeamCode] = useState(preselected?.code ?? "");
  const [viewMonth, setViewMonth] = useState(() => monthOf(new Date(defaultDate)));

  const start = useMemo(() => new Date(seasonStart), [seasonStart]);
  const end = useMemo(() => new Date(seasonEnd), [seasonEnd]);
  const minMonth = monthOf(start).getTime();
  const maxMonth = monthOf(end).getTime();
  const games = teamCode ? schedule[teamCode] : undefined;
  const selectedTeam = teams.find((t) => t.code === teamCode);

  const capHit = Math.max(0, (parseFloat(capM) || 0) * 1_000_000);
  const played = Math.max(0, Math.min(daysTotal, daysBetween(start, new Date(date))));
  const annualSpace = ceiling - capHit;
  const { actual, remaining } = accruedCapSpace(annualSpace, played, daysTotal);
  const maxCapHit = capHit + actual;
  const pct = Math.max(0, Math.min(100, Math.round((played / daysTotal) * 100)));
  const multiplier = annualSpace > 0 && remaining > 0 ? actual / annualSpace : 1;

  // Estimate trade deadline date (roughly 40 days before season end)
  const deadlineDate = useMemo(() => addDays(end, -40), [end]);
  const deadlinePlayed = Math.max(0, Math.min(daysTotal, daysBetween(start, deadlineDate)));
  const deadlineSpace = accruedCapSpace(annualSpace, deadlinePlayed, daysTotal).actual;

  const goTo = (d: Date | string) => {
    const clamped = new Date(
      Math.max(start.getTime(), Math.min(end.getTime(), (typeof d === "string" ? new Date(d) : d).getTime()))
    );
    setDate(iso(clamped));
    setViewMonth(monthOf(clamped));
  };

  const prefillTeam = (code: string) => {
    setTeamCode(code);
    const t = teams.find((x) => x.code === code);
    if (t) setCapM((t.capHit / 1_000_000).toFixed(2));
  };

  // 6 full weeks (Sun-Sat) covering the visible month
  const weeks = useMemo(() => {
    const firstDow = viewMonth.getUTCDay();
    let cur = addDays(viewMonth, -firstDow);
    const out: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: Date[] = [];
      for (let d = 0; d < 7; d++) {
        row.push(cur);
        cur = addDays(cur, 1);
      }
      out.push(row);
    }
    return out;
  }, [viewMonth]);

  return (
    <div className="space-y-6">
      {/* 1. Executive Top Deck: Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Tile 1: League Ceiling */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
              {t(lang, "capCalc.ceilingNote")}
            </span>
            <span className="text-base">🏛️</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {money(ceiling)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isCs ? "Oficiálny platový strop" : "Official League Limit"}
            </p>
          </div>
        </div>

        {/* Tile 2: Current Space Today */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
              {t(lang, "capCalc.actualSpace")}
            </span>
            <span className="text-base">💼</span>
          </div>
          <div>
            <div
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                annualSpace >= 0 ? "text-slate-200" : "text-rose-400"
              }`}
            >
              {money(annualSpace)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {annualSpace >= 0
                ? isCs
                  ? "Priestor pod stropom dnes"
                  : "Unused below ceiling today"
                : isCs
                ? "Over the cap"
                : "Over the cap ceiling"}
            </p>
          </div>
        </div>

        {/* Tile 3: Maximum Deadline Acquisition */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between ring-1 ring-emerald-500/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-400">
              {t(lang, "capCalc.projectedSpace")}
            </span>
            <span className="text-base">⚡</span>
          </div>
          <div>
            <div
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                actual >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {money(actual)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isCs ? "Max. AAV ročný kontrakt posily" : "Max addition AAV on this day"}
            </p>
          </div>
        </div>

        {/* Tile 4: Multiplier Power */}
        <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
              {t(lang, "capCalc.multiplier")}
            </span>
            <span className="text-base">📈</span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight font-mono">
              ×{multiplier.toFixed(2)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {remaining} {t(lang, "capCalc.daysLeft")} ({pct}% {isCs ? "sezóny" : "season"})
            </p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid: Inputs/Results & Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Inputs & Calculation Results) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Box 1: Scenario Inputs */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md">
            <div className="px-5 py-3.5 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>⚙️</span> {t(lang, "capCalc.scenario")}
              </span>
              {selectedTeam && (
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                  {selectedTeam.logoUrl && (
                    <img src={selectedTeam.logoUrl} alt="" className="w-4 h-4 object-contain" />
                  )}
                  <span>{selectedTeam.code}</span>
                </div>
              )}
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Club Selector */}
              {teams.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    {t(lang, "capCalc.selectClub")}
                  </label>
                  <div className="relative">
                    <select
                      value={teamCode}
                      onChange={(e) => prefillTeam(e.target.value)}
                      className="w-full bg-slate-950/90 border border-slate-700/80 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-medium focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="">{t(lang, "capCalc.manualClub")}</option>
                      {teams.map((t) => (
                        <option key={t.code} value={t.code ?? ""}>
                          {t.name} ({t.code}) — {money(t.capHit)}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>
              )}

              {/* Cap Hit Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    {t(lang, "capCalc.projectedCapHit")}
                  </label>
                  <span className="text-xs text-slate-400 font-mono">
                    {money(capHit)}
                  </span>
                </div>
                <div className="flex items-center bg-slate-950/90 border border-slate-700/80 rounded-xl overflow-hidden focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500 transition-all">
                  <span className="pl-3.5 text-slate-500 font-black text-lg">$</span>
                  <input
                    type="number"
                    value={capM}
                    onChange={(e) => setCapM(e.target.value)}
                    step="0.05"
                    className="w-full bg-transparent px-2.5 py-2.5 text-xl font-black text-white tabular-nums outline-none"
                  />
                  <span className="pr-3.5 text-slate-400 font-bold text-sm">M</span>
                </div>
              </div>

              {/* Days Timeline & Presets */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-300">
                    {t(lang, "capCalc.daysIntoSeason")}
                  </span>
                  <span className="text-xs font-mono font-bold text-sky-400">
                    {t(lang, "capCalc.day")} {played} {t(lang, "capCalc.of")} {daysTotal} ({pct}%)
                  </span>
                </div>

                <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 via-blue-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 font-mono mb-3">
                  <span>{fmtLeagueDate(start)}</span>
                  <span>{fmtLeagueDate(end)}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <PresetBtn
                    label={t(lang, "capCalc.btnSeasonStart")}
                    onClick={() => goTo(start)}
                    active={date === iso(start)}
                  />
                  <PresetBtn
                    label={t(lang, "capCalc.btnToday")}
                    onClick={() => goTo(defaultDate)}
                    active={date === defaultDate}
                  />
                  <PresetBtn
                    label={t(lang, "capCalc.tradeDeadline")}
                    onClick={() => goTo(deadlineDate)}
                    active={date === iso(deadlineDate)}
                  />
                  <PresetBtn
                    label={t(lang, "capCalc.btnPlus30")}
                    onClick={() => goTo(addDays(new Date(date), 30))}
                  />
                  <PresetBtn
                    label={t(lang, "capCalc.btnSeasonEnd")}
                    onClick={() => goTo(end)}
                    active={date === iso(end)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Box 2: Results & Breakdown */}
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md">
            <div className="px-5 py-3.5 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>📊</span> {t(lang, "capCalc.results")}
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                {remaining} {t(lang, "capCalc.daysLeft")} • ×{multiplier.toFixed(2)}
              </span>
            </div>

            <div className="divide-y divide-slate-800/60">
              <Out
                label={t(lang, "capCalc.actualSpace")}
                value={money(annualSpace)}
                tone={annualSpace < 0 ? "bad" : "neutral"}
                sub={t(lang, "capCalc.actualSpaceSub")}
              />
              <Out
                label={t(lang, "capCalc.projectedSpace")}
                value={money(actual)}
                big
                tone={actual < 0 ? "bad" : "good"}
                sub={t(lang, "capCalc.projectedSpaceSub")}
              />
              <Out
                label={t(lang, "capCalc.projectedCapHitMax")}
                value={money(maxCapHit)}
                sub={t(lang, "capCalc.projectedCapHitSub")}
              />
            </div>

            {/* Explanatory Guide Box */}
            <div className="p-5 border-t border-slate-800 bg-slate-950/50 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                <span>💡</span> {t(lang, "capCalc.howItWorks")}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t(lang, "capCalc.explText")}
              </p>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <span className="text-amber-400 font-bold">▸ </span>
                {t(lang, "capCalc.explTip")}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Interactive Calendar & Match Schedule) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md">
            {/* Calendar Header with Month Navigation */}
            <div className="px-5 py-3.5 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth(monthOf(addDays(viewMonth, -1)))}
                disabled={monthOf(addDays(viewMonth, -1)).getTime() < minMonth}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 font-bold grid place-items-center transition-colors"
                title="Previous Month"
              >
                ‹
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white capitalize">
                  {viewMonth.toLocaleDateString(locale, {
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                {selectedTeam?.logoUrl && (
                  <img
                    src={selectedTeam.logoUrl}
                    alt=""
                    className="w-5 h-5 object-contain filter drop-shadow"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => setViewMonth(monthOf(addDays(viewMonth, 32)))}
                disabled={monthOf(addDays(viewMonth, 32)).getTime() > maxMonth}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 font-bold grid place-items-center transition-colors"
                title="Next Month"
              >
                ›
              </button>
            </div>

            <div className="p-4 sm:p-5">
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-2">
                {weekdays.map((w, i) => (
                  <div
                    key={i}
                    className="text-center text-[11px] font-bold text-slate-400 py-1 uppercase tracking-wider"
                  >
                    {w}
                  </div>
                ))}
              </div>

              {/* Day buttons matrix */}
              <div className="grid grid-cols-7 gap-1.5">
                {weeks.flat().map((d) => {
                  const dStr = iso(d);
                  const inMonth = d.getUTCMonth() === viewMonth.getUTCMonth();
                  const inSeason = dStr >= seasonStart && dStr <= seasonEnd;
                  const game = games?.[dStr];
                  const isSelected = dStr === date;
                  const isToday = dStr === defaultDate;

                  return (
                    <button
                      key={dStr}
                      type="button"
                      disabled={!inSeason}
                      onClick={() => goTo(d)}
                      title={
                        game
                          ? `${dStr} • ${game.home ? "vs" : "@"} ${game.oppName}`
                          : dStr
                      }
                      className={`aspect-square rounded-xl p-1 flex flex-col items-center justify-between text-xs transition-all relative ${
                        !inSeason
                          ? "opacity-20 cursor-not-allowed bg-slate-950/20"
                          : "cursor-pointer"
                      } ${
                        isSelected
                          ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white font-black ring-2 ring-sky-300 shadow-lg shadow-sky-500/30 scale-[1.04] z-10"
                          : isToday
                          ? "bg-slate-800/90 text-amber-300 font-bold border border-amber-500/50 hover:bg-slate-700"
                          : inMonth
                          ? "bg-slate-950/50 hover:bg-slate-800 text-slate-200 border border-slate-800/60"
                          : "bg-slate-950/20 hover:bg-slate-800/40 text-slate-600 border border-transparent"
                      }`}
                    >
                      {/* Day number */}
                      <span className="text-[11px] font-mono leading-none pt-0.5">
                        {d.getUTCDate()}
                      </span>

                      {/* Opponent Logo or Label */}
                      <div className="min-h-[18px] flex items-center justify-center">
                        {game ? (
                          game.oppLogo ? (
                            <img
                              src={game.oppLogo}
                              alt={game.oppCode ?? ""}
                              className="w-4 h-4 object-contain filter drop-shadow hover:scale-110 transition-transform"
                            />
                          ) : (
                            <span className="text-[9px] font-bold text-slate-300 uppercase leading-none">
                              {game.oppCode}
                            </span>
                          )
                        ) : null}
                      </div>

                      {/* Dot for selected / today */}
                      <div className="w-1 h-1 rounded-full">
                        {isToday && !isSelected && <div className="w-1 h-1 rounded-full bg-amber-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Calendar footer info */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex items-center gap-2">
                <span className="text-sky-400 font-bold">ℹ️</span>
                <span>
                  {teamCode ? (
                    <>
                      {t(lang, "capCalc.showingSchedule")}{" "}
                      <b className="text-white">{selectedTeam?.name}</b>.
                    </>
                  ) : (
                    t(lang, "capCalc.pickClubPrompt")
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
