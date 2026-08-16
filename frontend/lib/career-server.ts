// Player Careers + Franchise History — built on a durable per-season stat archive
// (PlayerSeasonStat / GoalieSeasonStat / TeamSeasonStat). The ACTIVE season is
// always computed LIVE from the per-game rows (so an in-progress season is fresh);
// finished seasons are read from the archive, which `archiveSeasonStats` freezes
// before a reset wipes the per-game data. This lets careers/records grow over years.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";
import { computeStandings } from "./sim/standings";

export const ACTIVE_SEASON = "2026-27";

// ---------- archive (freeze a finished season) ----------

export async function archiveSeasonStats(season: string, league = "NHL"): Promise<{ skaters: number; goalies: number; teams: number }> {
  const games = await prisma.game.findMany({ where: { season, league, status: "FINAL" }, select: { id: true, seriesId: true } });
  const regIds = games.filter((g) => g.seriesId == null).map((g) => g.id);
  const poIds = games.filter((g) => g.seriesId != null).map((g) => g.id);

  let skaters = 0, goalies = 0, teams = 0;

  for (const [ids, isPlayoff] of [[regIds, false], [poIds, true]] as const) {
    if (!ids.length) continue;
    // skaters
    const sg = await prisma.playerGameStat.groupBy({
      by: ["playerId", "teamId"], where: { gameId: { in: ids } },
      _sum: { goals: true, assists: true, points: true, shots: true, pim: true, plusMinus: true, ppGoals: true, shGoals: true, ppAssists: true, shAssists: true, gwg: true, hits: true, blocks: true },
      _count: { _all: true },
    });
    for (const r of sg) {
      await prisma.playerSeasonStat.upsert({
        where: { playerId_season_league_isPlayoff: { playerId: r.playerId, season, league, isPlayoff } },
        create: { playerId: r.playerId, season, league, isPlayoff, teamId: r.teamId, gp: r._count._all, goals: r._sum.goals ?? 0, assists: r._sum.assists ?? 0, points: r._sum.points ?? 0, shots: r._sum.shots ?? 0, pim: r._sum.pim ?? 0, plusMinus: r._sum.plusMinus ?? 0, ppGoals: r._sum.ppGoals ?? 0, shGoals: r._sum.shGoals ?? 0, ppAssists: r._sum.ppAssists ?? 0, shAssists: r._sum.shAssists ?? 0, gwg: r._sum.gwg ?? 0, hits: r._sum.hits ?? 0, blocks: r._sum.blocks ?? 0 },
        update: { teamId: r.teamId, gp: r._count._all, goals: r._sum.goals ?? 0, assists: r._sum.assists ?? 0, points: r._sum.points ?? 0, shots: r._sum.shots ?? 0, pim: r._sum.pim ?? 0, plusMinus: r._sum.plusMinus ?? 0, ppGoals: r._sum.ppGoals ?? 0, shGoals: r._sum.shGoals ?? 0, ppAssists: r._sum.ppAssists ?? 0, shAssists: r._sum.shAssists ?? 0, gwg: r._sum.gwg ?? 0, hits: r._sum.hits ?? 0, blocks: r._sum.blocks ?? 0 },
      });
      skaters++;
    }
    // goalies (conditional counts → aggregate in JS)
    const gr = await prisma.goalieGameStat.findMany({ where: { gameId: { in: ids }, started: true }, select: { playerId: true, teamId: true, shotsAgainst: true, saves: true, goalsAgainst: true, decision: true } });
    const gAgg = new Map<number, { teamId: number; gp: number; w: number; l: number; otl: number; so: number; sa: number; sv: number; ga: number }>();
    for (const r of gr) {
      const a = gAgg.get(r.playerId) ?? { teamId: r.teamId, gp: 0, w: 0, l: 0, otl: 0, so: 0, sa: 0, sv: 0, ga: 0 };
      a.gp++; a.sa += r.shotsAgainst; a.sv += r.saves; a.ga += r.goalsAgainst;
      if (r.decision === "W") a.w++; else if (r.decision === "OTL") a.otl++; else if (r.decision === "L") a.l++;
      if (r.goalsAgainst === 0) a.so++;
      a.teamId = r.teamId;
      gAgg.set(r.playerId, a);
    }
    for (const [playerId, a] of gAgg) {
      await prisma.goalieSeasonStat.upsert({
        where: { playerId_season_league_isPlayoff: { playerId, season, league, isPlayoff } },
        create: { playerId, season, league, isPlayoff, teamId: a.teamId, gp: a.gp, wins: a.w, losses: a.l, otl: a.otl, shutouts: a.so, shotsAgainst: a.sa, saves: a.sv, goalsAgainst: a.ga },
        update: { teamId: a.teamId, gp: a.gp, wins: a.w, losses: a.l, otl: a.otl, shutouts: a.so, shotsAgainst: a.sa, saves: a.sv, goalsAgainst: a.ga },
      });
      goalies++;
    }
  }

  // teams (regular-season standings + playoff result from SeasonRecord)
  const st = await computeStandings(season, league).catch(() => []);
  const rec = await prisma.seasonRecord.findUnique({ where: { season_league: { season, league } } }).catch(() => null);
  for (let i = 0; i < st.length; i++) {
    const t = st[i];
    const playoffResult = rec?.championTeamId === t.teamId ? "Champion" : rec?.runnerUpTeamId === t.teamId ? "Final" : null;
    await prisma.teamSeasonStat.upsert({
      where: { teamId_season_league: { teamId: t.teamId, season, league } },
      create: { teamId: t.teamId, season, league, gp: t.gp, wins: t.w, losses: t.l, otl: t.otl, points: t.points, gf: t.gf, ga: t.ga, finish: i + 1, playoffResult },
      update: { gp: t.gp, wins: t.w, losses: t.l, otl: t.otl, points: t.points, gf: t.gf, ga: t.ga, finish: i + 1, playoffResult },
    });
    teams++;
  }
  return { skaters, goalies, teams };
}

