// Structured trade conditions — the stat-threshold layer on top of
// TradeCondition's plain free-text description (see prisma/schema.prisma).
// A commissioner attaches this AFTER a trade with a text condition already
// exists (createTradeRecord auto-creates the row), picking a player, a
// threshold (or two, AND/OR), and the two candidate DraftPicks — the one
// already conveyed (pickA, the "if NOT met" resting state) and the alternate
// that swaps in for the receiving club instead if the stats clear the bar
// (pickB). Both picks get locked out of any other trade for as long as the
// condition is PENDING (see lib/trade-exec.ts's assertOwnership).

import { prisma } from "./prisma";

export const METRICS = ["POINTS", "GOALS", "ASSISTS", "GAMES_PLAYED", "PPG"] as const;
export type Metric = (typeof METRICS)[number];
export const METRIC_LABELS: Record<Metric, string> = {
  POINTS: "Points", GOALS: "Goals", ASSISTS: "Assists", GAMES_PLAYED: "Games Played", PPG: "Points per Game",
};

export const OPS = ["GTE", "GT", "LTE", "LT"] as const;
export type Op = (typeof OPS)[number];
export const OP_LABELS: Record<Op, string> = { GTE: "≥", GT: ">", LTE: "≤", LT: "<" };

function seasonStr(seasonYear: number): string {
  return `${seasonYear}-${String(seasonYear + 1).slice(-2)}`;
}

const compare = (op: string, value: number, threshold: number): boolean => {
  switch (op) {
    case "GTE": return value >= threshold;
    case "GT": return value > threshold;
    case "LTE": return value <= threshold;
    case "LT": return value < threshold;
    default: return false;
  }
};

export type PlayerSeasonStats = { goals: number; assists: number; points: number; gamesPlayed: number; ppg: number };

/** Regular-season NHL stats only (no preseason/playoffs) — the standard basis
 *  for a real conditional-pick clause. */
export async function playerSeasonStats(playerId: number, seasonYear: number): Promise<PlayerSeasonStats> {
  const rows = await prisma.playerGameStat.findMany({
    where: { playerId, game: { season: seasonStr(seasonYear), league: "NHL", status: "FINAL" } },
    select: { goals: true, assists: true, points: true },
  });
  const goals = rows.reduce((s, r) => s + r.goals, 0);
  const assists = rows.reduce((s, r) => s + r.assists, 0);
  const points = rows.reduce((s, r) => s + r.points, 0);
  const gamesPlayed = rows.length;
  return { goals, assists, points, gamesPlayed, ppg: gamesPlayed ? points / gamesPlayed : 0 };
}

const valueOf = (stats: PlayerSeasonStats, metric: string): number =>
  metric === "POINTS" ? stats.points : metric === "GOALS" ? stats.goals : metric === "ASSISTS" ? stats.assists
    : metric === "GAMES_PLAYED" ? stats.gamesPlayed : metric === "PPG" ? stats.ppg : 0;

export type ClauseProgress = { metric: string; label: string; value: number; op: string; threshold: number; pass: boolean };
export type ConditionEval = { met: boolean; clauses: ClauseProgress[]; stats: PlayerSeasonStats };

export function evaluateAgainstStats(c: {
  metric: string | null; op: string | null; threshold: number | null;
  metric2: string | null; op2: string | null; threshold2: number | null; logic2: string | null;
}, stats: PlayerSeasonStats): ConditionEval | null {
  if (!c.metric || !c.op || c.threshold == null) return null;
  const v1 = valueOf(stats, c.metric);
  const pass1 = compare(c.op, v1, c.threshold);
  const clauses: ClauseProgress[] = [{ metric: c.metric, label: METRIC_LABELS[c.metric as Metric] ?? c.metric, value: Math.round(v1 * 100) / 100, op: c.op, threshold: c.threshold, pass: pass1 }];
  let met = pass1;
  if (c.metric2 && c.op2 && c.threshold2 != null) {
    const v2 = valueOf(stats, c.metric2);
    const pass2 = compare(c.op2, v2, c.threshold2);
    clauses.push({ metric: c.metric2, label: METRIC_LABELS[c.metric2 as Metric] ?? c.metric2, value: Math.round(v2 * 100) / 100, op: c.op2, threshold: c.threshold2, pass: pass2 });
    met = c.logic2 === "OR" ? (pass1 || pass2) : (pass1 && pass2);
  }
  return { met, clauses, stats };
}

export type StructuredCondition = Awaited<ReturnType<typeof prisma.tradeCondition.findUniqueOrThrow>>;

/** Live progress for a condition that already has structured fields set. Null
 *  if it's still a plain free-text condition (no metric attached yet). */
export async function evaluateCondition(condition: StructuredCondition): Promise<ConditionEval | null> {
  if (!condition.playerId || !condition.seasonYear) return null;
  const stats = await playerSeasonStats(condition.playerId, condition.seasonYear);
  return evaluateAgainstStats(condition, stats);
}

