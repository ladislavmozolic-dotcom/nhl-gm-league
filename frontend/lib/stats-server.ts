// Season stat aggregation from per-game rows (PlayerGameStat / GoalieGameStat),
// filtered to regular-season FINAL games of a league. Used by the Stats pages.

import { prisma } from "./prisma";
import { cleanName, isRookieName } from "./playerName";
import { computeStandings } from "./sim/standings";

export type SkaterTotal = {
  playerId: number; name: string; rookie: boolean; position: string; number: number | null;
  teamId: number | null; teamCode: string | null; teamSlug: string | null;
  gp: number; goals: number; assists: number; points: number; shots: number;
  pim: number; plusMinus: number; ppGoals: number; shGoals: number; gwg: number;
  hits: number; blocks: number; toi: number;
};

export type GoalieTotal = {
  playerId: number; name: string; teamId: number | null; teamCode: string | null; teamSlug: string | null;
  gp: number; wins: number; losses: number; otl: number; shutouts: number;
  shotsAgainst: number; saves: number; goalsAgainst: number; toiMin: number;
  svPct: number; gaa: number;
};

type GameFilter = { season: string; league: string; playoffs: boolean };
const gameWhere = ({ season, league, playoffs }: GameFilter) =>
  ({ season, league, status: "FINAL", ...(playoffs ? { seriesId: { not: null } } : { seriesId: null }) });

async function teamLookup() {
  const teams = await prisma.team.findMany({ select: { id: true, code: true, slug: true } });
  return new Map(teams.map((t) => [t.id, t]));
}

export async function skaterTotals(season: string, league = "NHL", playoffs = false): Promise<SkaterTotal[]> {
  // Group by (player, team-they-played-for) so a farm call-up who dressed for an
  // NHL club during injuries shows under THAT club — not his AHL parent team. A
  // player who suited up for two teams (trade / multiple call-ups) gets a split
  // line per team, exactly like real NHL stat pages.
  const grouped = await prisma.playerGameStat.groupBy({
    by: ["playerId", "teamId"],
    where: { game: gameWhere({ season, league, playoffs }) },
    _sum: { goals: true, assists: true, points: true, shots: true, pim: true, plusMinus: true, ppGoals: true, shGoals: true, gwg: true, hits: true, blocks: true, toi: true },
    _count: { _all: true },
  });
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: grouped.map((g) => g.playerId) } }, select: { id: true, name: true, position: true, number: true, teamId: true } }),
    teamLookup(),
  ]);
  const pById = new Map(players.map((p) => [p.id, p]));
  return grouped.map((g) => {
    const p = pById.get(g.playerId);
    const t = g.teamId ? teams.get(g.teamId) : null; // team the player actually played for
    const s = g._sum;
    return {
      playerId: g.playerId, name: cleanName(p?.name ?? "—"), rookie: isRookieName(p?.name ?? ""),
      position: p?.position ?? "—", number: p?.number ?? null, teamId: g.teamId ?? null, teamCode: t?.code ?? null, teamSlug: t?.slug ?? null,
      gp: g._count._all, goals: s.goals ?? 0, assists: s.assists ?? 0, points: s.points ?? 0, shots: s.shots ?? 0,
      pim: s.pim ?? 0, plusMinus: s.plusMinus ?? 0, ppGoals: s.ppGoals ?? 0, shGoals: s.shGoals ?? 0, gwg: s.gwg ?? 0,
      hits: s.hits ?? 0, blocks: s.blocks ?? 0, toi: s.toi ?? 0,
    };
  });
}

export async function goalieTotals(season: string, league = "NHL", playoffs = false): Promise<GoalieTotal[]> {
  const rows = await prisma.goalieGameStat.findMany({
    where: { game: gameWhere({ season, league, playoffs }) },
    select: { playerId: true, teamId: true, shotsAgainst: true, saves: true, goalsAgainst: true, decision: true, started: true },
  });
  type Acc = Omit<GoalieTotal, "name" | "teamCode" | "teamSlug" | "svPct" | "gaa"> & { teamId: number | null };
  // key by (goalie, team-played-for) so a called-up farm goalie who covered an
  // NHL club's crease shows under THAT club, not his AHL parent.
  const acc = new Map<string, Acc>();
  for (const r of rows) {
    // count only games the goalie actually played (started or faced a shot in
    // relief) — a dressed-but-DNP backup shouldn't inflate GP/GAA.
    if (!r.started && r.shotsAgainst === 0) continue;
    const key = `${r.playerId}:${r.teamId}`;
    let a = acc.get(key);
    if (!a) { a = { playerId: r.playerId, teamId: r.teamId ?? null, gp: 0, wins: 0, losses: 0, otl: 0, shutouts: 0, shotsAgainst: 0, saves: 0, goalsAgainst: 0, toiMin: 0 }; acc.set(key, a); }
    a.gp++;
    a.shotsAgainst += r.shotsAgainst; a.saves += r.saves; a.goalsAgainst += r.goalsAgainst;
    a.toiMin += 60; // one full game ≈ 60 min (no per-goalie TOI stored)
    if (r.decision === "W") a.wins++;
    else if (r.decision === "L") a.losses++;
    else if (r.decision === "OTL") a.otl++;
    if (r.goalsAgainst === 0) a.shutouts++;
  }
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: [...acc.values()].map((a) => a.playerId) } }, select: { id: true, name: true } }),
    teamLookup(),
  ]);
  const pById = new Map(players.map((p) => [p.id, p]));
  return [...acc.values()].map((a) => {
    const p = pById.get(a.playerId);
    const t = a.teamId ? teams.get(a.teamId) : null;
    const svPct = a.shotsAgainst ? a.saves / a.shotsAgainst : 0;
    const gaa = a.toiMin ? (a.goalsAgainst * 60) / a.toiMin : 0;
    return { ...a, name: cleanName(p?.name ?? "—"), teamCode: t?.code ?? null, teamSlug: t?.slug ?? null, svPct, gaa };
  });
}