// ---------- player career ----------

export type CareerSkaterRow = { season: string; league: string; isPlayoff: boolean; teamCode: string | null; teamSlug: string | null; gp: number; goals: number; assists: number; points: number; pim: number; plusMinus: number; shots: number; hits: number; blocks: number };
export type CareerGoalieRow = { season: string; league: string; isPlayoff: boolean; teamCode: string | null; teamSlug: string | null; gp: number; wins: number; losses: number; otl: number; shutouts: number; shotsAgainst: number; saves: number; goalsAgainst: number; svPct: number; gaa: number };
export type PlayerCareer = {
  isGoalie: boolean;
  skater: CareerSkaterRow[];
  goalie: CareerGoalieRow[];
  awards: { season: string; category: string; detail: string | null }[];
  totals: { gp: number; goals: number; assists: number; points: number } | null;      // NHL regular-season career
  goalieTotals: { gp: number; wins: number; shutouts: number; svPct: number; gaa: number } | null;
};

const teamMap = async () => new Map((await prisma.team.findMany({ select: { id: true, code: true, name: true, slug: true } })).map((t) => [t.id, t]));

export async function playerCareer(playerId: number): Promise<PlayerCareer> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { position: true, name: true } });
  const isGoalie = (p?.position ?? "") === "G";
  const tm = await teamMap();
  const tc = (id: number) => { const t = tm.get(id); return { code: t?.code ?? t?.name ?? null, slug: t?.slug ?? null }; };

  const skater: CareerSkaterRow[] = [];
  const goalie: CareerGoalieRow[] = [];

  if (isGoalie) {
    const archived = await prisma.goalieSeasonStat.findMany({ where: { playerId, season: { not: ACTIVE_SEASON } } });
    for (const r of archived) goalie.push(mkGoalieRow(r, tc(r.teamId)));
    // live active season (reg + playoff, per league)
    for (const league of ["NHL", "AHL"]) for (const isPlayoff of [false, true]) {
      const live = await liveGoalie(playerId, ACTIVE_SEASON, league, isPlayoff);
      if (live) goalie.push(mkGoalieRow({ ...live, season: ACTIVE_SEASON, league, isPlayoff }, tc(live.teamId)));
    }
  } else {
    const archived = await prisma.playerSeasonStat.findMany({ where: { playerId, season: { not: ACTIVE_SEASON } } });
    for (const r of archived) skater.push(mkSkaterRow(r, tc(r.teamId)));
    for (const league of ["NHL", "AHL"]) for (const isPlayoff of [false, true]) {
      const live = await liveSkater(playerId, ACTIVE_SEASON, league, isPlayoff);
      if (live) skater.push(mkSkaterRow({ ...live, season: ACTIVE_SEASON, league, isPlayoff }, tc(live.teamId)));
    }
  }

  skater.sort((a, b) => a.season.localeCompare(b.season) || a.league.localeCompare(b.league) || Number(a.isPlayoff) - Number(b.isPlayoff));
  goalie.sort((a, b) => a.season.localeCompare(b.season) || a.league.localeCompare(b.league) || Number(a.isPlayoff) - Number(b.isPlayoff));

  const awardsRaw = await prisma.seasonAward.findMany({ where: { OR: [{ playerId }, { playerName: cleanName(p?.name ?? "") }] }, orderBy: { season: "asc" } });
  const awards = awardsRaw.map((a) => ({ season: a.season, category: a.category, detail: a.detail }));

  const nhlReg = skater.filter((r) => r.league === "NHL" && !r.isPlayoff);
  const totals = nhlReg.length ? nhlReg.reduce((t, r) => ({ gp: t.gp + r.gp, goals: t.goals + r.goals, assists: t.assists + r.assists, points: t.points + r.points }), { gp: 0, goals: 0, assists: 0, points: 0 }) : null;
  const gNhlReg = goalie.filter((r) => r.league === "NHL" && !r.isPlayoff);
  const goalieTotals = gNhlReg.length ? (() => {
    const gp = gNhlReg.reduce((t, r) => t + r.gp, 0), wins = gNhlReg.reduce((t, r) => t + r.wins, 0), so = gNhlReg.reduce((t, r) => t + r.shutouts, 0);
    const sa = gNhlReg.reduce((t, r) => t + r.shotsAgainst, 0), sv = gNhlReg.reduce((t, r) => t + r.saves, 0), ga = gNhlReg.reduce((t, r) => t + r.goalsAgainst, 0);
    return { gp, wins, shutouts: so, svPct: sa ? sv / sa : 0, gaa: gp ? (ga / gp) : 0 };
  })() : null;

  return { isGoalie, skater, goalie, awards, totals, goalieTotals };
}

