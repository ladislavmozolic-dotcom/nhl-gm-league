// Playoff bracket: seed from standings, run best-of-7 series, advance rounds
// until a champion. Playoff games are regular Game rows tagged with seriesId.

import { prisma } from "./../prisma";
import { loadSimTeam } from "./index";
import { simulateGame } from "./engine";
import { saveGameResult } from "./persist";
import { fixtureSeed } from "./rng";
import { loadSettings } from "./settings";
import { computeStandings } from "./standings";

const ROUND_NAMES: Record<number, string> = {
  1: "First Round", 2: "Second Round", 3: "Conference Final", 4: "Cup Final",
};
export const roundName = (r: number, conf?: string | null) =>
  r === 3 && conf ? `${conf.replace(" Conference", "")} Final` : ROUND_NAMES[r] ?? `Round ${r}`;

// home-ice pattern for a best-of-7 (2-2-1-1-1): true = higher seed at home
const HOME_2211 = [true, true, false, false, true, false, true];

type Standing = Awaited<ReturnType<typeof computeStandings>>[number];
type Pairing = { homeId: number; awayId: number; homeSeed: number; awaySeed: number };

/** Conference format: top 8 by points, bracket 1v8 / 4v5 / 3v6 / 2v7. */
function conferencePairings(pool: Standing[], n: number): Pairing[] {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < n / 2; i++) pairs.push([i + 1, n - i]); // 1v8, 2v7, 3v6, 4v5
  const order = [pairs[0], pairs[3], pairs[2], pairs[1]];     // slot order
  return order.map(([hi, lo]) => ({
    homeId: pool[hi - 1].teamId, awayId: pool[lo - 1].teamId, homeSeed: hi, awaySeed: lo,
  }));
}

/** NHL division format: top 3 per division + 2 wild cards; division winner hosts. */
function divisionPairings(confTeams: Standing[]): Pairing[] {
  const seedOf = new Map(confTeams.map((t, i) => [t.teamId, i + 1])); // conf points rank 1..8+
  const divisions = [...new Set(confTeams.map((t) => t.division))] as string[];
  if (divisions.length !== 2) return conferencePairings(confTeams.slice(0, 8), 8); // fallback

  const divTeams = divisions.map((d) => confTeams.filter((t) => t.division === d));
  const top3 = divTeams.map((d) => d.slice(0, 3));
  const auto = new Set(top3.flat().map((t) => t.teamId));
  const wildcards = confTeams.filter((t) => !auto.has(t.teamId)).slice(0, 2); // WC1 (better), WC2

  // rank the two division winners by points -> P1 (best), P2
  const winners = [top3[0][0], top3[1][0]].sort((a, b) => b.points - a.points);
  const p1DivIdx = top3.findIndex((d) => d[0].teamId === winners[0].teamId);
  const p2DivIdx = p1DivIdx === 0 ? 1 : 0;
  const [wc1, wc2] = wildcards;
  const seed = (id: number) => seedOf.get(id) ?? 99;
  const P = (t: Standing, w: Standing): Pairing => ({ homeId: t.teamId, awayId: w.teamId, homeSeed: seed(t.teamId), awaySeed: seed(w.teamId) });

  // slots so advanceRound pairs 0-1 (P1 side) and 2-3 (P2 side)
  return [
    P(winners[0], wc2),                 // P1 vs WC2
    P(top3[p1DivIdx][1], top3[p1DivIdx][2]), // P1-div 2 vs 3
    P(winners[1], wc1),                 // P2 vs WC1
    P(top3[p2DivIdx][1], top3[p2DivIdx][2]), // P2-div 2 vs 3
  ];
}

/** Seed a fresh playoff from the standings, using the configured format. */
export async function seedPlayoffs(season = "2026-27",
  cfg: { format?: "conference" | "division"; teamsPerConf?: number; bestOf?: number; league?: string } = {}) {
  const settings = await loadSettings();
  const league = cfg.league ?? "NHL";
  const format = cfg.format ?? settings.playoffFormat;
  const teamsPerConf = cfg.teamsPerConf ?? settings.playoffTeamsPerConf;
  const bestOf = cfg.bestOf ?? settings.playoffBestOf;

  const old = await prisma.playoffSeries.findMany({ where: { season, league }, select: { id: true } });
  if (old.length) {
    await prisma.game.deleteMany({ where: { seriesId: { in: old.map((s) => s.id) } } });
    await prisma.playoffSeries.deleteMany({ where: { season, league } });
  }
  await prisma.player.updateMany({ where: { team: { league } }, data: { condition: 100, injuryDaysLeft: 0, injuryDesc: null } });

  const standings = await computeStandings(season, league);
  const confs = [...new Set(standings.map((s) => s.conference).filter(Boolean))] as string[];

  let created = 0;
  for (const conf of confs) {
    const confTeams = standings.filter((s) => s.conference === conf);
    if (confTeams.length < teamsPerConf) continue;
    const pairings = format === "division"
      ? divisionPairings(confTeams)
      : conferencePairings(confTeams.slice(0, teamsPerConf), teamsPerConf);
    for (let slot = 0; slot < pairings.length; slot++) {
      const p = pairings[slot];
      await prisma.playoffSeries.create({
        data: {
          season, league, round: 1, conference: conf, slot,
          highSeedTeamId: p.homeId, lowSeedTeamId: p.awayId,
          highSeed: p.homeSeed, lowSeed: p.awaySeed, bestOf,
        },
      });
      created++;
    }
  }
  return { conferences: confs.length, series: created, format };
}

