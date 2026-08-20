// PRE-SEASON — 6 exhibition games per NHL club, a rest day between each round.
// Fully isolated from the real season by a distinct Game.season string, so it
// never touches standings, stats, careers or records. The sim persists ONLY the
// Game score + play-by-play — no PlayerGameStat/GoalieGameStat rows, no injuries,
// no condition/morale/chemistry/finance side-effects. Purely exhibition.

import { prisma } from "./prisma";
import { loadSimTeam, fixtureSeed } from "./sim";
import { simulateGame } from "./sim/engine";
import { saveGameResult } from "./sim/persist";
import { syncChem } from "./sim/season";
import { loadSettings } from "./sim/settings";
import type { SimTeam } from "./sim/types";
import { PRE_SEASON } from "./phase";

export { PRE_SEASON };
export const PRE_ROUNDS = 6;
const YEAR = 2026;
const DAY = 86_400_000;

/** Round r (0..5) → a calendar date, two days apart. With a chosen start day the
 *  first round is that day; otherwise it defaults to ending Sep 30 (the eve of the
 *  Oct 1 regular-season face-off). */
function preseasonDate(round: number, start?: Date): Date {
  if (start) return new Date(utcMidnight(start) + round * 2 * DAY);
  const last = Date.UTC(YEAR, 8, 30); // Sep 30
  return new Date(last - (PRE_ROUNDS - 1 - round) * 2 * DAY);
}
const utcMidnight = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export function preseasonDateFor(round: number) { return preseasonDate(round); }

/** Circle-method round-robin: each team plays once per round, a fresh opponent
 *  each round. Returns the first `numRounds` rounds of [home, away] pairings. */
function buildRounds(ids: number[], numRounds: number): [number, number][][] {
  const arr = [...ids];
  if (arr.length % 2) arr.push(-1); // odd → a bye slot
  const n = arr.length, half = n / 2;
  let order = arr.slice();
  const rounds: [number, number][][] = [];
  for (let r = 0; r < numRounds; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < half; i++) {
      const a = order[i], b = order[n - 1 - i];
      if (a === -1 || b === -1) continue;
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]); // alternate home/away by round
    }
    rounds.push(pairs);
    const [fixed, ...rest] = order;      // rotate all but the first
    rest.unshift(rest.pop()!);
    order = [fixed, ...rest];
  }
  return rounds;
}

/** (Re)build the pre-season schedule (6 rounds, a rest day between each). Wipes any
 *  existing pre-season games. `startDate` sets the exact face-off day of round 1. */
export async function generatePreseason(startDate?: Date): Promise<{ games: number; teams: number; rounds: number; firstDate: Date; lastDate: Date }> {
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true }, orderBy: { id: "asc" } });
  const ids = teams.map((t) => t.id);
  if (ids.length < 2) return { games: 0, teams: ids.length, rounds: 0, firstDate: preseasonDate(0, startDate), lastDate: preseasonDate(PRE_ROUNDS - 1, startDate) };

  await prisma.game.deleteMany({ where: { season: PRE_SEASON } });
  const rounds = buildRounds(ids, PRE_ROUNDS);
  const rows = rounds.flatMap((pairs, r) =>
    pairs.map(([home, away]) => ({
      season: PRE_SEASON, league: "NHL", round: r, gameDate: preseasonDate(r, startDate),
      homeTeamId: home, awayTeamId: away, status: "SCHEDULED",
    })));
  await prisma.game.createMany({ data: rows });
  return { games: rows.length, teams: ids.length, rounds: rounds.length, firstDate: preseasonDate(0, startDate), lastDate: preseasonDate(PRE_ROUNDS - 1, startDate) };
}

/** Simulate the pre-season games due on one calendar day (for the calendar day-loop). */
export async function playPreseasonDay(dayStart: Date, dayEnd: Date): Promise<{ played: number }> {
  return simPreseason({ season: PRE_SEASON, status: "SCHEDULED", gameDate: { gte: dayStart, lt: dayEnd } });
}

/** Simulate every scheduled pre-season game at once (admin "Simulate all"). */
export async function playPreseason(): Promise<{ played: number }> {
  return simPreseason({ season: PRE_SEASON, status: "SCHEDULED" });
}

