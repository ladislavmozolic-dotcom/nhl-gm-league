"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import PlayerAvatar from "@/components/playerAvatar";
import { cleanName } from "@/lib/playerName";
import {
  ALL_GOALIE_PARAMS,
  GOALIE_PARAM_META,
  type GoalieParamKey,
  type ProjGoalie,
} from "@/lib/param-projection";

type ViewMode = "diff" | "compare" | "projected";

export type GoalieSortKey =
  | "name"
  | "age"
  | "gp"
  | "ov"
  | "svPct"
  | "gaa"
  | "gsax"
  | "gsax60"
  | "hdSv"
  | "rebCtrl"
  | "freezePct"
  | GoalieParamKey;

export type GoalieSortConfig = {
  key: GoalieSortKey;
  dir: "asc" | "desc";
};

interface TeamItem {
  id: number;
  slug: string;
  code: string | null;
  name: string;
  logoUrl: string | null;
}

function ratingColor(val: number | null): string {
  if (val == null) return "text-slate-600";
  if (val >= 85) return "text-emerald-400 font-bold";
  if (val >= 80) return "text-sky-300 font-bold";
  if (val >= 70) return "text-slate-100 font-medium";
  if (val >= 60) return "text-slate-300";
  return "text-slate-500";
}

export default function GoalieCalculatorSection({
  selectedTeam,
  affiliate,
  nhlGoalies,
  ahlGoalies,
  otherMatches,
  viewMode,
  sort,
  onSort,
  active,
  emptyMessage,
  showTeamBadge,
  teamMap,
}: {
  selectedTeam: TeamItem;
  affiliate: TeamItem | null;
  nhlGoalies: ProjGoalie[];
  ahlGoalies: ProjGoalie[];
  otherMatches: Array<{ goalie: ProjGoalie; team: TeamItem }>;
  viewMode: ViewMode;
  sort: GoalieSortConfig;
  onSort: (k: GoalieSortKey) => void;
  active: boolean;
  emptyMessage: string;
  showTeamBadge?: boolean;
  teamMap?: Map<number, { id: number; slug: string; code: string; name: string; logoUrl: string | null }>;
}) {
  const [hovered, setHovered] = useState<{
    player: ProjGoalie;
    x: number;
    y: number;
  } | null>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (e: React.MouseEvent, p: ProjGoalie) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left;
    const y = r.bottom;
    hoverTimeout.current = setTimeout(() => {
      setHovered({ player: p, x, y });
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      setHovered(null);
    }, 100);
  };

  const isAll = selectedTeam.slug === "all" || selectedTeam.id === 0;

  const nhlAvgOv =
    nhlGoalies.length > 0
      ? (nhlGoalies.reduce((a, b) => a + (b.overallProjected ?? b.overall ?? 0), 0) / nhlGoalies.length).toFixed(1)
      : "0";
  const ahlAvgOv =
    ahlGoalies.length > 0
      ? (ahlGoalies.reduce((a, b) => a + (b.overallProjected ?? b.overall ?? 0), 0) / ahlGoalies.length).toFixed(1)
      : "0";

  const nhlTitle = isAll
    ? "NHL — Všetci brankári ligy"
    : `${selectedTeam.name} — NHL Brankári`;

  const ahlTitle = isAll
    ? "AHL — Všetci brankári ligy (Farma)"
    : affiliate
    ? `${affiliate.name} — AHL Farm Brankári`
    : `${selectedTeam.name} — AHL Farm Brankári`;

  return (
    <div className="space-y-6">
      {/* SECTION A: NHL GOALIES */}
      <GoalieTable
        title={nhlTitle}
        badgeText="NHL"
        badgeColor="bg-amber-600/20 text-amber-300 border-amber-500/30"
        teamLogo={isAll ? null : selectedTeam.logoUrl}
        goalies={nhlGoalies}
        avgOv={nhlAvgOv}
        viewMode={viewMode}
        sort={sort}
        onSort={onSort}
        active={active}
        onRowMouseEnter={handleMouseEnter}
        onRowMouseLeave={handleMouseLeave}
        emptyMessage={emptyMessage || "Žiadni brankári na NHL súpiske nezodpovedajú filtru."}
        showTeamBadge={showTeamBadge}
        teamMap={teamMap}
      />

      {/* SECTION B: AHL GOALIES */}
      <GoalieTable
        title={ahlTitle}
        badgeText="AHL"
        badgeColor="bg-purple-600/20 text-purple-300 border-purple-500/30"
        teamLogo={isAll ? null : affiliate?.logoUrl ?? selectedTeam.logoUrl}
        goalies={ahlGoalies}
        avgOv={ahlAvgOv}
        viewMode={viewMode}
        sort={sort}
        onSort={onSort}
        active={active}
        onRowMouseEnter={handleMouseEnter}
        onRowMouseLeave={handleMouseLeave}
        emptyMessage={emptyMessage || "Žiadni brankári na AHL súpiske nezodpovedajú filtru."}
        showTeamBadge={showTeamBadge}
        teamMap={teamMap}
      />

      {/* Hover comparison popover card */}
      <GoalieHoverComparisonCard hovered={hovered} />
    </div>
  );
}

