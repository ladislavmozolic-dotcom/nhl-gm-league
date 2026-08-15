// Compute standings and stat leaders from persisted FINAL games.

import { prisma } from "../prisma";
import { loadSettings } from "./settings";

export type TeamStanding = {
  teamId: number;
  name: string;
  code: string | null;
  conference: string | null;
  division: string | null;
  gp: number;
  w: number;      // total wins (REG + OT + SO)
  l: number;      // regulation losses
  otl: number;    // overtime/shootout losses
  rw: number;     // regulation wins (tiebreak)
  gf: number;
  ga: number;
  diff: number;
  points: number;
  pointsPct: number;
};

/** Standard NHL points: win = 2, OT/SO loss = 1, regulation loss = 0. */
export async function computeStandings(season = "2026-27", league = "NHL"): Promise<TeamStanding[]> {
  const teams = await prisma.team.findMany({
    where: { league },
    select: { id: true, name: true, code: true, conference: true, division: true },
  });

  const games = await prisma.game.findMany({
    where: { season, league, status: "FINAL", seriesId: null },
    select: {
      homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true,
      winnerTeamId: true, endedIn: true,
    },
  });

  const table = new Map<number, TeamStanding>();
  for (const t of teams) {
    table.set(t.id, {
      teamId: t.id, name: t.name, code: t.code,
      conference: t.conference, division: t.division,
      gp: 0, w: 0, l: 0, otl: 0, rw: 0, gf: 0, ga: 0, diff: 0,
      points: 0, pointsPct: 0,
    });
  }

  const settings = await loadSettings();
  for (const g of games) {
    const home = table.get(g.homeTeamId);
    const away = table.get(g.awayTeamId);
    if (!home || !away || g.homeGoals == null || g.awayGoals == null) continue;
    home.gp++; away.gp++;
    home.gf += g.homeGoals; home.ga += g.awayGoals;
    away.gf += g.awayGoals; away.ga += g.homeGoals;

    const winner = g.winnerTeamId === g.homeTeamId ? home : away;
    const loser = winner === home ? away : home;
    const reg = g.endedIn === "REG";
    winner.w++;
    winner.points += reg ? settings.winPts : settings.otWinPts;
    if (reg) { loser.l++; winner.rw++; loser.points += settings.lossPts; }
    else { loser.otl++; loser.points += settings.otLossPts; }
  }

  const standings = [...table.values()];
  for (const s of standings) {
    s.diff = s.gf - s.ga;
    s.pointsPct = s.gp ? s.points / (s.gp * 2) : 0;
  }
  // sort: points, then points%, then regulation wins, then goal diff
  standings.sort((a, b) =>
    b.points - a.points || b.pointsPct - a.pointsPct || b.rw - a.rw || b.diff - a.diff);
  return standings;
}

export type SkaterLeader = {
  playerId: number; name: string; teamCode: string | null; position: string;
  isDefense: boolean;
  gp: number; goals: number; assists: number; points: number;
  shots: number; pim: number; plusMinus: number;
};

export async function skaterLeaders(season = "2026-27", limit = 30, league = "NHL"): Promise<SkaterLeader[]> {
  const rows = await prisma.playerGameStat.groupBy({
    by: ["playerId"],
    where: { game: { season, league, status: "FINAL", seriesId: null } },
    _sum: { goals: true, assists: true, points: true, shots: true, pim: true, plusMinus: true },
    _count: { _all: true },
    orderBy: { _sum: { points: "desc" } },
    take: limit,
  });
  const players = await prisma.player.findMany({
    where: { id: { in: rows.map((r) => r.playerId) } },
    select: { id: true, name: true, position: true, team: { select: { code: true } } },
  });
  const byId = new Map(players.map((p) => [p.id, p]));
  return rows.map((r) => {
    const pos = byId.get(r.playerId)?.position ?? "";
    return {
      playerId: r.playerId,
      name: byId.get(r.playerId)?.name ?? `#${r.playerId}`,
      teamCode: byId.get(r.playerId)?.team.code ?? null,
      position: pos,
      isDefense: /(^|\/)D(\/|$)/.test(pos) || pos === "D",
      gp: r._count._all,
      goals: r._sum.goals ?? 0,
      assists: r._sum.assists ?? 0,
      points: r._sum.points ?? 0,
      shots: r._sum.shots ?? 0,
      pim: r._sum.pim ?? 0,
      plusMinus: r._sum.plusMinus ?? 0,
    };
  });
}

export type GoalieLeader = {
  playerId: number; name: string; teamCode: string | null;
  gp: number; wins: number; losses: number; otl: number;
  shotsAgainst: number; saves: number; goalsAgainst: number;
  savePct: number; gaa: number;
};

