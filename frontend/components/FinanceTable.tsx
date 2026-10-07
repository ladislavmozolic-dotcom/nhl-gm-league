"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { money } from "@/lib/finance";
import type { Lang } from "@/lib/i18n";

export type FinanceRow = {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  code?: string | null;
  division?: string | null;
  conference?: string | null;
  popularity: number;
  actualIncome: number;
  projectedIncome: number;
  actualExpenses: number;
  projectedExpenses: number;
  projectedResult: number;
  bankAccount: number;
  projectedBankAccount: number;
};

const UI_TEXT = {
  en: {
    totalRevenue: "Total League Revenue",
    totalPayroll: "Total Player Payroll",
    avgNetResult: "Avg Club Profit",
    totalLiquidity: "Total League Bank Reserves",
    searchPlaceholder: "Search team by name...",
    filterAll: "All",
    filterProfitable: "Profitable",
    filterDeficit: "In the Red",
    filterAtlantic: "Atlantic",
    filterMetro: "Metropolitan",
    filterCentral: "Central",
    filterPacific: "Pacific",
    filterEast: "Eastern",
    filterWest: "Western",
    colTeam: "Team",
    colPopularity: "Popularity",
    colActualIncome: "Actual Income",
    colProjIncome: "Projected Revenue",
    colActualExpenses: "Actual Expenses",
    colProjExpenses: "Projected Payroll",
    colNetResult: "Projected Net Result",
    colBank: "Current Bank",
    colProjBank: "Projected Bank",
    statusHealthy: "Healthy",
    statusWealthy: "Wealthy",
    statusTight: "Low Cash",
    teamsCount: "teams",
  },
  sk: {
    totalRevenue: "Celkové príjmy ligy",
    totalPayroll: "Celkové výdavky na platy",
    avgNetResult: "Priemerný zisk klubu",
    totalLiquidity: "Celková likvidita v bankách",
    searchPlaceholder: "Hľadať tím podľa názvu...",
    filterAll: "Všetko",
    filterProfitable: "V zisku",
    filterDeficit: "V strate",
    filterAtlantic: "Atlantická",
    filterMetro: "Metropolitná",
    filterCentral: "Centrálna",
    filterPacific: "Pacifická",
    filterEast: "Východ",
    filterWest: "Západ",
    colTeam: "Tím",
    colPopularity: "Popularita",
    colActualIncome: "Skutočný príjem",
    colProjIncome: "Projekcia príjmov",
    colActualExpenses: "Skutočné výdavky",
    colProjExpenses: "Projekcia výdavkov",
    colNetResult: "Výsledok hospodárenia",
    colBank: "Aktuálny zostatok",
    colProjBank: "Projekcia zostatku",
    statusHealthy: "Zdravý",
    statusWealthy: "Bohatý",
    statusTight: "Nízka hotovosť",
    teamsCount: "tímov",
  },
};

type ColKey = keyof FinanceRow;

