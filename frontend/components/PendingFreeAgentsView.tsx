"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";
import { Card } from "@/components/ui";

export type PendingStats = {
  total: number;
  ufa: number;
  rfa: number;
  extensions: number;
};

export type TeamOption = {
  id: number;
  name: string;
  code: string | null;
  slug: string;
};

export default function PendingFreeAgentsView({
  cols,
  rows,
  stats,
  teams,
  selectedStatus,
  selectedTeam,
  selectedType,
  isEn,
}: {
  cols: SortCol[];
  rows: SortRow[];
  stats: PendingStats;
  teams: TeamOption[];
  selectedStatus: string;
  selectedTeam?: string;
  selectedType?: string;
  isEn: boolean;
}) {
  const router = useRouter();
  const statusTab = (key: string, label: string, count?: number) => {
    const active = selectedStatus === key;
    const teamParam = selectedTeam ? `&team=${selectedTeam}` : "";
    const typeParam = selectedType ? `&type=${selectedType}` : "";
    return (
      <Link
        key={key}
        href={`/free-agents?view=pending&status=${key}${teamParam}${typeParam}`}
        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
          active
            ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
            : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60"
        }`}
      >
        {label} {count != null && <span className="opacity-75 font-mono">({count})</span>}
      </Link>
    );
  };

  const posTab = (key: string, label: string) => {
    const active = (selectedType ?? "all") === key;
    const statusParam = selectedStatus !== "all" ? `&status=${selectedStatus}` : "";
    const teamParam = selectedTeam ? `&team=${selectedTeam}` : "";
    return (
      <Link
        key={key}
        href={`/free-agents?view=pending&type=${key}${statusParam}${teamParam}`}
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
          active
            ? "bg-blue-600 text-white"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      {/* SCOUTING INFO BANNER */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-[#0c1c31]/90 to-slate-900/90 p-4 sm:p-5 border-l-4 border-l-amber-500 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-black font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                CLASS OF 2027
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {isEn ? "Pending Free Agents — Expiring Contracts" : "Pending Free Agents — Hráči s končiacou zmluvou"}
              </h3>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              {isEn
                ? "Players across the league entering the final year of their contract. Use this board to scout upcoming free-agent classes, plan cap space, and target trade candidates before the deadline."
                : "Zoznam všetkých hráčov v lige v poslednom roku zmluvy. Slúži manažérom na skauting pred Trade Deadline, plánovanie platového stropu (Cap Space) a sledovanie budúcich posíl."}
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 text-xs self-start lg:self-auto">
            <div className="text-center px-3 border-r border-slate-800">
              <span className="block text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                {isEn ? "Expiring" : "Končiace"}
              </span>
              <span className="text-sm font-black text-slate-200 font-mono">{stats.total}</span>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <span className="block text-amber-400/90 text-[10px] uppercase font-bold tracking-wider">UFA</span>
              <span className="text-sm font-black text-amber-400 font-mono">{stats.ufa}</span>
            </div>
            <div className="text-center px-3 border-r border-slate-800">
              <span className="block text-blue-400/90 text-[10px] uppercase font-bold tracking-wider">RFA</span>
              <span className="text-sm font-black text-blue-400 font-mono">{stats.rfa}</span>
            </div>
            <div className="text-center px-3">
              <span className="block text-emerald-400/90 text-[10px] uppercase font-bold tracking-wider">
                {isEn ? "Extensions" : "Podpísané"}
              </span>
              <span className="text-sm font-black text-emerald-400 font-mono">{stats.extensions}</span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS TOOLBAR */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-0.5 scrollbar-thin">
          {statusTab("all", isEn ? "All Expiring" : "Všetky končiace", stats.total)}
          {statusTab("ufa", "UFA Only", stats.ufa)}
          {statusTab("rfa", "RFA Only", stats.rfa)}
          {statusTab("unsigned", isEn ? "Unsigned Only" : "Bez predĺženia")}
        </div>

        {/* Position & Team Selectors */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1 text-xs">
            {posTab("all", isEn ? "All" : "Všetci")}
            {posTab("skaters", isEn ? "Skaters" : "Korčuliari")}
            {posTab("goalies", isEn ? "Goalies" : "Brankári")}
          </div>

          <select
            defaultValue={selectedTeam ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              const teamParam = val ? `&team=${val}` : "";
              const statusParam = selectedStatus !== "all" ? `&status=${selectedStatus}` : "";
              const typeParam = selectedType ? `&type=${selectedType}` : "";
              router.push(`/free-agents?view=pending${statusParam}${typeParam}${teamParam}`);
            }}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">{isEn ? "All NHL Teams" : "Všetky tímy NHL"}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.slug}>
                {t.code ? `${t.code} · ` : ""}{t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE */}
      {rows.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-slate-500">
            <p className="text-base">{isEn ? "No expiring players found matching this filter." : "Žiadni hráči nezodpovedajú zvolenému filtru."}</p>
          </div>
        </Card>
      ) : (
        <Card bodyClassName="p-2">
          <SortableTable
            cols={cols}
            rows={rows}
            initialSort="ovr"
            minWidth={880}
            csvFilename="pending-free-agents"
          />
          <p className="text-[11px] text-slate-600 px-2 pt-1">
            {isEn
              ? "Market Value is estimated using the sim-weighted comparable contract engine. Extensions take effect next league year."
              : "Trhová hodnota je odhadovaná trhovým modelom ligy na základe porovnateľných zmlúv. Predĺženia zmlúv (Extensions) začínajú platiť od novej sezóny."}
          </p>
        </Card>
      )}
    </div>
  );
}
