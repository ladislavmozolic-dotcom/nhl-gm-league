// PRE-SEASON — 6 exhibition games per NHL club, a rest day between each round.
// Every NHL fixture is mirrored by its two AHL affiliates on the same date.
// Fully isolated from the real season by a distinct Game.season string, so it
// never touches regular-season standings, careers or records. Full preseason
// boxscores are stored under their own season key. Conditioning, injuries and
// line chemistry do carry over — a line that gels in camp should show up gelled
// on opening night, not reset to a projection — but morale/finance do not.

import { prisma } from "./prisma";
import { loadSimTeam, fixtureSeed } from "./sim";
import { simulateGame } from "./sim/engine";
import { saveGameResult } from "./sim/persist";
import { evolveChem, injuryConTarget, syncChem, updateInjuryCon } from "./sim/season";
import { loadSettings } from "./sim/settings";
import { activeSimEngine, engineVersionFor } from "./sim/version";
import { recordSimAudit } from "./audit-server";
import type { SimTeam } from "./sim/types";
import type { TeamLinesData } from "./sim/lines-core";
import { PRE_SEASON, REGULAR_SEASON } from "./phase";
import { getArenaSections, attendanceRate, priceAttendanceFactor } from "./finance";

export { PRE_SEASON };
export const PRE_ROUNDS = 6;
const YEAR = 2026;
const DAY = 86_400_000;
// Round 5 (the last exhibition round) should land this many days before the
// REAL first regular-season game — not the hardcoded Oct 1 calendar constant,
// since an imported real schedule can face off on a different date.
const PRESEASON_GAP_DAYS = 3;

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

/** Round 1's face-off day so the LAST exhibition round lands exactly
 *  PRESEASON_GAP_DAYS before the real first regular-season game — computed from the
 *  actual schedule (imported or generated), not the hardcoded Oct 1 constant. Returns
 *  null if the regular-season schedule doesn't exist yet (nothing to count back from). */
export async function computeAutoPreseasonStart(): Promise<Date | null> {
  const first = await prisma.game.findFirst({
    where: { season: REGULAR_SEASON, seriesId: null },
    orderBy: { gameDate: "asc" }, select: { gameDate: true },
  });
  if (!first?.gameDate) return null;
  // round 5 (last) = start + 5*2 days, so start = target - 10 days
  return new Date(utcMidnight(first.gameDate) - PRESEASON_GAP_DAYS * DAY - (PRE_ROUNDS - 1) * 2 * DAY);
}

/** (Re)build the pre-season schedule (6 rounds, a rest day between each). Wipes any
 *  existing pre-season games. `startDate` sets the exact face-off day of round 1. */
export async function generatePreseason(startDate?: Date): Promise<{ games: number; teams: number; rounds: number; firstDate: Date; lastDate: Date }> {
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, affiliateTeams: { where: { league: "AHL" }, select: { id: true }, take: 1 } },
    orderBy: { id: "asc" },
  });
  const ids = teams.map((t) => t.id);
  if (ids.length < 2) return { games: 0, teams: ids.length, rounds: 0, firstDate: preseasonDate(0, startDate), lastDate: preseasonDate(PRE_ROUNDS - 1, startDate) };

  await prisma.game.deleteMany({ where: { season: PRE_SEASON } });
  const rounds = buildRounds(ids, PRE_ROUNDS);
  const affiliateByParent = new Map(teams.flatMap((t) => t.affiliateTeams[0] ? [[t.id, t.affiliateTeams[0].id] as const] : []));
  const rows = rounds.flatMap((pairs, r) => pairs.flatMap(([home, away]) => {
    const gameDate = preseasonDate(r, startDate);
    const fixtures = [{
      season: PRE_SEASON, league: "NHL", round: r, gameDate,
      homeTeamId: home, awayTeamId: away, status: "SCHEDULED",
    }];
    const ahlHome = affiliateByParent.get(home);
    const ahlAway = affiliateByParent.get(away);
    if (ahlHome != null && ahlAway != null) fixtures.push({
      season: PRE_SEASON, league: "AHL", round: r, gameDate,
      homeTeamId: ahlHome, awayTeamId: ahlAway, status: "SCHEDULED",
    });
    return fixtures;
  }));
  await prisma.game.createMany({ data: rows });
  return { games: rows.length, teams: ids.length, rounds: rounds.length, firstDate: preseasonDate(0, startDate), lastDate: preseasonDate(PRE_ROUNDS - 1, startDate) };
}

