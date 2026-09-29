"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { REGULAR_SEASON } from "@/lib/phase";
import {
  getOrCreateSeasonPicksConfig,
  evaluateAllSubmissions,
  type SeasonPicksFormData,
} from "@/lib/season-picks-server";

export async function saveSeasonPicksAction(
  picks: SeasonPicksFormData,
  season = REGULAR_SEASON,
  league = "NHL"
) {
  const teamId = await getTeamSession();
  if (!teamId) {
    return { ok: false, error: "Musíte byť prihlásený ako GM tímu." };
  }

  const admin = await isAdmin();
  const cfg = await getOrCreateSeasonPicksConfig(season, league);

  const now = new Date();
  const isLocked =
    cfg.status === "LOCKED" ||
    cfg.status === "RESOLVED" ||
    (cfg.deadline ? now > cfg.deadline : false);

  if (isLocked && !admin) {
    return {
      ok: false,
      error: "Tipovačka je už uzamknutá po deadline. Tipy nie je možné meniť.",
    };
  }

  // Check if GM already submitted (one submission per GM, no editing allowed)
  const existing = await prisma.seasonPicksSubmission.findUnique({
    where: {
      season_league_teamId: {
        season,
        league,
        teamId,
      },
    },
  });

  if (existing && !admin) {
    return {
      ok: false,
      error: "Tipy ste už odoslali. Každý GM môže tipovať iba raz a odoslané tipy nie je možné meniť.",
    };
  }

  // Validate trophy confidence distribution if trophies provided
  if (picks.trophies && picks.trophies.length > 0) {
    const confCounts = { 1: 0, 2: 0, 3: 0 };
    for (const t of picks.trophies) {
      if (t.confidence === 1 || t.confidence === 2 || t.confidence === 3) {
        confCounts[t.confidence]++;
      }
    }
    if (confCounts[3] > 2 || confCounts[2] > 2 || confCounts[1] > 2) {
      return {
        ok: false,
        error: "Prekročený limit hodnôt Confidence: každú úroveň (1, 2, 3) môžete použiť maximálne 2-krát.",
      };
    }
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { gmNickname: true, gm: true, name: true },
  });

  const submittedBy = team?.gmNickname || team?.gm || team?.name || `Team #${teamId}`;

  await prisma.seasonPicksSubmission.upsert({
    where: {
      season_league_teamId: {
        season,
        league,
        teamId,
      },
    },
    update: {
      picks: picks as any,
      submittedBy,
      updatedAt: new Date(),
    },
    create: {
      season,
      league,
      teamId,
      submittedBy,
      picks: picks as any,
    },
  });

  revalidatePath("/league/picks");
  revalidatePath("/tools/picks");
  return { ok: true };
}

export async function updateSeasonPicksConfigAction(
  data: {
    status?: string;
    deadline?: string | null;
    overUnderQuestions?: any;
    h2hDuels?: any;
    boldStatements?: any;
    officialResults?: any;
  },
  season = REGULAR_SEASON,
  league = "NHL"
) {
  const admin = await isAdmin();
  if (!admin) return { ok: false, error: "Prístup povolený len administrátorom." };

  const updateData: any = {};
  if (data.status) updateData.status = data.status;
  if (data.deadline !== undefined) {
    updateData.deadline = data.deadline ? new Date(data.deadline) : null;
  }
  if (data.overUnderQuestions) updateData.overUnderQuestions = data.overUnderQuestions;
  if (data.h2hDuels) updateData.h2hDuels = data.h2hDuels;
  if (data.boldStatements) updateData.boldStatements = data.boldStatements;
  if (data.officialResults !== undefined) updateData.officialResults = data.officialResults;

  await prisma.seasonPicksConfig.upsert({
    where: { season_league: { season, league } },
    update: updateData,
    create: {
      season,
      league,
      ...updateData,
    },
  });

  revalidatePath("/league/picks");
  revalidatePath("/tools/picks");
  return { ok: true };
}

export async function evaluateSeasonPicksAction(season = REGULAR_SEASON, league = "NHL") {
  const admin = await isAdmin();
  if (!admin) return { ok: false, error: "Prístup povolený len administrátorom." };

  const res = await evaluateAllSubmissions(season, league);
  revalidatePath("/league/picks");
  revalidatePath("/tools/picks");
  return res;
}