export default function FinanceTable({
  rows,
  lang = "en",
}: {
  rows: FinanceRow[];
  lang?: Lang;
}) {
  const t = lang === "cs" ? UI_TEXT.sk : UI_TEXT.en;

  const [sort, setSort] = useState<{ key: ColKey; dir: 1 | -1 }>({ key: "bankAccount", dir: -1 });
  const [search, setSearch] = useState("");
  const [activeDiv, setActiveDiv] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  // Summary KPI calculation
  const summary = useMemo(() => {
    let sumRev = 0;
    let sumExp = 0;
    let sumNet = 0;
    let sumBank = 0;

    for (const r of rows) {
      sumRev += r.projectedIncome;
      sumExp += r.projectedExpenses;
      sumNet += r.projectedResult;
      sumBank += r.bankAccount;
    }

    const avgNet = rows.length > 0 ? Math.round(sumNet / rows.length) : 0;

    return {
      sumRev,
      sumExp,
      avgNet,
      sumBank,
      totalTeams: rows.length,
    };
  }, [rows]);

  // Filtering
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchCode = r.code?.toLowerCase().includes(q);
        const matchSlug = r.slug.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchSlug) return false;
      }

      // Division / Conference
      if (activeDiv !== "all") {
        if (activeDiv === "East" || activeDiv === "West") {
          if (r.conference !== activeDiv) return false;
        } else {
          const div = r.division?.toLowerCase() ?? "";
          if (!div.includes(activeDiv.toLowerCase())) return false;
        }
      }

      // Profitability filter
      if (activeFilter === "profit" && r.projectedResult <= 0) return false;
      if (activeFilter === "deficit" && r.projectedResult >= 0) return false;

      return true;
    });
  }, [rows, search, activeDiv, activeFilter]);

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Projected Revenue */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>{t.totalRevenue}</span>
            <span className="text-emerald-400 font-bold">▲ REV</span>
          </div>
          <div className="text-lg sm:text-xl font-mono font-black text-emerald-400 mt-1">
            {money(summary.sumRev)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Full-season projection
          </div>
        </div>

        {/* Total Payroll */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>{t.totalPayroll}</span>
            <span className="text-rose-400 font-bold">▼ EXP</span>
          </div>
          <div className="text-lg sm:text-xl font-mono font-black text-rose-300 mt-1">
            {money(summary.sumExp)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Salaries & operations
          </div>
        </div>

        {/* Average Net Profit */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>{t.avgNetResult}</span>
            <span className={summary.avgNet >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
              {summary.avgNet >= 0 ? "PROFIT" : "DEFICIT"}
            </span>
          </div>
          <div className={`text-lg sm:text-xl font-mono font-black mt-1 ${summary.avgNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {summary.avgNet >= 0 ? `+${money(summary.avgNet)}` : money(summary.avgNet)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Avg per franchise
          </div>
        </div>

        {/* Total Liquidity */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg relative overflow-hidden backdrop-blur-sm">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>{t.totalLiquidity}</span>
            <span className="text-amber-400 font-bold">💰 CASH</span>
          </div>
          <div className="text-lg sm:text-xl font-mono font-black text-amber-300 mt-1">
            {money(summary.sumBank)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Across {summary.totalTeams} clubs
          </div>
        </div>
      </div>

      {/* SEARCH & FILTERS */}
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

          {/* Profitability filter pills */}
          <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
            {[
              { id: "all", label: t.filterAll },
              { id: "profit", label: t.filterProfitable },
              { id: "deficit", label: t.filterDeficit },
            ].map((flt) => (
              <button
                key={flt.id}
                onClick={() => setActiveFilter(flt.id)}
                className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all ${
                  activeFilter === flt.id
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {flt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Division / Conference Pills */}
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
                  onClick={() => toggleSort("popularity")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colPopularity}{sortArrow("popularity")}
                </th>
                <th
                  onClick={() => toggleSort("actualIncome")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colActualIncome}{sortArrow("actualIncome")}
                </th>
                <th
                  onClick={() => toggleSort("projectedIncome")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colProjIncome}{sortArrow("projectedIncome")}
                </th>
                <th
                  onClick={() => toggleSort("actualExpenses")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colActualExpenses}{sortArrow("actualExpenses")}
                </th>
                <th
                  onClick={() => toggleSort("projectedExpenses")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colProjExpenses}{sortArrow("projectedExpenses")}
                </th>
                <th
                  onClick={() => toggleSort("projectedResult")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colNetResult}{sortArrow("projectedResult")}
                </th>
                <th
                  onClick={() => toggleSort("bankAccount")}
                  className="text-right px-3 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colBank}{sortArrow("bankAccount")}
                </th>
                <th
                  onClick={() => toggleSort("projectedBankAccount")}
                  className="text-right px-4 py-3 cursor-pointer hover:text-white select-none whitespace-nowrap"
                >
                  {t.colProjBank}{sortArrow("projectedBankAccount")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 italic">
                    No teams match search filter.
                  </td>
                </tr>
              ) : (
                sorted.map((r) => {
                  const popPct = Math.min(100, Math.max(0, r.popularity));
                  const isProfit = r.projectedResult >= 0;

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

                      {/* Popularity Gauge */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="font-mono text-slate-200 font-semibold text-xs">
                          {r.popularity}
                        </div>
                        <div className="w-16 bg-slate-800 h-1 rounded-full mt-1 ml-auto overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 rounded-full"
                            style={{ width: `${popPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Actual Income */}
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                        {money(r.actualIncome)}
                      </td>

                      {/* Projected Income */}
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                        {money(r.projectedIncome)}
                      </td>

                      {/* Actual Expenses */}
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300">
                        {money(r.actualExpenses)}
                      </td>

                      {/* Projected Expenses */}
                      <td className="px-3 py-2.5 text-right font-mono text-slate-400">
                        {money(r.projectedExpenses)}
                      </td>

                      {/* Projected Result (Net Profit / Loss) */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            isProfit
                              ? "bg-emerald-950/60 border border-emerald-800/60 text-emerald-300"
                              : "bg-rose-950/60 border border-rose-800/60 text-rose-300"
                          }`}
                        >
                          {isProfit ? `+${money(r.projectedResult)}` : money(r.projectedResult)}
                        </span>
                      </td>

                      {/* Current Bank Account */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-300 whitespace-nowrap">
                        {money(r.bankAccount)}
                      </td>

                      {/* Projected Bank */}
                      <td className="px-4 py-2.5 text-right font-mono text-slate-400 whitespace-nowrap">
                        {money(r.projectedBankAccount)}
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
