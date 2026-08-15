"use client";

import { useState } from "react";
import Link from "next/link";
import { cleanName } from "@/lib/playerName";

// ---- types (shape passed from the server page) ------------------------------
type Skater = {
  id: number; name: string; position: string; slug: string | null;
  goals: number; assists: number; points: number; shots: number; pim: number;
  plusMinus: number; ppGoals: number; shGoals: number; gwg: number;
  hits: number; blocks: number; faceoffWins: number; faceoffLosses: number; toi: number;
  conAfter: number | null; xg?: number; hdShots?: number;
};
type Goalie = {
  id: number; name: string; slug: string | null; started: boolean;
  shotsAgainst: number; saves: number; goalsAgainst: number;
  conBefore: number | null; conAfter: number | null; fatigued: boolean; decision: string | null;
  xga?: number;
  hdShotsAg?: number; hdSaves?: number; mdShotsAg?: number; mdSaves?: number; ldShotsAg?: number; ldSaves?: number;
};
type LineGroup = { title: string; cols: string[]; units: { n: number; players: (string | null)[]; tactic?: { phy: number; df: number; of: number }; wanted?: number }[] };
type Side = {
  teamId: number; name: string; slug: string; logoUrl: string | null; code?: string | null;
  goals: number; shots: number; goalsByPeriod: number[]; shotsByPeriod: number[];
  xg?: number | null; hd?: number | null;
  ozPct?: number | null; nzPct?: number | null; dzPct?: number | null;
  shotSectors?: number[]; topShot?: number | null; topShotBy?: string | null; avgShot?: number | null;
  skaters: Skater[]; goalies: Goalie[]; lines?: LineGroup[];
};
type GoalAssist = { name: string; slug: string | null; total: number | null };
type GoalE = { period: number; seconds: number; teamId: number; scorerName: string; scorerSlug?: string | null; scorerSeasonGoal?: number; assistNames: string[]; assists?: GoalAssist[]; strength: string; emptyNet: boolean };
type PenE = { period: number; seconds: number; teamId: number; playerName: string; type: string; minutes: number; severity: string };
type PbpE = { period: number; seconds: number; time: string; teamId: number | null; kind: string; text: string; major: boolean };
type ShootoutE = { round: number; teamId: number; teamCode: string | null; shooterName: string; shooterSlug: string | null; result: "goal" | "save" | "miss" };
type InjuryRow = { period: number; seconds: number; teamId: number | null; playerName: string; playerSlug: string | null; part: string; mechanism: string; severity: string; days: number; byName: string | null };
type SystemDials = { tempo?: string; forecheck?: string; puckStyle?: string; dZone?: string; preset?: string } | null;
type Data = {
  id: number; endedIn: string; home: Side; away: Side; homeTeamId: number; awayTeamId: number;
  goals: GoalE[]; penalties: PenE[]; playByPlay: PbpE[]; shootout?: ShootoutE[];
  injuries?: InjuryRow[]; homeSystem?: SystemDials; awaySystem?: SystemDials;
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
  if (!s) return <span className="text-slate-500 text-sm">Balanced</span>;
  if (s.preset && s.preset !== "Balanced") return <span className="text-sky-300 text-sm font-semibold">{s.preset}</span>;
  const dials = ([["Tempo", s.tempo], ["Forecheck", s.forecheck], ["Puck", s.puckStyle], ["D-Zone", s.dZone]] as const)
    .filter(([, v]) => v && v !== "balanced");
  if (dials.length === 0) return <span className="text-slate-400 text-sm">Balanced</span>;
  return <span className="text-sm text-slate-300">{dials.map(([k, v]) => `${k}: ${DIAL_LABEL[v as string] ?? v}`).join(" · ")}</span>;
}
const periodLabel = (p: number) => (p === 4 ? "Overtime" : p === 5 ? "Shootout" : `${p}${["st", "nd", "rd"][p - 1]} Period`);
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
        name: s.name, slug: s.slug, teamId: side.teamId,
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
        name: g.name, slug: g.slug, teamId: side.teamId,
        line: `${g.saves}/${g.shotsAgainst}, ${(svp(g) * 100).toFixed(1)}%`, score,
      });
    }
  }
  return cands.sort((a, b) => b.score - a.score).slice(0, 3);
}