/** Simulate the pre-season games due on one calendar day (for the calendar day-loop). */
export async function playPreseasonDay(dayStart: Date, dayEnd: Date, actor = "System"): Promise<{ played: number }> {
  return simPreseason({ season: PRE_SEASON, status: "SCHEDULED", gameDate: { gte: dayStart, lt: dayEnd } }, actor);
}

/** Simulate every scheduled pre-season game at once (admin "Simulate all"). */
export async function playPreseason(actor = "System"): Promise<{ played: number }> {
  return simPreseason({ season: PRE_SEASON, status: "SCHEDULED" }, actor);
}

/** One rest day between exhibition rounds. Preseason games now carry real
 * conditioning and injuries, so the scheduled off-day must heal/recover them too. */
async function recoverPreseasonRestDay() {
  const teams = await prisma.team.findMany({ where: { league: { in: ["NHL", "AHL"] } }, select: { id: true } });
  await recoverPreseasonTeams(teams.map((t) => t.id));
}

/** Give selected clubs one genuine pre-season off-day. This is also used by the
 * split schedule: while eight fixtures play, every club not on that day's slate
 * still receives its normal CON/injury recovery. */
export async function recoverPreseasonTeams(teamIds: number[]) {
  const ids = [...new Set(teamIds)];
  if (!ids.length) return;
  const settings = await loadSettings();
  const skRec = Math.max(1, Math.round(settings.skaterConRecovery));
  const selected = { teamId: { in: ids } };
  await prisma.player.updateMany({ where: { ...selected, isGoalie: false, injuryDaysLeft: { lte: 0 } }, data: { condition: { increment: skRec } } });
  await prisma.player.updateMany({ where: { ...selected, isGoalie: true }, data: { condition: { increment: 2 } } });
  await prisma.player.updateMany({ where: { ...selected, condition: { gt: 100 } }, data: { condition: 100 } });
  await prisma.player.updateMany({ where: { ...selected, injuryDaysLeft: { gt: 0 } }, data: { injuryDaysLeft: { decrement: 1 } } });
  await prisma.player.updateMany({ where: { ...selected, injuryDaysLeft: { lt: 0 } }, data: { injuryDaysLeft: 0 } });
  await updateInjuryCon();
}

export async function recoverPreseasonIdleTeams(dayStart: Date, dayEnd: Date) {
  const games = await prisma.game.findMany({
    where: { season: PRE_SEASON, status: "SCHEDULED", gameDate: { gte: dayStart, lt: dayEnd } },
    select: { homeTeamId: true, awayTeamId: true },
  });
  const playing = new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId]));
  const idle = await prisma.team.findMany({
    where: { league: { in: ["NHL", "AHL"] }, id: { notIn: [...playing] } }, select: { id: true },
  });
  await recoverPreseasonTeams(idle.map((t) => t.id));
}

/** Persist the two preseason effects that matter for roster availability:
 * post-game CON and injuries. Line chemistry is persisted separately (see
 * simPreseason's end-of-call flush, same pattern as the regular season).
 * Standings/career/morale/finance remain isolated under the preseason season
 * string. */
