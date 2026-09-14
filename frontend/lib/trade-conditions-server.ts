// Structured trade conditions — the layer on top of TradeCondition's plain
// free-text description (see prisma/schema.prisma). A commissioner attaches
// this AFTER a trade with a text condition already exists (createTradeRecord
// auto-creates the row), or a GM builds it directly in the Trade Builder,
// picking a player (or, for a protected pick, no player at all), 1-3 clauses,
// and the two candidate DraftPicks — pickA (the UPGRADE, conveys INSTEAD if
// the clauses evaluate true) and pickB (the DEFAULT, conveys as-is if they
// evaluate false). Both picks get locked out of any other trade for as long
// as the condition is PENDING (see lib/trade-exec.ts's assertOwnership).
//
// A clause can be judged on the player's REAL-LIFE NHL production (same real
// NHL API — api-web.nhle.com — lib/nhl-career-gp-import.ts already pulls
// career games from) or on this league's OWN (UNHL) simulated games —
// whichever the GM picks per clause. A clause can also be a UNHL playoff run,
// a UNHL contract extension, or (no player at all) a classic top-N protected
// 1st rounder resolved against the Draft Lottery.

import { prisma } from "./prisma";

export * from "./trade-conditions-shared";
import {
  METRIC_LABELS, OP_LABELS, PLAYOFF_ROUND_LABELS,
  type Metric, type Op, type PlayoffRound, type ConditionClause,
  type StatClause, type PlayoffClause, type ContractClause, type LotteryClause,
} from "./trade-conditions-shared";

const compare = (op: string, value: number, threshold: number): boolean => {
  switch (op) {
    case "GTE": return value >= threshold;
    case "GT": return value > threshold;
    case "LTE": return value <= threshold;
    case "LT": return value < threshold;
    default: return false;
  }
};

const seasonStr = (startYear: number) => `${startYear}-${String(startYear + 1).slice(-2)}`;

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

/** This league's (UNHL) own regular-season stats for `seasonYear`, summed
 *  across every FINAL NHL game he actually appears in that season regardless
 *  of which club he suited up for (mirrors the real-NHL trade-split summing
 *  above). Returns null only if the player doesn't exist at all — 0 games so
 *  far is a normal, valid (not-yet-met) result, not an error. */
export async function unhlSeasonStats(playerId: number, seasonYear: number): Promise<PlayerSeasonStats | null> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { id: true } });
  if (!p) return null;
  const rows = await prisma.playerGameStat.findMany({
    where: { playerId, game: { season: seasonStr(seasonYear), league: "NHL", status: "FINAL" } },
    select: { goals: true, assists: true, points: true },
  });
  const gamesPlayed = rows.length;
  const goals = rows.reduce((t, r) => t + r.goals, 0);
  const assists = rows.reduce((t, r) => t + r.assists, 0);
  const points = rows.reduce((t, r) => t + r.points, 0);
  return { goals, assists, points, gamesPlayed, ppg: gamesPlayed ? points / gamesPlayed : 0 };
}

const valueOf = (stats: PlayerSeasonStats, metric: string): number =>
  metric === "POINTS" ? stats.points : metric === "GOALS" ? stats.goals : metric === "ASSISTS" ? stats.assists
    : metric === "GAMES_PLAYED" ? stats.gamesPlayed : metric === "PPG" ? stats.ppg : 0;

const ROUND_LEVEL: Record<PlayoffRound, number> = { MADE_PLAYOFFS: 1, WON_R1: 2, WON_R2: 3, WON_CONF: 4, WON_CUP: 5 };

export type ClauseProgress = { kind: ConditionClause["kind"]; label: string; pass: boolean; detail: string; logic?: "AND" | "OR" };
export type ConditionEval = { met: boolean; clauses: ClauseProgress[] };
export type ConditionEvalResult = { eval: ConditionEval | null; error: string | null };

export type StructuredCondition = Awaited<ReturnType<typeof prisma.tradeCondition.findUniqueOrThrow>>;

async function evalStat(c: StatClause, condition: StructuredCondition): Promise<ClauseProgress | { error: string }> {
  if (!condition.playerId) return { error: "No player attached for this stat clause." };
  const stats = c.source === "UNHL" ? await unhlSeasonStats(condition.playerId, c.seasonYear) : await playerSeasonStats(condition.playerId, c.seasonYear);
  if (!stats) return { error: c.source === "UNHL" ? "Couldn't find this player for UNHL stats." : "Couldn't read real NHL stats for this player (no real NHL ID on file, or the NHL API is unreachable right now)." };
  const value = valueOf(stats, c.metric);
  const pass = compare(c.op, value, c.threshold);
  const label = `${METRIC_LABELS[c.metric as Metric] ?? c.metric} ${OP_LABELS[c.op as Op] ?? c.op} ${c.threshold} (${c.source === "UNHL" ? "UNHL" : "Real NHL"} ${seasonStr(c.seasonYear)})`;
  return { kind: "STAT", label, pass, detail: `currently ${Math.round(value * 100) / 100} (${stats.gamesPlayed} GP)`, logic: c.logic };
}

