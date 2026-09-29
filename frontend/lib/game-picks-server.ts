import { prisma } from "@/lib/prisma";
import { REGULAR_SEASON } from "@/lib/phase";

export type DailyGamePickInput = {
  gameId: number;
  winnerTeamId: number;
  confidence?: number; // 1 | 2 | 3
  isUpsetPick?: boolean;
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
    // Auto-select initial featured games and game of the week
    const upcomingGames = await prisma.game.findMany({
      where: { season, league, seriesId: null },
      orderBy: [{ round: "asc" }, { gameDate: "asc" }, { id: "asc" }],
      take: 30,
      select: { id: true, homeTeamId: true, awayTeamId: true, gameDate: true, round: true },
    });

    const featuredGameIds = upcomingGames.slice(0, 12).map((g) => g.id);
    const gameOfTheWeekId = upcomingGames.length > 0 ? upcomingGames[0].id : null;

    // Get bottom 40% teams by standings / initial ranking as upset eligible
    const allTeams = await prisma.team.findMany({
      where: { league, isAffiliate: false },
      select: { id: true },
    });
    const upsetTeamIds = allTeams.slice(Math.floor(allTeams.length * 0.6)).map((t) => t.id);

    config = await prisma.gamePicksConfig.create({
      data: {
        season,
        league,
        featuredGameIds,
        gameOfTheWeekId,
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
  const [config, teams, players, allProfiles] = await Promise.all([
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
  ]);

  // Load featured games and recent games
  const featuredIds = config.featuredGameIds || [];
  const gotwId = config.gameOfTheWeekId;
  const allGameIdsToFetch = Array.from(new Set([...featuredIds, ...(gotwId ? [gotwId] : [])]));

  const games = await prisma.game.findMany({
    where: {
      OR: [
        { id: { in: allGameIdsToFetch } },
        {
          season,
          league,
          seriesId: null,
          status: "SCHEDULED",
        },
      ],
    },
    take: 40,
    orderBy: [{ round: "asc" }, { gameDate: "asc" }, { id: "asc" }],
    include: {
      homeTeam: { select: { id: true, name: true, code: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, code: true, logoUrl: true } },
      goalEvents: {
        orderBy: [{ period: "asc" }, { seconds: "asc" }, { id: "asc" }],
        take: 1,
      },
      playerStats: {
        orderBy: [{ points: "desc" }, { goals: "desc" }],
        take: 3,
      },
    },
  });

  const now = new Date();

  // Load viewer submissions
  const viewerSubmissions = viewerTeamId
    ? await prisma.gamePickSubmission.findMany({
        where: { season, league, teamId: viewerTeamId },
      })
    : [];

  const viewerProfile = viewerTeamId ? await getOrCreateGamePicksProfile(viewerTeamId, season, league) : null;

  // Identify Rival for viewerTeam if pairings exist
  let currentRival: any = null;
  const pairings = (config.rivalPairings as RivalPairing[]) || [];
  if (viewerTeamId && pairings.length > 0) {
    const p = pairings.find((pair) => pair.teamAId === viewerTeamId || pair.teamBId === viewerTeamId);
    if (p) {
      const rivalId = p.teamAId === viewerTeamId ? p.teamBId : p.teamAId;
      const rivalTeam = teams.find((t) => t.id === rivalId);
      const rivalProfile = allProfiles.find((ap) => ap.teamId === rivalId);
      const duelGames = games.filter((g) => p.gameIds.includes(g.id));

      currentRival = {
        week: p.week,
        rivalTeam,
        rivalProfile,
        duelGames,
      };
    }
  }

  return {
    config,
    teams,
    players,
    games: games.map((g) => ({
      ...g,
      isLocked: g.status === "FINAL" || (g.gameDate ? now > g.gameDate : false),
      isGameOfTheWeek: g.id === gotwId,
      isFeatured: featuredIds.includes(g.id),
      isHomeUpset: config.upsetTeamIds.includes(g.homeTeamId),
      isAwayUpset: config.upsetTeamIds.includes(g.awayTeamId),
    })),
    viewerProfile,
    viewerSubmissions,
    leaderboard: allProfiles,
    currentRival,
  };
}

export async function evaluateGamePicks(season = REGULAR_SEASON, league = "NHL") {
  const config = await getOrCreateGamePicksConfig(season, league);

  // Find all evaluated final games
  const finalGames = await prisma.game.findMany({
    where: { season, league, status: "FINAL" },
    include: {
      goalEvents: {
        orderBy: [{ period: "asc" }, { seconds: "asc" }, { id: "asc" }],
      },
      playerStats: {
        orderBy: [{ points: "desc" }, { goals: "desc" }],
      },
    },
  });

  const finalGameMap = new Map(finalGames.map((g) => [g.id, g]));

  // Find all un-evaluated submissions for final games
  const pendingSubmissions = await prisma.gamePickSubmission.findMany({
    where: {
      season,
      league,
      gameId: { in: Array.from(finalGameMap.keys()) },
      isEvaluated: false,
    },
  });

  if (pendingSubmissions.length === 0) {
    return { evaluatedCount: 0, message: "Žiadne nové zápasy na vyhodnotenie." };
  }

  // Group submissions by teamId
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

    for (const sub of subs) {
      const game = finalGameMap.get(sub.gameId);
      if (!game) continue;

      let subPoints = 0;
      const breakdown: Record<string, any> = {};

      const realWinner = game.winnerTeamId;
      const isWinnerCorrect = sub.winnerTeamId && realWinner && sub.winnerTeamId === realWinner;

      const multiplier = sub.isJoker ? 3 : 1;
      if (sub.isJoker) jokersUsed = Math.min(5, jokersUsed + 1);

      // 1. Regular Pick / Game of the Day
      if (!sub.isGameOfTheWeek) {
        if (isWinnerCorrect) {
          const conf = sub.confidence || 2;
          const pts = conf * multiplier;
          subPoints += pts;
          breakdown.winner = { correct: true, points: pts, conf, multiplier };

          // Upset Bonus (+5 b)
          if (sub.isUpsetPick && config.upsetTeamIds.includes(sub.winnerTeamId!)) {
            subPoints += 5;
            breakdown.upset = { correct: true, points: 5 };
          }

          // Streak increment
          currentStreak++;
          if (currentStreak === 3) {
            subPoints += 2;
            breakdown.streakBonus = { streak: 3, points: 2 };
          } else if (currentStreak === 5) {
            subPoints += 5;
            breakdown.streakBonus = { streak: 5, points: 5 };
          } else if (currentStreak === 10) {
            subPoints += 15;
            breakdown.streakBonus = { streak: 10, points: 15 };
          }
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          breakdown.winner = { correct: false, points: 0 };
          currentStreak = 0; // Streak reset
        }
      } else {
        // 2. Game of the Week (Max 15 b * multiplier)
        let gotwPoints = 0;

        // Winner (+2 b)
        if (isWinnerCorrect) {
          gotwPoints += 2;
          breakdown.gotwWinner = { correct: true, points: 2 };
        }

        // Exact Score (+5 b)
        if (sub.predictedScore) {
          const cleanPick = sub.predictedScore.trim().replace(/\s+/g, "");
          const realScoreA = `${game.homeGoals}:${game.awayGoals}`;
          const realScoreB = `${game.awayGoals}:${game.homeGoals}`;
          if (cleanPick === realScoreA || cleanPick === realScoreB) {
            gotwPoints += 5;
            breakdown.gotwScore = { correct: true, points: 5 };
          }
        }

        // First Goal Scorer (+5 b)
        if (sub.firstGoalScorerId || sub.firstGoalScorerName) {
          const firstGoal = game.goalEvents[0];
          if (firstGoal) {
            const matched =
              (sub.firstGoalScorerId && sub.firstGoalScorerId === firstGoal.scorerId) ||
              (sub.firstGoalScorerName &&
                firstGoal.scorerName &&
                sub.firstGoalScorerName.toLowerCase() === firstGoal.scorerName.toLowerCase());
            if (matched) {
              gotwPoints += 5;
              breakdown.gotwFirstGoal = { correct: true, points: 5 };
            }
          }
        }

        // Top Scorer in game (+3 b)
        if (sub.topScorerPlayerId || sub.topScorerPlayerName) {
          const topStat = game.playerStats[0];
          if (topStat) {
            const matched = sub.topScorerPlayerId && sub.topScorerPlayerId === topStat.playerId;
            if (matched) {
              gotwPoints += 3;
              breakdown.gotwTopScorer = { correct: true, points: 3 };
            }
          }
        }

        subPoints += gotwPoints * multiplier;
        breakdown.gotwMultiplier = multiplier;

        if (isWinnerCorrect) {
          currentStreak++;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      // Update submission record
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

      // Monthly points accumulation
      const monthKey = game.gameDate ? game.gameDate.toISOString().slice(0, 7) : "2026-10";
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + subPoints;
    }

    // Update GM Profile
    await prisma.gamePicksProfile.update({
      where: { id: profile.id },
      data: {
        totalPoints: profile.totalPoints + pointsToAdd,
        currentStreak,
        bestStreak,
        jokersUsed,
        monthlyPoints: monthlyMap,
      },
    });
  }

  return {
    evaluatedCount: evaluatedTotal,
    message: `Úspešne vyhodnotených ${evaluatedTotal} tipov na zápasy.`,
  };
}
