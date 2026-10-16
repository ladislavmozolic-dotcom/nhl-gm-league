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

export type GoalTelemetry = {
  speedMph: number;
  speedKmh: number;
  distanceFt: number;
  distanceM: number;
  shotTypeLabel: string;
  playLabel: string;
  xgFormatted: string | null;
  isHighDanger: boolean;
};

export function computeGoalTelemetry(d: GoalReplayData, seed = 0): GoalTelemetry {
  // Deterministic pseudo-random jitter from seed
  const r = (k: number) => {
    let s = (seed + k * 1013) % 2147483647;
    s = (s * 16807) % 2147483647;
    return (s % 1000) / 1000;
  };

  const st = (d.shotType ?? "WRIST").toUpperCase();
  let baseSpeed = 82;
  let spread = 8;
  if (st.includes("SLAP")) { baseSpeed = 95; spread = 9; }
  else if (st.includes("ONE") || st.includes("TIMER")) { baseSpeed = 93; spread = 8; }
  else if (st.includes("SNAP")) { baseSpeed = 86; spread = 7; }
  else if (st.includes("WRIST")) { baseSpeed = 81; spread = 7; }
  else if (st.includes("BACK")) { baseSpeed = 68; spread = 8; }
  else if (st.includes("TIP") || d.play === "deflect") { baseSpeed = 64; spread = 10; }

  const speedMph = Math.round((baseSpeed + (r(1) - 0.5) * spread * 2) * 10) / 10;
  const speedKmh = Math.round(speedMph * 1.60934 * 10) / 10;

  const sec = (d.sector ?? "SLOT").toUpperCase();
  let baseDist = 25;
  let distSpread = 6;
  if (sec.includes("NET") || sec.includes("CREASE")) { baseDist = 13; distSpread = 5; }
  else if (sec.includes("POINT")) { baseDist = 56; distSpread = 8; }
  else if (sec.includes("CIRCLE")) { baseDist = 38; distSpread = 7; }
  else if (sec.includes("PERIMETER")) { baseDist = 44; distSpread = 8; }
  else { baseDist = 24; distSpread = 7; } // SLOT

  const distanceFt = Math.max(6, Math.round(baseDist + (r(2) - 0.5) * distSpread * 2));
  const distanceM = Math.round(distanceFt * 0.3048 * 10) / 10;

  const shotTypeLabel =
    d.play === "deflect" ? "DEFLECTION" :
    d.play === "wrap" ? "WRAPAROUND" :
    d.play === "rebound" ? "REBOUND" :
    st.includes("ONE") ? "ONE-TIMER" :
    st.includes("SLAP") ? "SLAP SHOT" :
    st.includes("SNAP") ? "SNAP SHOT" :
    st.includes("BACK") ? "BACKHAND" :
    st.includes("WRIST") ? "WRIST SHOT" : "SHOT";

  const playLabel =
    d.rush === "BREAKAWAY" ? "BREAKAWAY" :
    d.rush === "2ON1" ? "2-ON-1 RUSH" :
    d.rush === "3ON2" ? "3-ON-2 RUSH" :
    d.play === "rebound" ? "SECOND CHANCE" :
    d.play === "wrap" ? "WRAPAROUND" :
    d.emptyNet ? "EMPTY NET" :
    d.strength === "PP" ? "POWER PLAY" :
    d.strength === "SH" ? "SHORTHANDED" : "EVEN STRENGTH";

  const xgFormatted = d.xg != null ? d.xg.toFixed(2) : null;
  const isHighDanger = (d.xg != null && d.xg >= 0.22) || sec.includes("NET") || d.rush === "BREAKAWAY";

  return {
    speedMph,
    speedKmh,
    distanceFt,
    distanceM,
    shotTypeLabel,
    playLabel,
    xgFormatted,
    isHighDanger,
  };
}
