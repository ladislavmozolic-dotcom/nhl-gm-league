"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saveSettings, mergeSettings, DEFAULT_SETTINGS, type EngineSettings } from "@/lib/sim/settings";
import { isAdmin } from "@/lib/auth";

/** Switch the whole league between the stable (current) and next-gen (v2) sim engine. */
export async function setSimEngineAction(choice: "current" | "nextgen") {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const simEngine = choice === "nextgen" ? "nextgen" : "current";
  await prisma.leagueConfig.upsert({ where: { id: 1 }, update: { simEngine }, create: { id: 1, simEngine } });
  revalidatePath("/admin/simulation");
  return { ok: true as const };
}

/** Switch the active player-parameter calculator (STHS vs NHL Edge). Only the active one shows in the Tools menu. */
export async function setParamModeAction(choice: "sths" | "edge") {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const paramMode = choice === "edge" ? "edge" : "sths";
  await prisma.leagueConfig.upsert({ where: { id: 1 }, update: { paramMode }, create: { id: 1, paramMode } });
  revalidatePath("/admin/simulation");
  revalidatePath("/", "layout");
  return { ok: true as const };
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