/** Play one series to completion, storing each game. */
export async function playSeries(seriesId: number, season: string) {
  const s = await prisma.playoffSeries.findUnique({ where: { id: seriesId } });
  if (!s || s.status === "DONE") return;
  const settings = await loadSettings();
  const [high, low] = await Promise.all([loadSimTeam(s.highSeedTeamId), loadSimTeam(s.lowSeedTeamId)]);
  const need = Math.ceil(s.bestOf / 2);
  let hiW = s.highWins, loW = s.lowWins;
  let gameNum = hiW + loW;

  while (hiW < need && loW < need && gameNum < s.bestOf) {
    const highHome = HOME_2211[gameNum] ?? true;
    const home = highHome ? high : low;
    const away = highHome ? low : high;
    const seed = fixtureSeed(seriesId * 101 + gameNum, s.highSeedTeamId, s.round);
    const result = simulateGame(home, away, { seed, settings, noShootout: true });
    // date the game so it lands on the schedule: playoffs open after the regular
    // season (~day 200), each round two weeks later, series games every other day.
    const year = parseInt(season.slice(0, 4), 10) || 2026;
    const dayIdx = 200 + (s.round - 1) * 16 + gameNum * 2;
    const gameDate = new Date(Date.UTC(year, 9, 1) + dayIdx * 86_400_000);
    await saveGameResult(result, { season, league: s.league, round: s.round, seriesId, gameNum: gameNum + 1, gameDate });
    if (result.winner === s.highSeedTeamId) hiW++; else loW++;
    gameNum++;
  }
  const winnerTeamId = hiW >= need ? s.highSeedTeamId : s.lowSeedTeamId;
  await prisma.playoffSeries.update({
    where: { id: seriesId },
    data: { highWins: hiW, lowWins: loW, status: "DONE", winnerTeamId },
  });
  return winnerTeamId;
}

/** After a round is complete, create the next round's series from the winners. */
async function advanceRound(season: string, round: number, league = "NHL") {
  const done = await prisma.playoffSeries.findMany({
    where: { season, league, round, status: "DONE" },
    orderBy: [{ conference: "asc" }, { slot: "asc" }],
  });
  if (!done.length) return;

  const standings = await computeStandings(season, league);
  const ptsOf = (id: number) => standings.find((t) => t.teamId === id)?.points ?? 0;
  const seedOf = (s: (typeof done)[number]) => (s.winnerTeamId === s.highSeedTeamId ? s.highSeed : s.lowSeed);

  const nextRound = round + 1;
  const groups = new Map<string, typeof done>();
  const isFinal = nextRound === 4;
  for (const s of done) {
    // conference finals (round 3) still group by conference; cup final merges
    const key = isFinal ? "FINAL" : s.conference ?? "FINAL";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(s);
  }

  let slot = 0;
  for (const [key, list] of groups) {
    list.sort((a, b) => a.slot - b.slot);
    for (let i = 0; i + 1 < list.length; i += 2) {
      const a = list[i], b = list[i + 1];
      const aId = a.winnerTeamId!, bId = b.winnerTeamId!;
      // higher seed (or better record) is the high seed / home ice
      const aBetter = seedOf(a) < seedOf(b) || (seedOf(a) === seedOf(b) && ptsOf(aId) >= ptsOf(bId));
      await prisma.playoffSeries.create({
        data: {
          season, league, round: nextRound, conference: isFinal ? null : key, slot: slot++,
          highSeedTeamId: aBetter ? aId : bId, lowSeedTeamId: aBetter ? bId : aId,
          highSeed: aBetter ? seedOf(a) : seedOf(b), lowSeed: aBetter ? seedOf(b) : seedOf(a),
          bestOf: a.bestOf,
        },
      });
    }
  }
}

