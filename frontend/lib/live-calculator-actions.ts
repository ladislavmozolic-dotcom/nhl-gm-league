"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, getTeamSession } from "./auth";
import {
  getLiveCalculatorConfig,
  updateLiveCalculatorConfig,
  LiveCalcConfigData,
} from "./live-calculator-config";
import { runLiveCalculatorRecompute } from "./live-calculator-engine";
import { runLiveCalculatorGoalieRecompute } from "./live-calculator-goalie-engine";
import { syncLiveCalculatorData } from "./live-calculator-sync";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function fetchLiveCalculatorConfigAction(): Promise<LiveCalcConfigData> {
  return getLiveCalculatorConfig();
}

/** Check if the current user is commissioner or a designated Live Calculator manager. */
export async function canManageLiveCalculator(): Promise<boolean> {
  const teamId = await getTeamSession();
  if (teamId == null) return false;
  if (await isAdmin()) return true;
  const config = await getLiveCalculatorConfig();
  return (config.managerTeamIds ?? []).includes(teamId);
}

export async function saveLiveCalculatorConfigAction(data: Partial<LiveCalcConfigData>) {
  const isFullAdmin = await isAdmin();
  const canManage = isFullAdmin || (await canManageLiveCalculator());
  if (!canManage) {
    throw new Error("Nemáte oprávnenie meniť konfiguráciu kalkulátora.");
  }
  // Only the full league administrator (commissioner) can change manager team assignments
  const updateData = { ...data };
  if (!isFullAdmin && "managerTeamIds" in updateData) {
    delete updateData.managerTeamIds;
  }
  const updated = await updateLiveCalculatorConfig(updateData);
  revalidatePath("/tools/player-calculator");
  return { success: true, config: updated };
}

export async function triggerLiveCalculatorRecomputeAction() {
  if (!(await canManageLiveCalculator())) {
    throw new Error("Nemáte oprávnenie spustiť prepočet kalkulátora.");
  }
  const [skaters, goalies] = await Promise.all([
    runLiveCalculatorRecompute(),
    runLiveCalculatorGoalieRecompute(),
  ]);
  revalidatePath("/tools/player-calculator");
  return {
    success: true,
    totalProcessed: skaters.totalProcessed + goalies.totalProcessed,
    nhlCount: skaters.nhlCount + goalies.nhlCount,
    ahlCount: skaters.ahlCount + goalies.ahlCount,
    skaters,
    goalies,
  };
}

export async function triggerLiveCalculatorSyncAction() {
  if (!(await canManageLiveCalculator())) {
    throw new Error("Nemáte oprávnenie spustiť synchronizáciu dát.");
  }
  const syncResult = await syncLiveCalculatorData();
  const [skaters, goalies] = await Promise.all([
    runLiveCalculatorRecompute(),
    runLiveCalculatorGoalieRecompute(),
  ]);
  revalidatePath("/tools/player-calculator");
  return { success: true, sync: syncResult, recompute: skaters, goalieRecompute: goalies };
}

export type TeamAssignmentItem = {
  id: number;
  name: string;
  code: string | null;
  gmName: string;
  gmEmail: string | null;
};

export async function getAllTeamsForAssignmentAction(): Promise<TeamAssignmentItem[]> {
  if (!(await isAdmin())) {
    return [];
  }
  const teams = await prisma.team.findMany({
    where: { league: "NHL" },
    select: {
      id: true,
      name: true,
      code: true,
      gmFirstName: true,
      gmLastName: true,
      gmNickname: true,
      gmEmail: true,
    },
    orderBy: { name: "asc" },
  });

  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    gmName: t.gmNickname || [t.gmFirstName, t.gmLastName].filter(Boolean).join(" ") || "Bez priradeného GM",
    gmEmail: t.gmEmail,
  }));
}

export type PromotionStatus = {
  hasBackup: boolean;
  backupCount: number;
  totalSkaters: number;
  calculatedSkaters: number;
  totalGoalies: number;
  calculatedGoalies: number;
};

export async function checkIsAdminAction(): Promise<boolean> {
  return isAdmin();
}

