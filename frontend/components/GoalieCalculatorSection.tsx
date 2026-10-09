"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import PlayerAvatar from "@/components/playerAvatar";
import PlayerLink from "@/components/PlayerLink";
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
    rect: DOMRect;
  } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent, p: ProjGoalie) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHovered({ player: p, rect });
  };

  const handleMouseLeave = () => {
    setHovered(null);
  };

  // Dismiss on scroll
  useEffect(() => {
    const onScroll = () => setHovered(null);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    ? "NHL — All league goalies"
    : `${selectedTeam.name} — NHL Goalies`;

  const ahlTitle = isAll
    ? "AHL — All league goalies (Farm)"
    : affiliate
    ? `${affiliate.name} — AHL Farm Goalies`
    : `${selectedTeam.name} — AHL Farm Goalies`;

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
        emptyMessage={emptyMessage || "No goalies on the NHL roster match the filter."}
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
        emptyMessage={emptyMessage || "No goalies on the AHL roster match the filter."}
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
            Goalies: <b className="text-white">{goalies.length}</b>
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
                Goalie{arrow("name")}
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
                title="Games in the current season"
              >
                GP{arrow("gp")}
              </th>

              {/* Overall */}
              <th
                onClick={() => onSort("ov")}
                className="py-2.5 px-2.5 text-center font-black text-amber-300 hover:text-amber-200 cursor-pointer w-12 border-r border-slate-800/80 bg-amber-950/20"
                title="Goalie overall rating (Overall)"
              >
                OV{arrow("ov")}
              </th>

              {/* Advanced Live Stats */}
              <th
                onClick={() => onSort("svPct")}
                className="py-2.5 px-2 text-center font-bold text-emerald-400 hover:text-white cursor-pointer w-16"
                title="Save % (Save percentage)"
              >
                SV%{arrow("svPct")}
              </th>
              <th
                onClick={() => onSort("gaa")}
                className="py-2.5 px-2 text-center font-bold text-emerald-400 hover:text-white cursor-pointer w-14"
                title="GAA (Goals-against average / 60)"
              >
                GAA{arrow("gaa")}
              </th>
              <th
                onClick={() => onSort("gsax")}
                className="py-2.5 px-2 text-center font-bold text-emerald-400 hover:text-white cursor-pointer w-14"
                title="GSAx (Goals saved above expected)"
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
                title="High-Danger SV% (Save % on high-danger shots)"
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
                                title={teamMap.get(p.teamId)?.name ?? "Go to team"}
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
                                  title={`Current: ${act} → Recalculated: ${proj} (${diff > 0 ? `+${diff}` : diff})`}
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

const GOALIE_ATTRS: Array<{ key: GoalieParamKey; label: string; nameSk: string; nameEn: string }> = [
  { key: "sz", label: "SZ", nameSk: "Veľkosť", nameEn: "Size" },
  { key: "ag", label: "AG", nameSk: "Pohyblivosť", nameEn: "Agility" },
  { key: "rb", label: "RB", nameSk: "Vyrážanie", nameEn: "Rebounds" },
  { key: "sc", label: "SC", nameSk: "Štýl / Pokrytie", nameEn: "Style Control" },
  { key: "hs", label: "HS", nameSk: "Vysoké strely", nameEn: "High Shots" },
  { key: "rt", label: "RT", nameSk: "Reflexy / Nízke", nameEn: "Reflexes" },
  { key: "ph", label: "PH", nameSk: "Hra s hokejkou", nameEn: "Puck Handling" },
  { key: "sk", label: "SK", nameSk: "Korčuľovanie", nameEn: "Skating" },
  { key: "du", label: "DU", nameSk: "Odolnosť", nameEn: "Durability" },
  { key: "en", label: "EN", nameSk: "Výdrž", nameEn: "Endurance" },
  { key: "ex", label: "EX", nameSk: "Skúsenosti", nameEn: "Experience" },
  { key: "ps", label: "PS", nameSk: "Nájazdy", nameEn: "Penalty Shot" },
];

function getPopoverStyle(rect: DOMRect): React.CSSProperties {
  const width = 380;
  const padding = 16;
  const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const windowHeight = typeof window !== "undefined" ? window.innerHeight : 800;

  let left = rect.right + 12;
  if (left + width > windowWidth - padding) {
    left = rect.left - width - 12;
  }
  if (left < padding) {
    left = Math.max(padding, windowWidth - width - padding);
  }

  const estimatedHeight = 360;
  let top = rect.top - 8;
  if (top + estimatedHeight > windowHeight - padding) {
    top = windowHeight - estimatedHeight - padding;
  }
  if (top < padding) {
    top = padding;
  }

  return {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  };
}

function GoalieHoverComparisonCard({
  hovered,
}: {
  hovered: { player: ProjGoalie; rect: DOMRect } | null;
}) {
  if (!hovered) return null;
  const { player: p, rect } = hovered;

  const ovAct = p.overall ?? 50;
  const ovProj = p.overallProjected ?? ovAct;
  const ovDiff = ovProj - ovAct;
  const s = p.stats ?? {};

  return (
    <div
      style={getPopoverStyle(rect)}
      className="fixed z-50 pointer-events-none transition-opacity duration-150 animate-in fade-in zoom-in-95"
    >
      <div className="w-[380px] rounded-2xl bg-slate-950/95 border border-slate-700/80 shadow-[0_25px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl p-4 text-xs text-white space-y-3 ring-1 ring-amber-500/20">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <PlayerAvatar src={p.photoUrl} alt={p.name} size={42} />
            <div className="min-w-0">
              <div className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                {p.number != null && <span className="text-slate-500 font-mono font-bold text-xs">#{p.number}</span>}
                <span className="truncate">{cleanName(p.name)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold border bg-amber-500/10 border-amber-500/30 text-amber-300">
                  G
                </span>
                {p.age != null && <span>• {p.age} r.</span>}
                {p.gp > 0 && <span>• {p.gp} GP</span>}
                {p.classification && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {p.classification}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Overall comparison */}
          <div className="text-right shrink-0 pl-2">
            <div className="text-[10px] uppercase font-bold text-slate-400">OV</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs font-semibold text-slate-400">{ovAct}</span>
              <span className="text-slate-500 text-[10px]">→</span>
              <span className="text-sm font-black text-amber-300">{ovProj}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] border font-bold ${
                  ovDiff > 0
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : ovDiff < 0
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : "bg-slate-800 text-slate-400 border-slate-700 font-normal"
                }`}
              >
                {ovDiff > 0 ? `+${ovDiff}` : `${ovDiff}`}
              </span>
            </div>
          </div>
        </div>

        {/* Goalie advanced stats pills */}
        {(s.svPct != null || s.gaa != null || s.gsax != null) && (
          <div className="flex items-center gap-1.5 text-[10px] overflow-x-auto pb-0.5">
            {s.svPct != null && (
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                SV% <strong className="text-emerald-400">{(s.svPct * 100).toFixed(1)}%</strong>
              </span>
            )}
            {s.gaa != null && (
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                GAA <strong className="text-slate-200">{s.gaa.toFixed(2)}</strong>
              </span>
            )}
            {s.gsax != null && (
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                GSAx <strong className={s.gsax >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {s.gsax > 0 ? `+${s.gsax.toFixed(1)}` : s.gsax.toFixed(1)}
                </strong>
              </span>
            )}
          </div>
        )}

        {/* Core Attributes comparison (SZ, AG, RB, SC, HS, RT) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Kľúčové parametre</span>
            <span className="text-[9px] font-normal text-slate-400 opacity-80">
              Pôvodné → Nové (Posun)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {GOALIE_ATTRS.slice(0, 6).map((attr) => {
              const act = p.actual[attr.key] ?? 0;
              const proj = p.projected[attr.key] ?? act;
              const d = proj - act;
              return (
                <div
                  key={attr.key}
                  className={`flex items-center justify-between p-1.5 rounded-xl border text-[11px] ${
                    d > 0
                      ? "bg-emerald-950/25 border-emerald-500/35"
                      : d < 0
                      ? "bg-rose-950/25 border-rose-500/35"
                      : "bg-slate-900/60 border-slate-800"
                  }`}
                >
                  <div className="min-w-0 pr-1">
                    <span className="font-black text-white mr-1">{attr.label}</span>
                    <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                      {attr.nameSk}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-mono">
                    <span className="text-slate-400 text-[10px]">{act}</span>
                    <span className="text-slate-500 text-[9px]">→</span>
                    <span className="font-bold text-white text-[11px]">{proj}</span>
                    <span
                      className={`px-1 py-0.2 rounded text-[10px] font-bold ${
                        d > 0 ? "text-emerald-400" : d < 0 ? "text-rose-400" : "text-slate-400"
                      }`}
                    >
                      ({d > 0 ? `+${d}` : d})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Secondary Attributes comparison (PH, SK, DU, EN, EX, PS) */}
        <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Ostatné atribúty
          </div>
          <div className="grid grid-cols-3 gap-1">
            {GOALIE_ATTRS.slice(6).map((attr) => {
              const act = p.actual[attr.key] ?? 0;
              const proj = p.projected[attr.key] ?? act;
              const d = proj - act;
              return (
                <div
                  key={attr.key}
                  className={`p-1 rounded-lg border text-center text-[10px] ${
                    d > 0
                      ? "bg-emerald-950/25 border-emerald-500/35 text-emerald-300"
                      : d < 0
                      ? "bg-rose-950/25 border-rose-500/35 text-rose-300"
                      : "bg-slate-900/50 border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="font-bold text-white">{attr.label}</div>
                  <div className="font-mono mt-0.5 text-[9px]">
                    {act}→<strong className="text-white">{proj}</strong>
                  </div>
                  <div className="font-bold text-[9px]">
                    {d > 0 ? `+${d}` : d}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-1 border-t border-slate-800/60 text-[10px] text-slate-400 flex items-center justify-between">
          <span>✨ Prepočet v reálnom čase</span>
          <span className="font-mono">{p.statusText ?? p.classification ?? "NHL"}</span>
        </div>
      </div>
    </div>
  );
}
