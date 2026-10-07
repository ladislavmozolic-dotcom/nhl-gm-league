"use client";

import EventBadge from "@/components/EventBadge";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cleanName } from "@/lib/playerName";
import type { GameReport, GameFlow } from "@/lib/game-report-server";
import GameReportCard from "@/components/GameReportCard";
import GameFlowChart from "@/components/GameFlowChart";
import { useLang } from "@/components/LangProvider";
import { presetLabel } from "@/lib/tactics-i18n";

// ---- types (shape passed from the server page) ------------------------------
type Skater = {
  id: number; name: string; position: string; slug: string | null;
  goals: number; assists: number; points: number; shots: number; pim: number;
  plusMinus: number; ppGoals: number; shGoals: number; gwg: number;
  hits: number; blocks: number; faceoffWins: number; faceoffLosses: number; toi: number;
  ppToi?: number; pkToi?: number;
  conAfter: number | null; xg?: number; hdShots?: number;
};
type Goalie = {
  id: number; name: string; slug: string | null; started: boolean;
  shotsAgainst: number; saves: number; goalsAgainst: number;
  conBefore: number | null; conAfter: number | null; fatigued: boolean; decision: string | null;
  record?: { w: number; l: number; otl: number };
  xga?: number;
  isSteal?: boolean;
  hdShotsAg?: number; hdSaves?: number; mdShotsAg?: number; mdSaves?: number; ldShotsAg?: number; ldSaves?: number;
};
type LineGroup = { title: string; cols: string[]; units: { n: number; players: (string | null)[]; tactic?: { phy: number; df: number; of: number }; wanted?: number }[] };
type Side = {
  teamId: number; name: string; slug: string; logoUrl: string | null; code?: string | null;
  goals: number; shots: number; goalsByPeriod: number[]; shotsByPeriod: number[];
  xg?: number | null; hd?: number | null;
  ozPct?: number | null; nzPct?: number | null; dzPct?: number | null;
  shotSectors?: number[]; topShot?: number | null; topShotBy?: string | null; avgShot?: number | null;
  shotDots?: { sector: string; xg: number | null; goal: boolean; playerName: string | null }[];
  skaters: Skater[]; goalies: Goalie[]; lines?: LineGroup[];
  record?: { w: number; l: number; otl: number } | null;
};
type GoalAssist = { name: string; slug: string | null; total: number | null };
type GoalE = { period: number; seconds: number; teamId: number; scorerName: string; scorerSlug?: string | null; scorerSeasonGoal?: number; assistNames: string[]; assists?: GoalAssist[]; strength: string; emptyNet: boolean; homeScoreAfter: number; awayScoreAfter: number; onIceForNames?: string[]; onIceAgainstNames?: string[] };
type PenE = { period: number; seconds: number; teamId: number; playerName: string; type: string; minutes: number; severity: string; givesPP: boolean; offsetting: boolean };
type PbpE = { period: number; seconds: number; time: string; teamId: number | null; kind: string; text: string; major: boolean };
type ShootoutE = { round: number; teamId: number; teamCode: string | null; shooterName: string; shooterSlug: string | null; result: "goal" | "save" | "miss" };
type InjuryRow = { period: number; seconds: number; teamId: number | null; playerName: string; playerSlug: string | null; part: string; mechanism: string; severity: string; days: number; byName: string | null };
type SystemDials = { tempo?: string; forecheck?: string; puckStyle?: string; dZone?: string; preset?: string } | null;
type Data = {
  id: number; endedIn: string; home: Side; away: Side; homeTeamId: number; awayTeamId: number;
  goals: GoalE[]; penalties: PenE[]; playByPlay: PbpE[]; shootout?: ShootoutE[];
  injuries?: InjuryRow[]; homeSystem?: SystemDials; awaySystem?: SystemDials;
  story?: { report: GameReport; flow: GameFlow } | null;
  attendance?: number | null; arena?: string | null; event?: { kind: string; title: string; venue: string | null } | null; officials?: { name: string; number: number | null; role: string }[]; gameDate?: string | Date | null;
  seriesId?: number | null; gameNum?: number | null; round?: number | null;
};

