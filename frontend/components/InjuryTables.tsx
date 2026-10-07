"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CurrentInjury, SeasonInjury } from "@/lib/injuries-server";
import { money } from "@/lib/finance";
import PlayerAvatar from "@/components/playerAvatar";

const SEV_CONFIG: Record<string, { cls: string; badgeCls: string; labelEn: string; labelCs: string }> = {
  "Day-to-Day": {
    cls: "text-slate-300",
    badgeCls: "bg-slate-800 text-slate-300 border-slate-700",
    labelEn: "Day-to-Day",
    labelCs: "Zo dňa na deň",
  },
  "Week-to-Week": {
    cls: "text-amber-400",
    badgeCls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    labelEn: "Week-to-Week",
    labelCs: "Týždeň až týždne",
  },
  "Multi-week": {
    cls: "text-orange-400",
    badgeCls: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    labelEn: "Multi-week",
    labelCs: "Viacero týždňov",
  },
  "Long-term": {
    cls: "text-rose-400",
    badgeCls: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    labelEn: "Long-term",
    labelCs: "Dlhodobo",
  },
  "Season-ending": {
    cls: "text-red-400 font-bold",
    badgeCls: "bg-red-600/25 text-red-300 border-red-500/40 font-bold",
    labelEn: "Season-ending",
    labelCs: "Koniec sezóny",
  },
};

const SEV_TAG: Record<string, string> = { "Multi-week": "IR", "Long-term": "LTIR", "Season-ending": "LTIR" };

const MECH_ICON: Record<string, string> = {
  Hit: "💥",
  "Blocked shot": "🛡️",
  Fight: "🥊",
  Collision: "🚑",
  Fatigue: "🔥",
  "Non-contact": "🩹",
};

const returnEta = (d: number, isCs: boolean) => {
  if (d <= 6) return `${d}d`;
  if (d < 14) return isCs ? "~1 týž." : "~1 wk";
  if (d < 45) return isCs ? `~${Math.round(d / 7)} týž.` : `~${Math.round(d / 7)} wks`;
  if (d < 120) return isCs ? `~${Math.round(d / 30)} mes.` : `~${Math.round(d / 30)} mo`;
  return isCs ? "Koniec sezóny" : "Season";
};