export type TeamStatTotal = {
  teamId: number; name: string; code: string | null; slug: string | null;
  gp: number; w: number; l: number; otw: number; otl: number; sow: number; sol: number; rw: number;
  points: number; pct: number; gf: number; ga: number; diff: number;
  gfPerGame: number; gaPerGame: number;
  shotsFor: number; shotsAgainst: number; sfPerGame: number; saPerGame: number;
  shutouts: number;
  goals: number; assists: number; pim: number; hits: number; blocks: number;
  ppGoals: number; shGoals: number;
};

/** Full team stat line for the Team Stats page: standings + goal/shot splits + team player totals. */
export async function teamStatTotals(season: string, league = "NHL"): Promise<TeamStatTotal[]> {
  const [standings, games, playerAgg, teams] = await Promise.all([
    computeStandings(season, league),
    prisma.game.findMany({
      where: { season, league, status: "FINAL", seriesId: null },
      select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, homeShots: true, awayShots: true, endedIn: true, winnerTeamId: true },
    }),
    prisma.playerGameStat.groupBy({
      by: ["teamId"],
      where: { game: { season, league, status: "FINAL", seriesId: null } },
      _sum: { goals: true, assists: true, pim: true, hits: true, blocks: true, ppGoals: true, shGoals: true },
    }),
    prisma.team.findMany({ select: { id: true, slug: true } }),
  ]);
  const slugById = new Map(teams.map((t) => [t.id, t.slug]));
  const pAgg = new Map(playerAgg.map((p) => [p.teamId, p._sum]));

  type Ext = { shotsFor: number; shotsAgainst: number; shutouts: number; otw: number; sow: number; otl: number; sol: number };
  const ext = new Map<number, Ext>();
  const bump = (id: number) => { let e = ext.get(id); if (!e) { e = { shotsFor: 0, shotsAgainst: 0, shutouts: 0, otw: 0, sow: 0, otl: 0, sol: 0 }; ext.set(id, e); } return e; };
  for (const g of games) {
    const h = bump(g.homeTeamId), a = bump(g.awayTeamId);
    h.shotsFor += g.homeShots ?? 0; h.shotsAgainst += g.awayShots ?? 0;
    a.shotsFor += g.awayShots ?? 0; a.shotsAgainst += g.homeShots ?? 0;
    if ((g.awayGoals ?? 0) === 0) h.shutouts++;
    if ((g.homeGoals ?? 0) === 0) a.shutouts++;
    if (g.winnerTeamId) {
      const loserId = g.winnerTeamId === g.homeTeamId ? g.awayTeamId : g.homeTeamId;
      const win = bump(g.winnerTeamId), lose = bump(loserId);
      if (g.endedIn === "OT") { win.otw++; lose.otl++; }
      else if (g.endedIn === "SO") { win.sow++; lose.sol++; }
    }
  }

  return standings.map((s) => {
    const e = ext.get(s.teamId) ?? { shotsFor: 0, shotsAgainst: 0, shutouts: 0, otw: 0, sow: 0, otl: 0, sol: 0 };
    const pa = pAgg.get(s.teamId);
    const gp = s.gp || 1;
    return {
      teamId: s.teamId, name: s.name, code: s.code, slug: slugById.get(s.teamId) ?? null,
      gp: s.gp, w: s.w, l: s.l, otw: e.otw, otl: s.otl, sow: e.sow, sol: e.sol, rw: s.rw,
      points: s.points, pct: s.pointsPct, gf: s.gf, ga: s.ga, diff: s.diff,
      gfPerGame: s.gf / gp, gaPerGame: s.ga / gp,
      shotsFor: e.shotsFor, shotsAgainst: e.shotsAgainst, sfPerGame: e.shotsFor / gp, saPerGame: e.shotsAgainst / gp,
      shutouts: e.shutouts,
      goals: pa?.goals ?? 0, assists: pa?.assists ?? 0, pim: pa?.pim ?? 0, hits: pa?.hits ?? 0, blocks: pa?.blocks ?? 0,
      ppGoals: pa?.ppGoals ?? 0, shGoals: pa?.shGoals ?? 0,
    };
  });
}