export async function goalieLeaders(season = "2026-27", limit = 30, league = "NHL"): Promise<GoalieLeader[]> {
  // only games the goalie actually STARTED count toward GP/record/GAA/SV%
  const rows = await prisma.goalieGameStat.groupBy({
    by: ["playerId"],
    where: { started: true, game: { season, league, status: "FINAL", seriesId: null } },
    _sum: { shotsAgainst: true, saves: true, goalsAgainst: true },
    _count: { _all: true },
  });
  // decisions need per-row counting
  const decisionRows = await prisma.goalieGameStat.findMany({
    where: { started: true, game: { season, league, status: "FINAL", seriesId: null } },
    select: { playerId: true, decision: true },
  });
  const dec = new Map<number, { w: number; l: number; otl: number }>();
  for (const d of decisionRows) {
    const e = dec.get(d.playerId) ?? { w: 0, l: 0, otl: 0 };
    if (d.decision === "W") e.w++;
    else if (d.decision === "OTL") e.otl++;
    else if (d.decision === "L") e.l++;
    dec.set(d.playerId, e);
  }

  const players = await prisma.player.findMany({
    where: { id: { in: rows.map((r) => r.playerId) } },
    select: { id: true, name: true, team: { select: { code: true } } },
  });
  const byId = new Map(players.map((p) => [p.id, p]));

  const leaders: GoalieLeader[] = rows.map((r) => {
    const sa = r._sum.shotsAgainst ?? 0;
    const ga = r._sum.goalsAgainst ?? 0;
    const gp = r._count._all;
    const d = dec.get(r.playerId) ?? { w: 0, l: 0, otl: 0 };
    return {
      playerId: r.playerId,
      name: byId.get(r.playerId)?.name ?? `#${r.playerId}`,
      teamCode: byId.get(r.playerId)?.team.code ?? null,
      gp, wins: d.w, losses: d.l, otl: d.otl,
      shotsAgainst: sa, saves: r._sum.saves ?? 0, goalsAgainst: ga,
      savePct: sa ? (sa - ga) / sa : 0,
      gaa: gp ? ga / gp : 0, // per-game (approx; assumes ~1 game per start)
    };
  });
  // rank by wins then save% (require a workload to qualify for the leaderboard)
  const maxGp = Math.max(0, ...leaders.map((l) => l.gp));
  const minGp = maxGp >= 30 ? 15 : 1;
  return leaders
    .filter((l) => l.gp >= minGp)
    .sort((a, b) => b.wins - a.wins || b.savePct - a.savePct)
    .slice(0, limit);
}

export type PowerRow = {
  teamId: number; name: string; code: string | null; conference: string | null; division: string | null;
  gp: number; w: number; l: number; otl: number; points: number; pointsPct: number;
  gf: number; ga: number; diff: number; form: string; // e.g. "W L W W OTL ..."
};

/** Power ranking: teams ordered by results over their last `window` games. */
export async function powerRanking(season = "2026-27", league = "NHL", window = 10): Promise<PowerRow[]> {
  const [teams, games, settings] = await Promise.all([
    prisma.team.findMany({ where: { league }, select: { id: true, name: true, code: true, conference: true, division: true } }),
    prisma.game.findMany({
      where: { season, league, status: "FINAL", seriesId: null, gameDate: { not: null } },
      select: { homeTeamId: true, awayTeamId: true, winnerTeamId: true, endedIn: true, homeGoals: true, awayGoals: true, gameDate: true },
      orderBy: { gameDate: "desc" },
    }),
    loadSettings(),
  ]);

  const recent = new Map<number, typeof games>();
  for (const g of games) for (const tid of [g.homeTeamId, g.awayTeamId]) {
    const arr = recent.get(tid) ?? []; if (arr.length < window) { arr.push(g); recent.set(tid, arr); }
  }

  const rows: PowerRow[] = teams.map((t) => {
    const gs = recent.get(t.id) ?? [];
    let w = 0, l = 0, otl = 0, points = 0, gf = 0, ga = 0;
    const marks: string[] = [];
    for (const g of gs) { // newest first
      const home = g.homeTeamId === t.id;
      gf += (home ? g.homeGoals : g.awayGoals) ?? 0;
      ga += (home ? g.awayGoals : g.homeGoals) ?? 0;
      const won = g.winnerTeamId === t.id;
      const reg = g.endedIn === "REG" || !g.endedIn;
      if (won) { w++; points += reg ? settings.winPts : settings.otWinPts; marks.push("W"); }
      else if (!reg) { otl++; points += settings.otLossPts; marks.push("OTL"); }
      else { l++; marks.push("L"); }
    }
    const gp = gs.length;
    return {
      teamId: t.id, name: t.name, code: t.code, conference: t.conference, division: t.division,
      gp, w, l, otl, points, pointsPct: gp ? points / (gp * 2) : 0,
      gf, ga, diff: gf - ga, form: marks.slice(0, window).reverse().join(" "),
    };
  });

  return rows.sort((a, b) => b.pointsPct - a.pointsPct || b.points - a.points || b.diff - a.diff || b.gf - a.gf);
}
