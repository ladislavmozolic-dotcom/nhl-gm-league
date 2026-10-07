"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";
import { money } from "@/lib/finance";

export type ContractRow = {
  id: number;
  name: string;
  slug: string;
  photoUrl: string | null;
  position: string;
  teamCode: string | null;
  teamSlug: string | null;
  teamLogoUrl: string | null;
  teamName: string | null;
  capHit: number;
  years: number | null;
  contractType: string | null; // "ONE_WAY" | "TWO_WAY"
  clause: string | null; // "NMC" | "NTC" | "M_NTC" etc.
};

const isForward = (pos: string) => ["C", "LW", "RW", "W", "F"].includes(pos.toUpperCase());
const isDefense = (pos: string) => ["D", "LD", "RD"].includes(pos.toUpperCase());
const isGoaliePos = (pos: string) => ["G"].includes(pos.toUpperCase());

export default function ContractsLedgerView({
  rows,
  lang = "en",
}: {
  rows: ContractRow[];
  lang?: string;
}) {
  const isCs = lang === "cs";

  const [q, setQ] = useState("");
  const [posFilter, setPosFilter] = useState<"ALL" | "F" | "D" | "G">("ALL");
  const [clauseFilter, setClauseFilter] = useState<"ALL" | "CLAUSE" | "NMC" | "NTC">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "ONE_WAY" | "TWO_WAY">("ALL");
  const [sortKey, setSortKey] = useState<"cap" | "yrs" | "name" | "team">("cap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalCount = rows.length;
    const topPlayer = rows.reduce<ContractRow | null>(
      (max, r) => (!max || r.capHit > max.capHit ? r : max),
      null
    );
    const clauseCount = rows.filter((r) => !!r.clause).length;
    const oneWayCount = rows.filter((r) => r.contractType === "ONE_WAY").length;
    const twoWayCount = rows.filter((r) => r.contractType === "TWO_WAY").length;
    const avgCap =
      totalCount > 0 ? Math.round(rows.reduce((s, r) => s + r.capHit, 0) / totalCount) : 0;

    return { totalCount, topPlayer, clauseCount, oneWayCount, twoWayCount, avgCap };
  }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const result = rows.filter((p) => {
      if (query) {
        const matchName = cleanName(p.name).toLowerCase().includes(query);
        const matchTeam =
          (p.teamCode?.toLowerCase().includes(query) ?? false) ||
          (p.teamName?.toLowerCase().includes(query) ?? false);
        if (!matchName && !matchTeam) return false;
      }
      if (posFilter === "F" && !isForward(p.position)) return false;
      if (posFilter === "D" && !isDefense(p.position)) return false;
      if (posFilter === "G" && !isGoaliePos(p.position)) return false;

      if (clauseFilter === "CLAUSE" && !p.clause) return false;
      if (clauseFilter === "NMC" && !p.clause?.includes("NMC")) return false;
      if (clauseFilter === "NTC" && !p.clause?.includes("NTC")) return false;

      if (typeFilter !== "ALL" && p.contractType !== typeFilter) return false;

      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "cap") cmp = a.capHit - b.capHit;
      else if (sortKey === "yrs") cmp = (a.years ?? 0) - (b.years ?? 0);
      else if (sortKey === "name") cmp = cleanName(a.name).localeCompare(cleanName(b.name));
      else if (sortKey === "team") cmp = (a.teamCode ?? "").localeCompare(b.teamCode ?? "");
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [rows, q, posFilter, clauseFilter, typeFilter, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "team" ? "asc" : "desc");
    }
  };

  const capBadge = (cap: number) => {
    if (cap >= 10_000_000) {
      return "bg-amber-500/20 text-amber-300 border-amber-500/40 font-black";
    }
    if (cap >= 6_000_000) {
      return "bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold";
    }
    if (cap >= 3_000_000) {
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold";
    }
    return "bg-slate-800 text-slate-300 border-slate-700 font-medium";
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Deck */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Highest Cap Hit */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Najvyšší platový strop" : "Highest Cap Hit"}
          </div>
          {metrics.topPlayer ? (
            <div className="mt-1 flex items-center gap-2">
              <PlayerAvatar src={metrics.topPlayer.photoUrl} alt={metrics.topPlayer.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white truncate">
                  {cleanName(metrics.topPlayer.name)}
                </div>
                <div className="text-base font-black text-amber-400 font-mono">
                  {money(metrics.topPlayer.capHit)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xl font-bold text-slate-400 mt-1">—</div>
          )}
        </div>

        {/* Total Active Contracts */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Aktívne zmluvy" : "Active Contracts"}
          </div>
          <div className="text-2xl font-black text-white mt-1">
            {metrics.totalCount} <span className="text-xs font-normal text-slate-500">{isCs ? "hráčov" : "deals"}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isCs ? "Priemerný cap hit:" : "Avg Cap Hit:"} {money(metrics.avgCap)}
          </div>
        </div>

        {/* Clauses Count */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Ochranné klauzuly" : "Movement Clauses"}
          </div>
          <div className="text-2xl font-black text-purple-400 mt-1">
            {metrics.clauseCount} <span className="text-xs font-normal text-slate-500">NMC / NTC</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isCs ? "Zmluvy s obmedzením výmeny" : "Protected against trades"}
          </div>
        </div>

        {/* Contract Structure */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {isCs ? "Typ zmluvy" : "Contract Structure"}
          </div>
          <div className="text-2xl font-black text-sky-400 mt-1 flex items-baseline gap-2">
            <span>{metrics.oneWayCount}</span>
            <span className="text-xs font-medium text-slate-400">1-way</span>
            <span className="text-slate-600">/</span>
            <span className="text-emerald-400">{metrics.twoWayCount}</span>
            <span className="text-xs font-medium text-slate-400">2-way</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isCs ? "Jednocestné vs Dvojcestné" : "Guaranteed vs Split NHL/AHL"}
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

          {/* Clause Filter */}
          <div className="inline-flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
            <button
              onClick={() => setClauseFilter("ALL")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                clauseFilter === "ALL" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              {isCs ? "Všetky" : "All"}
            </button>
            <button
              onClick={() => setClauseFilter("CLAUSE")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                clauseFilter === "CLAUSE" ? "bg-purple-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              🔒 {isCs ? "Klauzuly" : "Clauses"}
            </button>
          </div>

          {/* 1-way / 2-way */}
          <div className="inline-flex rounded-lg bg-slate-800/80 p-0.5 border border-slate-700/60 text-xs">
            {(["ALL", "ONE_WAY", "TWO_WAY"] as const).map((tp) => (
              <button
                key={tp}
                onClick={() => setTypeFilter(tp)}
                className={`px-2 py-1 rounded-md font-semibold transition-all ${
                  typeFilter === tp ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                {tp === "ALL" ? (isCs ? "Typ" : "Type") : tp === "ONE_WAY" ? "1-way" : "2-way"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Contracts Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80 shadow-md">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/40 border-b border-slate-800 select-none">
              <th
                onClick={() => toggleSort("name")}
                className="text-left px-4 py-3 cursor-pointer hover:text-white"
              >
                {isCs ? "Hráč" : "Player"} {sortKey === "name" && (sortDir === "asc" ? "▲" : "▼")}
              </th>
              <th
                onClick={() => toggleSort("team")}
                className="text-left px-3 py-3 cursor-pointer hover:text-white"
              >
                {isCs ? "Tím" : "Team"} {sortKey === "team" && (sortDir === "asc" ? "▲" : "▼")}
              </th>
              <th className="text-center px-2 py-3">{isCs ? "Poz" : "Pos"}</th>
              <th
                onClick={() => toggleSort("cap")}
                className="text-right px-4 py-3 cursor-pointer hover:text-white"
              >
                {isCs ? "Platový strop" : "Cap Hit"} {sortKey === "cap" && (sortDir === "asc" ? "▲" : "▼")}
              </th>
              <th
                onClick={() => toggleSort("yrs")}
                className="text-center px-3 py-3 cursor-pointer hover:text-white"
              >
                {isCs ? "Roky" : "Term"} {sortKey === "yrs" && (sortDir === "asc" ? "▲" : "▼")}
              </th>
              <th className="text-center px-3 py-3">{isCs ? "Typ" : "Type"}</th>
              <th className="text-left px-4 py-3">{isCs ? "Klauzula" : "Clause"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                {/* Player */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar src={p.photoUrl} alt={p.name} size={32} />
                    <Link
                      href={`/players/${p.slug}`}
                      className="font-bold text-white hover:text-blue-400 transition-colors"
                    >
                      {cleanName(p.name)}
                    </Link>
                  </div>
                </td>

                {/* Team */}
                <td className="px-3 py-3">
                  {p.teamSlug ? (
                    <Link
                      href={`/teams/${p.teamSlug}`}
                      className="inline-flex items-center gap-1.5 text-slate-300 hover:text-blue-400 transition-colors"
                    >
                      {p.teamLogoUrl && (
                        <img src={p.teamLogoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
                      )}
                      <span className="font-semibold text-xs tracking-wider">{p.teamCode}</span>
                    </Link>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>

                {/* Pos */}
                <td className="px-2 py-3 text-center">
                  <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    {p.position}
                  </span>
                </td>

                {/* Cap Hit */}
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-lg border font-mono text-xs ${capBadge(
                      p.capHit
                    )}`}
                  >
                    {money(p.capHit)}
                  </span>
                </td>

                {/* Term / Years */}
                <td className="px-3 py-3 text-center tabular-nums whitespace-nowrap">
                  <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold text-xs border border-slate-700">
                    {p.years != null ? `${p.years}y` : "—"}
                  </span>
                </td>

                {/* Type (1-way / 2-way) */}
                <td className="px-3 py-3 text-center whitespace-nowrap">
                  {p.contractType === "TWO_WAY" ? (
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                      2-way
                    </span>
                  ) : p.contractType === "ONE_WAY" ? (
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/25">
                      1-way
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>

                {/* Clause */}
                <td className="px-4 py-3 whitespace-nowrap">
                  {p.clause ? (
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-black border ${
                        p.clause.includes("NMC")
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                          : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      }`}
                      title={
                        p.clause.includes("NMC")
                          ? isCs
                            ? "No-Movement Clause — hráč nemôže byť vymenený ani poslaný na waiver bez súhlasu"
                            : "No-Movement Clause — cannot be waived or traded without consent"
                          : isCs
                          ? "No-Trade Clause — obmedzenie výmeny"
                          : "No-Trade Clause — trade restriction"
                      }
                    >
                      {p.clause}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  {isCs ? "Žiadne zmluvy nevyhovujú zvoleným filtrom." : "No contracts match the selected filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            {isCs ? "Zobrazených:" : "Showing:"} {filtered.length} / {rows.length} {isCs ? "zmlúv" : "deals"}
          </span>
          <span className="text-slate-500">
            {isCs ? "Kliknutím na záhlavie stĺpca zmeníte radenie." : "Click column header to sort."}
          </span>
        </div>
      </div>
    </div>
  );
}