async function evalPlayoff(c: PlayoffClause, condition: StructuredCondition): Promise<ClauseProgress | { error: string }> {
  const teamId = condition.fromTeamId; // the condition's ownerTeamId
  const season = seasonStr(c.seasonYear);
  const rows = await prisma.playoffSeries.findMany({
    where: { season, league: "NHL", OR: [{ highSeedTeamId: teamId }, { lowSeedTeamId: teamId }] },
    select: { round: true, winnerTeamId: true },
  });
  let level = 0;
  if (rows.length) {
    level = Math.max(...rows.map((r) => r.round));
    if (rows.some((r) => r.round === 4 && r.winnerTeamId === teamId)) level = 5;
  }
  const need = ROUND_LEVEL[c.round];
  const pass = level >= need;
  const label = `${PLAYOFF_ROUND_LABELS[c.round] ?? c.round} (${season}, UNHL)`;
  return { kind: "PLAYOFF_ROUND", label, pass, detail: level === 0 ? "didn't make the playoffs (yet)" : `reached level ${level}/5`, logic: c.logic };
}

async function evalContract(c: ContractClause, condition: StructuredCondition): Promise<ClauseProgress | { error: string }> {
  if (!condition.playerId) return { error: "No player attached for this contract clause." };
  const [team, logs] = await Promise.all([
    prisma.team.findUnique({ where: { id: condition.fromTeamId }, select: { code: true } }),
    prisma.signingLog.findMany({ where: { playerId: condition.playerId, reverted: false, createdAt: { gte: condition.createdAt } }, select: { teamCode: true } }),
  ]);
  const signed = !!team?.code && logs.some((l) => l.teamCode === team.code);
  const pass = c.extended ? signed : !signed;
  const label = c.extended ? "Signs a new deal with them" : "Does NOT sign with them";
  return { kind: "CONTRACT_EXT", label, pass, detail: signed ? "signed a new deal" : "no new deal signed yet", logic: c.logic };
}

async function evalLottery(c: LotteryClause, condition: StructuredCondition): Promise<ClauseProgress | { error: string }> {
  if (!condition.pickAId) return { error: "No protected pick attached." };
  const pickA = await prisma.draftPick.findUnique({ where: { id: condition.pickAId } });
  if (!pickA) return { error: "Protected pick not found." };
  if (pickA.round !== 1) return { error: "Only a 1st round pick can be lottery-protected." };
  const origTeam = pickA.ownerLogoId != null ? await prisma.team.findFirst({ where: { profinhlLogoId: pickA.ownerLogoId } }) : null;
  if (!origTeam) return { error: "Couldn't resolve the pick's original team." };
  const lotteryRow = await prisma.draftLottery.findFirst({ where: { year: pickA.year, teamId: origTeam.id } });
  if (!lotteryRow) return { error: `The ${pickA.year} Draft Lottery hasn't been drawn yet.` };
  // pass = SAFE to convey (the original team did NOT land in the protected
  // range) — if they did, Pick A is protected and Pick B goes out instead.
  const pass = lotteryRow.pick > c.threshold;
  const label = `Not lottery-protected (top ${c.threshold}, ${pickA.year})`;
  return { kind: "LOTTERY_PROTECTION", label, pass, detail: `${origTeam.code ?? origTeam.name} landed at #${lotteryRow.pick}`, logic: c.logic };
}

async function evalClause(c: ConditionClause, condition: StructuredCondition): Promise<ClauseProgress | { error: string }> {
  switch (c.kind) {
    case "STAT": return evalStat(c, condition);
    case "PLAYOFF_ROUND": return evalPlayoff(c, condition);
    case "CONTRACT_EXT": return evalContract(c, condition);
    case "LOTTERY_PROTECTION": return evalLottery(c, condition);
  }
}

/** Live progress for a condition that already has structured `clauses`
 *  attached. `eval` is null (with `error` set) when it's still a plain
 *  free-text condition, or any one clause couldn't be evaluated (no real NHL
 *  ID on file, the lottery for a protected pick's year hasn't run yet, etc). */
export async function evaluateCondition(condition: StructuredCondition): Promise<ConditionEvalResult> {
  const clauses = (condition.clauses as unknown as ConditionClause[] | null) ?? [];
  if (clauses.length === 0) return { eval: null, error: "No structured clauses attached." };
  const progress: ClauseProgress[] = [];
  let met: boolean | null = null;
  for (const c of clauses) {
    const r = await evalClause(c, condition);
    if ("error" in r) return { eval: null, error: r.error };
    progress.push(r);
    met = met === null ? r.pass : (c.logic === "OR" ? (met || r.pass) : (met && r.pass));
  }
  return { eval: { met: met ?? false, clauses: progress }, error: null };
}
