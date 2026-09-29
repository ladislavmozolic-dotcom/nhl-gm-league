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
export async function fetchRealNhlSchedule(): Promise<any[]> {
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
          periodDescriptor: g.periodDescriptor,
          gameOutcome: g.gameOutcome,
        });
      }
    }
    return games;
  } catch (err) {
    console.warn("Failed to fetch real NHL schedule from api-web.nhle.com:", err);
    return [];
  }
}

/** Cache for real NHL rosters in memory */
let realRosterCache: { timestamp: number; players: any[] } | null = null;

async function fetchRealNhlRostersForTeams(
  teams: { id: number; code: string | null; name: string }[]
): Promise<any[]> {
  const now = Date.now();
  if (realRosterCache && now - realRosterCache.timestamp < 60 * 60 * 1000 && realRosterCache.players.length > 0) {
    return realRosterCache.players;
  }

  try {
    const realPlayers: any[] = [];
    await Promise.all(
      teams.map(async (t) => {
        if (!t.code) return;
        try {
          const code = t.code.toUpperCase();
          const res = await fetch(`https://api-web.nhle.com/v1/roster/${code}/current`, {
            next: { revalidate: 3600 },
          });
          if (!res.ok) return;
          const data = await res.json();
          const all = [
            ...(data.forwards || []),
            ...(data.defensemen || []),
            ...(data.goalies || []),
          ];
          for (const p of all) {
            const firstName = p.firstName?.default || "";
            const lastName = p.lastName?.default || "";
            const fullName = `${firstName} ${lastName}`.trim();
            const rawPos = p.positionCode || "F";
            const pos = rawPos === "L" ? "LW" : rawPos === "R" ? "RW" : rawPos;
            const isGoalie = pos === "G";
            const photoUrl = p.headshot || `https://assets.nhle.com/mugs/nhl/latest/${p.id}.png`;

            realPlayers.push({
              id: p.id,
              name: fullName,
              position: pos,
              teamId: t.id,
              isGoalie,
              photoUrl,
            });
          }
        } catch {
          // ignore single team roster fetch error
        }
      })
    );

    if (realPlayers.length > 0) {
      realRosterCache = { timestamp: now, players: realPlayers };
      return realPlayers;
    }
  } catch (err) {
    console.warn("Failed to fetch real NHL rosters:", err);
  }

  return [];
}