function mkSkaterRow(r: { season: string; league: string; isPlayoff: boolean; gp: number; goals: number; assists: number; points: number; pim: number; plusMinus: number; shots: number; hits: number; blocks: number }, t: { code: string | null; slug: string | null }): CareerSkaterRow {
  return { season: r.season, league: r.league, isPlayoff: r.isPlayoff, teamCode: t.code, teamSlug: t.slug, gp: r.gp, goals: r.goals, assists: r.assists, points: r.points, pim: r.pim, plusMinus: r.plusMinus, shots: r.shots, hits: r.hits, blocks: r.blocks };
}
function mkGoalieRow(r: { season: string; league: string; isPlayoff: boolean; gp: number; wins: number; losses: number; otl: number; shutouts: number; shotsAgainst: number; saves: number; goalsAgainst: number }, t: { code: string | null; slug: string | null }): CareerGoalieRow {
  return { season: r.season, league: r.league, isPlayoff: r.isPlayoff, teamCode: t.code, teamSlug: t.slug, gp: r.gp, wins: r.wins, losses: r.losses, otl: r.otl, shutouts: r.shutouts, shotsAgainst: r.shotsAgainst, saves: r.saves, goalsAgainst: r.goalsAgainst, svPct: r.shotsAgainst ? r.saves / r.shotsAgainst : 0, gaa: r.gp ? r.goalsAgainst / r.gp : 0 };
}

