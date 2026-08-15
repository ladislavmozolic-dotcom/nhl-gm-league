"use server";

import { revalidatePath } from "next/cache";
import { saveSettings, mergeSettings, DEFAULT_SETTINGS, type EngineSettings } from "@/lib/sim/settings";
import { isAdmin } from "@/lib/auth";

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
