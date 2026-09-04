"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saveSettings, mergeSettings, DEFAULT_SETTINGS, type EngineSettings } from "@/lib/sim/settings";
import { isAdmin } from "@/lib/auth";
import { promoteParamSet, type ParamSet } from "@/lib/edge-params-server";

/** Switch the whole league between the stable (current) and next-gen (v2) sim engine. */
export async function setSimEngineAction(choice: "current" | "nextgen") {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const simEngine = choice === "nextgen" ? "nextgen" : "current";
  await prisma.leagueConfig.upsert({ where: { id: 1 }, update: { simEngine }, create: { id: 1, simEngine } });
  revalidatePath("/admin/simulation");
  return { ok: true as const };
}

/** Switch the LEAGUE'S LIVE parameter set — this actually overwrites every player's
 *  and goalie's ck/fg/di/.../overall fields (what the simulation and every roster/
 *  player page read) with the chosen set's values, and switches which calculator
 *  shows in the Tools menu to match. The commissioner decides when to do this —
 *  nothing runs automatically. The original STHS numbers are snapshotted the first
 *  time this ever runs, so switching back to "sths" restores them exactly. */
export async function setParamModeAction(choice: ParamSet) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const paramMode = choice === "nextgen" ? "edge" : choice; // "edge" is the legacy DB value for Next Gen
  const result = await promoteParamSet(choice);
  await prisma.leagueConfig.upsert({ where: { id: 1 }, update: { paramMode }, create: { id: 1, paramMode } });
  revalidatePath("/admin/simulation");
  revalidatePath("/", "layout");
  return { ok: true as const, ...result };
}

export async function saveSimSettings(values: Partial<EngineSettings>) {
  if (!(await isAdmin())) throw new Error("Only a league admin can change the simulation settings.");
  await saveSettings(mergeSettings(values));
  revalidatePath("/admin/simulation");
}

export async function resetSimSettings() {
  if (!(await isAdmin())) throw new Error("Only a league admin can change the simulation settings.");
  await saveSettings(DEFAULT_SETTINGS);
  revalidatePath("/admin/simulation");
  return DEFAULT_SETTINGS;
}