export async function checkCanManageAction(): Promise<{ isAdmin: boolean; canManage: boolean }> {
  const isFullAdmin = await isAdmin();
  const canManage = isFullAdmin || (await canManageLiveCalculator());
  return { isAdmin: isFullAdmin, canManage };
}

/**
 * Get current status of STHS backup and promotion readiness for skaters and goalies.
 */
export async function getPromotionStatusAction(): Promise<PromotionStatus> {
  const [totalSkaters, skaterBackupCount, calculatedSkaters, totalGoalies, goalieBackupCount, calculatedGoalies] =
    await Promise.all([
      prisma.player.count({ where: { isGoalie: false } }),
      prisma.player.count({
        where: {
          isGoalie: false,
          sthsBackup: { not: Prisma.DbNull },
        },
      }),
      prisma.player.count({
        where: {
          isGoalie: false,
          liveCalculatorRatings: { not: Prisma.DbNull },
        },
      }),
      prisma.player.count({ where: { isGoalie: true } }),
      prisma.goalieRating.count({
        where: {
          sthsBackup: { not: Prisma.DbNull },
        },
      }),
      prisma.player.count({
        where: {
          isGoalie: true,
          liveCalculatorRatings: { not: Prisma.DbNull },
        },
      }),
    ]);

  return {
    hasBackup: skaterBackupCount > 0 || goalieBackupCount > 0,
    backupCount: skaterBackupCount + goalieBackupCount,
    totalSkaters,
    calculatedSkaters,
    totalGoalies,
    calculatedGoalies,
  };
}

/**
 * Snapshot current player and goalie live ratings into sthsBackup where sthsBackup IS NULL,
 * ensuring the original baseline STHS numbers are permanently preserved.
 */
async function backupLiveSthsIfNeeded(): Promise<number> {
  const skaterResult = await prisma.$executeRawUnsafe(`
    UPDATE "Player"
    SET "sthsBackup" = jsonb_build_object(
      'ck', ck, 'fg', fg, 'di', di, 'sk', sk, 'st', st,
      'en', en, 'du', du, 'ph', ph, 'fo', fo, 'pa', pa,
      'sc', sc, 'df', df, 'ps', ps, 'ex', ex, 'ld', ld, 'mo', mo,
      'overall', overall
    )
    WHERE "sthsBackup" IS NULL AND "isGoalie" = false
  `);

  const goalieResult = await prisma.$executeRawUnsafe(`
    UPDATE "GoalieRating"
    SET "sthsBackup" = jsonb_build_object(
      'sk', sk, 'du', du, 'en', en, 'sz', sz, 'ag', ag,
      'rb', rb, 'sc', sc, 'hs', hs, 'rt', rt, 'ph', ph,
      'ps', ps, 'ex', ex, 'ld', ld, 'mo', mo,
      'overall', overall
    )
    WHERE "sthsBackup" IS NULL
  `);

  return Number(skaterResult) + Number(goalieResult);
}

/**
 * Promote Live Calculator projected ratings into active STHS player ratings.
 * Covers skaters and goalies; Morale (MO) is strictly untouched.
 */
