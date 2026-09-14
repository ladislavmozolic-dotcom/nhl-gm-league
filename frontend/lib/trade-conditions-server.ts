// Structured trade conditions — the stat-threshold layer on top of
// TradeCondition's plain free-text description (see prisma/schema.prisma).
// A commissioner attaches this AFTER a trade with a text condition already
// exists (createTradeRecord auto-creates the row), picking a player, a
// threshold (or two, AND/OR), and the two candidate DraftPicks — the one
// already conveyed (pickA, the "if NOT met" resting state) and the alternate
// that swaps in for the receiving club instead if the stats clear the bar
// (pickB). Both picks get locked out of any other trade for as long as the
// condition is PENDING (see lib/trade-exec.ts's assertOwnership).
//
// IMPORTANT: a real conditional-pick clause in this league is judged on the
// player's REAL-LIFE NHL production, not this league's own simulated games —
// same real NHL API (api-web.nhle.com) lib/nhl-career-gp-import.ts already
// pulls career games from. Requires the player to carry a real Player.nhlId;
// a fictional/generated player has no real season to check against.

import { prisma } from "./prisma";

export * from "./trade-conditions-shared";
import { METRIC_LABELS, type Metric } from "./trade-conditions-shared";

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

const NHL_API_UA = "Mozilla/5.0 (compatible; ProfiNHL-League/1.0)";

/** Real-life NHL regular-season stats for `seasonYear` (its start year, e.g.
 *  2025 = the 2025-26 season) — pulled live from the real NHL API, the exact
 *  same source lib/nhl-career-gp-import.ts uses for career games. Returns null
 *  if the player has no real Player.nhlId on file, the API call fails, or that
 *  season/NHL/regular-season row isn't in his history yet (0 GP so far). */
export async function playerSeasonStats(playerId: number, seasonYear: number): Promise<PlayerSeasonStats | null> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { nhlId: true } });
  if (!p?.nhlId) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`https://api-web.nhle.com/v1/player/${p.nhlId}/landing`, { headers: { "User-Agent": NHL_API_UA }, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    const d = await res.json();
    const seasonCode = seasonYear * 10000 + (seasonYear + 1);
    // the API returns one row PER TEAM for a season the player was traded
    // within (e.g. 20 GP with his old club + 15 with his new one) — a real
    // conditional-pick clause always means the FULL season regardless of who
    // he's playing for, so every matching row must be summed, not just the first.
    const rows = (d?.seasonTotals ?? []).filter((s: { season?: number; leagueAbbrev?: string; gameTypeId?: number }) =>
      s.season === seasonCode && s.leagueAbbrev === "NHL" && s.gameTypeId === 2);
    const sum = (f: (r: { goals?: number; assists?: number; points?: number; gamesPlayed?: number }) => number | undefined) =>
      rows.reduce((t: number, r: { goals?: number; assists?: number; points?: number; gamesPlayed?: number }) => t + (f(r) ?? 0), 0);
    const gamesPlayed = sum((r) => r.gamesPlayed);
    const points = sum((r) => r.points);
    return { goals: sum((r) => r.goals), assists: sum((r) => r.assists), points, gamesPlayed, ppg: gamesPlayed ? points / gamesPlayed : 0 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const valueOf = (stats: PlayerSeasonStats, metric: string): number =>
  metric === "POINTS" ? stats.points : metric === "GOALS" ? stats.goals : metric === "ASSISTS" ? stats.assists
    : metric === "GAMES_PLAYED" ? stats.gamesPlayed : metric === "PPG" ? stats.ppg : 0;

export type ClauseProgress = { metric: string; label: string; value: number; op: string; threshold: number; pass: boolean };
export type ConditionEval = { met: boolean; clauses: ClauseProgress[]; stats: PlayerSeasonStats };
export type ConditionEvalResult = { eval: ConditionEval | null; error: string | null };

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

/** Live progress for a condition that already has structured fields set —
 *  against the player's REAL NHL stats (see playerSeasonStats above), not this
 *  league's own simulated games. `eval` is null (with `error` set) when it's
 *  still a plain free-text condition, the player has no real Player.nhlId on
 *  file, or the real NHL API call failed. */
export async function evaluateCondition(condition: StructuredCondition): Promise<ConditionEvalResult> {
  if (!condition.playerId || !condition.seasonYear) return { eval: null, error: "No player/season attached." };
  const stats = await playerSeasonStats(condition.playerId, condition.seasonYear);
  if (!stats) return { eval: null, error: "Couldn't read real NHL stats for this player (no real NHL ID on file, or the NHL API is unreachable right now)." };
  return { eval: evaluateAgainstStats(condition, stats), error: null };
}

