import { prisma } from "@/lib/prisma";
import { REGULAR_SEASON } from "@/lib/phase";

/** Monday (UTC date, YYYY-MM-DD) of the week containing `d` — the Game Picks week key. */
export function pickWeekKey(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

export type DailyGamePickInput = {
  gameId: number;
  winnerTeamId: number;
  isJoker?: boolean;
};

export type GameOfTheWeekPickInput = {
  gameId: number;
  winnerTeamId: number;
  predictedScore: string; // e.g. "5:3"
  firstGoalScorerId?: number;
  firstGoalScorerName?: string;
  topScorerPlayerId?: number;
  topScorerPlayerName?: string;
  isJoker?: boolean;
};

export type RivalPairing = {
  week: number;
  teamAId: number;
  teamBId: number;
  gameIds: number[];
};

export async function getOrCreateGamePicksConfig(season = REGULAR_SEASON, league = "NHL") {
  let config = await prisma.gamePicksConfig.findUnique({
    where: { season_league: { season, league } },
  });

  if (!config) {
    const allTeams = await prisma.team.findMany({
      where: { league, isAffiliate: false },
      select: { id: true },
    });
    const upsetTeamIds = allTeams.slice(Math.floor(allTeams.length * 0.6)).map((t) => t.id);

    config = await prisma.gamePicksConfig.create({
      data: {
        season,
        league,
        featuredGameIds: [],
        gameOfTheWeekId: null,
        upsetTeamIds,
        activeWeek: 1,
        rivalPairings: [],
      },
    });
  }

  return config;
}

export async function getOrCreateGamePicksProfile(teamId: number, season = REGULAR_SEASON, league = "NHL") {
  let profile = await prisma.gamePicksProfile.findUnique({
    where: {
      season_league_teamId: {
        season,
        league,
        teamId,
      },
    },
  });

  if (!profile) {
    profile = await prisma.gamePicksProfile.create({
      data: {
        season,
        league,
        teamId,
        totalPoints: 0,
        currentStreak: 0,
        bestStreak: 0,
        jokersUsed: 0,
        jokersTotal: 5,
        monthlyPoints: {},
        badges: [],
        rivalHistory: [],
      },
    });
  }

  return profile;
}

export async function getGamePicksData(season = REGULAR_SEASON, league = "NHL", viewerTeamId?: number | null) {
  const [config, teams, dbPlayers, allProfiles, dbGames] = await Promise.all([
    getOrCreateGamePicksConfig(season, league),
    prisma.team.findMany({
      where: { league, isAffiliate: false },
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        logoUrl: true,
        gm: true,
        gmNickname: true,
        division: true,
        conference: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.player.findMany({
      where: {
        team: { league, isAffiliate: false },
      },
      select: {
        id: true,
        name: true,
        position: true,
        teamId: true,
        isGoalie: true,
        nhlId: true,
        photoUrl: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.gamePicksProfile.findMany({
      where: { season, league },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            logoUrl: true,
            gm: true,
            gmNickname: true,
          },
        },
      },
      orderBy: [{ totalPoints: "desc" }, { bestStreak: "desc" }],
    }),
    prisma.game.findMany({
      where: { season, league, seriesId: null },
      orderBy: [{ round: "asc" }, { gameDate: "asc" }, { id: "asc" }],
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            logoUrl: true,
            gm: true,
            gmNickname: true,
            division: true,
            conference: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            logoUrl: true,
            gm: true,
            gmNickname: true,
            division: true,
            conference: true,
          },
        },
      },
    }),
  ]);

  const now = new Date();

  // Map UNHL database games
  const mappedGames = dbGames.map((g) => {
    const isFinal = g.status === "FINAL";
    const isLocked = isFinal;

    let winnerTeamId: number | null = null;
    if (isFinal) {
      const isDraw = g.endedIn === "OT" || g.endedIn === "SO";
      if (isDraw) {
        winnerTeamId = 0; // Draw (X)
      } else if (typeof g.homeGoals === "number" && typeof g.awayGoals === "number") {
        winnerTeamId = g.homeGoals > g.awayGoals ? g.homeTeamId : g.awayTeamId;
      } else {
        winnerTeamId = g.winnerTeamId ?? null;
      }
    }

    return {
      id: g.id,
      season: g.season,
      league: g.league,
      round: g.round,
      gameDate: g.gameDate,
      status: g.status,
      homeTeamId: g.homeTeamId,
      awayTeamId: g.awayTeamId,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      homeGoals: g.homeGoals,
      awayGoals: g.awayGoals,
      winnerTeamId,
      isLocked,
      isHomeUpset: config.upsetTeamIds.includes(g.homeTeamId),
      isAwayUpset: config.upsetTeamIds.includes(g.awayTeamId),
    };
  });

  // Identify today's active games batch (e.g. next upcoming round/day of scheduled UNHL matches)
  const scheduledGames = mappedGames.filter((g) => g.status === "SCHEDULED");
  let todayGames: typeof mappedGames = [];

  if (scheduledGames.length > 0) {
    const firstScheduled = scheduledGames[0];
    if (firstScheduled.gameDate) {
      const targetDate = firstScheduled.gameDate.toISOString().slice(0, 10);
      todayGames = scheduledGames.filter(
        (g) => g.gameDate && g.gameDate.toISOString().slice(0, 10) === targetDate
      );
    } else if (firstScheduled.round) {
      todayGames = scheduledGames.filter((g) => g.round === firstScheduled.round);
    } else {
      todayGames = scheduledGames.slice(0, 10);
    }
  } else {
    // If all games played, show last round played
    const lastPlayed = mappedGames[mappedGames.length - 1];
    if (lastPlayed?.round) {
      todayGames = mappedGames.filter((g) => g.round === lastPlayed.round);
    } else {
      todayGames = mappedGames.slice(-10);
    }
  }

  const RIVALRIES = new Set([
    "MTL-TOR", "TOR-MTL", "NYR-BOS", "BOS-NYR", "EDM-CGY", "CGY-EDM",
    "PIT-PHI", "PHI-PIT", "EDM-VAN", "VAN-EDM", "FLA-TBL", "TBL-FLA",
    "COL-VGK", "VGK-COL", "NYR-NJD", "NJD-NYR", "TOR-BOS", "BOS-TOR",
    "CAR-FLA", "FLA-CAR", "DAL-COL", "COL-DAL", "WSH-PIT", "PIT-WSH",
    "CHI-DET", "DET-CHI", "NYI-NYR", "NYR-NYI", "CGY-VAN", "VAN-CGY",
    "LAK-SJS", "SJS-LAK", "LAK-ANA", "ANA-LAK", "COL-EDM", "EDM-COL",
  ]);

  const candidatePool = scheduledGames.length > 0 ? scheduledGames.slice(0, 25) : mappedGames.slice(0, 25);
  const scoredGames = candidatePool.map((g) => {
    let score = 0;
    const hCode = g.homeTeam?.code?.toUpperCase() || "";
    const aCode = g.awayTeam?.code?.toUpperCase() || "";
    if (hCode && aCode && (RIVALRIES.has(`${aCode}-${hCode}`) || RIVALRIES.has(`${hCode}-${aCode}`))) {
      score += 50;
    }
    if (g.isHomeUpset || g.isAwayUpset) score += 10;
    return { game: g, score };
  });

  // Sort descending by score, then by gameDate/round
  scoredGames.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const tA = a.game.gameDate ? new Date(a.game.gameDate).getTime() : a.game.id;
    const tB = b.game.gameDate ? new Date(b.game.gameDate).getTime() : b.game.id;
    return tA - tB;
  });

  // Find top upcoming scheduled game chosen by AI
  const topScheduledCandidate = scoredGames.find((sg) => sg.game.status === "SCHEDULED" && !sg.game.isLocked)?.game;
  const bestCandidate = topScheduledCandidate || scoredGames[0]?.game;

  // A GOTW that has already been played (FINAL) is done — its picks get evaluated by the
  // daily job — so it must roll over to the next pick instead of staying pinned forever.
  const currentGotw = config.gameOfTheWeekId ? mappedGames.find((g) => g.id === config.gameOfTheWeekId) : null;
  let gotwId = currentGotw && currentGotw.status !== "FINAL" ? currentGotw.id : null;

  // If no GOTW is currently active or previous GOTW is finished/not found, AI picks the most interesting game
  if (!gotwId && bestCandidate) {
    gotwId = bestCandidate.id;
    await prisma.gamePicksConfig.update({
      where: { season_league: { season, league } },
      data: { gameOfTheWeekId: gotwId },
    }).catch(() => {});
  }

  const allGameIds = mappedGames.map((g) => g.id);

  // Load viewer submissions for these UNHL games
  const viewerSubmissions = viewerTeamId
    ? await prisma.gamePickSubmission.findMany({
        where: {
          season,
          league,
          teamId: viewerTeamId,
          gameId: { in: allGameIds },
        },
      })
    : [];

  const viewerProfile = viewerTeamId ? await getOrCreateGamePicksProfile(viewerTeamId, season, league) : null;

  return {
    config: {
      ...config,
      gameOfTheWeekId: gotwId,
    },
    teams,
    players: dbPlayers,
    games: mappedGames.map((g) => ({
      ...g,
      isGameOfTheWeek: g.id === gotwId,
      isFeatured: todayGames.some((tg) => tg.id === g.id),
    })),
    viewerProfile,
    viewerSubmissions,
    leaderboard: allProfiles,
    currentRival: null,
  };
}