async function persistPreseasonPlayerState(result: ReturnType<typeof simulateGame>, home: SimTeam, away: SimTeam) {
  const injured = new Map(result.injuries.map((i) => [i.playerId, i]));
  const updates: ReturnType<typeof prisma.player.update>[] = [];
  for (const [box, team] of [[result.home, home], [result.away, away]] as const) {
    const skaters = new Map([...team.forwards, ...team.defense].map((s) => [s.id, s]));
    for (const row of box.skaters) {
      const injury = injured.get(row.id);
      const con = injury ? injuryConTarget(injury.days) : Math.round(row.conAfter);
      const local = skaters.get(row.id);
      if (local) local.con = con;
      updates.push(prisma.player.update({
        where: { id: row.id },
        data: injury
          ? { condition: con, injuryDaysLeft: injury.days, injuryDesc: `${injury.desc} (${injury.mechanism})`, injurySeverity: injury.severity }
          : { condition: con },
      }));
    }
    for (const row of [box.goalie, box.backupGoalie].filter((g): g is NonNullable<typeof g> => g != null)) {
      const local = team.goalies.find((g) => g.id === row.id);
      const con = Math.round(row.conAfter);
      if (local) local.con = con;
      updates.push(prisma.player.update({ where: { id: row.id }, data: { condition: con } }));
    }
  }
  if (updates.length) await prisma.$transaction(updates);
}

/** Shared pre-season simmer — full box score plus real CON/injury effects. */
async function simPreseason(where: object, actor: string): Promise<{ played: number }> {
  const settings = await loadSettings();
  const engineVersion = engineVersionFor(await activeSimEngine());
  const scheduled = await prisma.game.findMany({
    where,
    orderBy: [{ round: "asc" }, { id: "asc" }],
    select: { id: true, league: true, round: true, gameDate: true, homeTeamId: true, awayTeamId: true },
  });
  if (scheduled.length === 0) return { played: 0 };

  const cache = new Map<number, (SimTeam & { linesUsed: TeamLinesData }) | null>();
  const starts = new Map<number, number>(); // per-team games played → rotate the starter
  const getTeam = async (id: number) => {
    if (cache.has(id)) return cache.get(id) ?? null;
    try {
      const t = await loadSimTeam(id, undefined, { chemBase: settings.chemistryBase, offPos: { wing: settings.offPosWingPct, center: settings.offPosCenterPct, def: settings.offPosDefPct, chemCap: settings.offPosChemCap } });
      cache.set(id, t); return t;
    } catch { cache.set(id, null); return null; }
  };

  const finTeams = await prisma.team.findMany({
    where: { league: "NHL" },
    select: { id: true, popularity: true, capacity: true, arenaSections: true },
  });
  const finBy = new Map(
    finTeams.map((t) => {
      const secs = getArenaSections(t);
      return [
        t.id,
        {
          pop: t.popularity ?? 100,
          capacity: secs.reduce((a, x) => a + x.capacity, 0),
          pf: priceAttendanceFactor(secs),
        },
      ];
    })
  );
  const storePreseasonAttendance = async (gm: { id: number; homeTeamId: number; awayTeamId: number; league: string | null }) => {
    if (gm.league === "AHL") return;
    const fin = finBy.get(gm.homeTeamId);
    if (!fin || fin.capacity <= 0) return;
    // Pre-season attendance: standard baseline ~60-95% capacity without ticket pricing revenue impact
    const base = attendanceRate(fin.pop, 0.5) * fin.pf * 0.90;
    const jitter = (((gm.id * 2654435761) >>> 0) % 1000) / 1000;
    const frac = Math.max(0.40, Math.min(0.98, base * (1 + (jitter - 0.5) * 0.12)));
    const crowd = Math.round(fin.capacity * frac);
    await prisma.game.update({
      where: { id: gm.id },
      data: { attendance: crowd, gate: 0 },
    });
  };

  let played = 0;
  const playedIds: number[] = [];
  let previousRound: number | null = null;
  for (const gm of scheduled) {
    // `playPreseason()` can process all six rounds in one call. Reproduce the
    // scheduled rest day between rounds; day-by-day calls contain one round and
    // recover through simulateLeagueDay instead.
    if (previousRound != null && gm.round != null && gm.round !== previousRound) {
      await recoverPreseasonRestDay();
      cache.clear();
    }
    previousRound = gm.round;
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
    const league = gm.league === "AHL" ? "AHL" : "NHL";
    const result = simulateGame(home, away, { seed, settings, rivalry, league, engineVersion });
    // Full box score stays isolated under the PRE season string; CON and injuries
    // carry over because they affect who can dress for the next exhibition game.
    await saveGameResult(result, {
      gameId: gm.id, season: PRE_SEASON, gameDate: gm.gameDate ?? preseasonDate(gm.round ?? 0), round: gm.round ?? 0,
      homeLines: home.linesUsed, awayLines: away.linesUsed,
    });
    await storePreseasonAttendance(gm);
    await persistPreseasonPlayerState(result, home, away);
    // gel/decay pairwise chemistry from this exhibition game too (flushed to
    // TeamLines below) — a camp line that stays together should show up gelled,
    // not still "(proj.)", once the regular season opens.
    evolveChem(home, settings);
    evolveChem(away, settings);
    for (const injury of result.injuries) cache.delete(injury.teamId);
    played++;
    playedIds.push(gm.id);
  }
  const chemUpdates: Promise<unknown>[] = [];
  for (const team of cache.values()) {
    if (team && team.units.length)
      chemUpdates.push(prisma.teamLines.update({ where: { teamId: team.id }, data: { chemistry: team.chemistry } }).catch(() => undefined));
  }
  await Promise.all(chemUpdates);
  await recordSimAudit(playedIds, actor);
  return { played };
}

