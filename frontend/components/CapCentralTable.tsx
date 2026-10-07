"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { money } from "@/lib/finance";
import type { Lang } from "@/lib/i18n";

export type CapRow = {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  code?: string | null;
  division?: string | null;
  conference?: string | null;
  gp: number;
  gamesTotal: number;
  count: number;
  totalSalaries: number;
  buyouts: number;
  deadCap: number;
  capHit: number;
  capSpace: number;
  projCapHit: number;
  projCapSpace: number;
  underFloorBy: number;
  ltir?: number;
};

const UI_TEXT = {
  en: {
    upperLimit: "Upper Limit",
    lowerFloor: "Salary Floor",
    avgCapSpace: "Avg Cap Space",
    deadlineSpace: "Total Trade Deadline Space",
    complianceTitle: "Cap Compliance",
    compliant: "Compliant",
    ltirRelief: "LTIR Relief",
    overCeiling: "Over Ceiling",
    belowFloor: "Below Floor",
    searchPlaceholder: "Search team by name or code...",
    filterAll: "All",
    filterAtlantic: "Atlantic",
    filterMetro: "Metropolitan",
    filterCentral: "Central",
    filterPacific: "Pacific",
    filterEast: "Eastern",
    filterWest: "Western",
    colTeam: "Team",
    colCount: "Roster",
    colSalaries: "Total Salaries",
    colBuyouts: "Buyout Dead Cap",
    colRetained: "Retained Salary",
    colCapHit: "Actual Cap Hit",
    colLtir: "LTIR Relief",
    colCapSpace: "Actual Cap Space",
    colProjCapSpace: "Projected Cap Space",
    colStatus: "Cap Status",
    ltirCompliantTag: "LTIR Compliant ✓",
    compliantTag: "Compliant ✓",
    overByTag: "Over by",
    belowByTag: "Below floor",
    teamsCount: "teams",
  },
  sk: {
    upperLimit: "Platový strop",
    lowerFloor: "Platová podlaha",
    avgCapSpace: "Priemerný priestor",
    deadlineSpace: "Celkový priestor k Deadline",
    complianceTitle: "Súlad s pravidlami",
    compliant: "V norme",
    ltirRelief: "LTIR úľava",
    overCeiling: "Nad stropom",
    belowFloor: "Pod podlahou",
    searchPlaceholder: "Hľadať tím podľa názvu...",
    filterAll: "Všetko",
    filterAtlantic: "Atlantická",
    filterMetro: "Metropolitná",
    filterCentral: "Centrálna",
    filterPacific: "Pacifická",
    filterEast: "Východ",
    filterWest: "Západ",
    colTeam: "Tím",
    colCount: "Hráči",
    colSalaries: "Platy hráčov",
    colBuyouts: "Vykúpené zmluvy",
    colRetained: "Ponechaný plat",
    colCapHit: "Aktuálny Cap Hit",
    colLtir: "LTIR úľava",
    colCapSpace: "Miesto pod stropom",
    colProjCapSpace: "Projekcia k Deadline",
    colStatus: "Stav stropu",
    ltirCompliantTag: "LTIR v norme ✓",
    compliantTag: "V norme ✓",
    overByTag: "Nad stropom o",
    belowByTag: "Pod podlahou o",
    teamsCount: "tímov",
  },
};

type ColKey = keyof CapRow;

