"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "./auth";
import {
  getLiveCalculatorConfig,
  updateLiveCalculatorConfig,
  LiveCalcConfigData,
} from "./live-calculator-config";
import { runLiveCalculatorRecompute } from "./live-calculator-engine";
import { syncLiveCalculatorData } from "./live-calculator-sync";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function fetchLiveCalculatorConfigAction(): Promise<LiveCalcConfigData> {
  return getLiveCalculatorConfig();
}

export async function saveLiveCalculatorConfigAction(data: Partial<LiveCalcConfigData>) {
  if (!(await isAdmin())) {
    throw new Error("Iba administrátor ligy môže meniť konfiguráciu kalkulátora.");
  }
  const updated = await updateLiveCalculatorConfig(data);
  revalidatePath("/tools/player-calculator");
  return { success: true, config: updated };
}

export async function triggerLiveCalculatorRecomputeAction() {
  if (!(await isAdmin())) {
    throw new Error("Iba administrátor ligy môže spustiť prepočet kalkulátora.");
  }
  const result = await runLiveCalculatorRecompute();
  revalidatePath("/tools/player-calculator");
  return { success: true, ...result };
}

export async function triggerLiveCalculatorSyncAction() {
  if (!(await isAdmin())) {
    throw new Error("Iba administrátor ligy môže spustiť synchronizáciu dát.");
  }
  const syncResult = await syncLiveCalculatorData();
  const recomputeResult = await runLiveCalculatorRecompute();
  revalidatePath("/tools/player-calculator");
  return { success: true, sync: syncResult, recompute: recomputeResult };
}

export type PromotionStatus = {
  hasBackup: boolean;
  backupCount: number;
  totalSkaters: number;
  calculatedSkaters: number;
};

export async function checkIsAdminAction(): Promise<boolean> {
  return isAdmin();
}

/**
 * Get current status of STHS backup and promotion readiness.
 */
export async function getPromotionStatusAction(): Promise<PromotionStatus> {
  const [totalSkaters, backupCount, calculatedSkaters] = await Promise.all([
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
  ]);

  return {
    hasBackup: backupCount > 0,
    backupCount,
    totalSkaters,
    calculatedSkaters,
  };
}

/**
 * Snapshot current player live ratings into sthsBackup where sthsBackup IS NULL,
 * ensuring the original baseline STHS numbers are permanently preserved.
 */
async function backupLiveSthsIfNeeded(): Promise<number> {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "Player"
    SET "sthsBackup" = jsonb_build_object(
      'ck', ck, 'fg', fg, 'di', di, 'sk', sk, 'st', st,
      'en', en, 'du', du, 'ph', ph, 'fo', fo, 'pa', pa,
      'sc', sc, 'df', df, 'ps', ps, 'ex', ex, 'ld', ld, 'mo', mo,
      'overall', overall
    )
    WHERE "sthsBackup" IS NULL AND "isGoalie" = false
  `);
  return Number(result);
}

/**
 * Promote Live Calculator projected ratings into active STHS player ratings.
 * Skaters only; Morale (MO) is untouched.
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

  // 1. Ensure permanent STHS snapshot exists
  const backedUpCount = await backupLiveSthsIfNeeded();

  // 2. Fetch all skaters with calculated live ratings
  const players = await prisma.player.findMany({
    where: {
      isGoalie: false,
      liveCalculatorRatings: { not: Prisma.DbNull },
    },
    select: {
      id: true,
      liveCalculatorRatings: true,
    },
  });

  if (!players.length) {
    throw new Error("Žiadny hráči nemajú vypočítané Live ratingy. Najprv spustite prepočet.");
  }

  const CHUNK_SIZE = 100;
  let updatedCount = 0;

  for (let i = 0; i < players.length; i += CHUNK_SIZE) {
    const chunk = players.slice(i, i + CHUNK_SIZE);

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
 * Restore original STHS ratings from sthsBackup for all skaters.
 */
export async function restoreSthsBackupAction(): Promise<{
  success: boolean;
  restoredCount: number;
}> {
  if (!(await isAdmin())) {
    throw new Error("Iba administrátor ligy môže obnoviť ratingy zo zálohy.");
  }

  // Restore Player table
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

  revalidatePath("/tools/player-calculator");
  revalidatePath("/players");
  revalidatePath("/roster");
  revalidatePath("/admin");

  return {
    success: true,
    restoredCount: Number(playerResult),
  };
}

