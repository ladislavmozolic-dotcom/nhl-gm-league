// NHL-style draft lottery. The 16 non-playoff clubs enter; TWO weighted draws set
// the #1 and #2 picks (a club may move up at most 10 spots). The rest of round 1 is
// non-playoff clubs by inverse standings, then playoff clubs by how far they went
// (earliest out picks first, Cup champion picks 32nd). Drawn once, stored.

import { prisma } from "./prisma";
import { computeStandings } from "./sim/standings";
import { assignBlocks, ownerOfRank, drawFourBalls, type ComboBlock } from "./lottery-combos";

// Odds (%) for the #1 pick, worst record first — the real NHL table (16 clubs).
export const LOTTERY_ODDS_PCT = [18.5, 13.5, 11.5, 9.5, 8.5, 7.5, 6.5, 6.0, 5.0, 3.5, 3.0, 2.5, 2.0, 1.5, 0.5, 0.5];
export const MAX_MOVE_UP = 10; // a club can climb at most this many draft slots
export const LOTTERY_DRAWS = 2; // picks decided by lottery (#1 and #2)

/** The season that decides a draft year's order: draft Y follows season (Y-1)-YY.
 *  e.g. the 2027 draft is set by the 2026-27 season. Lets the lottery + draft order
 *  advance automatically with the calendar instead of a hardcoded season. */
export function seasonForDraftYear(year: number): string {
  return `${year - 1}-${String(year).slice(2)}`;
}

export type LotteryTeams = {
  nonPlayoff: { teamId: number; points: number }[]; // worst first (lottery order)
  playoff: { teamId: number; elimRank: number; points: number }[]; // earliest-out first
};

/** Split the league into non-playoff (lottery) clubs worst-first and playoff clubs
 *  ordered by elimination (Cup champion last). */
export async function lotteryTeams(season = "2026-27"): Promise<LotteryTeams> {
  const [standings, series] = await Promise.all([
    computeStandings(season, "NHL"),
    prisma.playoffSeries.findMany({ where: { season, league: "NHL" }, select: { round: true, highSeedTeamId: true, lowSeedTeamId: true, winnerTeamId: true } }),
  ]);
  const ptsOf = new Map(standings.map((s) => [s.teamId, s.points]));
  const inPlayoffs = new Set<number>();
  const maxRound = new Map<number, number>();
  const wonRound = new Map<number, Set<number>>();
  for (const s of series) {
    for (const tid of [s.highSeedTeamId, s.lowSeedTeamId]) {
      inPlayoffs.add(tid);
      maxRound.set(tid, Math.max(maxRound.get(tid) ?? 0, s.round));
    }
    if (s.winnerTeamId) { (wonRound.get(s.winnerTeamId) ?? wonRound.set(s.winnerTeamId, new Set()).get(s.winnerTeamId)!).add(s.round); }
  }
  // non-playoff, worst first (fewest points)
  const nonPlayoff = standings
    .filter((s) => !inPlayoffs.has(s.teamId))
    .map((s) => ({ teamId: s.teamId, points: s.points }))
    .sort((a, b) => a.points - b.points);
  // playoff, elimination rank: lost R1=1 … lost final=4, champion=5
  const playoff = [...inPlayoffs].map((teamId) => {
    const mr = maxRound.get(teamId) ?? 1;
    const wonMax = wonRound.get(teamId)?.has(mr) ?? false;
    const elimRank = wonMax && mr === 4 ? 5 : mr; // won the final = champion, else out in round mr
    return { teamId, elimRank, points: ptsOf.get(teamId) ?? 0 };
  }).sort((a, b) => a.elimRank - b.elimRank || a.points - b.points); // earliest out + worst record first
  return { nonPlayoff, playoff };
}

/** The published combination assignment for a set of non-playoff clubs (worst-first). */
export function lotteryBlocks(nonPlayoff: number[]): ComboBlock[] {
  return assignBlocks(nonPlayoff, LOTTERY_ODDS_PCT);
}

export type LotteryWinner = { teamId: number; fromPos: number; balls: number[]; rank: number };
export type LotteryDraw = { winners: LotteryWinner[]; order: number[]; blocks: ComboBlock[] };
/** Actually draw the balls: four at a time until the combination belongs to an
 *  eligible, not-yet-won club (redraw on the unassigned combo, a repeat winner, or a
 *  club that would climb more than 10 spots). Records the winning balls per pick so
 *  the whole league can watch and verify. */
export function drawLottery(nonPlayoff: number[]): LotteryDraw {
  const blocks = lotteryBlocks(nonPlayoff);
  const posOf = new Map(nonPlayoff.map((t, i) => [t, i + 1]));
  const won = new Set<number>();
  const winners: LotteryWinner[] = [];
  for (let k = 1; k <= LOTTERY_DRAWS; k++) {
    let guard = 0;
    while (guard++ < 100000) {
      const { balls, rank } = drawFourBalls();
      const teamId = ownerOfRank(blocks, rank);
      if (teamId == null) continue;         // the redraw combination (unassigned)
      if (won.has(teamId)) continue;        // this club already won a draw
      const pos = posOf.get(teamId) ?? 1;
      if (pos - k > MAX_MOVE_UP) continue;  // can't climb more than 10 spots
      winners.push({ teamId, fromPos: pos, balls, rank });
      won.add(teamId);
      break;
    }
  }
  const rest = nonPlayoff.filter((t) => !won.has(t));
  return { winners, order: [...winners.map((w) => w.teamId), ...rest], blocks };
}

export type LotteryOutcome = {
  round1: { pick: number; teamId: number; viaLottery: boolean; combo: number[] | null }[];
  winners: LotteryWinner[];
};
/** Compute a full round-1 order from one lottery draw (no persistence). */
export async function computeLotteryOrder(year: number): Promise<LotteryOutcome> {
  const { nonPlayoff, playoff } = await lotteryTeams(seasonForDraftYear(year));
  const draw = drawLottery(nonPlayoff.map((t) => t.teamId));
  const winnerSet = new Set(draw.winners.map((w) => w.teamId));
  const ballsOf = new Map(draw.winners.map((w) => [w.teamId, w.balls]));
  const teamOrder = [...draw.order, ...playoff.map((p) => p.teamId)]; // 32 teams
  return {
    round1: teamOrder.map((teamId, i) => {
      const viaLottery = i < LOTTERY_DRAWS && winnerSet.has(teamId);
      return { pick: i + 1, teamId, viaLottery, combo: viaLottery ? ballsOf.get(teamId) ?? null : null };
    }),
    winners: draw.winners,
  };
}

/** A non-committing draw — used for practice runs. */
export async function simulateLottery(year: number): Promise<LotteryOutcome> {
  return computeLotteryOrder(year);
}

/** Run + persist the lottery → the full round-1 order for a draft year. */
export async function runLottery(year: number) {
  const outcome = await computeLotteryOrder(year);
  await prisma.$transaction([
    prisma.draftLottery.deleteMany({ where: { year } }),
    prisma.draftLottery.createMany({ data: outcome.round1.map((r) => ({ year, pick: r.pick, teamId: r.teamId, viaLottery: r.viaLottery, combo: r.combo ? r.combo.join("-") : null })) }),
  ]);
  return { winners: outcome.winners };
}

export async function getLottery(year: number) {
  return prisma.draftLottery.findMany({ where: { year }, orderBy: { pick: "asc" } });
}