async function liveSkater(playerId: number, season: string, league: string, isPlayoff: boolean) {
  const agg = await prisma.playerGameStat.aggregate({
    where: { playerId, game: { season, league, status: "FINAL", ...(isPlayoff ? { seriesId: { not: null } } : { seriesId: null }) } },
    _sum: { goals: true, assists: true, points: true, shots: true, pim: true, plusMinus: true, hits: true, blocks: true }, _count: { _all: true },
  });
  if (!agg._count._all) return null;
  const row = await prisma.playerGameStat.findFirst({ where: { playerId, game: { season, league, status: "FINAL", ...(isPlayoff ? { seriesId: { not: null } } : { seriesId: null }) } }, orderBy: { gameId: "desc" }, select: { teamId: true } });
  return { teamId: row?.teamId ?? 0, gp: agg._count._all, goals: agg._sum.goals ?? 0, assists: agg._sum.assists ?? 0, points: agg._sum.points ?? 0, shots: agg._sum.shots ?? 0, pim: agg._sum.pim ?? 0, plusMinus: agg._sum.plusMinus ?? 0, hits: agg._sum.hits ?? 0, blocks: agg._sum.blocks ?? 0 };
}

async function liveGoalie(playerId: number, season: string, league: string, isPlayoff: boolean) {
  const rows = await prisma.goalieGameStat.findMany({ where: { playerId, started: true, game: { season, league, status: "FINAL", ...(isPlayoff ? { seriesId: { not: null } } : { seriesId: null }) } }, select: { teamId: true, shotsAgainst: true, saves: true, goalsAgainst: true, decision: true } });
  if (!rows.length) return null;
  let w = 0, l = 0, otl = 0, so = 0, sa = 0, sv = 0, ga = 0, teamId = 0;
  for (const r of rows) { sa += r.shotsAgainst; sv += r.saves; ga += r.goalsAgainst; if (r.decision === "W") w++; else if (r.decision === "OTL") otl++; else if (r.decision === "L") l++; if (r.goalsAgainst === 0) so++; teamId = r.teamId; }
  return { teamId, gp: rows.length, wins: w, losses: l, otl, shutouts: so, shotsAgainst: sa, saves: sv, goalsAgainst: ga };
}

// ---------- franchise history ----------

export type FranchiseSeason = { season: string; gp: number; wins: number; losses: number; otl: number; points: number; gf: number; ga: number; finish: number | null; playoffResult: string | null };
export type FranchiseLeader = { name: string; slug: string | null; value: number };
export type FranchiseHistory = {
  seasons: FranchiseSeason[];
  allTime: { gp: number; wins: number; losses: number; otl: number; points: number; gf: number; ga: number; seasons: number };
  championships: string[];   // seasons won
  finals: string[];          // seasons lost in final
  presidents: string[];      // seasons as best regular-season team
  leaders: { points: FranchiseLeader[]; goals: FranchiseLeader[]; wins: FranchiseLeader[] };
};