export async function backfillPreseasonAttendance(): Promise<number> {
  const games = await prisma.game.findMany({
    where: { season: PRE_SEASON, status: "FINAL", league: "NHL", attendance: null },
    select: { id: true, homeTeamId: true, awayTeamId: true, league: true },
  });
  if (!games.length) return 0;
  const finTeams = await prisma.team.findMany({
    where: { league: "NHL" },
    select: { id: true, popularity: true, capacity: true, arenaSections: true },
  });
  const finBy = new Map(
    finTeams.map((t) => {
      const secs = getArenaSections(t);
      return [
        t.id,
        {
          pop: t.popularity ?? 100,
          capacity: secs.reduce((a, x) => a + x.capacity, 0),
          pf: priceAttendanceFactor(secs),
        },
      ];
    })
  );
  let updated = 0;
  for (const gm of games) {
    const fin = finBy.get(gm.homeTeamId);
    if (!fin || fin.capacity <= 0) continue;
    const base = attendanceRate(fin.pop, 0.5) * fin.pf * 0.90;
    const jitter = (((gm.id * 2654435761) >>> 0) % 1000) / 1000;
    const frac = Math.max(0.40, Math.min(0.98, base * (1 + (jitter - 0.5) * 0.12)));
    const crowd = Math.round(fin.capacity * frac);
    await prisma.game.update({
      where: { id: gm.id },
      data: { attendance: crowd, gate: 0 },
    });
    updated++;
  }
  return updated;
}

export type PreGameRow = {
  id: number; round: number; date: Date | null; status: string;
  home: TeamMini; away: TeamMini; homeGoals: number | null; awayGoals: number | null;
  endedIn: string | null; winnerTeamId: number | null;
};
type TeamMini = { id: number; name: string; code: string | null; logoUrl: string | null; slug: string | null };

/** All pre-season games grouped by round, for the public page. */
export async function preseasonSchedule(league: "NHL" | "AHL" = "NHL"): Promise<{ rounds: { round: number; date: Date | null; games: PreGameRow[] }[]; hasSchedule: boolean }> {
  const games = await prisma.game.findMany({
    where: { season: PRE_SEASON, league },
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