/** Seed and play the entire playoff, round by round, until a champion. */
export async function runPlayoffs(season = "2026-27", league = "NHL",
  onSeries?: (info: { round: number; text: string }) => void) {
  const seed = await seedPlayoffs(season, { league });
  for (let round = 1; round <= 4; round++) {
    const series = await prisma.playoffSeries.findMany({ where: { season, league, round }, orderBy: { slot: "asc" } });
    if (!series.length) break;
    for (const s of series) {
      await playSeries(s.id, season);
      onSeries?.({ round, text: `series ${s.id} done` });
    }
    if (round < 4) await advanceRound(season, round, league);
  }
  const final = await prisma.playoffSeries.findFirst({ where: { season, league, round: 4, status: "DONE" } });
  return { ...seed, championTeamId: final?.winnerTeamId ?? null };
}

// ---- Day-by-day playoffs (calendar-driven, no back-to-backs) ----------------
const DAY_MS = 86_400_000;
const utcMidnight = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Schedule every potential game of a round's series on a 2-day cadence (games k of
 *  ALL series fall on the same day, days two apart → no team ever plays twice in a
 *  row). Extra games past a clinch are removed when the series ends. */
export async function schedulePlayoffRound(season: string, league: string, round: number, firstDate: Date) {
  const series = await prisma.playoffSeries.findMany({ where: { season, league, round }, orderBy: { slot: "asc" } });
  const base = utcMidnight(firstDate);
  const rows: { season: string; league: string; round: number; seriesId: number; gameNum: number; gameDate: Date; homeTeamId: number; awayTeamId: number; status: string }[] = [];
  for (const s of series) {
    for (let g = 0; g < s.bestOf; g++) {
      const highHome = HOME_2211[g] ?? true;
      rows.push({
        season, league, round, seriesId: s.id, gameNum: g + 1,
        gameDate: new Date(base + g * 2 * DAY_MS),
        homeTeamId: highHome ? s.highSeedTeamId : s.lowSeedTeamId,
        awayTeamId: highHome ? s.lowSeedTeamId : s.highSeedTeamId,
        status: "SCHEDULED",
      });
    }
  }
  if (rows.length) await prisma.game.createMany({ data: rows });
  return { games: rows.length, firstDate: new Date(base), lastDate: new Date(base + (Math.max(...series.map((s) => s.bestOf), 1) - 1) * 2 * DAY_MS) };
}

/** Seed the bracket AND schedule round 1 on a chosen start day. Day-advance then
 *  plays it out; rounds advance automatically as series finish. */
export async function startPlayoffs(season = "2026-27", league = "NHL", startDate?: Date) {
  const seeded = await seedPlayoffs(season, { league });
  const first = startDate ?? new Date(Date.UTC(parseInt(season.slice(0, 4), 10) || 2026, 9, 1) + 200 * DAY_MS);
  const sched = await schedulePlayoffRound(season, league, 1, first);
  return { ...seeded, firstDate: sched.firstDate };
}

/** Play the playoff games due on one calendar day, update series, and — when the
 *  active round is complete — seed & schedule the next round (after a short break).
 *  Returns games played and, if the Cup was decided, the champion id. */
