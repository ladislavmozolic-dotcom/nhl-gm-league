import { prisma } from "@/lib/prisma";

// UNHL Intelligence — "Post-game Intelligence" (phase 5 — see memory:
// gm-assistant-intelligence). Explains a result by comparing this game's real
// numbers to the team's/goalie's own season-to-date baseline (prior FINAL
// regular-season games, same season/league — the exact "priorGame" pattern
// app/games/[id]/page.tsx already uses for running totals). Only metrics the
// sim engine actually persists are used: shots, goals, team xG/high-danger
// shots (Game.homeXg/homeHd — null before the engine tracked them, in which
// case that swing is just left out), faceoff% (real, from PlayerGameStat),
// and goalie save%/GSAx. PP%/PK% are deliberately NOT computed — the engine
// tracks special-teams GOALS but not power-play OPPORTUNITIES, so a "PK%"
// here would be invented, not measured (see app/stats/teams/page.tsx's own
// note on this gap). No blended "how well did they play" score — every swing
// stands on its own real number.

export interface TeamGameSwing {
  key: string;
  label: string;
  gameValue: number;
  seasonAvg: number;
  delta: number;
  gamesInBaseline: number;
}

export interface GoalieGameSwing {
  playerId: number;
  name: string;
  savePct: number;
  seasonSavePct: number;
  gsax: number;
  seasonGsaxPerGame: number;
  gamesInBaseline: number;
}

export interface TeamPostGame {
  teamId: number;
  teamCode: string | null;
  swings: TeamGameSwing[];
}

