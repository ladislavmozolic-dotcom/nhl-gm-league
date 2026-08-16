// Season stat aggregation from per-game rows (PlayerGameStat / GoalieGameStat),
// filtered to regular-season FINAL games of a league. Used by the Stats pages.

import { prisma } from "./prisma";
import { cleanName, isRookieName } from "./playerName";
import { computeStandings } from "./sim/standings";

export type SkaterTotal = {
  playerId: number; name: string; rookie: boolean; position: string; number: number | null;
  teamId: number | null; teamCode: string | null; teamSlug: string | null;
  gp: number; goals: number; assists: number; points: number; shots: number;
  pim: number; plusMinus: number; ppGoals: number; shGoals: number; ppAssists: number; shAssists: number; gwg: number;
  hits: number; blocks: number; toi: number;
  xg: number; hdShots: number; // Phase 2 shot quality
};

export type GoalieTotal = {
  playerId: number; name: string; teamId: number | null; teamCode: string | null; teamSlug: string | null;
  gp: number; wins: number; losses: number; otl: number; shutouts: number;
  shotsAgainst: number; saves: number; goalsAgainst: number; toiMin: number;
  svPct: number; gaa: number;
  xga: number; gsax: number; // Phase 2: expected goals against + goals saved above expected
};

type GameFilter = { season: string; league: string; playoffs: boolean };
const gameWhere = ({ season, league, playoffs }: GameFilter) =>
  ({ season, league, status: "FINAL", ...(playoffs ? { seriesId: { not: null } } : { seriesId: null }) });

async function teamLookup() {
  const teams = await prisma.team.findMany({ select: { id: true, code: true, slug: true, name: true } });
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
    _sum: { goals: true, assists: true, points: true, shots: true, pim: true, plusMinus: true, ppGoals: true, shGoals: true, ppAssists: true, shAssists: true, gwg: true, hits: true, blocks: true, toi: true, xg: true, hdShots: true },
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
      pim: s.pim ?? 0, plusMinus: s.plusMinus ?? 0, ppGoals: s.ppGoals ?? 0, shGoals: s.shGoals ?? 0, ppAssists: s.ppAssists ?? 0, shAssists: s.shAssists ?? 0, gwg: s.gwg ?? 0,
      hits: s.hits ?? 0, blocks: s.blocks ?? 0, toi: s.toi ?? 0,
      xg: s.xg ?? 0, hdShots: s.hdShots ?? 0,
    };
  });
}

export async function goalieTotals(season: string, league = "NHL", playoffs = false): Promise<GoalieTotal[]> {
  const rows = await prisma.goalieGameStat.findMany({
    where: { game: gameWhere({ season, league, playoffs }) },
    select: { playerId: true, teamId: true, shotsAgainst: true, saves: true, goalsAgainst: true, decision: true, started: true, xga: true },
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
    if (!a) { a = { playerId: r.playerId, teamId: r.teamId ?? null, gp: 0, wins: 0, losses: 0, otl: 0, shutouts: 0, shotsAgainst: 0, saves: 0, goalsAgainst: 0, toiMin: 0, xga: 0, gsax: 0 }; acc.set(key, a); }
    a.gp++;
    a.shotsAgainst += r.shotsAgainst; a.saves += r.saves; a.goalsAgainst += r.goalsAgainst; a.xga += r.xga ?? 0;
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
    return { ...a, name: cleanName(p?.name ?? "—"), teamCode: t?.code ?? null, teamSlug: t?.slug ?? null, svPct, gaa, gsax: a.xga - a.goalsAgainst };
  });
}

// ---- NHL EDGE-style tracking leaderboards -----------------------------------
// Shot speed, zone time and save-by-danger are REAL sim output. Skating speed,
// speed bursts and distance are MODELLED from a skater's SK rating + ice time
// (the sim doesn't simulate stride-level movement) — labelled as such in the UI.

const jitter = (id: number) => ((id * 2654435761) % 1000) / 1000; // deterministic 0..1 per player
const skateTopSpeed = (sk: number, id: number) => 18.4 + ((sk - 50) / 49) * 5.6 + (jitter(id) - 0.5) * 0.8;
const burstsPerGame = (sk: number) => Math.max(0, (sk - 72) / 3.5); // 22+ mph bursts / game
const milesPerGame = (toiSecPerGame: number) => (toiSecPerGame / 60) * 0.155;