const fmtDate = (d: Date | string | null, isCs: boolean) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString(isCs ? "sk-SK" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

const isForward = (pos: string) => ["C", "LW", "RW", "W", "F"].includes(pos.toUpperCase());
const isDefense = (pos: string) => ["D", "LD", "RD"].includes(pos.toUpperCase());
const isGoaliePos = (pos: string) => ["G"].includes(pos.toUpperCase());

export function CurrentInjuryTable({ rows, showTeam = true, lang = "en" }: { rows: CurrentInjury[]; showTeam?: boolean; lang?: string }) {
  const isCs = lang === "cs";

  const [q, setQ] = useState("");
  const [posFilter, setPosFilter] = useState<"ALL" | "F" | "D" | "G">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "LTIR" | "IR" | "DTD">("ALL");

  const reliefTotal = useMemo(() => rows.reduce((s, p) => s + (p.onLtir ? p.capHit : 0), 0), [rows]);

  // Metric computations
  const metrics = useMemo(() => {
    const totalOut = rows.length;
    const ltirCount = rows.filter((r) => r.onLtir).length;
    const irCount = rows.filter((r) => !r.onLtir && (r.severity === "Multi-week" || r.severity === "Week-to-Week")).length;
    const avgDays = totalOut > 0 ? Math.round(rows.reduce((s, r) => s + r.daysLeft, 0) / totalOut) : 0;

    // Club impact
    const teamCounts = new Map<string, { count: number; code: string; logo: string | null; name: string }>();
    for (const r of rows) {
      if (!r.teamCode) continue;
      const cur = teamCounts.get(r.teamCode) || { count: 0, code: r.teamCode, logo: r.teamLogo, name: r.teamName || r.teamCode };
      cur.count++;
      teamCounts.set(r.teamCode, cur);
    }
    const hardestTeam = [...teamCounts.values()].sort((a, b) => b.count - a.count)[0] || null;

    return { totalOut, ltirCount, irCount, avgDays, hardestTeam };
  }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (query) {
        const matchName = p.name.toLowerCase().includes(query);
        const matchTeam = (p.teamName?.toLowerCase().includes(query) ?? false) || (p.teamCode?.toLowerCase().includes(query) ?? false);
        const matchDesc = p.desc.toLowerCase().includes(query);
        if (!matchName && !matchTeam && !matchDesc) return false;
      }
      if (posFilter === "F" && !isForward(p.position)) return false;
      if (posFilter === "D" && !isDefense(p.position)) return false;
      if (posFilter === "G" && !isGoaliePos(p.position)) return false;

      const tag = p.onLtir ? "LTIR" : SEV_TAG[p.severity] || "DTD";
      if (statusFilter === "LTIR" && tag !== "LTIR") return false;
      if (statusFilter === "IR" && tag !== "IR") return false;
      if (statusFilter === "DTD" && tag !== "DTD") return false;

      return true;
    });
  }, [rows, q, posFilter, statusFilter]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center backdrop-blur">
        <span className="text-4xl mb-3 block">🎉</span>
        <p className="text-emerald-400 text-lg font-bold">
          {isCs ? "Žiadne aktuálne zranenia v lige. Všetci hráči sú fit!" : "No current injuries in the league. Clean bill of health!"}
        </p>
        <p className="text-slate-500 text-xs mt-1">
          {isCs ? "Všetky kluby majú k dispozícii kompletné kádre." : "All clubs are operating at full health."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top HUD KPI Deck */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Aktuálne zranení" : "Currently Injured"}
          </div>
          <div className="text-2xl font-black text-rose-400 mt-1 flex items-baseline gap-2">
            {metrics.totalOut}
            <span className="text-xs font-normal text-slate-500">
              {isCs ? "hráčov" : "players"}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {metrics.ltirCount} LTIR · {metrics.irCount} IR
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "LTIR Úľava na strope" : "LTIR Cap Relief"}
          </div>
          <div className="text-2xl font-black text-sky-400 mt-1">
            +{money(reliefTotal)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isCs ? "Aktívny fond náhradníkov" : "Emergency replacement pool"}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Priemerná absencia" : "Avg. Recovery Time"}
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">
            ~{metrics.avgDays} <span className="text-sm font-medium text-slate-400">{isCs ? "dní" : "days"}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isCs ? "Doba do návratu" : "Across all injured players"}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Najviac zasiahnutý" : "Hardest Hit Club"}
          </div>
          {metrics.hardestTeam ? (
            <div className="flex items-center gap-2 mt-1">
              {metrics.hardestTeam.logo && (
                <img src={metrics.hardestTeam.logo} alt="" className="w-7 h-7 object-contain" />
              )}
              <div>
                <span className="text-lg font-black text-white">{metrics.hardestTeam.code}</span>
                <span className="text-xs text-rose-400 font-semibold ml-2">
                  {metrics.hardestTeam.count} {isCs ? "maródov" : "out"}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-lg font-bold text-slate-400 mt-1">—</div>
          )}
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            {metrics.hardestTeam?.name ?? "—"}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 backdrop-blur">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isCs ? "Hľadať hráča, zranenie alebo tím..." : "Search player, injury or team..."}
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
          {/* Position Pills */}
          <div className="inline-flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
            {(["ALL", "F", "D", "G"] as const).map((pos) => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  posFilter === pos ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                {pos === "ALL" ? (isCs ? "Všetky" : "All") : pos}
              </button>
            ))}
          </div>

          {/* Status Pills */}
          <div className="inline-flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
            {(["ALL", "LTIR", "IR", "DTD"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  statusFilter === st
                    ? st === "LTIR"
                      ? "bg-sky-600 text-white shadow-sm"
                      : st === "IR"
                      ? "bg-orange-600 text-white shadow-sm"
                      : "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {st === "ALL" ? (isCs ? "Všetky stavy" : "All Status") : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 shadow-md">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/40 border-b border-slate-800">
              <th className="text-left px-4 py-3">{isCs ? "Hráč" : "Player"}</th>
              {showTeam && <th className="text-left px-3 py-3">{isCs ? "Tím" : "Team"}</th>}
              <th className="text-center px-2 py-3">{isCs ? "Poz" : "Pos"}</th>
              <th className="text-left px-3 py-3">{isCs ? "Zranenie" : "Injury"}</th>
              <th className="text-left px-3 py-3">{isCs ? "Závažnosť" : "Severity"}</th>
              <th className="text-left px-3 py-3">{isCs ? "Status" : "Status"}</th>
              <th className="text-left px-3 py-3">{isCs ? "Zranený od" : "Injured"}</th>
              <th className="text-right px-4 py-3">{isCs ? "Návrat" : "Est. Return"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((p) => {
              const tag = p.onLtir ? "LTIR" : SEV_TAG[p.severity];
              const sev = SEV_CONFIG[p.severity] || {
                cls: "text-slate-400",
                badgeCls: "bg-slate-800 text-slate-400 border-slate-700",
                labelEn: p.severity,
                labelCs: p.severity,
              };

              return (
                <tr key={p.playerId} className="hover:bg-slate-800/40 transition-colors">
                  {/* Player Name & Avatar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PlayerAvatar src={null} alt={p.name} size={32} />
                      <div>
                        <Link
                          href={`/players/${p.slug ?? p.playerId}`}
                          className="font-bold text-white hover:text-blue-400 transition-colors"
                        >
                          {p.name}
                        </Link>
                        {p.capHit > 0 && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            {money(p.capHit)} cap
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Team */}
                  {showTeam && (
                    <td className="px-3 py-3">
                      {p.teamSlug ? (
                        <Link
                          href={`/teams/${p.teamSlug}`}
                          className="inline-flex items-center gap-2 text-slate-300 hover:text-blue-400 transition-colors"
                        >
                          {p.teamLogo && (
                            <img src={p.teamLogo} alt="" className="w-5 h-5 object-contain shrink-0" />
                          )}
                          <span className="font-semibold text-xs tracking-wider">{p.teamCode ?? p.teamName}</span>
                        </Link>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  )}

                  {/* Position */}
                  <td className="px-2 py-3 text-center">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                      {p.position}
                    </span>
                  </td>

                  {/* Injury Description */}
                  <td className="px-3 py-3">
                    <span className="text-slate-200 font-medium text-xs">{p.desc}</span>
                  </td>

                  {/* Severity */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${sev.badgeCls}`}
                    >
                      {isCs ? sev.labelCs : sev.labelEn}
                    </span>
                  </td>

                  {/* Status (LTIR / IR / Active) */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    {tag === "LTIR" ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm"
                        title={
                          isCs
                            ? `Long-Term Injured Reserve — uvoľňuje ${money(p.capHit)} na platovom strope`
                            : `Long-Term Injured Reserve — frees ${money(p.capHit)} in cap relief`
                        }
                      >
                        LTIR {p.onLtir && <span className="text-sky-200 font-mono">+{money(p.capHit)}</span>}
                      </span>
                    ) : tag === "IR" ? (
                      <span
                        className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/40"
                        title={
                          isCs
                            ? "Injured Reserve — absencia niekoľko týždňov (bez finančnej úľavy)"
                            : "Injured Reserve — out multiple weeks (no cap relief)"
                        }
                      >
                        IR
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">
                        {isCs ? "Aktívna súpiska" : "Active Roster"}
                      </span>
                    )}
                  </td>

                  {/* Date Injured */}
                  <td className="px-3 py-3 text-slate-400 text-xs tabular-nums whitespace-nowrap">
                    {fmtDate(p.injuredAt, isCs)}
                  </td>

                  {/* Return ETA */}
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    <span
                      className="inline-block px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500/10 text-amber-300 border border-amber-500/25"
                      title={`${p.daysLeft} ${isCs ? "dní do návratu" : "days left"}`}
                    >
                      {returnEta(p.daysLeft, isCs)}
                    </span>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={showTeam ? 8 : 7} className="px-4 py-8 text-center text-slate-500">
                  {isCs ? "Filtrom nevyhovujú žiadne zranenia." : "No injuries match your current filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {reliefTotal > 0 && (
          <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-sky-400 font-bold">
                {isCs ? "Celková úľava LTIR:" : "Total LTIR Cap Relief:"} +{money(reliefTotal)}
              </span>
              <span className="hidden sm:inline text-slate-500">
                — {isCs ? "Suma, o ktorú kluby môžu prekročiť platový strop pre núdzové povolanie náhradníkov." : "Amount clubs can exceed the ceiling to call up injury replacements."}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              {filtered.length} / {rows.length} {isCs ? "zobrazených" : "shown"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SeasonInjuryTable({ rows, showTeam = true, lang = "en" }: { rows: SeasonInjury[]; showTeam?: boolean; lang?: string }) {
  const isCs = lang === "cs";

  const [q, setQ] = useState("");

  const metrics = useMemo(() => {
    const totalInjuries = rows.length;
    const totalDays = rows.reduce((s, r) => s + r.days, 0);

    // mechanism breakdown
    const mechCounts = new Map<string, number>();
    for (const r of rows) {
      mechCounts.set(r.mechanism, (mechCounts.get(r.mechanism) || 0) + 1);
    }
    const topMech = [...mechCounts.entries()].sort((a, b) => b[1] - a[1])[0] || ["—", 0];

    return { totalInjuries, totalDays, topMech };
  }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((r) => {
      const matchName = r.name.toLowerCase().includes(query);
      const matchTeam = (r.teamName?.toLowerCase().includes(query) ?? false) || (r.teamCode?.toLowerCase().includes(query) ?? false);
      const matchPart = r.part.toLowerCase().includes(query);
      const matchMech = r.mechanism.toLowerCase().includes(query);
      return matchName || matchTeam || matchPart || matchMech;
    });
  }, [rows, q]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center backdrop-blur">
        <p className="text-slate-500 text-sm">
          {isCs ? "V tejto sezóne zatiaľ neboli zaznamenané žiadne zranenia." : "No injuries recorded this season yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top HUD KPI Deck */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Celkovo zranení v sezóne" : "Total Season Incidents"}
          </div>
          <div className="text-2xl font-black text-rose-400 mt-1">
            {metrics.totalInjuries}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isCs ? "Zaznamenaných v zápasoch" : "Recorded in sim match events"}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Vymeškané dni spolu" : "Man-Days Lost"}
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {metrics.totalDays.toLocaleString()} <span className="text-sm font-medium text-slate-400">{isCs ? "dní" : "days"}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isCs ? "Kumulatívna absencia" : "Cumulative recovery days"}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Najčastejšia príčina" : "Top Injury Cause"}
          </div>
          <div className="text-2xl font-black text-sky-400 mt-1 flex items-center gap-1.5">
            <span>{MECH_ICON[metrics.topMech[0]] ?? "🩹"}</span>
            <span>{metrics.topMech[0]}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {metrics.topMech[1]} {isCs ? "prípadov" : "occurrences"}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 backdrop-blur">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={isCs ? "Hľadať v archíve zranení..." : "Search injury archive..."}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <span className="text-xs text-slate-500">
          {filtered.length} {isCs ? "záznamov" : "incidents"}
        </span>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 shadow-md">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/40 border-b border-slate-800">
              <th className="text-left px-4 py-3">{isCs ? "Hráč" : "Player"}</th>
              {showTeam && <th className="text-left px-3 py-3">{isCs ? "Tím" : "Team"}</th>}
              <th className="text-left px-3 py-3">{isCs ? "Časť tela" : "Injury"}</th>
              <th className="text-left px-3 py-3">{isCs ? "Príčina" : "Cause"}</th>
              <th className="text-left px-3 py-3">{isCs ? "Závažnosť" : "Severity"}</th>
              <th className="text-right px-3 py-3">{isCs ? "Dni" : "Days"}</th>
              <th className="text-left px-3 py-3">{isCs ? "Dátum" : "Date"}</th>
              <th className="text-right px-4 py-3">{isCs ? "Zápas" : "Match"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((r) => {
              const sev = SEV_CONFIG[r.severity] || {
                cls: "text-slate-400",
                badgeCls: "bg-slate-800 text-slate-400 border-slate-700",
                labelEn: r.severity,
                labelCs: r.severity,
              };

              return (
                <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/players/${r.slug ?? r.playerId}`}
                      className="font-bold text-white hover:text-blue-400 transition-colors"
                    >
                      {r.name}
                    </Link>
                  </td>
                  {showTeam && (
                    <td className="px-3 py-3">
                      {r.teamSlug ? (
                        <Link
                          href={`/teams/${r.teamSlug}`}
                          className="inline-flex items-center gap-1.5 text-slate-300 hover:text-blue-400 whitespace-nowrap"
                        >
                          {r.teamLogo && (
                            <img src={r.teamLogo} alt="" className="w-5 h-5 object-contain shrink-0" />
                          )}
                          <span className="font-semibold text-xs tracking-wider">{r.teamCode ?? r.teamName}</span>
                        </Link>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-3 text-slate-200 font-medium text-xs">{r.part}</td>
                  <td className="px-3 py-3 text-slate-300 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <span>{MECH_ICON[r.mechanism] ?? "🩹"}</span>
                      <span>{r.mechanism}</span>
                    </span>
                    {r.byName && (
                      <span className="text-slate-500 text-[11px] block">
                        {isCs ? "spôsobil" : "by"} {r.byName}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${sev.badgeCls}`}>
                      {isCs ? sev.labelCs : sev.labelEn}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-400 font-bold text-xs">{r.days}</td>
                  <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap tabular-nums">{fmtDate(r.gameDate, isCs)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/games/${r.gameId}`}
                      className="inline-block px-2 py-1 rounded bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                    >
                      {isCs ? "Zápas" : "Boxscore"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
