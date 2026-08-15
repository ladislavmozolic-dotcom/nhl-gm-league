// Schedule generation. Balanced round-robin via the circle method.
// Double round-robin (home & away vs everyone) for 32 teams => 62 games each.

import { prisma } from "../prisma";

export type Fixture = { round: number; homeTeamId: number; awayTeamId: number };

/**
 * Spread fixtures across days so each team plays ~every other day, with the
 * occasional back-to-back. `round` becomes the day index (the CON model treats
 * one round as one day). Deterministic — no RNG. This gives goalies real rest
 * (so CON stays healthy) and produces genuine back-to-backs.
 */
function assignDays(fixtures: Fixture[], teamIds: number[]): Fixture[] {
  const lastDay = new Map<number, number>(teamIds.map((id) => [id, -10]));
  const remaining = fixtures.map((f, i) => ({ ...f, i }));
  const out: Fixture[] = [];
  let day = 0;
  const B2B_EVERY = 5; // ~1 in 5 eligible back-to-backs are allowed

  while (remaining.length && day < 400) {
    const playedToday = new Set<number>();
    let placed = 0;
    for (let k = 0; k < remaining.length; k++) {
      const fx = remaining[k];
      if (playedToday.has(fx.homeTeamId) || playedToday.has(fx.awayTeamId)) continue;
      const restH = day - (lastDay.get(fx.homeTeamId) ?? -10);
      const restA = day - (lastDay.get(fx.awayTeamId) ?? -10);
      if (restH < 1 || restA < 1) continue;
      const b2b = restH === 1 || restA === 1;
      if (b2b && (fx.i + day) % B2B_EVERY !== 0) continue; // ration back-to-backs
      out.push({ round: day, homeTeamId: fx.homeTeamId, awayTeamId: fx.awayTeamId });
      playedToday.add(fx.homeTeamId); playedToday.add(fx.awayTeamId);
      lastDay.set(fx.homeTeamId, day); lastDay.set(fx.awayTeamId, day);
      remaining.splice(k, 1); k--; placed++;
    }
    // relief valve: if a day placed nothing, allow any rested pairing (incl. b2b)
    if (placed === 0) {
      for (let k = 0; k < remaining.length; k++) {
        const fx = remaining[k];
        if (playedToday.has(fx.homeTeamId) || playedToday.has(fx.awayTeamId)) continue;
        out.push({ round: day, homeTeamId: fx.homeTeamId, awayTeamId: fx.awayTeamId });
        playedToday.add(fx.homeTeamId); playedToday.add(fx.awayTeamId);
        lastDay.set(fx.homeTeamId, day); lastDay.set(fx.awayTeamId, day);
        remaining.splice(k, 1); k--;
      }
    }
    day++;
  }
  return out;
}

/**
 * Circle-method round-robin. For an even number of teams, produces N-1 rounds
 * where every team plays exactly once per round. `doubleRoundRobin` appends the
 * mirror half with home/away swapped.
 */
export function roundRobin(teamIds: number[], doubleRoundRobin = true): Fixture[] {
  const ids = [...teamIds];
  if (ids.length % 2 === 1) ids.push(-1); // bye marker
  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const fixtures: Fixture[] = [];

  // fixed[0] stays; the rest rotate
  const arr = [...ids];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === -1 || b === -1) continue;
      // alternate home/away by round parity for fairness
      const home = (r + i) % 2 === 0 ? a : b;
      const away = home === a ? b : a;
      fixtures.push({ round: r, homeTeamId: home, awayTeamId: away });
    }
    // rotate all but the first element
    arr.splice(1, 0, arr.pop() as number);
  }

  if (doubleRoundRobin) {
    const mirror = fixtures.map((f) => ({
      round: f.round + rounds,
      homeTeamId: f.awayTeamId,
      awayTeamId: f.homeTeamId,
    }));
    return [...fixtures, ...mirror];
  }
  return fixtures;
}

/**
 * Top up a double round-robin with extra same-conference games until every team
 * reaches `target` games. Greedy + deterministic (no RNG).
 */
function fillToTarget(
  teams: Array<{ id: number; conference: string | null }>,
  base: Fixture[], target: number, startRound: number,
): Fixture[] {
  const count = new Map<number, number>(teams.map((t) => [t.id, 0]));
  for (const f of base) {
    count.set(f.homeTeamId, (count.get(f.homeTeamId) ?? 0) + 1);
    count.set(f.awayTeamId, (count.get(f.awayTeamId) ?? 0) + 1);
  }
  const conf = new Map(teams.map((t) => [t.id, t.conference]));
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      if (conf.get(teams[i].id) === conf.get(teams[j].id))
        pairs.push([teams[i].id, teams[j].id]);

  const extra: Fixture[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const [a, b] of pairs) {
      if ((count.get(a) ?? 0) >= target || (count.get(b) ?? 0) >= target) continue;
      const home = ((count.get(a)! + count.get(b)!) % 2 === 0) ? a : b;
      const away = home === a ? b : a;
      extra.push({ round: startRound + Math.floor(extra.length / (teams.length / 2)), homeTeamId: home, awayTeamId: away });
      count.set(a, count.get(a)! + 1);
      count.set(b, count.get(b)! + 1);
      progress = true;
    }
  }
  return extra;
}

/**
 * Generate and persist a fresh schedule as SCHEDULED Game rows.
 * Deletes any existing games for the season first (fresh season).
 * `gamesPerTeam` (e.g. 82) tops up the balanced double round-robin (62) with
 * extra same-conference games.
 */
export async function generateSchedule(
  season = "2026-27",
  opts: { gamesPerTeam?: number; doubleRoundRobin?: boolean } = {},
) {
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, conference: true },
  });
  const ids = teams.map((t) => t.id);
  const base = roundRobin(ids, opts.doubleRoundRobin ?? true);
  const baseRounds = Math.max(...base.map((f) => f.round)) + 1;

  let fixtures = base;
  const perTeamBase = (opts.doubleRoundRobin ?? true) ? (ids.length - 1) * 2 : ids.length - 1;
  if (opts.gamesPerTeam && opts.gamesPerTeam > perTeamBase) {
    fixtures = [...base, ...fillToTarget(teams, base, opts.gamesPerTeam, baseRounds)];
  }

  // spread across days so teams get rest between games (round = day index)
  fixtures = assignDays(fixtures, ids);

  await prisma.game.deleteMany({ where: { season } });
  await prisma.game.createMany({
    data: fixtures.map((f) => ({
      season, round: f.round,
      homeTeamId: f.homeTeamId, awayTeamId: f.awayTeamId,
      status: "SCHEDULED",
    })),
  });

  return {
    teams: ids.length, games: fixtures.length,
    rounds: Math.max(...fixtures.map((f) => f.round)) + 1,
    gamesPerTeam: Math.round(fixtures.length * 2 / ids.length),
  };
}