export type SkaterEdge = {
  playerId: number; name: string; position: string; teamCode: string | null; teamSlug: string | null;
  gp: number; toi: number; topShot: number; hits: number;
  topSkateSpeed: number; bursts: number; miles: number; sk: number;
};

export async function skaterEdge(season: string, league = "NHL"): Promise<SkaterEdge[]> {
  const grouped = await prisma.playerGameStat.groupBy({
    by: ["playerId", "teamId"],
    where: { game: gameWhere({ season, league, playoffs: false }) },
    _sum: { toi: true, hits: true },
    _max: { topShot: true },
    _count: { _all: true },
  });
  const ids = grouped.map((g) => g.playerId);
  const [players, ratings, teams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, position: true } }),
    prisma.skaterRating.findMany({ where: { playerId: { in: ids } }, select: { playerId: true, sk: true } }),
    teamLookup(),
  ]);
  const pById = new Map(players.map((p) => [p.id, p]));
  const skById = new Map(ratings.map((r) => [r.playerId, r.sk ?? 50]));
  return grouped.map((g) => {
    const p = pById.get(g.playerId);
    const t = g.teamId ? teams.get(g.teamId) : null;
    const sk = skById.get(g.playerId) ?? 50;
    const gp = g._count._all;
    const toi = g._sum.toi ?? 0;
    return {
      playerId: g.playerId, name: cleanName(p?.name ?? "—"), position: p?.position ?? "—",
      teamCode: t?.code ?? null, teamSlug: t?.slug ?? null,
      gp, toi, topShot: g._max.topShot ?? 0, hits: g._sum.hits ?? 0,
      topSkateSpeed: skateTopSpeed(sk, g.playerId), bursts: Math.round(burstsPerGame(sk) * gp),
      miles: gp ? milesPerGame(toi / gp) * gp : 0, sk,
    };
  });
}

export type GoalieEdge = {
  playerId: number; name: string; teamCode: string | null; teamSlug: string | null;
  gp: number; hdSvPct: number; mdSvPct: number; ldSvPct: number;
  hdShotsAg: number; mdShotsAg: number; ldShotsAg: number; svPct: number;
};

export async function goalieEdge(season: string, league = "NHL"): Promise<GoalieEdge[]> {
  const rows = await prisma.goalieGameStat.findMany({
    where: { game: gameWhere({ season, league, playoffs: false }) },
    select: { playerId: true, teamId: true, started: true, shotsAgainst: true, saves: true,
      hdShotsAg: true, hdSaves: true, mdShotsAg: true, mdSaves: true, ldShotsAg: true, ldSaves: true },
  });
  type Acc = { playerId: number; teamId: number | null; gp: number; sa: number; sv: number;
    hdA: number; hdS: number; mdA: number; mdS: number; ldA: number; ldS: number };
  const acc = new Map<string, Acc>();
  for (const r of rows) {
    if (!r.started && r.shotsAgainst === 0) continue;
    const key = `${r.playerId}:${r.teamId}`;
    let a = acc.get(key);
    if (!a) { a = { playerId: r.playerId, teamId: r.teamId ?? null, gp: 0, sa: 0, sv: 0, hdA: 0, hdS: 0, mdA: 0, mdS: 0, ldA: 0, ldS: 0 }; acc.set(key, a); }
    a.gp++; a.sa += r.shotsAgainst; a.sv += r.saves;
    a.hdA += r.hdShotsAg; a.hdS += r.hdSaves; a.mdA += r.mdShotsAg; a.mdS += r.mdSaves; a.ldA += r.ldShotsAg; a.ldS += r.ldSaves;
  }
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: [...acc.values()].map((a) => a.playerId) } }, select: { id: true, name: true } }),
    teamLookup(),
  ]);
  const pById = new Map(players.map((p) => [p.id, p]));
  return [...acc.values()].map((a) => {
    const t = a.teamId ? teams.get(a.teamId) : null;
    return {
      playerId: a.playerId, name: cleanName(pById.get(a.playerId)?.name ?? "—"),
      teamCode: t?.code ?? null, teamSlug: t?.slug ?? null, gp: a.gp,
      hdSvPct: a.hdA ? a.hdS / a.hdA : 0, mdSvPct: a.mdA ? a.mdS / a.mdA : 0, ldSvPct: a.ldA ? a.ldS / a.ldA : 0,
      hdShotsAg: a.hdA, mdShotsAg: a.mdA, ldShotsAg: a.ldA, svPct: a.sa ? a.sv / a.sa : 0,
    };
  });
}