export async function evaluateGamePicks(season = REGULAR_SEASON, league = "NHL") {
  // Find all un-evaluated submissions
  const pendingSubmissions = await prisma.gamePickSubmission.findMany({
    where: {
      season,
      league,
      isEvaluated: false,
    },
  });

  if (pendingSubmissions.length === 0) {
    return { evaluatedCount: 0, message: "No new picks to evaluate." };
  }

  const gameIds = Array.from(new Set(pendingSubmissions.map((s) => s.gameId)));

  // Load finished games from UNHL database
  const dbFinalGames = await prisma.game.findMany({
    where: { id: { in: gameIds }, status: "FINAL" },
    include: {
      goalEvents: { orderBy: [{ period: "asc" }, { seconds: "asc" }, { id: "asc" }] },
      playerStats: { orderBy: [{ points: "desc" }, { goals: "desc" }] },
    },
  });

  const dbGameMap = new Map(dbFinalGames.map((g) => [g.id, g]));

  const subsByTeam = new Map<number, typeof pendingSubmissions>();
  for (const s of pendingSubmissions) {
    if (!subsByTeam.has(s.teamId)) subsByTeam.set(s.teamId, []);
    subsByTeam.get(s.teamId)!.push(s);
  }

  let evaluatedTotal = 0;

  for (const [teamId, subs] of subsByTeam.entries()) {
    const profile = await getOrCreateGamePicksProfile(teamId, season, league);
    let pointsToAdd = 0;
    let currentStreak = profile.currentStreak;
    let bestStreak = profile.bestStreak;
    let jokersUsed = profile.jokersUsed;

    const monthlyMap: Record<string, number> = (profile.monthlyPoints as Record<string, number>) || {};
    const weeklyMap: Record<string, number> = (profile.weeklyPoints as Record<string, number>) || {};

    for (const sub of subs) {
      const dbGame = dbGameMap.get(sub.gameId);
      if (!dbGame) continue; // Game not finished yet in UNHL

      let subPoints = 0;
      const breakdown: Record<string, any> = {};
      const multiplier = sub.isJoker ? 3 : 1;
      if (sub.isJoker) jokersUsed = Math.min(5, jokersUsed + 1);

      // Evaluate Regulation 1/X/2
      const isDbDraw = dbGame.endedIn === "OT" || dbGame.endedIn === "SO";
      let realWinnerId: number | null = null;
      if (isDbDraw) {
        realWinnerId = 0; // Draw (X)
      } else if (typeof dbGame.homeGoals === "number" && typeof dbGame.awayGoals === "number") {
        realWinnerId = dbGame.homeGoals > dbGame.awayGoals ? dbGame.homeTeamId : dbGame.awayTeamId;
      } else {
        realWinnerId = dbGame.winnerTeamId ?? null;
      }

      const isWinnerCorrect = Boolean(
        sub.winnerTeamId !== undefined &&
        sub.winnerTeamId !== null &&
        realWinnerId !== null &&
        sub.winnerTeamId === realWinnerId
      );

      if (!sub.isGameOfTheWeek) {
        // Daily Pick
        if (isWinnerCorrect) {
          const pts = 2 * multiplier;
          subPoints += pts;
          breakdown.winner = { correct: true, points: pts, multiplier };

          currentStreak++;
          if (currentStreak === 3) subPoints += 2;
          else if (currentStreak === 5) subPoints += 5;
          else if (currentStreak === 10) subPoints += 15;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          breakdown.winner = { correct: false, points: 0 };
          currentStreak = 0;
        }
      } else {
        // Game of the Week Pick
        let gotwPts = 0;
        if (isWinnerCorrect) {
          gotwPts += 2;
          breakdown.gotwWinner = { correct: true, points: 2 };
        } else {
          breakdown.gotwWinner = { correct: false, points: 0 };
        }

        // Exact Score
        if (sub.predictedScore) {
          const clean = sub.predictedScore.trim().replace(/\s+/g, "");
          const homeG = dbGame.homeGoals ?? 0;
          const awayG = dbGame.awayGoals ?? 0;
          if (clean === `${homeG}:${awayG}` || clean === `${awayG}:${homeG}`) {
            gotwPts += 5;
            breakdown.gotwScore = { correct: true, points: 5, actualScore: `${homeG}:${awayG}` };
          } else {
            breakdown.gotwScore = { correct: false, points: 0, actualScore: `${homeG}:${awayG}` };
          }
        }

        // First Goal Scorer
        if (dbGame.goalEvents && dbGame.goalEvents.length > 0) {
          const firstGoal = dbGame.goalEvents[0];
          if (sub.firstGoalScorerId && firstGoal.scorerId && sub.firstGoalScorerId === firstGoal.scorerId) {
            gotwPts += 5;
            breakdown.gotwFirstGoal = { correct: true, points: 5, player: firstGoal.scorerName };
          } else {
            breakdown.gotwFirstGoal = { correct: false, points: 0, actual: firstGoal.scorerName };
          }
        }

        // Top Scorer in Game (Most points)
        if (sub.topScorerPlayerId && dbGame.playerStats && dbGame.playerStats.length > 0) {
          const maxPts = Math.max(0, ...dbGame.playerStats.map((p) => p.points || 0));
          if (maxPts > 0) {
            const topScorers = dbGame.playerStats.filter((p) => (p.points || 0) === maxPts);
            const topScorerIds = topScorers.map((p) => p.playerId);
            if (topScorerIds.includes(sub.topScorerPlayerId)) {
              gotwPts += 3;
              breakdown.gotwTopScorer = { correct: true, points: 3, maxPoints: maxPts };
            } else {
              breakdown.gotwTopScorer = { correct: false, points: 0, maxPoints: maxPts };
            }
          }
        }

        subPoints += gotwPts * multiplier;
        if (isWinnerCorrect) {
          currentStreak++;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      await prisma.gamePickSubmission.update({
        where: { id: sub.id },
        data: {
          pointsAwarded: subPoints,
          isEvaluated: true,
          breakdown,
        },
      });

      pointsToAdd += subPoints;
      evaluatedTotal++;

      const monthKey = new Date().toISOString().slice(0, 7);
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + subPoints;
      const weekKey = pickWeekKey(new Date());
      weeklyMap[weekKey] = (weeklyMap[weekKey] || 0) + subPoints;
    }

    await prisma.gamePicksProfile.update({
      where: { id: profile.id },
      data: {
        totalPoints: profile.totalPoints + pointsToAdd,
        currentStreak,
        bestStreak,
        jokersUsed,
        monthlyPoints: monthlyMap,
        weeklyPoints: weeklyMap,
      },
    });
  }

  return {
    evaluatedCount: evaluatedTotal,
    message: `Successfully evaluated ${evaluatedTotal} UNHL game picks.`,
  };
}