function ShootoutView({ data }: { data: Data }) {
  const so = data.shootout ?? [];
  if (so.length === 0) return null;
  const goals = (id: number) => so.filter((a) => a.teamId === id && a.result === "goal").length;
  const icon = (r: string) => r === "goal" ? "🚨" : r === "miss" ? "🚫" : "🧤";
  const label = (r: string) => r === "goal" ? "goal" : r === "miss" ? "missed the net" : "saved by goalie";
  return (
    <div className="mt-6">
      <div className="flex items-baseline gap-3 mb-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Shootout</h3>
        <span className="text-sm text-slate-400 tabular-nums">{data.away.code ?? data.away.name} {goals(data.awayTeamId)} — {goals(data.homeTeamId)} {data.home.code ?? data.home.name}</span>
      </div>
      <div className="border border-slate-800 rounded-lg overflow-hidden">
        {so.map((a, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-1.5 border-b border-slate-800/60 last:border-0 text-sm">
            <span className="w-6 text-[11px] text-slate-500 tabular-nums">{a.round}</span>
            <span className="text-[11px] font-bold text-slate-500 w-9">{a.teamCode}</span>
            <span className="w-5 text-center">{icon(a.result)}</span>
            {a.shooterSlug
              ? <Link href={`/players/${a.shooterSlug}`} className="font-medium text-slate-100 hover:text-blue-400">{a.shooterName}</Link>
              : <span className="font-medium text-slate-100">{a.shooterName}</span>}
            <span className={`text-xs ${a.result === "goal" ? "text-green-400" : "text-slate-500"}`}>{label(a.result)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

const sevClass = (s: string) => s === "Season-ending" ? "text-red-500 font-bold" : s === "Long-term" ? "text-red-400" : s === "Multi-week" ? "text-orange-400" : s === "Week-to-Week" ? "text-amber-400" : "text-slate-400";

const DIAL_LABEL: Record<string, string> = {
  slow: "Slow", balanced: "Balanced", fast: "Fast", passive: "Passive", aggressive: "Aggressive",
  cycle: "Cycle", rush: "Rush", shotVolume: "Shot Volume", collapse: "Collapse",
};
function SystemSummary({ s }: { s: { tempo?: string; forecheck?: string; puckStyle?: string; dZone?: string; preset?: string } | null | undefined }) {
  const lang = useLang();
  if (!s) return <span className="text-slate-500 text-sm">{presetLabel(lang, "Balanced")}</span>;
  if (s.preset && s.preset !== "Balanced") return <span className="text-sky-300 text-sm font-semibold">{presetLabel(lang, s.preset)}</span>;
  const dials = ([["Tempo", s.tempo], ["Forecheck", s.forecheck], ["Puck", s.puckStyle], ["D-Zone", s.dZone]] as const)
    .filter(([, v]) => v && v !== "balanced");
  if (dials.length === 0) return <span className="text-slate-400 text-sm">{presetLabel(lang, "Balanced")}</span>;
  return <span className="text-sm text-slate-300">{dials.map(([k, v]) => `${k}: ${DIAL_LABEL[v as string] ?? v}`).join(" · ")}</span>;
}
// 4 = OT; beyond that it's a shootout in the regular season, or 2nd/3rd… OT in a playoff marathon
const periodLabel = (p: number, endedIn?: string) =>
  p <= 3 ? `${p}${["st", "nd", "rd"][p - 1]} Period` : p === 4 ? "Overtime" : endedIn === "SO" ? "Shootout" : `${p - 3}${["st", "nd", "rd"][p - 4] ?? "th"} Overtime`;
const strengthTag = (g: { strength: string; emptyNet: boolean }) => (g.emptyNet ? "EN" : g.strength !== "EV" ? g.strength : "");
const svp = (g: Goalie) => (g.shotsAgainst ? g.saves / g.shotsAgainst : 0);

// ---- 3 stars computation ----------------------------------------------------
function threeStars(data: Data) {
  type Star = { name: string; slug: string | null; teamId: number; line: string; score: number };
  const cands: Star[] = [];
  for (const side of [data.away, data.home]) {
    for (const s of side.skaters) {
      if (!s.points && !s.shots) continue;
      const score = s.goals * 3.2 + s.assists * 2 + s.plusMinus * 0.4 + s.shots * 0.08 + s.gwg * 1.5;
      cands.push({
        name: cleanName(s.name), slug: s.slug, teamId: side.teamId,
        line: `${s.goals}G ${s.assists}A`, score,
      });
    }
    for (const g of side.goalies) {
      if (!g.started || g.shotsAgainst < 15) continue;
      // save-%-only (matches the season Three Stars page): saves above a 0.915 baseline
      // — an average night scores ≤0, so goalies star only on a strong SV% (~.94%+); a
      // shutout gets a bonus. Low-scoring games (low GA → high SV%) can star both goalies.
      const savesAbove = g.saves - g.shotsAgainst * 0.915;
      const score = savesAbove * 3 + (g.goalsAgainst === 0 ? 2 : 0);
      cands.push({
        name: cleanName(g.name), slug: g.slug, teamId: side.teamId,
        line: `${g.saves}/${g.shotsAgainst}, ${(svp(g) * 100).toFixed(1)}%`, score,
      });
    }
  }
  return cands.sort((a, b) => b.score - a.score).slice(0, 3);
}

// ---- small pieces -----------------------------------------------------------
// ---- small pieces -----------------------------------------------------------
function Linescore({ title, sub, side, home, field }: { title: string; sub: string; side: Data; home: Side; field: "goalsByPeriod" | "shotsByPeriod" }) {
  const a = side.away[field], h = home[field];
  const hasOT = side.endedIn !== "REG";
  const heads = hasOT ? ["1", "2", "3", "OT"] : ["1", "2", "3"];
  const idxs = heads.map((_, i) => i);
  const sum = (arr: number[]) => arr.reduce((x, y) => x + y, 0);
  const Row = ({ name, dotColor, arr }: { name: string; dotColor: string; arr: number[] }) => (
    <tr className="hover:bg-slate-800/20 border-t border-slate-800/60 font-mono">
      <td className="py-2.5 font-sans font-bold text-white flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span>{name}</span>
      </td>
      {idxs.map((c) => <td key={c} className="py-2.5 px-3 text-center tabular-nums text-slate-300">{arr[c] ?? 0}</td>)}
      <td className="py-2.5 pl-3 text-center font-black text-white text-base tabular-nums">{sum(arr)}</td>
    </tr>
  );
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-[11px] text-slate-500 font-mono">{sub}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-xs border-b border-slate-800/80">
            <th className="text-left font-medium pb-2 text-slate-400">Team</th>
            {heads.map((x) => <th key={x} className="text-center font-medium pb-2 px-3 w-10">{x}</th>)}
            <th className="text-center font-black pb-2 pl-3 w-12 text-slate-200">T</th>
          </tr>
        </thead>
        <tbody>
          <Row name={side.away.name} dotColor="bg-sky-400" arr={a} />
          <Row name={home.name} dotColor="bg-rose-500" arr={h} />
        </tbody>
      </table>
    </div>
  );
}

function GoalieBlock({ side }: { side: Side }) {
  return (
    <div>
      <h3 className="font-bold mb-2">{side.name}</h3>
      {side.goalies.map((g) => {
        const con = g.conBefore != null && g.conAfter != null ? `${g.conBefore}→${g.conAfter}` : g.conAfter ?? "—";
        return (
          <div key={g.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between text-sm py-1.5 border-b border-slate-800/60 gap-2">
            <span className="flex items-center gap-2 flex-wrap">
              <Link href={`/players/${g.slug ?? g.id}`} className="font-semibold hover:text-blue-400 whitespace-nowrap">{cleanName(g.name)}</Link>
              {g.record && (g.record.w + g.record.l + g.record.otl > 0) && (
                <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap" title="Season record W-L-OTL (through this game)">{g.record.w}-{g.record.l}-{g.record.otl}</span>
              )}
              {!g.started && <span className="text-[10px] uppercase text-slate-500 border border-slate-700 rounded px-1">backup</span>}
              {g.fatigued && <span className="text-[10px] uppercase text-amber-500 border border-amber-700/50 rounded px-1">b2b</span>}
              {g.isSteal && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-300 bg-amber-500/20 border border-amber-500/40 rounded px-1.5 py-0.5 shadow-sm" title="Stolen game (Steal) — the goalie's GSAx exceeded the team's goal margin (excluding empty-net goals).">
                  🧤 Steal
                </span>
              )}
            </span>
            <span className="text-slate-300 tabular-nums text-right whitespace-nowrap">
              {g.started
                ? <>{g.saves}/{g.shotsAgainst} · {(svp(g) * 100).toFixed(1)}% · {g.goalsAgainst} GA{g.decision && <span className={`ml-2 text-xs font-bold ${g.decision === "W" ? "text-green-400" : "text-slate-500"}`}>[{g.decision}]</span>}</>
                : <span className="text-slate-500">DNP</span>}
              {g.started && g.xga != null && (() => { const gsax = g.xga - g.goalsAgainst; return (
                <span className={`ml-3 text-xs ${gsax >= 0 ? "text-green-400" : "text-red-400"}`} title="goals saved above expected">
                  GSAx {gsax >= 0 ? "+" : ""}{gsax.toFixed(1)}
                </span>
              ); })()}
              <span className="ml-3 text-xs text-slate-500">CON {con}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SkaterTable({ side }: { side: Side }) {
  type SortKey = "name" | "position" | "goals" | "assists" | "points" | "plusMinus" | "shots" | "xg" | "pim" | "hits" | "blocks" | "fo" | "toi" | "ppToi" | "pkToi" | "conAfter";
  const columns: Array<{ key: SortKey; label: string; title?: string }> = [
    { key: "goals", label: "G" }, { key: "assists", label: "A" }, { key: "points", label: "P" },
    { key: "plusMinus", label: "+/-" }, { key: "shots", label: "S" }, { key: "xg", label: "xG" },
    { key: "pim", label: "PIM" }, { key: "hits", label: "HIT" }, { key: "blocks", label: "BLK" },
    { key: "fo", label: "FO", title: "Sort by faceoff percentage" }, { key: "toi", label: "TOI" },
    { key: "ppToi", label: "PP" }, { key: "pkToi", label: "PK" }, { key: "conAfter", label: "CON" },
  ];
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "points", dir: "desc" });
  const sortValue = (s: Skater, key: SortKey): string | number | null => {
    if (key === "name") return cleanName(s.name).toLocaleLowerCase();
    if (key === "position") return (s.position ?? "").toLocaleLowerCase();
    if (key === "fo") {
      const attempts = s.faceoffWins + s.faceoffLosses;
      return attempts ? s.faceoffWins / attempts : null;
    }
    if (key === "xg") return s.xg ?? null;
    if (key === "ppToi") return s.ppToi ?? null;
    if (key === "pkToi") return s.pkToi ?? null;
    if (key === "conAfter") return s.conAfter;
    return s[key];
  };
  const sortedSkaters = side.skaters.map((skater, index) => ({ skater, index })).sort((a, b) => {
    const av = sortValue(a.skater, sort.key), bv = sortValue(b.skater, sort.key);
    if (av == null && bv == null) return a.index - b.index;
    if (av == null) return 1;
    if (bv == null) return -1;
    const compared = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
    return (sort.dir === "asc" ? compared : -compared) || a.index - b.index;
  }).map(({ skater }) => skater);
  const chooseSort = (key: SortKey) => setSort((old) => old.key === key
    ? { key, dir: old.dir === "desc" ? "asc" : "desc" }
    : { key, dir: key === "name" || key === "position" ? "asc" : "desc" });
  const sortHead = (sortKey: SortKey, label: string, align: "left" | "right" = "right", title?: string) => {
    const active = sort.key === sortKey;
    return (
      <th key={sortKey} className={`${align === "left" ? "text-left" : "text-right"} ${sortKey === "name" ? "py-1.5 pr-2 whitespace-nowrap" : "px-2 whitespace-nowrap"}`} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => chooseSort(sortKey)} title={title ?? `Sort by ${label}`} className={`inline-flex items-center gap-1 hover:text-slate-200 transition-colors ${active ? "text-sky-400" : ""}`}>
          {label}<span className={`text-[9px] w-2 ${active ? "opacity-100" : "opacity-0"}`} aria-hidden="true">{sort.dir === "asc" ? "▲" : "▼"}</span>
        </button>
      </th>
    );
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-700">
            {sortHead("name", "Player", "left")}
            {sortHead("position", "Pos", "left")}
            {columns.map((c) => sortHead(c.key, c.label, "right", c.title))}
          </tr>
        </thead>
        <tbody>
          {sortedSkaters.map((s) => {
            const fo = s.faceoffWins + s.faceoffLosses ? `${s.faceoffWins}-${s.faceoffLosses}` : "—";
            return (
              <tr key={s.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                <td className="py-1.5 pr-2 whitespace-nowrap"><Link href={`/players/${s.slug ?? s.id}`} className="hover:text-blue-400">{cleanName(s.name)}</Link></td>
                <td className="px-1 text-slate-500 text-xs whitespace-nowrap">{s.position}</td>
                <td className="px-2 text-right font-semibold tabular-nums">{s.goals}</td>
                <td className="px-2 text-right font-semibold tabular-nums">{s.assists}</td>
                <td className="px-2 text-right font-bold tabular-nums">{s.points}</td>
                <td className={`px-2 text-right tabular-nums ${s.plusMinus > 0 ? "text-emerald-400 font-medium" : s.plusMinus < 0 ? "text-rose-400 font-medium" : "text-slate-400"}`}>{s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus}</td>
                <td className="px-2 text-right tabular-nums text-slate-300">{s.shots}</td>
                <td className={`px-2 text-right tabular-nums ${s.xg && s.goals > s.xg + 0.5 ? "text-green-400" : "text-slate-400"}`} title={s.hdShots ? `${s.hdShots} high-danger` : undefined}>{s.xg != null ? s.xg.toFixed(1) : "—"}</td>
                <td className="px-2 text-right tabular-nums text-slate-300">{s.pim}</td>
                <td className="px-2 text-right tabular-nums text-slate-300">{s.hits}</td>
                <td className="px-2 text-right tabular-nums text-slate-300">{s.blocks}</td>
                <td className="px-2 text-right tabular-nums text-slate-400 whitespace-nowrap">{fo}</td>
                <td className="px-2 text-right tabular-nums text-slate-400 whitespace-nowrap">{mmss(s.toi)}</td>
                <td className="px-2 text-right tabular-nums text-emerald-400/80 whitespace-nowrap" title="Power-play TOI">{s.ppToi ? mmss(s.ppToi) : "—"}</td>
                <td className="px-2 text-right tabular-nums text-sky-400/80 whitespace-nowrap" title="Penalty-kill TOI">{s.pkToi ? mmss(s.pkToi) : "—"}</td>
                <td className={`px-2 text-right tabular-nums whitespace-nowrap ${s.conAfter != null && s.conAfter < 100 ? "text-amber-400" : "text-slate-600"}`}>{s.conAfter ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// STHS-style lines (deployment derived from ice time until the line editor exists)
function LinesTable({ title, rows, cols }: { title: string; rows: Array<{ n: number; players: string[]; phy: number; df: number; of: number; wanted: number; timePct: number; timePlay: string }>; cols: string[] }) {
  return (
    <div className="mb-4">
      <div className="bg-slate-800/60 text-center text-xs font-bold tracking-wide text-slate-300 py-1.5 rounded-t">{title}</div>
      <div className="overflow-x-auto border border-slate-800 rounded-b">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-[11px] text-slate-500 bg-slate-900/60">
              <th className="px-2 py-1.5 text-left">Line #</th>
              {cols.map((c, i) => <th key={i} className="px-2 py-1.5 text-left">{c}</th>)}
              {["PHY", "DF", "OF", "Wanted %", "Time %", "Time Play"].map((h) => <th key={h} className="px-2 py-1.5 text-right">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.n} className="border-t border-slate-800/60">
                <td className="px-2 py-1.5 text-slate-400">{r.n}</td>
                {r.players.map((p, i) => <td key={i} className="px-2 py-1.5">{p || <span className="text-slate-700">—</span>}</td>)}
                <td className="px-2 py-1.5 text-right tabular-nums">{r.phy}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.df}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.of}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.wanted}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.timePct}%</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{r.timePlay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TAC_CLS: Record<string, string> = { PHY: "text-amber-300", DF: "text-sky-300", OF: "text-rose-300", phy: "text-amber-300", df: "text-sky-300", of: "text-rose-300" };

function UnitTable({ group }: { group: LineGroup }) {
  const width = group.cols.length;
  if (!group.units.some((u) => u.players.some(Boolean))) return null;
  const hasTactic = group.units.some((u) => u.tactic);       // PHY/DF/OF per unit
  const hasWanted = group.units.some((u) => u.wanted != null); // ice-time share
  return (
    <div className="mb-4">
      <div className="bg-slate-800/60 text-center text-xs font-bold tracking-wide text-slate-300 py-1.5 rounded-t">{group.title}</div>
      <div className="overflow-x-auto border border-slate-800 rounded-b">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-[11px] text-slate-500 bg-slate-900/60">
              <th className="px-2 py-1.5 text-left w-10">Line #</th>
              {group.cols.map((c, i) => <th key={i} className="px-2 py-1.5 text-left">{c || ` `}</th>)}
              {hasTactic && ["PHY", "DF", "OF"].map((c) => <th key={c} className={`px-2 py-1.5 text-center w-11 ${TAC_CLS[c]}`} title="Line tactic — PHY physical/forecheck, DF defensive, OF offensive push">{c}</th>)}
              {hasWanted && <th className="px-2 py-1.5 text-right w-20 text-slate-400" title="Set ice-time share for this unit">Wanted %</th>}
            </tr>
          </thead>
          <tbody>
            {group.units.map((u) => (
              <tr key={u.n} className="border-t border-slate-800/60">
                <td className="px-2 py-1.5 text-slate-400">{u.n}</td>
                {Array.from({ length: width }).map((_, i) => (
                  <td key={i} className="px-2 py-1.5">{u.players[i] || <span className="text-slate-700">—</span>}</td>
                ))}
                {hasTactic && (["phy", "df", "of"] as const).map((k) => (
                  <td key={k} className={`px-2 py-1.5 text-center tabular-nums font-semibold ${u.tactic ? TAC_CLS[k] : "text-slate-700"}`}>{u.tactic ? u.tactic[k] : "—"}</td>
                ))}
                {hasWanted && <td className="px-2 py-1.5 text-right tabular-nums text-slate-300">{u.wanted != null ? `${u.wanted}%` : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LinesView({ side }: { side: Side }) {
  if (!side.lines || side.lines.length === 0) {
    return <div><h3 className="font-bold text-xl mb-2">{side.name}</h3><div className="text-xs text-slate-500">No line configuration.</div></div>;
  }
  return (
    <div>
      <h3 className="font-bold text-xl mb-2">{side.name}</h3>
      <div className="text-xs text-slate-500 mb-3">Manager-set lines, or the position-aware auto lines the sim used — 5v5, power play, penalty kill, 4-on-4 and 3-on-3 overtime.</div>
      {side.lines.map((g) => <UnitTable key={g.title} group={g} />)}
    </div>
  );
}

function PbpView({ data, full }: { data: Data; full: boolean }) {
  const events = full ? data.playByPlay : data.playByPlay.filter((e) => e.major || ["shot", "save", "hit"].includes(e.kind));
  const byPeriod = new Map<number, PbpE[]>();
  for (const e of events) { const a = byPeriod.get(e.period) ?? []; a.push(e); byPeriod.set(e.period, a); }
  const label = (p: number) => (p === 4 ? "OVERTIME" : p === 5 ? "SHOOTOUT" : `${p}${["ST", "ND", "RD"][p - 1]} PERIOD`);
  const teamCode = (id: number | null) => (id == null ? "" : id === data.homeTeamId ? "H" : "A");
  return (
    <div className="space-y-6">
      {[...byPeriod.keys()].sort((a, b) => a - b).map((p) => (
        <div key={p}>
          <h3 className="font-bold text-lg mb-2">{label(p)}</h3>
          <div className="space-y-0.5">
            {byPeriod.get(p)!.map((e, i) => (
              <div key={i} className={`text-sm flex gap-3 ${e.kind === "goal" ? "text-amber-300 font-semibold" : e.kind === "fight" ? "text-red-400" : e.kind === "injury" ? "text-rose-400" : e.kind === "penalty" ? "text-orange-300" : e.kind === "change" ? "text-sky-500/70 italic" : "text-slate-300"}`}>
                <span className="tabular-nums text-slate-500 w-12 shrink-0">{e.time}</span>
                <span>{e.text}{full && e.teamId != null && <span className="text-slate-600"> ({teamCode(e.teamId)})</span>}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {events.length === 0 && <p className="text-slate-500">No play-by-play recorded for this game.</p>}
    </div>
  );
}

// ---- shot chart --------------------------------------------------------------
// Deterministic [0,1) float from a string — used to jitter dots inside a sector's
// zone so 40 shots don't stack into 5 dots. Must be stable server↔client (this
// component is "use client" but still SSRs first), so Math.random() would cause
// a hydration mismatch — a string hash keeps the same value both passes.
function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
// Half-rink zones (net near the bottom, blue line at y=42) the 5 tracked
// sectors map onto. Every shooting ellipse sits fully inside the offensive
// zone. Multiple clusters give the chart natural left/right and high/low
// variety even though the engine stores a sector rather than exact coordinates.
const SHOT_ZONES: Record<string, { cx: number; cy: number; rx: number; ry: number }[]> = {
  POINT: [{ cx: 55, cy: 58, rx: 38, ry: 12 }, { cx: 145, cy: 58, rx: 38, ry: 12 }],
  PERIMETER: [{ cx: 28, cy: 111, rx: 15, ry: 53 }, { cx: 172, cy: 111, rx: 15, ry: 53 }],
  CIRCLE: [{ cx: 64, cy: 128, rx: 20, ry: 22 }, { cx: 136, cy: 128, rx: 20, ry: 22 }],
  SLOT: [{ cx: 100, cy: 158, rx: 31, ry: 25 }],
  NET_FRONT: [{ cx: 100, cy: 184, rx: 20, ry: 10 }],
};

type ShotDot = NonNullable<Side["shotDots"]>[number];

/** Stable visual coordinates for a shot sector. Using polar coordinates inside
 * an ellipse avoids the artificial diagonal rows created when the old code
 * hashed near-identical `key + "x"` and `key + "y"` strings. A small share of
 * net-front goals are bank/wraparound plays originating behind the goal line. */
function shotPosition(d: ShotDot, key: string): { x: number; y: number; behindNet: boolean } | null {
  const zones = SHOT_ZONES[d.sector];
  if (!zones?.length) return null;

  // Roughly 4% of NET_FRONT goals; net-front accounts for only part of all
  // scoring, so this remains a genuinely rare (~1% overall) lacrosse/bank/
  // wraparound-looking goal rather than a common chart artefact.
  const behindNet = d.goal && d.sector === "NET_FRONT" && hashUnit(`behind:${key}`) < 0.04;
  if (behindNet) {
    const side = hashUnit(`behind-side:${key}`) < 0.5 ? -1 : 1;
    return {
      x: 100 + side * (13 + hashUnit(`behind-x:${key}`) * 12),
      y: 204 + hashUnit(`behind-y:${key}`) * 4,
      behindNet: true,
    };
  }

  const zone = zones[Math.min(zones.length - 1, Math.floor(hashUnit(`cluster:${key}`) * zones.length))];
  const angle = hashUnit(`angle:${key}`) * Math.PI * 2;
  const radius = Math.sqrt(hashUnit(`radius:${key}`)); // uniform area, not a centre-heavy blob
  return {
    x: zone.cx + Math.cos(angle) * zone.rx * radius,
    y: zone.cy + Math.sin(angle) * zone.ry * radius,
    behindNet: false,
  };
}

function HalfRink() {
  return (
    <g stroke="currentColor" className="text-slate-700" fill="none" strokeWidth="1.2">
      <rect x="8" y="6" width="184" height="204" rx="26" />
      <line x1="8" y1="42" x2="192" y2="42" className="text-sky-800/70" strokeWidth="1.6" />
      <circle cx="64" cy="128" r="19" />
      <circle cx="136" cy="128" r="19" />
      <line x1="8" y1="198" x2="192" y2="198" className="text-red-900/60" strokeWidth="0.8" />
      <circle cx="100" cy="191" r="15" className="text-slate-800" strokeDasharray="2 2" />
      <rect x="90" y="196" width="20" height="7" className="text-slate-500" fill="currentColor" fillOpacity="0.25" />
    </g>
  );
}

function ShotChartPanel({ data }: { data: Data }) {
  const away = data.away.shotDots ?? [], home = data.home.shotDots ?? [];
  if (away.length === 0 && home.length === 0) return null;

  const Dots = ({ dots, side }: { dots: NonNullable<Side["shotDots"]>; side: "away" | "home" }) => (
    <>
      {dots.map((d, i) => {
        const key = `${d.sector}-${i}-${d.playerName ?? ""}`;
        const pos = shotPosition(d, key);
        if (!pos) return null;
        const color = d.goal ? "text-amber-400" : side === "home" ? "text-rose-400" : "text-sky-400";
        return (
          <g key={i} className={color}>
            {d.goal ? (
              <circle cx={pos.x} cy={pos.y} r="4.2" fill="currentColor" stroke="#0f172a" strokeWidth="1" />
            ) : (
              <circle cx={pos.x} cy={pos.y} r="2.6" fill="currentColor" fillOpacity="0.55" />
            )}
            <title>{d.playerName ?? "Unknown"}{d.goal ? " — GOAL" : ""}{pos.behindNet ? " — bank/wraparound from behind the net" : ""}{d.xg != null ? ` — xG ${d.xg.toFixed(2)}` : ""}</title>
          </g>
        );
      })}
    </>
  );

  const Rink = ({ dots, side, name }: { dots: NonNullable<Side["shotDots"]>; side: "away" | "home"; name: string }) => (
    <div className="flex-1 min-w-[220px]">
      <div className={`text-center text-xs font-bold uppercase tracking-wide mb-1 ${side === "home" ? "text-rose-400" : "text-sky-400"}`}>{name}</div>
      <svg viewBox="0 0 200 214" className="w-full max-w-[280px] mx-auto">
        <HalfRink />
        <Dots dots={dots} side={side} />
      </svg>
    </div>
  );

  return (
    <div className="bg-slate-900/40 rounded-lg overflow-hidden border border-slate-800">
      <div className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-800/60 uppercase tracking-wide flex items-center gap-2">
        <span className="text-amber-400">◆</span> Shot Map
        <span className="ml-auto normal-case font-normal text-slate-500 flex items-center gap-3">
          <span><span className="text-amber-400">●</span> Goal</span>
          <span><span className="text-sky-400">●</span> {data.away.name}</span>
          <span><span className="text-rose-400">●</span> {data.home.name}</span>
        </span>
      </div>
      <div className="p-4 flex flex-wrap gap-4">
        <Rink dots={away} side="away" name={data.away.name} />
        <Rink dots={home} side="home" name={data.home.name} />
      </div>
    </div>
  );
}

// ---- NHL EDGE-style tracking panel ------------------------------------------
const SECTOR_LABELS = ["Point", "Perimeter", "Circle", "Slot", "Net-front"];
const SECTOR_HD = [false, false, false, true, true]; // slot + net-front = high-danger

function EdgePanel({ data }: { data: Data }) {
  const { away, home } = data;
  const hasEdge = away.ozPct != null || home.ozPct != null || (away.topShot ?? 0) > 0;
  if (!hasEdge) return null;

  const secA = away.shotSectors ?? [];
  const secH = home.shotSectors ?? [];
  // Pick whoever faced the most shots — when a goalie change happens mid-game
  // both the starter and the reliever can be flagged "started", so the most
  // representative one for this shot-danger breakdown is whoever saw the most rubber.
  const mostShots = (goalies: Goalie[]) => goalies.reduce<Goalie | undefined>((best, g) => (!best || g.shotsAgainst > best.shotsAgainst ? g : best), undefined);
  const gA = mostShots(away.goalies);
  const gH = mostShots(home.goalies);
  const svById = (g: Goalie | undefined, sh: number, sv: number) => (g && sh ? (sv / sh) * 100 : null);

  // a stacked OZ/NZ/DZ zone-time bar for one team
  const ZoneBar = ({ oz, nz, dz }: { oz: number; nz: number; dz: number }) => (
    <div className="flex h-4 rounded overflow-hidden text-[9px] font-bold text-slate-900/80">
      <div className="bg-emerald-500/80 flex items-center justify-center" style={{ width: `${oz}%` }}>{oz >= 12 ? `${oz.toFixed(0)}` : ""}</div>
      <div className="bg-slate-500/70 flex items-center justify-center" style={{ width: `${nz}%` }}>{nz >= 12 ? `${nz.toFixed(0)}` : ""}</div>
      <div className="bg-rose-500/70 flex items-center justify-center" style={{ width: `${dz}%` }}>{dz >= 12 ? `${dz.toFixed(0)}` : ""}</div>
    </div>
  );

  return (
    <div className="bg-slate-900/40 rounded-lg overflow-hidden border border-slate-800">
      <div className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-800/60 uppercase tracking-wide flex items-center gap-2">
        <span className="text-sky-400">◆</span> NHL Edge — Tracking
      </div>
      <div className="p-4 space-y-4">
        {away.ozPct != null && home.ozPct != null && (
          <div>
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500 mb-1">
              <span>Zone time</span>
              <span className="normal-case flex gap-3"><span className="text-emerald-400">■ Off</span><span className="text-slate-400">■ Neu</span><span className="text-rose-400">■ Def</span></span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2"><span className="w-10 text-xs text-slate-400">{away.code ?? "A"}</span><div className="flex-1"><ZoneBar oz={away.ozPct} nz={away.nzPct ?? 0} dz={away.dzPct ?? 0} /></div></div>
              <div className="flex items-center gap-2"><span className="w-10 text-xs text-slate-400">{home.code ?? "H"}</span><div className="flex-1"><ZoneBar oz={home.ozPct} nz={home.nzPct ?? 0} dz={home.dzPct ?? 0} /></div></div>
            </div>
          </div>
        )}
        {(away.topShot ?? 0) > 0 && (home.topShot ?? 0) > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Shot speed <span className="normal-case text-slate-600">· top / avg</span></div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="tabular-nums"><span className="text-lg font-bold">{away.topShot!.toFixed(1)}</span> <span className="text-slate-500 text-xs">mph {away.topShotBy ? cleanName(away.topShotBy) : ""}</span>{away.avgShot != null && <span className="text-slate-500 text-xs"> · avg {away.avgShot.toFixed(0)}</span>}</div>
              <div className="tabular-nums text-right">{home.avgShot != null && <span className="text-slate-500 text-xs">avg {home.avgShot.toFixed(0)} · </span>}<span className="text-slate-500 text-xs">{home.topShotBy ? cleanName(home.topShotBy) : ""} mph</span> <span className="text-lg font-bold">{home.topShot!.toFixed(1)}</span></div>
            </div>
          </div>
        )}
        {gA?.hdShotsAg != null && gH?.hdShotsAg != null && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Goalie save % by danger</div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              {[[gA, away] as const, [gH, home] as const].map(([g, side], i) => (
                <div key={i} className={i === 1 ? "text-right" : ""}>
                  <div className="text-slate-400 mb-0.5">{cleanName(g!.name)}</div>
                  <span className="text-amber-400">HD {svById(g, g!.hdShotsAg!, g!.hdSaves!)?.toFixed(0) ?? "—"}%</span>
                  <span className="text-slate-500"> · MD {svById(g, g!.mdShotsAg!, g!.mdSaves!)?.toFixed(0) ?? "—"}%</span>
                  <span className="text-slate-500"> · LD {svById(g, g!.ldShotsAg!, g!.ldSaves!)?.toFixed(0) ?? "—"}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {secA.length === 5 && secH.length === 5 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Shot locations <span className="text-amber-400/80 normal-case">· slot / net-front = high-danger</span></div>
            <div className="space-y-1">
              {SECTOR_LABELS.map((lbl, i) => (
                <div key={lbl} className="flex items-center gap-2 text-xs">
                  <span className="w-8 text-right tabular-nums font-semibold">{secA[i]}</span>
                  <div className="flex-1 flex justify-end"><div className={`h-2 rounded ${SECTOR_HD[i] ? "bg-amber-500/70" : "bg-sky-500/50"}`} style={{ width: `${Math.min(100, secA[i] * 8)}%` }} /></div>
                  <span className={`w-20 text-center text-[10px] uppercase ${SECTOR_HD[i] ? "text-amber-400" : "text-slate-500"}`}>{lbl}</span>
                  <div className="flex-1 flex justify-start"><div className={`h-2 rounded ${SECTOR_HD[i] ? "bg-amber-500/70" : "bg-rose-500/50"}`} style={{ width: `${Math.min(100, secH[i] * 8)}%` }} /></div>
                  <span className="w-8 tabular-nums font-semibold">{secH[i]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- main view --------------------------------------------------------------
export default function GameView({ data, intelSlot }: { data: Data; intelSlot?: React.ReactNode }) {
  const [tab, setTab] = useState("summary");
  const [metric, setMetric] = useState<"shots" | "goals" | "pp" | "hits" | "fo" | "blocks" | "xg">("shots");
  const router = useRouter();
  const tabs = [
    { id: "summary", label: "Summary" },
    ...(data.story ? [{ id: "report", label: "Game Report" }] : []),
    { id: "stats", label: "Team Stats" },
    { id: "lines", label: "Lines" },
    { id: "fullpbp", label: "Play-by-Play" },
  ];
  const finalTag = data.endedIn === "REG" ? "FINAL" : `FINAL / ${data.endedIn}`;
  const stars = threeStars(data);
  const nameOf = (id: number) => (id === data.homeTeamId ? data.home.name : data.away.name);
  const codeOf = (id: number) => (id === data.homeTeamId ? data.home.code : data.away.code) || nameOf(id);
  const periods = Array.from(new Set([...data.goals.map((g) => g.period), ...data.penalties.map((p) => p.period)])).sort((a, b) => a - b);

  const ppFor = (teamId: number) => data.goals.filter((g) => g.teamId === teamId && g.strength === "PP").length;
  // Fighting majors, misconducts and offsetting/brawl minors never put the other
  // team on the man advantage — only count infractions the engine actually flagged
  // as giving a power play (see lib/sim/engine.ts's addPenalty givesPP).
  const ppOpp = (teamId: number) => data.penalties.filter((p) => p.teamId !== teamId && p.givesPP).length;
  const teamSum = (side: Side, k: keyof Skater) => side.skaters.reduce((t, s) => t + (s[k] as number), 0);
  const foPct = (side: Side) => {
    const w = teamSum(side, "faceoffWins"), l = teamSum(side, "faceoffLosses");
    return w + l ? `${Math.round((w / (w + l)) * 100)}%` : "—";
  };
  const teamRows: Array<[string, string | number, string | number]> = [
    ["Goals", data.away.goals, data.home.goals],
    ["Shots on goal", data.away.shots, data.home.shots],
    ...(data.away.xg != null && data.home.xg != null
      ? ([["Expected goals (xG)", data.away.xg.toFixed(2), data.home.xg.toFixed(2)]] as Array<[string, string, string]>)
      : []),
    ...(data.away.hd != null && data.home.hd != null
      ? ([["High-danger shots", data.away.hd, data.home.hd]] as Array<[string, number, number]>)
      : []),
    ["Power play", `${ppFor(data.awayTeamId)}/${ppOpp(data.awayTeamId)}`, `${ppFor(data.homeTeamId)}/${ppOpp(data.homeTeamId)}`],
    ["Penalty minutes", teamSum(data.away, "pim"), teamSum(data.home, "pim")],
    ["Faceoff %", foPct(data.away), foPct(data.home)],
    ["Hits", teamSum(data.away, "hits"), teamSum(data.home, "hits")],
    ["Blocked shots", teamSum(data.away, "blocks"), teamSum(data.home, "blocks")],
  ];

  // period score string: e.g. "(1-0, 2-1, 1-0)" or "(1-0, 2-1, 1-0, 0-1)" for OT
  const periodScoreStr = (() => {
    const isReg = data.endedIn === "REG";
    const numPeriods = isReg ? 3 : 4;
    const parts = [];
    for (let i = 0; i < numPeriods; i++) {
      const a = data.away.goalsByPeriod[i] ?? 0;
      const h = data.home.goalsByPeriod[i] ?? 0;
      parts.push(`${a}-${h}`);
    }
    return `(${parts.join(", ")})`;
  })();

  const metricData = (() => {
    switch (metric) {
      case "goals": return { title: "Goals", valA: data.away.goals, valH: data.home.goals, rawA: data.away.goals, rawH: data.home.goals };
      case "pp": return { title: "Presilovky (Power Play)", valA: `${ppFor(data.awayTeamId)}/${ppOpp(data.awayTeamId)}`, valH: `${ppFor(data.homeTeamId)}/${ppOpp(data.homeTeamId)}`, rawA: ppFor(data.awayTeamId), rawH: ppFor(data.homeTeamId) };
      case "hits": return { title: "Hits", valA: teamSum(data.away, "hits"), valH: teamSum(data.home, "hits"), rawA: teamSum(data.away, "hits"), rawH: teamSum(data.home, "hits") };
      case "fo": return { title: "Vhadzovania (Faceoff %)", valA: foPct(data.away), valH: foPct(data.home), rawA: teamSum(data.away, "faceoffWins"), rawH: teamSum(data.home, "faceoffWins") };
      case "blocks": return { title: "Blocked Shots", valA: teamSum(data.away, "blocks"), valH: teamSum(data.home, "blocks"), rawA: teamSum(data.away, "blocks"), rawH: teamSum(data.home, "blocks") };
      case "xg": return { title: "Expected Goals (xG)", valA: (data.away.xg ?? 0).toFixed(2), valH: (data.home.xg ?? 0).toFixed(2), rawA: data.away.xg ?? 0, rawH: data.home.xg ?? 0 };
      default: return { title: "Shots on Goal", valA: data.away.shots, valH: data.home.shots, rawA: data.away.shots, rawH: data.home.shots };
    }
  })();
  const mTot = (Number(metricData.rawA) || 0) + (Number(metricData.rawH) || 0);
  const mPctA = mTot > 0 ? Math.round(((Number(metricData.rawA) || 0) / mTot) * 100) : 50;
  const mPctH = 100 - mPctA;
  const isPlayoff = data.seriesId != null;
  const badgeLabel = isPlayoff
    ? `PLAYOFF GAME${data.gameNum != null ? ` ${data.gameNum}` : ""}`
    : "REGULAR SEASON GAME";

  return (
    <div className="max-w-[1360px] mx-auto px-2 sm:px-4 space-y-6 pb-16">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={() => { if (typeof window !== "undefined" && window.history.length > 1) router.back(); else router.push("/scores"); }}
          className="hover:text-sky-400 transition-colors flex items-center gap-1 font-semibold"
        >← Back to Games</button>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> {finalTag}
        </span>
      </div>

      {/* 1. HERO SCOREBOARD */}
      <div className="relative bg-gradient-to-b from-[#0f172a]/95 via-[#0b1120] to-[#070b12] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl p-5 sm:p-7">
        <div className="relative text-center mb-6">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-slate-300 bg-slate-900/90 px-4 py-1.5 rounded-full border border-slate-700/60 shadow-inner">
            {badgeLabel}
          </span>
        </div>

        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
          {/* Away Team */}
          <div className="flex flex-col sm:flex-row items-center sm:justify-end gap-3 sm:gap-5 text-center sm:text-right">
            <div className="order-2 sm:order-1">
              <Link href={`/teams/${data.away.slug}`} className="text-lg sm:text-2xl font-black text-white hover:text-sky-400 transition-colors tracking-wide uppercase block">{data.away.name}</Link>
              {data.away.record && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-900/90 border border-slate-700/80 text-xs font-mono font-bold text-slate-200">
                  <span className="text-slate-500 font-normal">REC</span> {data.away.record.w}-{data.away.record.l}-{data.away.record.otl}
                </div>
              )}
            </div>
            <div className="order-1 sm:order-2 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800/50 border border-slate-700/60 p-2.5 flex items-center justify-center shadow-lg shrink-0">
              {data.away.logoUrl && <img src={data.away.logoUrl} alt={data.away.name} className="w-full h-full object-contain filter drop-shadow" />}
            </div>
          </div>

          {/* Center Score */}
          <div className="flex flex-col items-center justify-center px-2 sm:px-6">
            <div className="flex items-center gap-3 sm:gap-5">
              <span className="text-4xl sm:text-6xl font-black tabular-nums tracking-tight text-white">{data.away.goals}</span>
              <span className="text-xl sm:text-3xl font-light text-slate-600">—</span>
              <span className="text-4xl sm:text-6xl font-black tabular-nums tracking-tight text-white">{data.home.goals}</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> {finalTag}
            </div>
            {periodScoreStr && (
              <div className="mt-2 text-xs font-mono font-medium text-slate-400">
                {periodScoreStr}
              </div>
            )}
          </div>

          {/* Home Team */}
          <div className="flex flex-col sm:flex-row items-center sm:justify-start gap-3 sm:gap-5 text-center sm:text-left">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800/50 border border-slate-700/60 p-2.5 flex items-center justify-center shadow-lg shrink-0">
              {data.home.logoUrl && <img src={data.home.logoUrl} alt={data.home.name} className="w-full h-full object-contain filter drop-shadow" />}
            </div>
            <div>
              <Link href={`/teams/${data.home.slug}`} className="text-lg sm:text-2xl font-black text-white hover:text-sky-400 transition-colors tracking-wide uppercase block">{data.home.name}</Link>
              {data.home.record && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-900/90 border border-slate-700/80 text-xs font-mono font-bold text-slate-200">
                  <span className="text-slate-500 font-normal">REC</span> {data.home.record.w}-{data.home.record.l}-{data.home.record.otl}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Info inside Scoreboard */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-center sm:justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            {data.arena && <span>🏟️ {data.arena}</span>}
            {data.attendance != null && <span>👥 {data.attendance.toLocaleString()} fans</span>}
          </div>
          {!!data.officials?.length && (
            <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
              <span>🦓 Rozhodcovia: {data.officials.map((o) => `${o.name}${o.number ? ` (#${o.number})` : ""}`).join(", ")}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. COMPARATIVE STATS BAR */}
      <div className="bg-[#0b1120]/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded bg-sky-400"></span> Key team comparison
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(["shots", "goals", "pp", "hits", "fo", "blocks", "xg"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all uppercase ${metric === m ? "bg-sky-500 text-white shadow-sm" : "bg-slate-800 text-slate-400 hover:text-white"}`}
              >
                {m === "fo" ? "FO %" : m}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-950/70 rounded-xl p-3.5 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
              <span className="text-white font-extrabold">{data.away.code ?? data.away.name}</span>
              <span className="text-base font-black text-sky-400 ml-1 tabular-nums">{metricData.valA}</span>
            </div>
            <span className="text-slate-400 text-xs font-semibold normal-case">{metricData.title}</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-rose-400 mr-1 tabular-nums">{metricData.valH}</span>
              <span className="text-white font-extrabold">{data.home.code ?? data.home.name}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            </div>
          </div>

          <div className="relative h-4 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800 p-0.5">
            <div className="h-full bg-gradient-to-r from-sky-600 to-sky-500 rounded-l-full transition-all duration-500 flex items-center justify-start pl-2" style={{ width: `${mPctA}%` }}>
              <span className="text-[9px] font-black text-white/90">{mPctA}%</span>
            </div>
            <div className="w-0.5 h-full bg-slate-950 z-10"></div>
            <div className="h-full bg-gradient-to-l from-rose-700 to-rose-600 rounded-r-full transition-all duration-500 flex items-center justify-end pr-2" style={{ width: `${mPctH}%` }}>
              <span className="text-[9px] font-black text-white/90">{mPctH}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* tab bar */}

      <div className="flex gap-5 border-b border-slate-800 overflow-x-auto overflow-y-hidden justify-center">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-2 py-3 text-base font-bold uppercase tracking-wide whitespace-nowrap border-b-2 -mb-px transition ${tab === t.id ? "border-blue-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0b1120]/80 border border-slate-800 rounded-2xl p-5 shadow-lg md:divide-x md:divide-slate-800">
            <div className="pr-0 md:pr-4">
              <Linescore title="GOALS BY PERIOD" sub="GOALS" side={data} home={data.home} field="goalsByPeriod" />
            </div>
            <div className="pt-4 md:pt-0 md:pl-6">
              <Linescore title="SHOTS BY PERIOD" sub="STRELY" side={data} home={data.home} field="shotsByPeriod" />
            </div>
          </div>

          {/* scoring + penalties — 2-column split with modern cards */}
          <div className="bg-[#0b1120]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="grid grid-cols-2 bg-slate-900/95 text-xs font-black tracking-wider text-slate-300 border-b border-slate-800">
              <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between">
                <span className="flex items-center gap-2"><span>🚨</span> GOALS</span>
                <span className="text-[11px] font-normal text-slate-500 font-mono hidden sm:inline">Running score & players on ice</span>
              </div>
              <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between border-l border-slate-800 text-slate-300">
                <span className="flex items-center gap-2"><span>⏱️</span> PENALTIES</span>
                <span className="text-[11px] font-normal text-slate-500 font-mono hidden sm:inline">Tresty & Presilovky</span>
              </div>
            </div>

            {periods.map((p) => {
              const goals = data.goals.filter((g) => g.period === p && g.strength !== "SO");
              const pens = data.penalties.filter((x) => x.period === p);
              const pGoalsA = goals.filter((g) => g.teamId === data.awayTeamId).length;
              const pGoalsH = goals.filter((g) => g.teamId === data.homeTeamId).length;
              return (
                <div key={p} className="border-b border-slate-800 last:border-0">
                  <div className="px-4 sm:px-5 py-2.5 bg-emerald-950/30 border-l-4 border-emerald-500 text-xs font-extrabold text-emerald-400 uppercase tracking-widest flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span> {periodLabel(p, data.endedIn)}
                    </span>
                    <span className="text-xs font-mono text-emerald-400/90 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                      Stav tretiny: {codeOf(data.awayTeamId)} {pGoalsA} – {pGoalsH} {codeOf(data.homeTeamId)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-slate-800 text-sm">
                    {/* Goals column */}
                    <div className="p-3 sm:p-5 space-y-3.5">
                      {goals.length === 0 && <div className="text-slate-600 text-sm italic py-2 pl-2">No goal in this period</div>}
                      {goals.map((g, i) => {
                        const tag = strengthTag(g);
                        const homeScored = g.teamId === data.home.teamId;
                        const scoringTeam = homeScored ? data.home : data.away;
                        const opponentTeam = homeScored ? data.away : data.home;
                        const scoringCode = scoringTeam.code || scoringTeam.name;
                        const opponentCode = opponentTeam.code || opponentTeam.name;
                        const scoringScore = homeScored ? g.homeScoreAfter : g.awayScoreAfter;
                        const opponentScore = homeScored ? g.awayScoreAfter : g.homeScoreAfter;
                        return (
                          <div key={i} className="group bg-slate-950/80 hover:bg-slate-900/60 border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-3 sm:p-3.5 transition-all shadow-sm">
                            <div className="flex items-start gap-3 sm:gap-3.5">
                              {/* Team Logo on the far left spanning across scorer & assists */}
                              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700/70 p-1.5 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                                {scoringTeam.logoUrl ? (
                                  <img src={scoringTeam.logoUrl} alt={scoringTeam.name} className="w-full h-full object-contain filter drop-shadow" />
                                ) : (
                                  <span className="text-xs font-black text-sky-400 font-mono">{scoringCode}</span>
                                )}
                              </div>

                              {/* Content column */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{mmss(g.seconds)}</span>
                                    {tag && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">{tag}</span>}
                                    {g.scorerSlug ? (
                                      <Link href={`/players/${g.scorerSlug}`} className="font-black text-base sm:text-lg text-white group-hover:text-sky-400 transition-colors">{cleanName(g.scorerName)}</Link>
                                    ) : (
                                      <span className="font-black text-base sm:text-lg text-white">{cleanName(g.scorerName)}</span>
                                    )}
                                    {g.scorerSeasonGoal != null && <span className="text-sm font-bold text-amber-400">({g.scorerSeasonGoal})</span>}
                                  </div>
                                  <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded bg-slate-900 border border-slate-700/70 text-slate-200 shrink-0">
                                    {scoringCode} {scoringScore} – {opponentScore} {opponentCode}
                                  </span>
                                </div>

                                {/* Assists */}
                                <div className="text-xs sm:text-sm text-slate-200 flex items-center gap-1.5 mt-1 font-medium">
                                  {g.assists && g.assists.length > 0 ? (
                                    <>
                                      <span className="text-amber-400">🍎</span>
                                      <span>{g.assists.map((a, j) => (
                                        <span key={j}>
                                          {a.slug ? <Link href={`/players/${a.slug}`} className="hover:text-sky-400">{cleanName(a.name)}</Link> : cleanName(a.name)}
                                          {a.total != null && <span className="text-amber-400/80"> ({a.total})</span>}
                                          {j < g.assists!.length - 1 ? ", " : ""}
                                        </span>
                                      ))}</span>
                                    </>
                                  ) : !g.emptyNet ? (
                                    <span className="text-slate-500 italic text-xs">(bez asistencie / unassisted)</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {/* On-ice box */}
                            {(g.onIceForNames?.length || g.onIceAgainstNames?.length) ? (
                              <div className="mt-2.5 pt-2 border-t border-slate-800/70 flex flex-col gap-1 text-[10px] font-mono leading-tight">
                                {g.onIceForNames?.length ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[9px] inline-flex items-center gap-1">
                                      {scoringTeam.logoUrl && <img src={scoringTeam.logoUrl} alt="" className="w-3 h-3 object-contain shrink-0" />}
                                      ON+ {scoringCode}
                                    </span>
                                    <span className="text-slate-400">{g.onIceForNames.map(cleanName).join(", ")}</span>
                                  </div>
                                ) : null}
                                {g.onIceAgainstNames?.length ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-[9px] inline-flex items-center gap-1">
                                      {opponentTeam.logoUrl && <img src={opponentTeam.logoUrl} alt="" className="w-3 h-3 object-contain shrink-0" />}
                                      ON− {opponentCode}
                                    </span>
                                    <span className="text-slate-500">{g.onIceAgainstNames.map(cleanName).join(", ")}</span>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {/* Penalties column */}
                    <div className="p-3 sm:p-5 bg-slate-950/20 space-y-3.5 text-xs">
                      {pens.length === 0 && <div className="text-slate-600 text-sm italic py-2 pl-2">No penalties</div>}
                      {pens.map((x, i) => {
                        const penTeam = x.teamId === data.homeTeamId ? data.home : data.away;
                        const penCode = penTeam.code || penTeam.name;
                        const oppCode = codeOf(x.teamId === data.homeTeamId ? data.awayTeamId : data.homeTeamId);
                        return (
                          <div key={i} className="group bg-amber-950/10 hover:bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 sm:p-3.5 transition-all shadow-sm">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-amber-500/30 p-1.5 flex items-center justify-center shrink-0 shadow">
                                {penTeam.logoUrl ? (
                                  <img src={penTeam.logoUrl} alt={penTeam.name} className="w-full h-full object-contain filter drop-shadow" />
                                ) : (
                                  <span className="text-xs font-black text-amber-400 font-mono">{penCode}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{mmss(x.seconds)}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[10px] border border-amber-500/30">{x.minutes} MIN</span>
                                  </div>
                                  {x.givesPP && (
                                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                      ⚡ Presilovka pre {oppCode}
                                    </span>
                                  )}
                                  {x.offsetting && (
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                                      Coincidental penalty
                                    </span>
                                  )}
                                </div>
                                <div className="pl-0.5">
                                  <span className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">{cleanName(x.playerName)}</span>
                                  <span className="text-slate-400 text-xs"> — {x.type}</span>
                                  <span className="text-slate-500 font-mono text-[11px] block mt-0.5">{x.severity} · {x.minutes}:00</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* INJURIES — timed, red-flagged, with the cause */}
          {data.injuries && data.injuries.length > 0 && (
            <div className="bg-red-950/20 border border-red-900/40 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-red-900/30 text-xs font-bold tracking-wide text-red-300 uppercase flex items-center gap-2">
                <span className="text-red-500">✚</span> Injuries
              </div>
              {data.injuries.map((inj, i) => (
                <div key={i} className="px-4 py-1.5 text-sm leading-snug border-t border-red-900/20 flex items-baseline gap-2">
                  <span className="text-red-500 font-bold shrink-0" title="Injury">✚</span>
                  <span className="text-slate-500 tabular-nums shrink-0">P{inj.period} {mmss(inj.seconds)}</span>
                  <span className="text-slate-500 shrink-0">{inj.teamId != null ? codeOf(inj.teamId) : ""}</span>
                  <span>
                    {inj.playerSlug ? <Link href={`/players/${inj.playerSlug}`} className="font-semibold text-red-200 hover:text-red-100">{inj.playerName}</Link> : <span className="font-semibold text-red-200">{inj.playerName}</span>}
                    {" — "}<span className="text-slate-300">{inj.part}</span>
                    {inj.mechanism !== "Non-contact" && <span className="text-slate-500"> ({inj.mechanism.toLowerCase()}{inj.byName ? ` by ${inj.byName}` : ""})</span>}
                    {" · "}<span className={sevClass(inj.severity)}>{inj.severity}</span>
                    <span className="text-slate-500"> · out ~{inj.days}d</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* SYSTEMS — what tactic each side played (scouting) */}
          {(data.awaySystem || data.homeSystem) && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-slate-800/60 text-xs font-bold tracking-wide text-slate-300 uppercase flex items-center gap-2">
                <span className="text-sky-400">◆</span> Systems played
              </div>
              <div className="grid grid-cols-2 divide-x divide-slate-800">
                <div className="px-4 py-2"><div className="text-xs text-slate-500 mb-0.5">{data.away.code ?? data.away.name}</div><SystemSummary s={data.awaySystem} /></div>
                <div className="px-4 py-2"><div className="text-xs text-slate-500 mb-0.5">{data.home.code ?? data.home.name}</div><SystemSummary s={data.homeSystem} /></div>
              </div>
            </div>
          )}

          {/* SHOOTOUT — who shot, and the result of each attempt */}
          <ShootoutView data={data} />

          {/* THREE STARS */}
          <div className="bg-[#0b1120]/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <span>⭐</span> Three Stars of the Game
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {stars.map((s, i) => (
                <div key={i} className={`bg-slate-950/80 border ${i === 0 ? "border-amber-500/40" : i === 1 ? "border-slate-600/40" : "border-amber-800/40"} rounded-xl p-3.5 flex items-center gap-3 shadow-sm`}>
                  <div className={`text-2xl font-black ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : "text-amber-700"}`}>
                    {"★".repeat(i + 1)}
                  </div>
                  <div>
                    <Link href={`/players/${s.slug ?? s.name}`} className="font-extrabold text-sm text-white hover:text-sky-400 transition-colors block">{cleanName(s.name)}</Link>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{nameOf(s.teamId)} · {s.line}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GOALTENDING */}
          <div className="bg-[#0b1120]/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Goaltending</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GoalieBlock side={data.away} />
              <GoalieBlock side={data.home} />
            </div>
          </div>

          {/* UNHL INTELLIGENCE CARD (POST-GAME) */}
          {intelSlot && (
            <div className="bg-[#0b1120]/90 border border-blue-900/50 rounded-2xl p-5 shadow-xl">
              {intelSlot}
            </div>
          )}

          {/* TEAM STATS */}
          <div className="bg-[#0b1120]/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="grid grid-cols-3 px-4 py-2.5 text-xs font-bold text-slate-300 bg-slate-900/80 border-b border-slate-800 uppercase tracking-wide">
              <div>{data.away.name}</div><div className="text-center font-mono">Team Stats</div><div className="text-right">{data.home.name}</div>
            </div>
            {teamRows.map(([k, a, h]) => (
              <div key={k} className="grid grid-cols-3 px-4 py-2.5 text-sm border-t border-slate-800/60 items-center font-mono">
                <div className="font-bold tabular-nums text-white">{a}</div><div className="text-center text-slate-400 font-sans text-xs">{k}</div><div className="text-right font-bold tabular-nums text-white">{h}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "report" && data.story && (
        <div className="space-y-6">
          <GameReportCard report={data.story.report} />
          {data.story.flow.points.length > 2 && <GameFlowChart flow={data.story.flow} />}
          <ShotChartPanel data={data} />
          <EdgePanel data={data} />
        </div>
      )}

      {tab === "stats" && (
        <div className="space-y-10">
          <div className="space-y-4"><h2 className="text-xl font-bold">{data.away.name}</h2><SkaterTable side={data.away} /><GoalieBlock side={data.away} /></div>
          <div className="space-y-4"><h2 className="text-xl font-bold">{data.home.name}</h2><SkaterTable side={data.home} /><GoalieBlock side={data.home} /></div>
        </div>
      )}
      {tab === "lines" && <div className="space-y-8"><LinesView side={data.away} /><LinesView side={data.home} /></div>}
      {tab === "fullpbp" && <PbpView data={data} full={true} />}
    </div>
  );
}
