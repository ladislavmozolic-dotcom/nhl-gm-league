import { prisma } from "@/lib/prisma";
import { REGULAR_SEASON } from "@/lib/phase";

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

/** Fetch live real NHL schedule from api-web.nhle.com with local database fallback */
async function fetchRealNhlSchedule(): Promise<any[]> {
  try {
    const res = await fetch("https://api-web.nhle.com/v1/schedule/now", {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const games: any[] = [];

    const gameWeeks = data.gameWeek || [];
    for (const week of gameWeeks) {
      for (const g of week.games || []) {
        games.push({
          id: g.id,
          startTimeUTC: g.startTimeUTC,
          gameDate: g.startTimeUTC ? new Date(g.startTimeUTC) : null,
          gameState: g.gameState,
          homeAbbrev: g.homeTeam?.abbrev,
          awayAbbrev: g.awayTeam?.abbrev,
          homeScore: g.homeTeam?.score ?? null,
          awayScore: g.awayTeam?.score ?? null,
          venue: g.venue?.default || "NHL Arena",
        });
      }
    }
    return games;
  } catch (err) {
    console.warn("Failed to fetch real NHL schedule from api-web.nhle.com:", err);
    return [];
  }
}

export async function getGamePicksData(season = REGULAR_SEASON, league = "NHL", viewerTeamId?: number | null) {
  const [config, teams, players, allProfiles, realNhlGames] = await Promise.all([
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
    fetchRealNhlSchedule(),
  ]);

  const teamByCode = new Map<string, typeof teams[0]>();
  for (const tm of teams) {
    if (tm.code) teamByCode.set(tm.code.toUpperCase(), tm);
    if (tm.name) teamByCode.set(tm.name.toUpperCase(), tm);
  }

  const now = new Date();
  let mappedGames: any[] = [];

  // Map real NHL schedule games to our teams
  if (realNhlGames.length > 0) {
    mappedGames = realNhlGames
      .map((rg, idx) => {
        const homeTm = teamByCode.get(rg.homeAbbrev?.toUpperCase());
        const awayTm = teamByCode.get(rg.awayAbbrev?.toUpperCase());

        if (!homeTm || !awayTm) return null;

        const isFinal = rg.gameState === "FINAL" || rg.gameState === "OFF";
        const isLocked = isFinal || (rg.gameDate ? now > rg.gameDate : false);

        let winnerTeamId: number | null = null;
        if (isFinal && typeof rg.homeScore === "number" && typeof rg.awayScore === "number") {
          winnerTeamId = rg.homeScore > rg.awayScore ? homeTm.id : awayTm.id;
        }

        return {
          id: rg.id,
          season,
          league,
          round: 1,
          gameDate: rg.gameDate,
          status: isFinal ? "FINAL" : "SCHEDULED",
          homeTeamId: homeTm.id,
          awayTeamId: awayTm.id,
          homeTeam: homeTm,
          awayTeam: awayTm,
          homeGoals: rg.homeScore,
          awayGoals: rg.awayScore,
          winnerTeamId,
          isLocked,
          isHomeUpset: config.upsetTeamIds.includes(homeTm.id),
          isAwayUpset: config.upsetTeamIds.includes(awayTm.id),
        };
      })
      .filter(Boolean);
  }

  // Fallback: If NHL API returned nothing, use database scheduled games
  if (mappedGames.length === 0) {
    const dbGames = await prisma.game.findMany({
      where: { season, league, seriesId: null, status: "SCHEDULED" },
      take: 20,
      orderBy: [{ round: "asc" }, { gameDate: "asc" }, { id: "asc" }],
      include: {
        homeTeam: { select: { id: true, name: true, code: true, logoUrl: true, gm: true, gmNickname: true } },
        awayTeam: { select: { id: true, name: true, code: true, logoUrl: true, gm: true, gmNickname: true } },
      },
    });

    mappedGames = dbGames.map((g) => ({
      ...g,
      isLocked: g.status === "FINAL" || (g.gameDate ? now > g.gameDate : false),
      isHomeUpset: config.upsetTeamIds.includes(g.homeTeamId),
      isAwayUpset: config.upsetTeamIds.includes(g.awayTeamId),
    }));
  }

  // Identify today's games (within the active game night / 20 hours from first scheduled game)
  const scheduledGames = mappedGames.filter((g) => g.status === "SCHEDULED");
  const firstGameTime = scheduledGames[0]?.gameDate ? new Date(scheduledGames[0].gameDate).getTime() : now.getTime();
  const gameNightEndTime = firstGameTime + 20 * 60 * 60 * 1000;

  const todayGames = scheduledGames.filter((g) => {
    if (!g.gameDate) return true;
    const gTime = new Date(g.gameDate).getTime();
    return gTime >= firstGameTime - 2 * 60 * 60 * 1000 && gTime <= gameNightEndTime;
  });

  // Marquee match of the week (Game of the Week)
  const gotwId = config.gameOfTheWeekId || todayGames[0]?.id || scheduledGames[0]?.id || mappedGames[0]?.id;

  const allGameIds = mappedGames.map((g) => g.id);

  // Load viewer submissions for these real games
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
    players,
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
  const config = await getOrCreateGamePicksConfig(season, league);

  // Find all un-evaluated submissions
  const pendingSubmissions = await prisma.gamePickSubmission.findMany({
    where: {
      season,
      league,
      isEvaluated: false,
    },
  });

  if (pendingSubmissions.length === 0) {
    return { evaluatedCount: 0, message: "Žiadne nové tipy na vyhodnotenie." };
  }

  // Fetch real score data from NHL API for pending games
  const realScoreData: Record<number, any> = {};
  const gameIds = Array.from(new Set(pendingSubmissions.map((s) => s.gameId)));

  for (const gId of gameIds) {
    try {
      const res = await fetch(`https://api-web.nhle.com/v1/gamecenter/${gId}/landing`);
      if (res.ok) {
        const d = await res.json();
        if (d.gameState === "FINAL" || d.gameState === "OFF") {
          realScoreData[gId] = d;
        }
      }
    } catch {
      // Ignore network errors on single games
    }
  }

  // Also check database for finished games
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

    for (const sub of subs) {
      const realData = realScoreData[sub.gameId];
      const dbGame = dbGameMap.get(sub.gameId);

      if (!realData && !dbGame) continue; // Game not finished yet

      let subPoints = 0;
      const breakdown: Record<string, any> = {};
      const multiplier = sub.isJoker ? 3 : 1;
      if (sub.isJoker) jokersUsed = Math.min(5, jokersUsed + 1);

      let isWinnerCorrect = false;

      // Evaluate from Real NHL API Data
      if (realData) {
        const homeScore = realData.homeTeam?.score ?? 0;
        const awayScore = realData.awayTeam?.score ?? 0;
        const homeTeamCode = realData.homeTeam?.abbrev;
        const awayTeamCode = realData.awayTeam?.abbrev;

        const homeTm = await prisma.team.findFirst({ where: { code: homeTeamCode, league } });
        const awayTm = await prisma.team.findFirst({ where: { code: awayTeamCode, league } });

        const realWinnerId = homeScore > awayScore ? homeTm?.id : awayTm?.id;
        isWinnerCorrect = Boolean(sub.winnerTeamId && realWinnerId && sub.winnerTeamId === realWinnerId);

        if (!sub.isGameOfTheWeek) {
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
          // Game of the Week
          let gotwPts = 0;
          if (isWinnerCorrect) {
            gotwPts += 2;
            breakdown.gotwWinner = { correct: true, points: 2 };
          }
          if (sub.predictedScore) {
            const clean = sub.predictedScore.trim().replace(/\s+/g, "");
            if (clean === `${homeScore}:${awayScore}` || clean === `${awayScore}:${homeScore}`) {
              gotwPts += 5;
              breakdown.gotwScore = { correct: true, points: 5 };
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
      } else if (dbGame) {
        // Fallback DB game evaluation
        const realWinner = dbGame.winnerTeamId;
        isWinnerCorrect = Boolean(sub.winnerTeamId && realWinner && sub.winnerTeamId === realWinner);

        if (isWinnerCorrect) {
          const pts = 2 * multiplier;
          subPoints += pts;
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
    }

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
    message: `Úspešne vyhodnotených ${evaluatedTotal} tipov na zápasy podľa výsledkov NHL.`,
  };
}
