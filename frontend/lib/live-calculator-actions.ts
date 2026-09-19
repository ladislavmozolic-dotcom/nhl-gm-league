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

export async function checkIsAdminAction(): Promise<boolean> {
  return isAdmin();
}