export default function CapCentralTable({
  rows,
  capUpper = 88000000,
  capLower = 65000000,
  lang = "en",
}: {
  rows: CapRow[];
  capUpper?: number;
  capLower?: number;
  lang?: Lang;
}) {
  const t = lang === "cs" ? UI_TEXT.sk : UI_TEXT.en;

  const [sort, setSort] = useState<{ key: ColKey; dir: 1 | -1 }>({ key: "capHit", dir: -1 });
  const [search, setSearch] = useState("");
  const [activeDiv, setActiveDiv] = useState("all");
  const [activeStatus, setActiveStatus] = useState("all");

  // Summary Metrics
  const summary = useMemo(() => {
    let totalSpace = 0;
    let totalProjSpace = 0;
    let compliantCount = 0;
    let ltirCount = 0;
    let overCount = 0;
    let floorCount = 0;

    for (const r of rows) {
      totalSpace += r.capSpace;
      if (r.projCapSpace > 0) totalProjSpace += r.projCapSpace;

      const isOver = r.capSpace < 0;
      const isLtir = isOver && (r.ltir ?? 0) >= -r.capSpace;
      const isBelow = r.underFloorBy > 0;

      if (isLtir) ltirCount++;
      else if (isOver) overCount++;
      else if (isBelow) floorCount++;
      else compliantCount++;
    }

    const avgSpace = rows.length > 0 ? Math.round(totalSpace / rows.length) : 0;

    return {
      avgSpace,
      totalProjSpace,
      compliantCount,
      ltirCount,
      overCount,
      floorCount,
      totalTeams: rows.length,
    };
  }, [rows]);

  // Filtering
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      // Text search
      if (search) {
        const q = search.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchCode = r.code?.toLowerCase().includes(q);
        const matchSlug = r.slug.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchSlug) return false;
      }

      // Division / Conference filter
      if (activeDiv !== "all") {
        if (activeDiv === "East" || activeDiv === "West") {
          if (r.conference !== activeDiv) return false;
        } else {
          const div = r.division?.toLowerCase() ?? "";
          if (!div.includes(activeDiv.toLowerCase())) return false;
        }
      }

      // Status filter
      if (activeStatus !== "all") {
        const isOver = r.capSpace < 0;
        const isLtir = isOver && (r.ltir ?? 0) >= -r.capSpace;
        const isBelow = r.underFloorBy > 0;
        const isCompliant = !isOver && !isBelow;

        if (activeStatus === "compliant" && !isCompliant) return false;
        if (activeStatus === "ltir" && !isLtir) return false;
        if (activeStatus === "below" && !isBelow) return false;
        if (activeStatus === "over" && (!isOver || isLtir)) return false;
      }

      return true;
    });
  }, [rows, search, activeDiv, activeStatus]);

  // Sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * sort.dir;
    });
  }, [filtered, sort]);

  const toggleSort = (key: ColKey) => {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));
  };

  const sortArrow = (key: ColKey) => {
    if (sort.key !== key) return "";
    return sort.dir === -1 ? " ▾" : " ▴";
  };

  return (
    <div className="space-y-5">
      {/* TOP KPI HUD CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Upper Limit */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>{t.upperLimit}</span>
            <span className="text-emerald-400 font-bold">▲ MAX</span>
          </div>
          <div className="text-lg sm:text-xl font-mono font-black text-white mt-1">
            {money(capUpper)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {t.lowerFloor}: <span className="text-slate-300 font-mono">{money(capLower)}</span>
          </div>
        </div>

        {/* Avg Cap Space */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>{t.avgCapSpace}</span>
            <span className="text-cyan-400 font-bold">AVG</span>
          </div>
          <div className={`text-lg sm:text-xl font-mono font-black mt-1 ${summary.avgSpace < 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {money(summary.avgSpace)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {summary.totalTeams} {t.teamsCount}
          </div>
        </div>

        {/* Deadline Buying Power */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>{t.deadlineSpace}</span>
            <span className="text-amber-400 font-bold">⚡ BUY</span>
          </div>
          <div className="text-lg sm:text-xl font-mono font-black text-emerald-400 mt-1">
            {money(summary.totalProjSpace)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Accrued league buying room
          </div>
        </div>

        {/* Compliance Status Overview */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            {t.complianceTitle}
          </div>
          <div className="grid grid-cols-4 gap-2 pt-0.5 text-center">
            <div className="bg-slate-950/60 rounded-xl p-1.5 border border-slate-800">
              <div className="text-xs font-mono font-black text-emerald-400">{summary.compliantCount}</div>
              <div className="text-[9px] text-slate-400 uppercase font-bold">{t.compliant}</div>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-1.5 border border-slate-800">
              <div className="text-xs font-mono font-black text-sky-400">{summary.ltirCount}</div>
              <div className="text-[9px] text-slate-400 uppercase font-bold">{t.ltirRelief}</div>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-1.5 border border-slate-800">
              <div className="text-xs font-mono font-black text-amber-400">{summary.floorCount}</div>
              <div className="text-[9px] text-slate-400 uppercase font-bold">{t.belowFloor}</div>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-1.5 border border-slate-800">
              <div className="text-xs font-mono font-black text-rose-400">{summary.overCount}</div>
              <div className="text-[9px] text-slate-400 uppercase font-bold">{t.overCeiling}</div>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-3 shadow-md backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <span className="absolute left-2.5 top-2 text-slate-500 text-xs">🔍</span>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
            {[
              { id: "all", label: t.filterAll },
              { id: "compliant", label: t.compliant },
              { id: "ltir", label: t.ltirRelief },
              { id: "below", label: t.belowFloor },
              { id: "over", label: t.overCeiling },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setActiveStatus(st.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all ${
                  activeStatus === st.id
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Division & Conference Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-slate-800/60 text-[11px]">
          <span className="text-slate-500 font-bold uppercase text-[10px] mr-1.5 shrink-0">Division:</span>
          {[
            { id: "all", label: t.filterAll },
            { id: "Atlantic", label: t.filterAtlantic },
            { id: "Metropolitan", label: t.filterMetro },
            { id: "Central", label: t.filterCentral },
            { id: "Pacific", label: t.filterPacific },
            { id: "East", label: t.filterEast },
            { id: "West", label: t.filterWest },
          ].map((div) => (
            <button
              key={div.id}
              onClick={() => setActiveDiv(div.id)}
              className={`px-2.5 py-0.5 rounded-md font-semibold shrink-0 transition-all ${
                activeDiv === div.id
                  ? "bg-slate-800 text-white border border-slate-600 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              {div.label}
            </button>
          ))}
          <span className="text-slate-500 ml-auto font-mono text-[10px] shrink-0">
            {sorted.length} / {rows.length} {t.teamsCount}
          </span>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
        <div className="overflow-auto max-h-[640px] custom-scrollbar">
          <table className="w-full text-xs min-w-[1080px] border-collapse">
            <thead>
              <tr className="text-[11px] text-slate-400 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-20 backdrop-blur-md">
                <th
                  onClick={() => toggleSort("name")}
                  className="text-left px-4 py-3 cursor-pointer hover:text-white select-none sticky left-0 z-30 bg-slate-950/95 min-w-[200px]"
                >
                  {t.colTeam}{sortArrow("name")}
                </th>
                <th
                  onClick={() => toggleSort("count")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colCount}{sortArrow("count")}
                </th>
                <th
                  onClick={() => toggleSort("totalSalaries")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colSalaries}{sortArrow("totalSalaries")}
                </th>
                <th
                  onClick={() => toggleSort("buyouts")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colBuyouts}{sortArrow("buyouts")}
                </th>
                <th
                  onClick={() => toggleSort("deadCap")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colRetained}{sortArrow("deadCap")}
                </th>
                <th
                  onClick={() => toggleSort("capHit")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap min-w-[150px]"
                >
                  {t.colCapHit}{sortArrow("capHit")}
                </th>
                <th
                  onClick={() => toggleSort("ltir")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colLtir}{sortArrow("ltir")}
                </th>
                <th
                  onClick={() => toggleSort("capSpace")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colCapSpace}{sortArrow("capSpace")}
                </th>
                <th
                  onClick={() => toggleSort("projCapSpace")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colProjCapSpace}{sortArrow("projCapSpace")}
                </th>
                <th
                  onClick={() => toggleSort("underFloorBy")}
                  className="text-right px-4 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colStatus}{sortArrow("underFloorBy")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 italic">
                    No teams match search filter.
                  </td>
                </tr>
              ) : (
                sorted.map((r) => {
                  const isOver = r.capSpace < 0;
                  const isLtir = isOver && (r.ltir ?? 0) >= -r.capSpace;
                  const isBelow = r.underFloorBy > 0;
                  const capHitPct = Math.min(100, Math.max(0, (r.capHit / capUpper) * 100));

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Frozen Team Column */}
                      <td className="px-4 py-2.5 sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-850 min-w-[200px]">
                        <Link
                          href={`/finance/${r.slug}`}
                          className="flex items-center gap-2.5 hover:text-cyan-400 whitespace-nowrap transition-colors"
                        >
                          <div className="w-7 h-7 rounded-lg bg-slate-950 p-1 flex items-center justify-center shrink-0 border border-slate-800">
                            {r.logoUrl ? (
                              <img src={r.logoUrl} alt="" className="w-5 h-5 object-contain" />
                            ) : (
                              <span>🏒</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-white text-xs truncate block group-hover:text-cyan-300">
                              {r.name}
                            </span>
                            {r.division && (
                              <span className="text-[10px] text-slate-500 font-medium">
                                {r.division.replace(" Division", "")}
                              </span>
                            )}
                          </div>
                        </Link>
                      </td>

                      {/* Roster Player Count */}
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                        {r.count}
                      </td>

                      {/* Total Salaries */}
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                        {money(r.totalSalaries)}
                      </td>

                      {/* Buyouts Dead Cap */}
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                        {r.buyouts ? money(r.buyouts) : "—"}
                      </td>

                      {/* Retained Dead Cap */}
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                        {r.deadCap ? money(r.deadCap) : "—"}
                      </td>

                      {/* Actual Cap Hit with Mini Progress Meter */}
                      <td className="px-3 py-2.5 text-right">
                        <div className="font-mono font-bold text-slate-200">
                          {money(r.capHit)}
                        </div>
                        <div className="w-full bg-slate-800 h-1 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isOver ? "bg-rose-500" : isBelow ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${capHitPct}%` }}
                          />
                        </div>
                      </td>

                      {/* LTIR Relief */}
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                        {r.ltir ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-950/60 text-sky-300 border border-sky-800/60">
                            +{money(r.ltir)}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Actual Cap Space */}
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap ${
                          isLtir
                            ? "text-sky-300"
                            : isOver
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {money(r.capSpace)}
                      </td>

                      {/* Projected Cap Space */}
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-black whitespace-nowrap ${
                          r.projCapSpace < 0 ? "text-rose-400" : "text-emerald-400"
                        }`}
                      >
                        {money(r.projCapSpace)}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {isLtir ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            {t.ltirCompliantTag}
                          </span>
                        ) : isOver ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            {t.overByTag} {money(-r.capSpace - (r.ltir ?? 0))}
                          </span>
                        ) : isBelow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {t.belowByTag} {money(r.underFloorBy)}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            {t.compliantTag}
                          </span>
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
    </div>
  );
}