export async function getGamePicksData(season = REGULAR_SEASON, league = "NHL", viewerTeamId?: number | null) {
  const [config, teams, dbPlayers, allProfiles, realNhlGames] = await Promise.all([
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

  // Fetch real NHL rosters for all teams
  const realPlayers = await fetchRealNhlRostersForTeams(teams);
  const activePlayers = realPlayers.length > 0 ? realPlayers : dbPlayers;

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
          const lastPeriodType = rg.gameOutcome?.lastPeriodType || rg.periodDescriptor?.periodType;
          const isDraw = lastPeriodType === "OT" || lastPeriodType === "SO" || (rg.periodDescriptor?.number && rg.periodDescriptor.number > 3);
          if (isDraw) {
            winnerTeamId = 0; // Remíza (X)
          } else {
            winnerTeamId = rg.homeScore > rg.awayScore ? homeTm.id : awayTm.id;
          }
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

  // Calculate current week range (Monday 00:00 to Sunday 23:59:59)
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // Filter games occurring within the current week
  const weekGames = mappedGames.filter((g) => {
    if (!g.gameDate) return false;
    const gd = new Date(g.gameDate);
    return gd >= monday && gd <= sunday;
  });

  const RIVALRIES = new Set([
    "MTL-TOR", "TOR-MTL", "NYR-BOS", "BOS-NYR", "EDM-CGY", "CGY-EDM",
    "PIT-PHI", "PHI-PIT", "EDM-VAN", "VAN-EDM", "FLA-TBL", "TBL-FLA",
    "COL-VGK", "VGK-COL", "NYR-NJD", "NJD-NYR", "TOR-BOS", "BOS-TOR",
    "CAR-FLA", "FLA-CAR", "DAL-COL", "COL-DAL", "WSH-PIT", "PIT-WSH",
    "CHI-DET", "DET-CHI", "NYI-NYR", "NYR-NYI", "CGY-VAN", "VAN-CGY",
    "LAK-SJS", "SJS-LAK", "LAK-ANA", "ANA-LAK", "COL-EDM", "EDM-COL",
  ]);

  const candidatePool = weekGames.length > 0 ? weekGames : mappedGames;
  const scoredGames = candidatePool.map((g) => {
    let score = 0;
    if (g.gameDate) {
      const d = new Date(g.gameDate);
      const dow = d.getDay();
      if (dow === 6) score += 40; // Saturday prime time
      else if (dow === 0) score += 25; // Sunday showcase
      else if (dow === 5) score += 15; // Friday night
    }

    const hCode = g.homeTeam?.code?.toUpperCase() || "";
    const aCode = g.awayTeam?.code?.toUpperCase() || "";
    if (hCode && aCode && RIVALRIES.has(`${aCode}-${hCode}`)) {
      score += 45;
    }
    if (g.isHomeUpset || g.isAwayUpset) score += 10;
    return { game: g, score };
  });

  // Sort descending by score, then by gameDate ascending
  scoredGames.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const tA = a.game.gameDate ? new Date(a.game.gameDate).getTime() : 0;
    const tB = b.game.gameDate ? new Date(b.game.gameDate).getTime() : 0;
    return tA - tB;
  });

  // Find top upcoming scheduled game chosen by AI
  const topScheduledCandidate = scoredGames.find((sg) => sg.game.status === "SCHEDULED" && !sg.game.isLocked)?.game;
  const bestCandidate = topScheduledCandidate || scoredGames[0]?.game;

  let gotwId =
    config.gameOfTheWeekId && mappedGames.some((g) => g.id === config.gameOfTheWeekId)
      ? config.gameOfTheWeekId
      : null;

  // If no GOTW is currently active or previous GOTW is finished/not found, AI picks the most interesting game of the week
  if (!gotwId && bestCandidate) {
    gotwId = bestCandidate.id;
    // Persist AI selection to DB so everyone in the league has the exact same GOTW
    await prisma.gamePicksConfig.update({
      where: { season_league: { season, league } },
      data: { gameOfTheWeekId: gotwId },
    }).catch(() => {});
  }

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
    players: activePlayers,
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

        const lastPeriodType = realData.gameOutcome?.lastPeriodType || realData.periodDescriptor?.periodType;
        const isRegulationDraw = lastPeriodType === "OT" || lastPeriodType === "SO" || (realData.periodDescriptor?.number && realData.periodDescriptor.number > 3);

        let realWinnerId: number | null = null;
        if (isRegulationDraw) {
          realWinnerId = 0; // Remíza (X)
        } else if (homeScore > awayScore) {
          realWinnerId = homeTm?.id || null;
        } else if (awayScore > homeScore) {
          realWinnerId = awayTm?.id || null;
        }

        isWinnerCorrect = Boolean(sub.winnerTeamId !== undefined && sub.winnerTeamId !== null && realWinnerId !== null && sub.winnerTeamId === realWinnerId);

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

          // Real First Goal Scorer
          let realFirstGoalPlayerId: number | null = null;
          let realFirstGoalPlayerName: string | null = null;
          if (realData.summary?.scoring && Array.isArray(realData.summary.scoring)) {
            for (const period of realData.summary.scoring) {
              if (period.goals && period.goals.length > 0) {
                const g0 = period.goals[0];
                realFirstGoalPlayerId = g0.playerId || null;
                realFirstGoalPlayerName = g0.name?.default || `${g0.firstName?.default || ""} ${g0.lastName?.default || ""}`.trim();
                break;
              }
            }
          }

          if (sub.firstGoalScorerId && realFirstGoalPlayerId) {
            if (sub.firstGoalScorerId === realFirstGoalPlayerId) {
              gotwPts += 5;
              breakdown.gotwFirstGoal = { correct: true, points: 5, player: realFirstGoalPlayerName };
            } else {
              breakdown.gotwFirstGoal = { correct: false, points: 0, actual: realFirstGoalPlayerName };
            }
          }

          // Real Top Scorer in Game (Most points)
          if (sub.topScorerPlayerId) {
            try {
              const boxRes = await fetch(`https://api-web.nhle.com/v1/gamecenter/${sub.gameId}/boxscore`);
              if (boxRes.ok) {
                const boxData = await boxRes.json();
                const stats = boxData.playerByGameStats || {};
                const allSkaters = [
                  ...(stats.homeTeam?.forwards || []),
                  ...(stats.homeTeam?.defense || []),
                  ...(stats.awayTeam?.forwards || []),
                  ...(stats.awayTeam?.defense || []),
                ];
                const maxPts = Math.max(0, ...allSkaters.map((p: any) => p.points || 0));
                if (maxPts > 0) {
                  const topScorerIds = allSkaters.filter((p: any) => p.points === maxPts).map((p: any) => p.playerId);
                  const topScorerNames = allSkaters.filter((p: any) => p.points === maxPts).map((p: any) => p.name?.default || "");
                  if (topScorerIds.includes(sub.topScorerPlayerId)) {
                    gotwPts += 3;
                    breakdown.gotwTopScorer = { correct: true, points: 3, maxPoints: maxPts, leaders: topScorerNames.join(", ") };
                  } else {
                    breakdown.gotwTopScorer = { correct: false, points: 0, maxPoints: maxPts, leaders: topScorerNames.join(", ") };
                  }
                }
              }
            } catch {
              // Ignore boxscore network error
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
        const isDbDraw = dbGame.endedIn === "OT" || dbGame.endedIn === "SO";
        let realWinner: number | null = null;
        if (isDbDraw) {
          realWinner = 0; // Remíza (X)
        } else {
          realWinner = dbGame.winnerTeamId;
        }
        isWinnerCorrect = Boolean(sub.winnerTeamId !== undefined && sub.winnerTeamId !== null && realWinner !== null && sub.winnerTeamId === realWinner);

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