export async function franchiseHistory(teamId: number, league = "NHL"): Promise<FranchiseHistory> {
  const archived = await prisma.teamSeasonStat.findMany({ where: { teamId, league, season: { not: ACTIVE_SEASON } } });
  const seasons: FranchiseSeason[] = archived.map((r) => ({ season: r.season, gp: r.gp, wins: r.wins, losses: r.losses, otl: r.otl, points: r.points, gf: r.gf, ga: r.ga, finish: r.finish, playoffResult: r.playoffResult }));

  // live active season
  const st = await computeStandings(ACTIVE_SEASON, league).catch(() => []);
  const idx = st.findIndex((t) => t.teamId === teamId);
  if (idx >= 0) {
    const t = st[idx];
    const rec = await prisma.seasonRecord.findUnique({ where: { season_league: { season: ACTIVE_SEASON, league } } }).catch(() => null);
    const playoffResult = rec?.championTeamId === teamId ? "Champion" : rec?.runnerUpTeamId === teamId ? "Final" : null;
    seasons.push({ season: ACTIVE_SEASON, gp: t.gp, wins: t.w, losses: t.l, otl: t.otl, points: t.points, gf: t.gf, ga: t.ga, finish: idx + 1, playoffResult });
  }
  seasons.sort((a, b) => a.season.localeCompare(b.season));

  const allTime = seasons.reduce((a, s) => ({ gp: a.gp + s.gp, wins: a.wins + s.wins, losses: a.losses + s.losses, otl: a.otl + s.otl, points: a.points + s.points, gf: a.gf + s.gf, ga: a.ga + s.ga, seasons: a.seasons + 1 }), { gp: 0, wins: 0, losses: 0, otl: 0, points: 0, gf: 0, ga: 0, seasons: 0 });

  const recs = await prisma.seasonRecord.findMany({ where: { league, OR: [{ championTeamId: teamId }, { runnerUpTeamId: teamId }, { presidentsTeamId: teamId }] } });
  const championships = recs.filter((r) => r.championTeamId === teamId).map((r) => r.season).sort();
  const finals = recs.filter((r) => r.runnerUpTeamId === teamId).map((r) => r.season).sort();
  const presidents = recs.filter((r) => r.presidentsTeamId === teamId).map((r) => r.season).sort();

  const leaders = await franchiseLeaders(teamId, league);
  return { seasons, allTime, championships, finals, presidents, leaders };
}

// All-time franchise scoring/goalie leaders = archived per-season sums (for this
// team) + the live active season, combined per player.
async function franchiseLeaders(teamId: number, league: string): Promise<FranchiseHistory["leaders"]> {
  const pts = new Map<number, number>(), gls = new Map<number, number>(), wins = new Map<number, number>();
  const add = (m: Map<number, number>, id: number, v: number) => m.set(id, (m.get(id) ?? 0) + v);

  const archS = await prisma.playerSeasonStat.findMany({ where: { teamId, league, isPlayoff: false, season: { not: ACTIVE_SEASON } }, select: { playerId: true, points: true, goals: true } });
  for (const r of archS) { add(pts, r.playerId, r.points); add(gls, r.playerId, r.goals); }
  const archG = await prisma.goalieSeasonStat.findMany({ where: { teamId, league, isPlayoff: false, season: { not: ACTIVE_SEASON } }, select: { playerId: true, wins: true } });
  for (const r of archG) add(wins, r.playerId, r.wins);

  // live active season for this team
  const liveIds = await prisma.game.findMany({ where: { season: ACTIVE_SEASON, league, status: "FINAL", seriesId: null }, select: { id: true } });
  const gameIds = liveIds.map((g) => g.id);
  if (gameIds.length) {
    const sg = await prisma.playerGameStat.groupBy({ by: ["playerId"], where: { teamId, gameId: { in: gameIds } }, _sum: { points: true, goals: true } });
    for (const r of sg) { add(pts, r.playerId, r._sum.points ?? 0); add(gls, r.playerId, r._sum.goals ?? 0); }
    const gg = await prisma.goalieGameStat.findMany({ where: { teamId, started: true, decision: "W", gameId: { in: gameIds } }, select: { playerId: true } });
    for (const r of gg) add(wins, r.playerId, 1);
  }

  const ids = [...new Set([...pts.keys(), ...gls.keys(), ...wins.keys()])];
  const names = new Map((await prisma.player.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true } })).map((p) => [p.id, p]));
  const top = (m: Map<number, number>) => [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, v]) => ({ name: cleanName(names.get(id)?.name ?? "?"), slug: names.get(id)?.slug ?? null, value: v }));
  return { points: top(pts), goals: top(gls), wins: top(wins) };
}