/** Shared pre-season simmer — full box score, no profile/career/condition impact. */
async function simPreseason(where: object): Promise<{ played: number }> {
  const settings = await loadSettings();
  const scheduled = await prisma.game.findMany({
    where,
    orderBy: [{ round: "asc" }, { id: "asc" }],
    select: { id: true, round: true, gameDate: true, homeTeamId: true, awayTeamId: true },
  });
  if (scheduled.length === 0) return { played: 0 };

  const cache = new Map<number, SimTeam | null>();
  const starts = new Map<number, number>(); // per-team games played → rotate the starter
  const getTeam = async (id: number) => {
    if (cache.has(id)) return cache.get(id) ?? null;
    try {
      const t = await loadSimTeam(id, undefined, { chemBase: settings.chemistryBase, offPos: { wing: settings.offPosWingPct, center: settings.offPosCenterPct, def: settings.offPosDefPct, chemCap: settings.offPosChemCap } });
      cache.set(id, t); return t;
    } catch { cache.set(id, null); return null; }
  };

  let played = 0;
  for (const gm of scheduled) {
    const [home, away] = await Promise.all([getTeam(gm.homeTeamId), getTeam(gm.awayTeamId)]);
    if (!home || !away) continue;
    for (const [team, tid] of [[home, gm.homeTeamId], [away, gm.awayTeamId]] as const) {
      // rotate goalies across the 6 games so backups get pre-season starts
      const n = starts.get(tid) ?? 0; starts.set(tid, n + 1);
      if (team.goalies.length) {
        const starter = team.goalies[n % team.goalies.length];
        starter.fatigued = false;
        team.goalie = starter;
        team.backup = team.goalies.find((g) => g.id !== starter.id) ?? null;
      }
      syncChem(team, settings.chemistryBase);
    }
    const seed = fixtureSeed(gm.homeTeamId, gm.awayTeamId, (gm.round ?? 0) + gm.id * 7);
    const rivalry = home.rivalTeamIds.includes(away.id) || away.rivalTeamIds.includes(home.id);
    const result = simulateGame(home, away, { seed, settings, rivalry, league: "NHL" });
    // Full box score (players, goalies, goals, penalties, events) is persisted under the
    // PRE season string → complete pre-season stats/standings/scoreboard, while every
    // player-profile / career / regular-season aggregation (keyed on the regular season
    // string) ignores it. NO Player condition/injury/morale side-effects — that lives in
    // playScheduledGames, which we deliberately don't call here. Purely exhibition.
    await saveGameResult(result, { gameId: gm.id, season: PRE_SEASON, gameDate: gm.gameDate ?? preseasonDate(gm.round ?? 0), round: gm.round ?? 0 });
    played++;
  }
  return { played };
}

export type PreGameRow = {
  id: number; round: number; date: Date | null; status: string;
  home: TeamMini; away: TeamMini; homeGoals: number | null; awayGoals: number | null;
  endedIn: string | null; winnerTeamId: number | null;
};
type TeamMini = { id: number; name: string; code: string | null; logoUrl: string | null; slug: string | null };

/** All pre-season games grouped by round, for the public page. */
export async function preseasonSchedule(): Promise<{ rounds: { round: number; date: Date | null; games: PreGameRow[] }[]; hasSchedule: boolean }> {
  const games = await prisma.game.findMany({
    where: { season: PRE_SEASON },
    orderBy: [{ round: "asc" }, { id: "asc" }],
    select: { id: true, round: true, gameDate: true, status: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, endedIn: true, winnerTeamId: true },
  });
  if (games.length === 0) return { rounds: [], hasSchedule: false };
  const ids = [...new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
  const teams = await prisma.team.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, code: true, logoUrl: true, slug: true } });
  const tById = new Map(teams.map((t) => [t.id, t]));
  const mini = (id: number): TeamMini => tById.get(id) ?? { id, name: "?", code: null, logoUrl: null, slug: null };

  const byRound = new Map<number, PreGameRow[]>();
  for (const g of games) {
    const row: PreGameRow = {
      id: g.id, round: g.round ?? 0, date: g.gameDate, status: g.status,
      home: mini(g.homeTeamId), away: mini(g.awayTeamId),
      homeGoals: g.homeGoals, awayGoals: g.awayGoals, endedIn: g.endedIn, winnerTeamId: g.winnerTeamId,
    };
    (byRound.get(row.round) ?? byRound.set(row.round, []).get(row.round)!).push(row);
  }
  const rounds = [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([round, gs]) => ({ round, date: gs[0]?.date ?? null, games: gs }));
  return { rounds, hasSchedule: true };
}
