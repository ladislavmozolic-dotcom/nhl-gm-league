"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { promotePlayerToNextGen } from "@/lib/edge-params-server";
import { findMissingNhlPlayers, createDebutantAsProspect, previewDebutantRating, type DebutantCandidate } from "@/lib/rookie-debutants";

export async function promoteRookieAction(playerId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const result = await promotePlayerToNextGen(playerId);
  if (result.ok) revalidatePath("/tools/player-calculator");
  return result;
}

/** On-demand only (loops all 32 real NHL rosters) — never call this from a page
 *  render, only from an explicit admin button click. */
export async function scanMissingNhlPlayersAction() {
  if (!(await isAdmin())) return { ok: false as const, candidates: [] as DebutantCandidate[], error: "Admin only." };
  return findMissingNhlPlayers();
}

export async function createDebutantAction(c: DebutantCandidate) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const result = await createDebutantAsProspect(c);
  if (result.ok) revalidatePath("/tools/player-calculator");
  return result;
}

/** Read-only — computes a rating preview without creating or writing anything. */
export async function previewDebutantAction(c: DebutantCandidate) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  return previewDebutantRating(c);
}
