"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { promotePlayerToNextGen, applyRookieRatingsOverride } from "@/lib/edge-params-server";
import { scanAndSyncDebutants } from "@/lib/rookie-debutants";

export async function promoteRookieAction(playerId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const result = await promotePlayerToNextGen(playerId);
  if (result.ok) revalidatePath("/tools/player-calculator");
  return result;
}

/** Activate a GM-adjusted rating instead of the raw computed one — the Rookie
 *  Calculator table lets an admin edit any of the 16 param cells before hitting
 *  "Activate", for cases like a tiny hot-streak sample reading higher than a GM
 *  is comfortable trusting. */
export async function promoteRookieWithOverridesAction(playerId: number, ratings: Record<string, number>) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const result = await applyRookieRatingsOverride(playerId, ratings);
  if (result.ok) revalidatePath("/tools/player-calculator");
  return result;
}

/** On-demand only (loops all 32 real NHL rosters + a league-wide stat refresh) —
 *  never call this from a page render, only from an explicit admin button click.
 *  Creates every newly-found real NHL debutant as a PROSPECT automatically and
 *  refreshes stats for everyone already tracked, so the "Prospekti s reálnymi
 *  zápasmi" table below is fully up to date right after this returns. */
export async function scanAndSyncDebutantsAction() {
  if (!(await isAdmin())) return { ok: false as const, created: [], statsRefreshed: 0, error: "Admin only." };
  const result = await scanAndSyncDebutants();
  if (result.ok) revalidatePath("/tools/player-calculator");
  return result;
}
