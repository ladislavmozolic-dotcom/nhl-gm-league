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
  teamId: number;
  name: string;
  savePct: number;
  seasonSavePct: number | null;
  gsax: number;
  seasonGsaxPerGame: number | null;
  gamesInBaseline: number;
}

export interface TeamPostGame {
  teamId: number;
  teamCode: string | null;
  teamName: string;
  teamSlug?: string | null;
  teamLogo?: string | null;
  swings: TeamGameSwing[];
  goalies: GoalieGameSwing[];
}

export interface PostGameIntelResult {
  home: TeamPostGame;
  away: TeamPostGame;
  goalies: GoalieGameSwing[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number) => Math.round(n * 1000) / 10; // fraction -> percent, 1 decimal

async function teamSwings(teamId: number, isHome: boolean, game: {
  season: string; league: string; round: number | null; gameDate: Date | null; id: number;
  homeShots: number | null; awayShots: number | null; homeGoals: number | null; awayGoals: number | null;
  homeXg: number | null; awayXg: number | null; homeHd: number | null; awayHd: number | null;
}): Promise<TeamGameSwing[]> {
  const shotsFor = isHome ? game.homeShots : game.awayShots;
  const goalsFor = isHome ? game.homeGoals : game.awayGoals;
  const xgFor = isHome ? game.homeXg : game.awayXg;
  const hdFor = isHome ? game.homeHd : game.awayHd;

  const priorWhere = game.gameDate
    ? { status: "FINAL" as const, seriesId: null, season: game.season, league: game.league, gameDate: { lt: game.gameDate } }
    : game.round != null
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

async function goalieSwings(game: { id: number; season: string; league: string; round: number | null; gameDate: Date | null; homeTeamId: number; awayTeamId: number }): Promise<GoalieGameSwing[]> {
  const stats = await prisma.goalieGameStat.findMany({
    where: { gameId: game.id, shotsAgainst: { gt: 0 } },
    select: { playerId: true, teamId: true, started: true, saves: true, shotsAgainst: true, goalsAgainst: true, xga: true, player: { select: { name: true } } },
  });
  if (!stats.length) return [];

  // Sort: Away team goalies first, Home team goalies second; within team, starter first
  stats.sort((a, b) => {
    const aTeamOrder = a.teamId === game.awayTeamId ? 0 : 1;
    const bTeamOrder = b.teamId === game.awayTeamId ? 0 : 1;
    if (aTeamOrder !== bTeamOrder) return aTeamOrder - bTeamOrder;
    return (b.started ? 1 : 0) - (a.started ? 1 : 0);
  });

  const priorWhere = game.gameDate
    ? { status: "FINAL" as const, seriesId: null, season: game.season, league: game.league, gameDate: { lt: game.gameDate } }
    : game.round != null
    ? { status: "FINAL" as const, seriesId: null, season: game.season, league: game.league, round: { lt: game.round } }
    : { status: "FINAL" as const, seriesId: null, season: game.season, league: game.league, id: { lt: game.id } };

  const out: GoalieGameSwing[] = [];
  for (const s of stats) {
    const prior = await prisma.goalieGameStat.findMany({
      where: { playerId: s.playerId, shotsAgainst: { gt: 0 }, game: priorWhere },
      select: { saves: true, shotsAgainst: true, goalsAgainst: true, xga: true },
    });
    if (!prior.length) {
      out.push({
        playerId: s.playerId,
        teamId: s.teamId,
        name: s.player.name,
        savePct: pct(s.saves / s.shotsAgainst),
        seasonSavePct: null,
        gsax: round1(s.xga - s.goalsAgainst),
        seasonGsaxPerGame: null,
        gamesInBaseline: 0,
      });
      continue;
    }
    const priorSaves = prior.reduce((sum, p) => sum + p.saves, 0);
    const priorShots = prior.reduce((sum, p) => sum + p.shotsAgainst, 0);
    const priorGsaxSum = prior.reduce((sum, p) => sum + (p.xga - p.goalsAgainst), 0);
    out.push({
      playerId: s.playerId,
      teamId: s.teamId,
      name: s.player.name,
      savePct: pct(s.saves / s.shotsAgainst),
      seasonSavePct: pct(priorSaves / priorShots),
      gsax: round1(s.xga - s.goalsAgainst),
      seasonGsaxPerGame: round1(priorGsaxSum / prior.length),
      gamesInBaseline: prior.length,
    });
  }
  return out;
}

export async function postGameIntel(gameId: number): Promise<PostGameIntelResult | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true, season: true, league: true, round: true, gameDate: true, status: true,
      homeTeamId: true, awayTeamId: true, homeShots: true, awayShots: true, homeGoals: true, awayGoals: true,
      homeXg: true, awayXg: true, homeHd: true, awayHd: true,
      homeTeam: { select: { code: true, name: true, logoUrl: true, slug: true } }, awayTeam: { select: { code: true, name: true, logoUrl: true, slug: true } },
    },
  });
  if (!game || game.status !== "FINAL") return null;

  const [homeSw, awaySw, goalies] = await Promise.all([
    teamSwings(game.homeTeamId, true, game),
    teamSwings(game.awayTeamId, false, game),
    goalieSwings(game),
  ]);

  const homeGoalies = goalies.filter((g) => g.teamId === game.homeTeamId);
  const awayGoalies = goalies.filter((g) => g.teamId === game.awayTeamId);

  return {
    home: {
      teamId: game.homeTeamId,
      teamCode: game.homeTeam.code || game.homeTeam.name,
      teamName: game.homeTeam.name,
      teamSlug: game.homeTeam.slug,
      teamLogo: game.homeTeam.logoUrl,
      swings: homeSw,
      goalies: homeGoalies,
    },
    away: {
      teamId: game.awayTeamId,
      teamCode: game.awayTeam.code || game.awayTeam.name,
      teamName: game.awayTeam.name,
      teamSlug: game.awayTeam.slug,
      teamLogo: game.awayTeam.logoUrl,
      swings: awaySw,
      goalies: awayGoalies,
    },
    goalies,
  };
}