export async function advancePlayoffDay(season: string, league: string, dayStart: Date, dayEnd: Date): Promise<{ played: number; championTeamId: number | null; roundAdvanced: number | null }> {
  const settings = await loadSettings();
  const due = await prisma.game.findMany({
    where: { season, league, seriesId: { not: null }, status: "SCHEDULED", gameDate: { gte: dayStart, lt: dayEnd } },
    orderBy: [{ seriesId: "asc" }, { gameNum: "asc" }],
    select: { id: true, seriesId: true, gameNum: true, gameDate: true },
  });
  let played = 0;
  const teamCache = new Map<number, Awaited<ReturnType<typeof loadSimTeam>>>();
  const getTeam = async (id: number) => teamCache.get(id) ?? teamCache.set(id, await loadSimTeam(id)).get(id)!;

  for (const g of due) {
    const s = await prisma.playoffSeries.findUnique({ where: { id: g.seriesId! } });
    if (!s) continue;
    const need = Math.ceil(s.bestOf / 2);
    if (s.status === "DONE" || s.highWins >= need || s.lowWins >= need) {
      await prisma.game.delete({ where: { id: g.id } }).catch(() => {}); // decided → drop the extra
      continue;
    }
    const highHome = HOME_2211[(g.gameNum ?? 1) - 1] ?? true;
    const [high, low] = await Promise.all([getTeam(s.highSeedTeamId), getTeam(s.lowSeedTeamId)]);
    const home = highHome ? high : low, away = highHome ? low : high;
    const seed = fixtureSeed(s.id * 101 + (g.gameNum ?? 1), s.highSeedTeamId, s.round);
    const result = simulateGame(home, away, { seed, settings, noShootout: true });
    await saveGameResult(result, { gameId: g.id, season, league, round: s.round, seriesId: s.id, gameNum: g.gameNum ?? 1, gameDate: g.gameDate ?? dayStart });
    const hiW = s.highWins + (result.winner === s.highSeedTeamId ? 1 : 0);
    const loW = s.lowWins + (result.winner === s.lowSeedTeamId ? 1 : 0);
    const done = hiW >= need || loW >= need;
    await prisma.playoffSeries.update({ where: { id: s.id }, data: { highWins: hiW, lowWins: loW, ...(done ? { status: "DONE", winnerTeamId: hiW >= need ? s.highSeedTeamId : s.lowSeedTeamId } : {}) } });
    if (done) await prisma.game.deleteMany({ where: { seriesId: s.id, status: "SCHEDULED" } }); // clear the unneeded remainder
    played++;
  }

  // If the active (highest) round is fully decided, advance + schedule the next round.
  let championTeamId: number | null = null, roundAdvanced: number | null = null;
  const all = await prisma.playoffSeries.findMany({ where: { season, league }, select: { round: true, status: true, winnerTeamId: true } });
  if (all.length) {
    const maxRound = Math.max(...all.map((s) => s.round));
    const inRound = all.filter((s) => s.round === maxRound);
    if (inRound.every((s) => s.status === "DONE")) {
      if (maxRound >= 4) championTeamId = inRound[0]?.winnerTeamId ?? null;
      else {
        await advanceRound(season, maxRound, league);
        // next round starts after a 3-day break from today
        await schedulePlayoffRound(season, league, maxRound + 1, new Date(utcMidnight(dayStart) + 3 * DAY_MS));
        roundAdvanced = maxRound + 1;
      }
    }
  }
  return { played, championTeamId, roundAdvanced };
}

export type BracketTeam = { id: number; name: string; slug: string; logoUrl: string | null; code: string | null };
/** One played game inside a series (for the per-series game log on the bracket). */
export type BracketGame = {
  id: number; gameNum: number; homeTeamId: number; awayTeamId: number;
  homeGoals: number; awayGoals: number; endedIn: string; otPeriods: number; // 0=REG/SO, 1=OT, 2=2OT...
};
export type BracketSeries = {
  id: number; round: number; conference: string | null; slot: number;
  highSeed: number; lowSeed: number; highWins: number; lowWins: number;
  bestOf: number; status: string; winnerTeamId: number | null;
  high: BracketTeam; low: BracketTeam; games: BracketGame[];
};

export async function getBracket(season = "2026-27", league = "NHL"): Promise<BracketSeries[]> {
  const series = await prisma.playoffSeries.findMany({
    where: { season, league }, orderBy: [{ round: "asc" }, { conference: "asc" }, { slot: "asc" }],
  });
  const ids = [...new Set(series.flatMap((s) => [s.highSeedTeamId, s.lowSeedTeamId]))];
  const [teams, games] = await Promise.all([
    prisma.team.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true, logoUrl: true, code: true } }),
    prisma.game.findMany({
      where: { season, league, seriesId: { in: series.map((s) => s.id) }, status: "FINAL" },
      select: { id: true, seriesId: true, gameNum: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, endedIn: true, otPeriods: true },
      orderBy: { gameNum: "asc" },
    }),
  ]);
  const byId = new Map(teams.map((t) => [t.id, t]));
  const T = (id: number): BracketTeam => byId.get(id) ?? { id, name: `#${id}`, slug: "", logoUrl: null, code: null };
  const gamesBySeries = new Map<number, BracketGame[]>();
  for (const g of games) {
    if (g.seriesId == null) continue;
    const arr = gamesBySeries.get(g.seriesId) ?? [];
    arr.push({
      id: g.id, gameNum: g.gameNum ?? arr.length + 1, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
      homeGoals: g.homeGoals ?? 0, awayGoals: g.awayGoals ?? 0, endedIn: g.endedIn ?? "REG",
      otPeriods: g.otPeriods ?? 0,
    });
    gamesBySeries.set(g.seriesId, arr);
  }
  return series.map((s) => ({
    id: s.id, round: s.round, conference: s.conference, slot: s.slot,
    highSeed: s.highSeed, lowSeed: s.lowSeed, highWins: s.highWins, lowWins: s.lowWins,
    bestOf: s.bestOf, status: s.status, winnerTeamId: s.winnerTeamId,
    high: T(s.highSeedTeamId), low: T(s.lowSeedTeamId), games: gamesBySeries.get(s.id) ?? [],
  }));
}