export async function promoteLiveCalculatorRatingsAction(): Promise<{
  success: boolean;
  updatedCount: number;
  backedUpCount: number;
  timestamp: string;
}> {
  if (!(await isAdmin())) {
    throw new Error("Iba administrátor ligy môže aplikovať ratingy do STHS.");
  }

  // 1. Ensure permanent STHS snapshot exists for both skaters and goalies
  const backedUpCount = await backupLiveSthsIfNeeded();

  // 2. Fetch all skaters with calculated live ratings
  const skaters = await prisma.player.findMany({
    where: {
      isGoalie: false,
      liveCalculatorRatings: { not: Prisma.DbNull },
    },
    select: {
      id: true,
      liveCalculatorRatings: true,
    },
  });

  const goalies = await prisma.player.findMany({
    where: {
      isGoalie: true,
      liveCalculatorRatings: { not: Prisma.DbNull },
    },
    select: {
      id: true,
      liveCalculatorRatings: true,
    },
  });

  if (!skaters.length && !goalies.length) {
    throw new Error("Žiadny hráči ani brankári nemajú vypočítané Live ratingy. Najprv spustite prepočet.");
  }

  const CHUNK_SIZE = 100;
  let updatedCount = 0;

  // 3. Promote skaters
  for (let i = 0; i < skaters.length; i += CHUNK_SIZE) {
    const chunk = skaters.slice(i, i + CHUNK_SIZE);

    await prisma.$transaction(async (tx) => {
      for (const p of chunk) {
        const live = p.liveCalculatorRatings as any;
        const proj = live?.projected;
        if (!proj) continue;

        const ovProj = live?.overallProjected ?? undefined;

        const updateData: any = {
          ck: typeof proj.ck === "number" ? proj.ck : undefined,
          fg: typeof proj.fg === "number" ? proj.fg : undefined,
          di: typeof proj.di === "number" ? proj.di : undefined,
          sk: typeof proj.sk === "number" ? proj.sk : undefined,
          st: typeof proj.st === "number" ? proj.st : undefined,
          en: typeof proj.en === "number" ? proj.en : undefined,
          du: typeof proj.du === "number" ? proj.du : undefined,
          ph: typeof proj.ph === "number" ? proj.ph : undefined,
          fo: typeof proj.fo === "number" ? proj.fo : undefined,
          pa: typeof proj.pa === "number" ? proj.pa : undefined,
          sc: typeof proj.sc === "number" ? proj.sc : undefined,
          df: typeof proj.df === "number" ? proj.df : undefined,
          ps: typeof proj.ps === "number" ? proj.ps : undefined,
          ex: typeof proj.ex === "number" ? proj.ex : undefined,
          ld: typeof proj.ld === "number" ? proj.ld : undefined,
          overall: typeof ovProj === "number" ? ovProj : undefined,
        };

        // Update Player table
        await tx.player.update({
          where: { id: p.id },
          data: updateData,
        });

        // Keep SkaterRating table in sync
        await tx.skaterRating.updateMany({
          where: { playerId: p.id },
          data: updateData,
        });

        updatedCount++;
      }
    });
  }

  // 4. Promote goalies
  for (let i = 0; i < goalies.length; i += CHUNK_SIZE) {
    const chunk = goalies.slice(i, i + CHUNK_SIZE);

    await prisma.$transaction(async (tx) => {
      for (const g of chunk) {
        const live = g.liveCalculatorRatings as any;
        const proj = live?.projected;
        if (!proj) continue;

        const ovProj = live?.overallProjected ?? undefined;

        const goalieData: any = {
          sk: typeof proj.sk === "number" ? proj.sk : undefined,
          du: typeof proj.du === "number" ? proj.du : undefined,
          en: typeof proj.en === "number" ? proj.en : undefined,
          sz: typeof proj.sz === "number" ? proj.sz : undefined,
          ag: typeof proj.ag === "number" ? proj.ag : undefined,
          rb: typeof proj.rb === "number" ? proj.rb : undefined,
          sc: typeof proj.sc === "number" ? proj.sc : undefined,
          hs: typeof proj.hs === "number" ? proj.hs : undefined,
          rt: typeof proj.rt === "number" ? proj.rt : undefined,
          ph: typeof proj.ph === "number" ? proj.ph : undefined,
          ps: typeof proj.ps === "number" ? proj.ps : undefined,
          ex: typeof proj.ex === "number" ? proj.ex : undefined,
          ld: typeof proj.ld === "number" ? proj.ld : undefined,
          overall: typeof ovProj === "number" ? ovProj : undefined,
        };

        if (typeof ovProj === "number") {
          await tx.player.update({
            where: { id: g.id },
            data: { overall: ovProj },
          });
        }

        await tx.goalieRating.updateMany({
          where: { playerId: g.id },
          data: goalieData,
        });

        updatedCount++;
      }
    });
  }

  revalidatePath("/tools/player-calculator");
  revalidatePath("/players");
  revalidatePath("/roster");
  revalidatePath("/admin");

  return {
    success: true,
    updatedCount,
    backedUpCount,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Restore original STHS ratings from sthsBackup for all skaters and goalies.
 */
export async function restoreSthsBackupAction(): Promise<{
  success: boolean;
  restoredCount: number;
}> {
  if (!(await isAdmin())) {
    throw new Error("Iba administrátor ligy môže obnoviť ratingy zo zálohy.");
  }

  // Restore Player table for skaters
  const playerResult = await prisma.$executeRawUnsafe(`
    UPDATE "Player" SET
      ck = ("sthsBackup"->>'ck')::int,
      fg = ("sthsBackup"->>'fg')::int,
      di = ("sthsBackup"->>'di')::int,
      sk = ("sthsBackup"->>'sk')::int,
      st = ("sthsBackup"->>'st')::int,
      en = ("sthsBackup"->>'en')::int,
      du = ("sthsBackup"->>'du')::int,
      ph = ("sthsBackup"->>'ph')::int,
      fo = ("sthsBackup"->>'fo')::int,
      pa = ("sthsBackup"->>'pa')::int,
      sc = ("sthsBackup"->>'sc')::int,
      df = ("sthsBackup"->>'df')::int,
      ps = ("sthsBackup"->>'ps')::int,
      ex = ("sthsBackup"->>'ex')::int,
      ld = ("sthsBackup"->>'ld')::int,
      mo = ("sthsBackup"->>'mo')::int,
      overall = ("sthsBackup"->>'overall')::int
    WHERE "sthsBackup" IS NOT NULL AND "isGoalie" = false
  `);

  // Restore SkaterRating table in sync
  await prisma.$executeRawUnsafe(`
    UPDATE "SkaterRating" sr
    SET
      ck = (p."sthsBackup"->>'ck')::int,
      fg = (p."sthsBackup"->>'fg')::int,
      di = (p."sthsBackup"->>'di')::int,
      sk = (p."sthsBackup"->>'sk')::int,
      st = (p."sthsBackup"->>'st')::int,
      en = (p."sthsBackup"->>'en')::int,
      du = (p."sthsBackup"->>'du')::int,
      ph = (p."sthsBackup"->>'ph')::int,
      fo = (p."sthsBackup"->>'fo')::int,
      pa = (p."sthsBackup"->>'pa')::int,
      sc = (p."sthsBackup"->>'sc')::int,
      df = (p."sthsBackup"->>'df')::int,
      ps = (p."sthsBackup"->>'ps')::int,
      ex = (p."sthsBackup"->>'ex')::int,
      ld = (p."sthsBackup"->>'ld')::int,
      mo = (p."sthsBackup"->>'mo')::int,
      overall = (p."sthsBackup"->>'overall')::int
    FROM "Player" p
    WHERE sr."playerId" = p.id AND p."sthsBackup" IS NOT NULL AND p."isGoalie" = false
  `);

  // Restore GoalieRating table
  const goalieResult = await prisma.$executeRawUnsafe(`
    UPDATE "GoalieRating" gr
    SET
      sk = (gr."sthsBackup"->>'sk')::int,
      du = (gr."sthsBackup"->>'du')::int,
      en = (gr."sthsBackup"->>'en')::int,
      sz = (gr."sthsBackup"->>'sz')::int,
      ag = (gr."sthsBackup"->>'ag')::int,
      rb = (gr."sthsBackup"->>'rb')::int,
      sc = (gr."sthsBackup"->>'sc')::int,
      hs = (gr."sthsBackup"->>'hs')::int,
      rt = (gr."sthsBackup"->>'rt')::int,
      ph = (gr."sthsBackup"->>'ph')::int,
      ps = (gr."sthsBackup"->>'ps')::int,
      ex = (gr."sthsBackup"->>'ex')::int,
      ld = (gr."sthsBackup"->>'ld')::int,
      mo = (gr."sthsBackup"->>'mo')::int,
      overall = (gr."sthsBackup"->>'overall')::int
    WHERE gr."sthsBackup" IS NOT NULL
  `);

  // Restore Player.overall for goalies
  await prisma.$executeRawUnsafe(`
    UPDATE "Player" p
    SET overall = (gr."sthsBackup"->>'overall')::int
    FROM "GoalieRating" gr
    WHERE p.id = gr."playerId" AND gr."sthsBackup" IS NOT NULL
  `);

  revalidatePath("/tools/player-calculator");
  revalidatePath("/players");
  revalidatePath("/roster");
  revalidatePath("/admin");

  return {
    success: true,
    restoredCount: Number(playerResult) + Number(goalieResult),
  };
}