export interface PostGameIntelResult {
  home: TeamPostGame;
  away: TeamPostGame;
  goalies: GoalieGameSwing[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number) => Math.round(n * 1000) / 10; // fraction -> percent, 1 decimal

async function teamSwings(teamId: number, isHome: boolean, game: {
  season: string; league: string; round: number | null; id: number;
  homeShots: number | null; awayShots: number | null; homeGoals: number | null; awayGoals: number | null;
  homeXg: number | null; awayXg: number | null; homeHd: number | null; awayHd: number | null;
}): Promise<TeamGameSwing[]> {
  const shotsFor = isHome ? game.homeShots : game.awayShots;
  const goalsFor = isHome ? game.homeGoals : game.awayGoals;
  const xgFor = isHome ? game.homeXg : game.awayXg;
  const hdFor = isHome ? game.homeHd : game.awayHd;

  const priorWhere = game.round != null
    ? { status: "FINAL" as const, seriesId: null, season: game.season, league: game.league, round: { lt: game.round } }
    : { status: "FINAL" as const, seriesId: null, season: game.season, league: game.league, id: { lt: game.id } };

  const priorGames = await prisma.game.findMany({
    where: { ...priorWhere, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    select: { id: true, homeTeamId: true, homeShots: true, awayShots: true, homeGoals: true, awayGoals: true, homeXg: true, awayXg: true, homeHd: true, awayHd: true },
  });

  const forOf = (g: typeof priorGames[number], field: "Shots" | "Goals" | "Xg" | "Hd") =>
    g.homeTeamId === teamId ? g[`home${field}`] : g[`away${field}`];

  const avgOf = (field: "Shots" | "Goals" | "Xg" | "Hd") => {
    const vals = priorGames.map((g) => forOf(g, field)).filter((v): v is number => v != null);
    return { avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null, n: vals.length };
  };

  const priorGameIds = priorGames.map((g) => g.id);
  const [thisFo, priorFo] = await Promise.all([
    prisma.playerGameStat.aggregate({ where: { gameId: game.id, teamId }, _sum: { faceoffWins: true, faceoffLosses: true } }),
    priorGameIds.length
      ? prisma.playerGameStat.aggregate({ where: { gameId: { in: priorGameIds }, teamId }, _sum: { faceoffWins: true, faceoffLosses: true } })
      : Promise.resolve({ _sum: { faceoffWins: 0, faceoffLosses: 0 } }),
  ]);

  const swings: TeamGameSwing[] = [];
  const pushMetric = (key: string, label: string, gameVal: number | null, field: "Shots" | "Goals" | "Xg" | "Hd") => {
    if (gameVal == null) return;
    const { avg, n } = avgOf(field);
    if (avg == null || n === 0) return;
    swings.push({ key, label, gameValue: round1(gameVal), seasonAvg: round1(avg), delta: round1(gameVal - avg), gamesInBaseline: n });
  };
  pushMetric("shots", "Strely", shotsFor, "Shots");
  pushMetric("goals", "Góly", goalsFor, "Goals");
  pushMetric("xg", "Expected Goals (xG)", xgFor, "Xg");
  pushMetric("hd", "High-danger strely", hdFor, "Hd");

  const thisWins = thisFo._sum.faceoffWins ?? 0, thisLosses = thisFo._sum.faceoffLosses ?? 0;
  const priorWins = priorFo._sum.faceoffWins ?? 0, priorLosses = priorFo._sum.faceoffLosses ?? 0;
  if (thisWins + thisLosses > 0 && priorWins + priorLosses > 0) {
    const gameFo = pct(thisWins / (thisWins + thisLosses));
    const seasonFo = pct(priorWins / (priorWins + priorLosses));
    swings.push({ key: "faceoff", label: "Faceoff %", gameValue: gameFo, seasonAvg: seasonFo, delta: round1(gameFo - seasonFo), gamesInBaseline: priorGames.length });
  }

  return swings.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

async function goalieSwings(gameId: number, season: string, league: string, round: number | null): Promise<GoalieGameSwing[]> {
  const stats = await prisma.goalieGameStat.findMany({
    where: { gameId, shotsAgainst: { gt: 0 } },
    select: { playerId: true, saves: true, shotsAgainst: true, goalsAgainst: true, xga: true, player: { select: { name: true } } },
  });
  if (!stats.length) return [];

  const priorWhere = round != null
    ? { status: "FINAL" as const, seriesId: null, season, league, round: { lt: round } }
    : { status: "FINAL" as const, seriesId: null, season, league, id: { lt: gameId } };

  const out: GoalieGameSwing[] = [];
  for (const s of stats) {
    const prior = await prisma.goalieGameStat.findMany({
      where: { playerId: s.playerId, shotsAgainst: { gt: 0 }, game: priorWhere },
      select: { saves: true, shotsAgainst: true, goalsAgainst: true, xga: true },
    });
    if (!prior.length) continue; // no baseline yet this season — nothing to compare against
    const priorSaves = prior.reduce((sum, p) => sum + p.saves, 0);
    const priorShots = prior.reduce((sum, p) => sum + p.shotsAgainst, 0);
    const priorGsaxSum = prior.reduce((sum, p) => sum + (p.xga - p.goalsAgainst), 0);
    out.push({
      playerId: s.playerId, name: s.player.name,
      savePct: pct(s.saves / s.shotsAgainst), seasonSavePct: pct(priorSaves / priorShots),
      gsax: round1(s.xga - s.goalsAgainst), seasonGsaxPerGame: round1(priorGsaxSum / prior.length),
      gamesInBaseline: prior.length,
    });
  }
  return out;
}

export async function postGameIntel(gameId: number): Promise<PostGameIntelResult | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true, season: true, league: true, round: true, status: true,
      homeTeamId: true, awayTeamId: true, homeShots: true, awayShots: true, homeGoals: true, awayGoals: true,
      homeXg: true, awayXg: true, homeHd: true, awayHd: true,
      homeTeam: { select: { code: true } }, awayTeam: { select: { code: true } },
    },
  });
  if (!game || game.status !== "FINAL") return null;

  const [homeSw, awaySw, goalies] = await Promise.all([
    teamSwings(game.homeTeamId, true, game),
    teamSwings(game.awayTeamId, false, game),
    goalieSwings(game.id, game.season, game.league, game.round),
  ]);

  return {
    home: { teamId: game.homeTeamId, teamCode: game.homeTeam.code, swings: homeSw },
    away: { teamId: game.awayTeamId, teamCode: game.awayTeam.code, swings: awaySw },
    goalies,
  };
}