function GoalieTable({
  title,
  badgeText,
  badgeColor,
  teamLogo,
  goalies,
  avgOv,
  viewMode,
  sort,
  onSort,
  active,
  onRowMouseEnter,
  onRowMouseLeave,
  emptyMessage,
  showTeamBadge,
  teamMap,
}: {
  title: string;
  badgeText: string;
  badgeColor: string;
  teamLogo: string | null;
  goalies: ProjGoalie[];
  avgOv: string;
  viewMode: ViewMode;
  sort: GoalieSortConfig;
  onSort: (k: GoalieSortKey) => void;
  active: boolean;
  onRowMouseEnter: (e: React.MouseEvent, p: ProjGoalie) => void;
  onRowMouseLeave: () => void;
  emptyMessage: string;
  showTeamBadge?: boolean;
  teamMap?: Map<number, { id: number; slug: string; code: string; name: string; logoUrl: string | null }>;
}) {
  const arrow = (k: GoalieSortKey) =>
    sort.key === k ? (sort.dir === "asc" ? " ▲" : " ▾") : "";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl">
      {/* Header bar */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          {teamLogo ? (
            <img src={teamLogo} alt="" className="w-6 h-6 object-contain shrink-0" />
          ) : (
            <span className="w-6 h-6 rounded bg-slate-800 grid place-items-center text-[10px] font-bold text-slate-300">
              {badgeText}
            </span>
          )}
          <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badgeColor}`}>
            {badgeText}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            Brankári: <b className="text-white">{goalies.length}</b>
          </span>
          <span className="text-slate-700">·</span>
          <span>
            Priem. OV: <b className="text-amber-300">{avgOv}</b>
          </span>
        </div>
      </div>

      {/* Table container with sticky headers and scroll */}
      <div className="overflow-x-auto max-h-[580px] overflow-y-auto overscroll-contain">
        <table className="w-full text-xs text-left" style={{ minWidth: 1200 }}>
          <thead>
            <tr className="bg-slate-950/95 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider sticky top-0 z-20 select-none backdrop-blur-md">
              {/* Sticky Player Name & Number */}
              <th
                onClick={() => onSort("name")}
                className="py-2.5 px-3 font-bold text-slate-300 hover:text-white cursor-pointer sticky left-0 z-30 bg-slate-950 min-w-[190px] border-r border-slate-800/80"
              >
                Brankár{arrow("name")}
              </th>

              {/* Age */}
              <th
                onClick={() => onSort("age")}
                className="py-2.5 px-2 text-center font-bold hover:text-white cursor-pointer w-10"
              >
                Vek{arrow("age")}
              </th>

              {/* GP */}
              <th
                onClick={() => onSort("gp")}
                className="py-2.5 px-2 text-center font-bold hover:text-white cursor-pointer w-12"
                title="Zápasy v aktuálnej sezóne"
              >
                GP{arrow("gp")}
              </th>

              {/* Overall */}
              <th
                onClick={() => onSort("ov")}
                className="py-2.5 px-2.5 text-center font-black text-amber-300 hover:text-amber-200 cursor-pointer w-12 border-r border-slate-800/80 bg-amber-950/20"
                title="Celkový rating brankára (Overall)"
              >
                OV{arrow("ov")}
              </th>

              {/* Advanced Live Stats */}
              <th
                onClick={() => onSort("svPct")}
                className="py-2.5 px-2 text-center font-bold text-emerald-400 hover:text-white cursor-pointer w-16"
                title="Save % (Úspešnosť zásahov)"
              >
                SV%{arrow("svPct")}
              </th>
              <th
                onClick={() => onSort("gaa")}
                className="py-2.5 px-2 text-center font-bold text-emerald-400 hover:text-white cursor-pointer w-14"
                title="GAA (Priemer gólov / 60)"
              >
                GAA{arrow("gaa")}
              </th>
              <th
                onClick={() => onSort("gsax")}
                className="py-2.5 px-2 text-center font-bold text-emerald-400 hover:text-white cursor-pointer w-14"
                title="GSAx (Góly chytené nad očakávanie)"
              >
                GSAx{arrow("gsax")}
              </th>
              <th
                onClick={() => onSort("gsax60")}
                className="py-2.5 px-2 text-center font-bold text-emerald-400 hover:text-white cursor-pointer w-16"
                title="GSAx / 60 min"
              >
                GSAx/60{arrow("gsax60")}
              </th>
              <th
                onClick={() => onSort("hdSv")}
                className="py-2.5 px-2 text-center font-bold text-emerald-400 hover:text-white cursor-pointer w-16 border-r border-slate-800/80"
                title="High-Danger SV% (Úspešnosť pri tutovkách)"
              >
                HD SV%{arrow("hdSv")}
              </th>

              {/* All 13 Goalie Parameters */}
              {ALL_GOALIE_PARAMS.map((k) => {
                const meta = GOALIE_PARAM_META[k];
                const isSorted = sort.key === k;
                return (
                  <th
                    key={k}
                    onClick={() => onSort(k)}
                    className={`py-2.5 px-1.5 text-center font-bold hover:text-white cursor-pointer transition-colors text-slate-300 ${
                      isSorted ? "bg-slate-800/50" : ""
                    }`}
                    title={`${meta.label} — ${meta.name}`}
                  >
                    <span>{meta.label}</span>
                    {arrow(k)}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {goalies.length === 0 ? (
              <tr>
                <td
                  colSpan={22}
                  className="py-10 text-center text-slate-500 text-sm font-medium"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              goalies.map((p) => {
                const s = p.stats ?? {};
                return (
                  <tr
                    key={p.id}
                    onMouseEnter={(e) => onRowMouseEnter(e, p)}
                    onMouseLeave={onRowMouseLeave}
                    className="hover:bg-slate-800/40 transition-colors group cursor-default"
                  >
                    {/* Sticky Name Cell */}
                    <td className="py-2 px-3 sticky left-0 z-10 bg-slate-900/95 group-hover:bg-slate-850/95 backdrop-blur-sm border-r border-slate-800/80">
                      <div className="flex items-center gap-2.5 min-w-[170px]">
                        <PlayerAvatar src={p.photoUrl} alt={p.name} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p.number != null && (
                              <span className="text-[10px] font-mono text-slate-500">
                                #{p.number}
                              </span>
                            )}
                            <PlayerLink
                              slug={p.slug}
                              id={p.id}
                              name={p.name}
                              className="font-semibold text-white truncate hover:underline"
                            />
                            {showTeamBadge && p.teamId && teamMap?.has(p.teamId) && (
                              <Link
                                href={`/tools/player-calculator?team=${teamMap.get(p.teamId)?.slug ?? "all"}`}
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-slate-800/90 hover:bg-amber-600/30 text-slate-300 hover:text-amber-200 border border-slate-700/80 transition"
                                title={teamMap.get(p.teamId)?.name ?? "Prejsť na tím"}
                              >
                                {teamMap.get(p.teamId)?.code ?? "—"}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Age */}
                    <td className="py-2 px-2 text-center text-slate-400 tabular-nums">
                      {p.age ?? "—"}
                    </td>

                    {/* GP */}
                    <td className="py-2 px-2 text-center tabular-nums">
                      <span className="text-slate-200">{p.gp > 0 ? p.gp : "—"}</span>
                    </td>

                    {/* Overall */}
                    <td className="py-2 px-2 text-center tabular-nums border-r border-slate-800/80 bg-amber-950/10">
                      {viewMode === "diff" ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-black text-amber-300 bg-amber-500/15 border border-amber-500/30">
                          <span>{p.overall ?? "—"}</span>
                          {p.overallProjected != null && p.overall != null && p.overallProjected !== p.overall && (
                            <span
                              className={`text-[10px] font-black ${
                                p.overallProjected > p.overall ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {p.overallProjected > p.overall
                                ? `▲+${p.overallProjected - p.overall}`
                                : `▼${p.overallProjected - p.overall}`}
                            </span>
                          )}
                        </span>
                      ) : viewMode === "compare" ? (
                        <div className="flex items-center justify-center gap-1.5 text-xs">
                          <span className="text-slate-300 font-bold">{p.overall ?? "—"}</span>
                          <span className="text-slate-600">→</span>
                          <span className="text-amber-300 font-black">{p.overallProjected ?? p.overall ?? "—"}</span>
                        </div>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded font-black text-amber-300 bg-amber-500/15 border border-amber-500/30">
                          {p.overallProjected ?? p.overall ?? "—"}
                        </span>
                      )}
                    </td>

                    {/* Advanced Stats */}
                    <td className="py-2 px-2 text-center tabular-nums font-mono text-emerald-300">
                      {s.svPct != null ? (s.svPct * 100).toFixed(1) + "%" : "—"}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums font-mono text-slate-300">
                      {s.gaa != null ? s.gaa.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums font-mono font-bold">
                      {s.gsax != null ? (
                        <span className={s.gsax >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {s.gsax > 0 ? `+${s.gsax.toFixed(1)}` : s.gsax.toFixed(1)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums font-mono">
                      {s.gsax60 != null ? (
                        <span className={s.gsax60 >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {s.gsax60 > 0 ? `+${s.gsax60.toFixed(2)}` : s.gsax60.toFixed(2)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 px-2 text-center tabular-nums font-mono text-sky-300 border-r border-slate-800/80">
                      {s.hdSv != null ? (s.hdSv * 100).toFixed(1) + "%" : "—"}
                    </td>

                    {/* All 13 Parameters */}
                    {ALL_GOALIE_PARAMS.map((k) => {
                      const act = p.actual[k];
                      const proj = p.projected[k];
                      const diff = act != null && proj != null ? proj - act : 0;

                      let displayVal = act;
                      if (viewMode === "projected") {
                        displayVal = proj ?? act;
                      }

                      return (
                        <td key={k} className="py-2 px-1.5 text-center tabular-nums">
                          {viewMode === "compare" ? (
                            <div className="flex items-center justify-center gap-1 text-[11px] whitespace-nowrap">
                              <span className={ratingColor(act)}>{act ?? "—"}</span>
                              {diff !== 0 && (
                                <>
                                  <span className="text-slate-500 text-[9px]">→</span>
                                  <span
                                    className={`font-bold ${
                                      diff > 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}
                                  >
                                    {proj}
                                  </span>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-center gap-0.5">
                              <span className={ratingColor(displayVal)}>
                                {displayVal ?? "—"}
                              </span>
                              {viewMode === "diff" && diff !== 0 && (
                                <span
                                  className={`text-[9px] font-bold ${
                                    diff > 0 ? "text-emerald-400" : "text-rose-400"
                                  }`}
                                  title={`Aktuálne: ${act} → Prepočítané: ${proj} (${diff > 0 ? `+${diff}` : diff})`}
                                >
                                  {diff > 0 ? `+${diff}` : diff}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GoalieHoverComparisonCard({
  hovered,
}: {
  hovered: { player: ProjGoalie; x: number; y: number } | null;
}) {
  if (!hovered) return null;
  const { player: p, x, y } = hovered;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  const cardWidth = 760;
  const cardHeight = 310;

  let top = y + 8;
  if (top + cardHeight > vh - 16) {
    top = Math.max(10, y - cardHeight - 44);
  }

  let left = Math.max(16, Math.min(x, vw - cardWidth - 20));

  const s = p.stats ?? {};

  return (
    <div
      style={{
        position: "fixed",
        top,
        left,
        width: Math.min(cardWidth, vw - 32),
        zIndex: 100,
      }}
      className="pointer-events-none rounded-3xl border border-slate-700/90 bg-slate-950/98 p-5 shadow-2xl backdrop-blur-3xl ring-2 ring-white/10 animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header with avatar and Overall */}
      <div className="flex items-center justify-between gap-4 pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-3.5 min-w-0">
          <PlayerAvatar src={p.photoUrl} alt={p.name} size={48} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {p.number != null && (
                <span className="text-sm font-mono text-slate-500 font-bold">
                  #{p.number}
                </span>
              )}
              <span className="font-black text-white text-lg tracking-tight truncate">
                {cleanName(p.name)}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-300">
                G
              </span>
              {p.classification && (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                    p.classification === "NHL"
                      ? "text-sky-300 bg-sky-500/10 border-sky-500/30"
                      : "text-purple-300 bg-purple-500/10 border-purple-500/30"
                  }`}
                >
                  {p.classification}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2.5 flex-wrap">
              {p.age != null && <span><b>{p.age}</b> rokov</span>}
              {p.gp > 0 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span><b>{p.gp}</b> GP</span>
                </>
              )}
              {p.statusText && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-300">{p.statusText}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">
              Celkový Rating (OV)
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-slate-300 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 tabular-nums">
                {p.overall ?? "—"} <span className="text-[10px] font-semibold text-slate-400">Akt</span>
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className="text-lg font-black text-amber-300 px-2.5 py-1 rounded-xl bg-amber-600/20 border border-amber-500/40 tabular-nums flex items-center gap-1">
                <span>{p.overallProjected ?? p.overall ?? "—"}</span>
                <span className="text-[10px] font-bold text-amber-400">Proj</span>
                {p.overallProjected != null && p.overall != null && p.overallProjected !== p.overall && (
                  <span
                    className={`text-xs font-black ml-0.5 ${
                      p.overallProjected > p.overall ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {p.overallProjected > p.overall
                      ? `+${p.overallProjected - p.overall}`
                      : p.overallProjected - p.overall}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Stats Pill Bar */}
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-800/80 overflow-x-auto text-xs">
        <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">SV%</span>
          <span className="font-bold text-emerald-400">{s.svPct != null ? (s.svPct * 100).toFixed(1) + "%" : "—"}</span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">GAA</span>
          <span className="font-bold text-slate-200">{s.gaa != null ? s.gaa.toFixed(2) : "—"}</span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">GSAx</span>
          <span className={`font-bold ${s.gsax != null && s.gsax >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {s.gsax != null ? (s.gsax > 0 ? `+${s.gsax.toFixed(1)}` : s.gsax.toFixed(1)) : "—"}
          </span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">GSAx/60</span>
          <span className={`font-bold ${s.gsax60 != null && s.gsax60 >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {s.gsax60 != null ? (s.gsax60 > 0 ? `+${s.gsax60.toFixed(2)}` : s.gsax60.toFixed(2)) : "—"}
          </span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">HD SV%</span>
          <span className="font-bold text-sky-400">{s.hdSv != null ? (s.hdSv * 100).toFixed(1) + "%" : "—"}</span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">RebCtrl</span>
          <span className="font-bold text-indigo-300">{s.rebCtrl != null ? s.rebCtrl.toFixed(2) : "—"}</span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">Freeze %</span>
          <span className="font-bold text-purple-300">{s.freezePct != null ? (s.freezePct * 100).toFixed(0) + "%" : "—"}</span>
        </div>
      </div>

      {/* Comparison Matrix */}
      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <table className="w-full text-center text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase font-extrabold text-slate-400">
              <th className="py-1.5 px-2 text-left text-slate-500 min-w-[85px]">Stav</th>
              {ALL_GOALIE_PARAMS.map((k) => (
                <th key={k} className="py-1.5 px-1.5 min-w-[38px] text-amber-300 font-bold" title={GOALIE_PARAM_META[k].name}>
                  {GOALIE_PARAM_META[k].label}
                </th>
              ))}
              <th className="py-1.5 px-2 min-w-[44px] text-amber-300 font-black border-l border-slate-800">
                OV
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {/* Actual */}
            <tr>
              <td className="py-2 px-2 text-left font-sans text-xs font-bold text-slate-400">Tento rok</td>
              {ALL_GOALIE_PARAMS.map((k) => (
                <td key={k} className="py-2 px-1 text-slate-300 font-semibold">
                  {p.actual[k] ?? "—"}
                </td>
              ))}
              <td className="py-2 px-2 font-bold text-slate-200 border-l border-slate-800 bg-slate-900/50">
                {p.overall ?? "—"}
              </td>
            </tr>

            {/* Projected */}
            <tr className="bg-amber-950/15">
              <td className="py-2 px-2 text-left font-sans text-xs font-black text-amber-300">Live Odhad</td>
              {ALL_GOALIE_PARAMS.map((k) => (
                <td key={k} className="py-2 px-1 text-white font-black">
                  {p.projected[k] ?? p.actual[k] ?? "—"}
                </td>
              ))}
              <td className="py-2 px-2 font-black text-amber-300 border-l border-slate-800 bg-amber-900/30">
                {p.overallProjected ?? p.overall ?? "—"}
              </td>
            </tr>

            {/* Difference */}
            <tr className="bg-slate-900/40 text-xs">
              <td className="py-1.5 px-2 text-left font-sans font-bold text-slate-500">Rozdiel</td>
              {ALL_GOALIE_PARAMS.map((k) => {
                const diff = (p.projected[k] ?? 0) - (p.actual[k] ?? 0);
                return (
                  <td key={k} className={`py-1.5 px-1 font-bold ${diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-slate-600"}`}>
                    {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "—"}
                  </td>
                );
              })}
              <td className="py-1.5 px-2 font-black border-l border-slate-800">
                {p.overallProjected != null && p.overall != null && p.overallProjected !== p.overall ? (
                  <span className={p.overallProjected > p.overall ? "text-emerald-400" : "text-rose-400"}>
                    {p.overallProjected > p.overall ? `+${p.overallProjected - p.overall}` : p.overallProjected - p.overall}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