// ---- small pieces -----------------------------------------------------------
function Linescore({ title, side, home, field }: { title: string; side: Data; home: Side; field: "goalsByPeriod" | "shotsByPeriod" }) {
  const a = side.away[field], h = home[field];
  const hasOT = (a[3] ?? 0) > 0 || (h[3] ?? 0) > 0;
  const heads = hasOT ? ["1", "2", "3", "OT"] : ["1", "2", "3"];
  const idxs = heads.map((_, i) => i);
  const sum = (arr: number[]) => arr.reduce((x, y) => x + y, 0);
  const Row = ({ name, arr }: { name: string; arr: number[] }) => (
    <tr className="border-t border-slate-700/50">
      <td className="py-1.5 pr-4 text-slate-200">{name}</td>
      {idxs.map((c) => <td key={c} className="py-1.5 px-3 text-center tabular-nums text-slate-300">{arr[c] ?? 0}</td>)}
      <td className="py-1.5 pl-3 text-center font-bold tabular-nums">{sum(arr)}</td>
    </tr>
  );
  return (
    <div>
      <div className="text-sm font-semibold text-slate-400 mb-2">{title}</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-xs"><th />{heads.map((x) => <th key={x} className="px-3 font-medium">{x}</th>)}<th className="pl-3 font-bold text-slate-300">T</th></tr>
        </thead>
        <tbody><Row name={side.away.name} arr={a} /><Row name={home.name} arr={h} /></tbody>
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
          <div key={g.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800/60">
            <span className="flex items-center gap-2">
              <Link href={`/players/${g.slug ?? g.id}`} className="font-semibold hover:text-blue-400">{g.name}</Link>
              {!g.started && <span className="text-[10px] uppercase text-slate-500 border border-slate-700 rounded px-1">backup</span>}
              {g.fatigued && <span className="text-[10px] uppercase text-amber-500 border border-amber-700/50 rounded px-1">b2b</span>}
            </span>
            <span className="text-slate-300 tabular-nums text-right">
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
  const H = ["G", "A", "P", "+/-", "S", "xG", "PIM", "HIT", "BLK", "FO", "TOI", "CON"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-700">
            <th className="text-left py-1.5 pr-2">Player</th><th className="text-left px-1">Pos</th>
            {H.map((h) => <th key={h} className="px-2 text-right">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {side.skaters.map((s) => {
            const fo = s.faceoffWins + s.faceoffLosses ? `${s.faceoffWins}-${s.faceoffLosses}` : "—";
            return (
              <tr key={s.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                <td className="py-1.5 pr-2"><Link href={`/players/${s.slug ?? s.id}`} className="hover:text-blue-400">{s.name}</Link></td>
                <td className="px-1 text-slate-500 text-xs">{s.position}</td>
                <td className="px-2 text-right font-semibold tabular-nums">{s.goals}</td>
                <td className="px-2 text-right font-semibold tabular-nums">{s.assists}</td>
                <td className="px-2 text-right font-bold tabular-nums">{s.points}</td>
                <td className="px-2 text-right tabular-nums">{s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus}</td>
                <td className="px-2 text-right tabular-nums text-slate-300">{s.shots}</td>
                <td className={`px-2 text-right tabular-nums ${s.xg && s.goals > s.xg + 0.5 ? "text-green-400" : "text-slate-400"}`} title={s.hdShots ? `${s.hdShots} high-danger` : undefined}>{s.xg != null ? s.xg.toFixed(1) : "—"}</td>
                <td className="px-2 text-right tabular-nums text-slate-300">{s.pim}</td>
                <td className="px-2 text-right tabular-nums text-slate-300">{s.hits}</td>
                <td className="px-2 text-right tabular-nums text-slate-300">{s.blocks}</td>
                <td className="px-2 text-right tabular-nums text-slate-400">{fo}</td>
                <td className="px-2 text-right tabular-nums text-slate-400">{mmss(s.toi)}</td>
                <td className={`px-2 text-right tabular-nums ${s.conAfter != null && s.conAfter < 100 ? "text-amber-400" : "text-slate-600"}`}>{s.conAfter ?? "—"}</td>
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
              <div key={i} className={`text-sm flex gap-3 ${e.kind === "goal" ? "text-amber-300 font-semibold" : e.kind === "fight" ? "text-red-400" : e.kind === "injury" ? "text-rose-400" : e.kind === "penalty" ? "text-orange-300" : "text-slate-300"}`}>
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

// ---- NHL EDGE-style tracking panel ------------------------------------------
const SECTOR_LABELS = ["Point", "Perimeter", "Circle", "Slot", "Net-front"];
const SECTOR_HD = [false, false, false, true, true]; // slot + net-front = high-danger

function EdgePanel({ data }: { data: Data }) {
  const { away, home } = data;
  const hasEdge = away.ozPct != null || home.ozPct != null || (away.topShot ?? 0) > 0;
  if (!hasEdge) return null;

  const secA = away.shotSectors ?? [];
  const secH = home.shotSectors ?? [];
  const gA = away.goalies.find((g) => g.started);
  const gH = home.goalies.find((g) => g.started);
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
              <div className="tabular-nums"><span className="text-lg font-bold">{away.topShot!.toFixed(1)}</span> <span className="text-slate-500 text-xs">mph {away.topShotBy}</span>{away.avgShot != null && <span className="text-slate-500 text-xs"> · avg {away.avgShot.toFixed(0)}</span>}</div>
              <div className="tabular-nums text-right">{home.avgShot != null && <span className="text-slate-500 text-xs">avg {home.avgShot.toFixed(0)} · </span>}<span className="text-slate-500 text-xs">{home.topShotBy} mph</span> <span className="text-lg font-bold">{home.topShot!.toFixed(1)}</span></div>
            </div>
          </div>
        )}
        {gA?.hdShotsAg != null && gH?.hdShotsAg != null && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Goalie save % by danger</div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              {[[gA, away] as const, [gH, home] as const].map(([g, side], i) => (
                <div key={i} className={i === 1 ? "text-right" : ""}>
                  <div className="text-slate-400 mb-0.5">{g!.name}</div>
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
export default function GameView({ data }: { data: Data }) {
  const [tab, setTab] = useState("summary");
  const tabs = [
    { id: "summary", label: "Summary" },
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
  const ppOpp = (teamId: number) => data.penalties.filter((p) => p.teamId !== teamId).length;
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

  const TeamHeader = ({ side, align }: { side: Side; align: "left" | "right" }) => (
    <div className={`flex items-center gap-4 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {side.logoUrl && <img src={side.logoUrl} alt="" className="w-14 h-14 object-contain" />}
      <Link href={`/teams/${side.slug}`} className="text-xl font-bold hover:text-blue-400">{side.name}</Link>
      <div className={`text-4xl font-black tabular-nums ${align === "right" ? "mr-auto" : "ml-auto"}`}>{side.goals}</div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 space-y-6 pb-16">
      <Link href="/schedule" className="text-sm text-slate-400 hover:text-blue-400">← Schedule</Link>

      {/* scoreboard */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="text-center text-xs font-bold text-amber-400 tracking-widest mb-4">{finalTag}</div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
          <TeamHeader side={data.away} align="left" />
          <div className="text-slate-600 font-bold">@</div>
          <TeamHeader side={data.home} align="right" />
        </div>
      </div>

      {/* tab bar */}
      <div className="flex gap-5 border-b border-slate-800 overflow-x-auto justify-center">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-2 py-3 text-base font-bold uppercase tracking-wide whitespace-nowrap border-b-2 -mb-px transition ${tab === t.id ? "border-blue-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/40 border border-slate-800 rounded-xl p-5">
            <Linescore title="GOALS BY PERIOD" side={data} home={data.home} field="goalsByPeriod" />
            <Linescore title="SHOTS BY PERIOD" side={data} home={data.home} field="shotsByPeriod" />
          </div>

          {/* scoring + penalties — side by side (goals left, penalties right), aligned per period */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-800/60 text-xs font-bold tracking-wide text-slate-300">
              <div className="px-4 py-2">GOALS</div><div className="px-4 py-2 hidden md:block md:border-l border-slate-700">PENALTIES</div>
            </div>
            {periods.map((p) => {
              const goals = data.goals.filter((g) => g.period === p && g.strength !== "SO");
              const pens = data.penalties.filter((x) => x.period === p);
              return (
                <div key={p} className="border-b border-slate-800 last:border-0">
                  <div className="px-4 py-1.5 bg-green-950/30 border-l-2 border-green-500 text-xs font-bold text-green-400 uppercase tracking-wide">{periodLabel(p)}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Goals column */}
                    <div className="md:border-r border-slate-800">
                      {goals.length === 0 && <div className="px-4 py-2 text-slate-600 text-sm">—</div>}
                      {goals.map((g, i) => {
                        const tag = strengthTag(g);
                        return (
                          <div key={i} className="px-4 py-1.5 text-sm leading-snug">
                            <span className="text-slate-500 tabular-nums mr-2">{mmss(g.seconds)}</span>
                            <span className="text-slate-500 font-semibold mr-1.5">{codeOf(g.teamId)}</span>
                            <span title="Goal">🚨</span>{" "}
                            {g.scorerSlug ? <Link href={`/players/${g.scorerSlug}`} className="font-semibold hover:text-blue-400">{cleanName(g.scorerName)}</Link> : <span className="font-semibold">{cleanName(g.scorerName)}</span>}
                            {g.scorerSeasonGoal != null && <span className="text-amber-400/70" title="Season goal total"> ({g.scorerSeasonGoal})</span>}
                            {tag && <span className="ml-1 text-[10px] font-bold text-amber-400">({tag})</span>}
                            {g.assists && g.assists.length > 0 ? (
                              <span className="text-slate-400"> <span title="Assists">🍎</span> {g.assists.map((a, j) => (
                                <span key={j}>{a.slug ? <Link href={`/players/${a.slug}`} className="hover:text-blue-400">{cleanName(a.name)}</Link> : cleanName(a.name)}{a.total != null && <span className="text-amber-400/70"> ({a.total})</span>}{j < g.assists!.length - 1 ? ", " : ""}</span>
                              ))}</span>
                            ) : !g.emptyNet && <span className="text-slate-600"> (unassisted)</span>}
                          </div>
                        );
                      })}
                    </div>
                    {/* Penalties column */}
                    <div>
                      {pens.length === 0 && <div className="px-4 py-2 text-slate-600 text-sm">—</div>}
                      {pens.map((x, i) => (
                        <div key={i} className="px-4 py-1.5 text-sm leading-snug">
                          <span className="text-slate-500 tabular-nums mr-2">{mmss(x.seconds)}</span>
                          <span className="font-semibold">{cleanName(x.playerName)}</span> <span className="text-slate-500">({codeOf(x.teamId)})</span> for {x.type}<span className="text-slate-500"> ({x.severity})</span>
                        </div>
                      ))}
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

          {/* GOALTENDING — above team stats */}
          <div>
            <h2 className="text-lg font-bold mb-3">Goaltending</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/40 border border-slate-800 rounded-xl p-5">
              <GoalieBlock side={data.away} />
              <GoalieBlock side={data.home} />
            </div>
          </div>

          {/* 3 STARS */}
          <div>
            <h2 className="text-lg font-bold mb-3">Three Stars</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {stars.map((s, i) => (
                <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex items-center gap-3">
                  <div className="text-2xl font-black text-amber-400">{"★".repeat(i + 1)}</div>
                  <div>
                    <Link href={`/players/${s.slug ?? s.name}`} className="font-bold hover:text-blue-400">{s.name}</Link>
                    <div className="text-xs text-slate-400">{nameOf(s.teamId)} · {s.line}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TEAM STATS */}
          <div className="bg-slate-900/40 rounded-lg overflow-hidden border border-slate-800">
            <div className="grid grid-cols-3 px-4 py-2 text-xs font-bold text-slate-400 bg-slate-800/60">
              <div>{data.away.name}</div><div className="text-center uppercase tracking-wide">Team Stats</div><div className="text-right">{data.home.name}</div>
            </div>
            {teamRows.map(([k, a, h]) => (
              <div key={k} className="grid grid-cols-3 px-4 py-2 text-sm border-t border-slate-800 items-center">
                <div className="font-bold tabular-nums">{a}</div><div className="text-center text-slate-400">{k}</div><div className="text-right font-bold tabular-nums">{h}</div>
              </div>
            ))}
          </div>

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