export type TeamEdge = {
  teamId: number; name: string; code: string | null; slug: string | null;
  gp: number; ozPct: number; nzPct: number; dzPct: number;
  avgShot: number; topShot: number; hitsPerGame: number; avgSkateSpeed: number;
};

export async function teamEdge(season: string, league = "NHL"): Promise<TeamEdge[]> {
  const games = await prisma.game.findMany({
    where: { season, league, status: "FINAL", seriesId: null },
    select: { homeTeamId: true, awayTeamId: true, homeOzPct: true, homeNzPct: true, homeDzPct: true,
      awayOzPct: true, awayNzPct: true, awayDzPct: true, homeAvgShot: true, awayAvgShot: true,
      homeTopShot: true, awayTopShot: true },
  });
  type Acc = { teamId: number; gp: number; oz: number; nz: number; dz: number; avgShot: number; topShot: number };
  const acc = new Map<number, Acc>();
  const add = (id: number, oz: number | null, nz: number | null, dz: number | null, avg: number | null, top: number | null) => {
    let a = acc.get(id);
    if (!a) { a = { teamId: id, gp: 0, oz: 0, nz: 0, dz: 0, avgShot: 0, topShot: 0 }; acc.set(id, a); }
    a.gp++; a.oz += oz ?? 0; a.nz += nz ?? 0; a.dz += dz ?? 0; a.avgShot += avg ?? 0; a.topShot = Math.max(a.topShot, top ?? 0);
  };
  for (const g of games) {
    add(g.homeTeamId, g.homeOzPct, g.homeNzPct, g.homeDzPct, g.homeAvgShot, g.homeTopShot);
    add(g.awayTeamId, g.awayOzPct, g.awayNzPct, g.awayDzPct, g.awayAvgShot, g.awayTopShot);
  }
  // team hits/game + roster avg skating speed
  const [teamRows, hitAgg, rosters] = await Promise.all([
    teamLookup(),
    prisma.playerGameStat.groupBy({ by: ["teamId"], where: { game: gameWhere({ season, league, playoffs: false }) }, _sum: { hits: true } }),
    prisma.player.findMany({ where: { rosterType: league, teamId: { in: [...acc.keys()] } }, select: { teamId: true, skaterRating: { select: { sk: true } } } }),
  ]);
  const hitByTeam = new Map(hitAgg.map((h) => [h.teamId, h._sum.hits ?? 0]));
  const skByTeam = new Map<number, { sum: number; n: number }>();
  for (const p of rosters) {
    if (p.teamId == null || !p.skaterRating?.sk) continue;
    const e = skByTeam.get(p.teamId) ?? { sum: 0, n: 0 }; e.sum += p.skaterRating.sk; e.n++; skByTeam.set(p.teamId, e);
  }
  return [...acc.values()].map((a) => {
    const t = teamRows.get(a.teamId);
    const sk = skByTeam.get(a.teamId);
    return {
      teamId: a.teamId, name: t?.name ?? "—", code: t?.code ?? null, slug: t?.slug ?? null,
      gp: a.gp, ozPct: a.gp ? a.oz / a.gp : 0, nzPct: a.gp ? a.nz / a.gp : 0, dzPct: a.gp ? a.dz / a.gp : 0,
      avgShot: a.gp ? a.avgShot / a.gp : 0, topShot: a.topShot,
      hitsPerGame: a.gp ? (hitByTeam.get(a.teamId) ?? 0) / a.gp : 0,
      avgSkateSpeed: sk && sk.n ? skateTopSpeed(sk.sum / sk.n, a.teamId) : 0,
    };
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
