"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { REGULAR_SEASON } from "@/lib/phase";
import {
  evaluateGamePicks,
  getOrCreateGamePicksProfile,
  type DailyGamePickInput,
  type GameOfTheWeekPickInput,
} from "@/lib/game-picks-server";

export async function saveDailyGamePicksAction(
  picks: DailyGamePickInput[],
  season = REGULAR_SEASON,
  league = "NHL"
) {
  const teamId = await getTeamSession();
  if (!teamId) {
    return { ok: false, error: "Musíte byť prihlásený ako GM tímu." };
  }

  const now = new Date();
  const profile = await getOrCreateGamePicksProfile(teamId, season, league);

  // Count how many jokers were already used vs how many new ones are requested
  let jokersInRequest = 0;
  for (const p of picks) {
    if (p.isJoker) jokersInRequest++;
  }

  // Get games to verify locks
  const gameIds = picks.map((p) => p.gameId);
  const games = await prisma.game.findMany({
    where: { id: { in: gameIds } },
    select: { id: true, gameDate: true, status: true },
  });

  const gameMap = new Map(games.map((g) => [g.id, g]));

  // Check existing submissions for these games to compute net joker delta
  const existingSubs = await prisma.gamePickSubmission.findMany({
    where: {
      season,
      league,
      teamId,
      gameId: { in: gameIds },
    },
  });
  const existingJokers = existingSubs.filter((s) => s.isJoker).length;
  const netJokerDelta = jokersInRequest - existingJokers;

  if (profile.jokersUsed + netJokerDelta > profile.jokersTotal) {
    return {
      ok: false,
      error: `Prekročený počet Jokerov! Zostáva vám ${profile.jokersTotal - profile.jokersUsed} z ${profile.jokersTotal}.`,
    };
  }

  for (const pick of picks) {
    const g = gameMap.get(pick.gameId);
    if (!g) continue;

    const isLocked = g.status === "FINAL" || (g.gameDate ? now > g.gameDate : false);
    if (isLocked) {
      continue; // Skip locked games
    }

    await prisma.gamePickSubmission.upsert({
      where: {
        season_league_teamId_gameId: {
          season,
          league,
          teamId,
          gameId: pick.gameId,
        },
      },
      update: {
        winnerTeamId: pick.winnerTeamId,
        isJoker: pick.isJoker || false,
        isGameOfTheWeek: false,
        updatedAt: new Date(),
      },
      create: {
        season,
        league,
        teamId,
        gameId: pick.gameId,
        winnerTeamId: pick.winnerTeamId,
        isJoker: pick.isJoker || false,
        isGameOfTheWeek: false,
      },
    });
  }

  revalidatePath("/league/picks");
  revalidatePath("/tools/picks");
  return { ok: true };
}

export async function saveGameOfTheWeekPickAction(
  pick: GameOfTheWeekPickInput,
  season = REGULAR_SEASON,
  league = "NHL"
) {
  const teamId = await getTeamSession();
  if (!teamId) {
    return { ok: false, error: "Musíte byť prihlásený ako GM tímu." };
  }

  const now = new Date();
  const game = await prisma.game.findUnique({
    where: { id: pick.gameId },
    select: { id: true, gameDate: true, status: true },
  });

  if (!game) return { ok: false, error: "Zápas nebol nájdený." };

  const isLocked = game.status === "FINAL" || (game.gameDate ? now > game.gameDate : false);
  if (isLocked) {
    return { ok: false, error: "Tento zápas je už uzamknutý (začal alebo sa skončil)." };
  }

  await prisma.gamePickSubmission.upsert({
    where: {
      season_league_teamId_gameId: {
        season,
        league,
        teamId,
        gameId: pick.gameId,
      },
    },
    update: {
      winnerTeamId: pick.winnerTeamId,
      predictedScore: pick.predictedScore,
      firstGoalScorerId: pick.firstGoalScorerId || null,
      firstGoalScorerName: pick.firstGoalScorerName || null,
      topScorerPlayerId: pick.topScorerPlayerId || null,
      topScorerPlayerName: pick.topScorerPlayerName || null,
      isJoker: pick.isJoker || false,
      isGameOfTheWeek: true,
      updatedAt: new Date(),
    },
    create: {
      season,
      league,
      teamId,
      gameId: pick.gameId,
      winnerTeamId: pick.winnerTeamId,
      predictedScore: pick.predictedScore,
      firstGoalScorerId: pick.firstGoalScorerId || null,
      firstGoalScorerName: pick.firstGoalScorerName || null,
      topScorerPlayerId: pick.topScorerPlayerId || null,
      topScorerPlayerName: pick.topScorerPlayerName || null,
      isJoker: pick.isJoker || false,
      isGameOfTheWeek: true,
    },
  });

  revalidatePath("/league/picks");
  revalidatePath("/tools/picks");
  return { ok: true };
}

export async function evaluateGamePicksAction(season = REGULAR_SEASON, league = "NHL") {
  const admin = await isAdmin();
  if (!admin) return { ok: false, error: "Prístup povolený len administrátorom." };

  const res = await evaluateGamePicks(season, league);
  revalidatePath("/league/picks");
  revalidatePath("/tools/picks");
  return { ok: true, ...res };
}

export async function adminUpdateGamePicksConfigAction(
  data: {
    featuredGameIds?: number[];
    gameOfTheWeekId?: number | null;
    upsetTeamIds?: number[];
    activeWeek?: number;
  },
  season = REGULAR_SEASON,
  league = "NHL"
) {
  const admin = await isAdmin();
  if (!admin) return { ok: false, error: "Prístup povolený len administrátorom." };

  await prisma.gamePicksConfig.upsert({
    where: { season_league: { season, league } },
    update: data,
    create: {
      season,
      league,
      ...data,
    },
  });

  revalidatePath("/league/picks");
  revalidatePath("/tools/picks");
  return { ok: true };
}
