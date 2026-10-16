// Box-score goal → 3D replay clip. The game page sends the GOAL event's shot facts
// (sector, shot type, how it went in, rush) and the two on-ice units with numbers and
// positions; this fills any gaps (older games have no on-ice list) and builds the clip.

import { attackDirFor, buildShotClip, momentSeed, type Actor, type Clip, type Role, type Side } from "./reconstruct";

export type ReplayPlayer = { id: number; name: string; number: number | null; pos: string | null };
export type GoalReplayData = {
  period: number; seconds: number; teamId: number; strength: string; emptyNet: boolean;
  scorerId: number; scorerName: string; assistIds: number[]; assistNames: string[];
  sector: string | null; shotType: string | null; play: string | null; rush: string | null; xg: number | null;
  forSkaters: ReplayPlayer[]; againstSkaters: ReplayPlayer[];
  goalie: ReplayPlayer | null; ownGoalie: ReplayPlayer | null;
};

const roleOf = (pos: string | null | undefined): Role | null => {
  const p = (pos ?? "").toUpperCase();
  if (!p) return null;
  if (p.startsWith("G")) return "G";
  return p.startsWith("D") || p === "LD" || p === "RD" ? "D" : "F";
};

function unit(side: Side, list: ReplayPlayer[], size: number, must: ReplayPlayer[]): Actor[] {
  const out: ReplayPlayer[] = [...list];
  for (const m of must) if (!out.some((p) => p.id === m.id)) out.unshift(m);
  const actors: Actor[] = out.slice(0, Math.max(size, must.length)).map((p) => ({ id: `${side}-${p.id}`, side, role: roleOf(p.pos) ?? "F", name: p.name, number: p.number }));
  // unknown positions: the last two of a full unit play the point
  if (!out.some((p) => roleOf(p.pos))) actors.forEach((a, i) => { a.role = i >= actors.length - (actors.length >= 4 ? 2 : 1) ? "D" : "F"; });
  // pad an incomplete unit with anonymous skaters so the ice never looks empty
  let k = 0;
  while (actors.length < size) {
    const dNeed = Math.max(0, (size >= 4 ? 2 : 1) - actors.filter((a) => a.role === "D").length);
    actors.push({ id: `${side}-x${k++}`, side, role: dNeed > 0 ? "D" : "F", name: "", number: null });
  }
  if (!actors.some((a) => a.role === "D") && actors.length > 2) actors[actors.length - 1].role = "D";
  return actors;
}

export function goalClip(d: GoalReplayData, homeTeamId: number, gameId: number): Clip {
  const side: Side = d.teamId === homeTeamId ? "home" : "away";
  const opp: Side = side === "home" ? "away" : "home";
  const forN = d.forSkaters.length || (d.strength === "SH" ? 4 : 5);
  const agN = d.againstSkaters.length || (d.strength === "PP" ? 4 : d.emptyNet ? 6 : 5);
  const scorer: ReplayPlayer = d.forSkaters.find((p) => p.id === d.scorerId) ?? { id: d.scorerId, name: d.scorerName, number: null, pos: null };
  const assists = d.assistIds.map((id, i) => d.forSkaters.find((p) => p.id === id) ?? { id, name: d.assistNames[i] ?? "", number: null, pos: null });
  const attackers = unit(side, d.forSkaters, forN, [scorer, ...assists]);
  const defenders = unit(opp, d.againstSkaters, agN, []);
  const g = (p: ReplayPlayer | null, s: Side): Actor | null => (p ? { id: `${s}-g${p.id}`, side: s, role: "G", name: p.name, number: p.number } : null);
  return buildShotClip({
    outcome: "goal", attackSide: side, attackDir: attackDirFor(side, Math.min(d.period, 4)),
    attackers, defenders, goalie: d.emptyNet ? null : g(d.goalie, opp) ?? { id: `${opp}-g`, side: opp, role: "G", name: "", number: null },
    ownGoalie: g(d.ownGoalie, side),
    shooterId: `${side}-${scorer.id}`, assistIds: assists.map((a) => `${side}-${a.id}`),
    sector: d.sector, shotType: d.shotType, play: d.play, rush: d.rush, emptyNet: d.emptyNet,
    seed: momentSeed(gameId, d.period, d.seconds, d.teamId, d.scorerId),
  });
}
