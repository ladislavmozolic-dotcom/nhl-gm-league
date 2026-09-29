"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { REGULAR_SEASON } from "@/lib/phase";
import {
  evaluateGamePicks,
  getOrCreateGamePicksProfile,
  getOrCreateGamePicksConfig,
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

  // Get games to verify locks and schedule
  const gameIds = picks.map((p) => p.gameId);

  const dbGames = await prisma.game.findMany({
    where: { id: { in: gameIds } },
    select: { id: true, gameDate: true, status: true },
  });
  const dbGameMap = new Map(dbGames.map((g) => [g.id, g]));

  // Check existing submissions for these games - once submitted, daily picks are permanently locked
  const existingSubs = await prisma.gamePickSubmission.findMany({
    where: {
      season,
      league,
      teamId,
      gameId: { in: gameIds },
      isGameOfTheWeek: false,
    },
  });
  const existingGameIdSet = new Set(existingSubs.map((s) => s.gameId));

  // Filter out any already submitted picks so they cannot be overwritten
  const newPicks = picks.filter((p) => !existingGameIdSet.has(p.gameId));
  if (newPicks.length === 0) {
    return { ok: false, error: "Všetky vybrané zápasy už boli natipované a sú uzamknuté." };
  }

  // Count how many jokers are in the new request
  let newJokersInRequest = 0;
  for (const p of newPicks) {
    if (p.isJoker) newJokersInRequest++;
  }

  if (profile.jokersUsed + newJokersInRequest > profile.jokersTotal) {
    return {
      ok: false,
      error: `Prekročený počet Jokerov! Zostáva vám ${profile.jokersTotal - profile.jokersUsed} z ${profile.jokersTotal}.`,
    };
  }

  for (const pick of newPicks) {
    const dg = dbGameMap.get(pick.gameId);
    if (!dg) continue;

    const isLocked = dg.status === "FINAL" || (dg.gameDate ? now > dg.gameDate : false);
    if (isLocked) {
      continue; // Skip locked games
    }

    await prisma.gamePickSubmission.create({
      data: {
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

  let config = await getOrCreateGamePicksConfig(season, league);
  if (!config.gameOfTheWeekId) {
    await prisma.gamePicksConfig.update({
      where: { season_league: { season, league } },
      data: { gameOfTheWeekId: pick.gameId },
    }).catch(() => {});
    config.gameOfTheWeekId = pick.gameId;
  } else if (config.gameOfTheWeekId !== pick.gameId) {
    return { ok: false, error: "Zápas týždňa bol zmenený. Prosím obnovte stránku pre aktuálny zápas." };
  }

  const now = new Date();
  const dbGame = await prisma.game.findUnique({
    where: { id: pick.gameId },
    select: { id: true, gameDate: true, status: true },
  });

  if (!dbGame) {
    return { ok: false, error: "Zápas nebol nájdený." };
  }

  const isLocked = dbGame.status === "FINAL" || (dbGame.gameDate ? now > dbGame.gameDate : false);
  if (isLocked) {
    return { ok: false, error: "Tento zápas je už uzamknutý (začal alebo sa skončil)." };
  }

  // Check if GOTW was already submitted - once submitted, it is permanently locked
  const existingSub = await prisma.gamePickSubmission.findUnique({
    where: {
      season_league_teamId_gameId_isGameOfTheWeek: {
        season,
        league,
        teamId,
        gameId: pick.gameId,
        isGameOfTheWeek: true,
      },
    },
  });

  if (existingSub) {
    return { ok: false, error: "Tip na Zápas týždňa už bol odoslaný a je uzamknutý bez možnosti úprav." };
  }

  // Check profile joker count
  const profile = await getOrCreateGamePicksProfile(teamId, season, league);
  if (pick.isJoker) {
    if (profile.jokersUsed + 1 > profile.jokersTotal) {
      return {
        ok: false,
        error: `Prekročený počet Jokerov! Zostáva vám ${profile.jokersTotal - profile.jokersUsed} z ${profile.jokersTotal}.`,
      };
    }
  }

  await prisma.gamePickSubmission.create({
    data: {
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

export async function adminAutoSelectGotwAction(season = REGULAR_SEASON, league = "NHL") {
  const admin = await isAdmin();
  if (!admin) return { ok: false, error: "Prístup povolený len administrátorom." };

  // Reset gameOfTheWeekId so getGamePicksData automatically calculates the best game
  await prisma.gamePicksConfig.updateMany({
    where: { season, league },
    data: { gameOfTheWeekId: null },
  });

  const { getGamePicksData } = await import("@/lib/game-picks-server");
  const data = await getGamePicksData(season, league);

  revalidatePath("/league/picks");
  revalidatePath("/tools/picks");
  return { ok: true, gameOfTheWeekId: data.config.gameOfTheWeekId };
}

