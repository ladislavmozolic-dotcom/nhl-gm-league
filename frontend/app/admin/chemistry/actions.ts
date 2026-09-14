"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";

/** Directly overwrite one chemistry bond/unit value (TeamLines.chemistry[sig]) —
 *  the exact same store lib/sim/ratings.ts reads into SimSkater.chem for the next
 *  sim, so this takes effect immediately, not just in the Line Builder preview. */
export async function setChemistryValue(teamId: number, slug: string, sig: string, value: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Only the commissioner can edit chemistry." };
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const row = await prisma.teamLines.findUnique({ where: { teamId }, select: { chemistry: true } });
  if (!row) return { ok: false as const, error: "This club has no lines set yet." };
  const chem = { ...((row.chemistry ?? {}) as Record<string, number>), [sig]: clamped };
  await prisma.teamLines.update({ where: { teamId }, data: { chemistry: chem } });
  revalidatePath(`/admin/chemistry/${slug}`);
  revalidatePath(`/teams/${slug}/lines/builder`);
  return { ok: true as const, value: clamped };
}

/** Clear one bond back to "never played together" (removes the key entirely, so
 *  it falls back to the league's chemistryBase — same as a bond that's never
 *  been set). */
export async function clearChemistryValue(teamId: number, slug: string, sig: string) {
  if (!(await isAdmin())) return { ok: false as const, error: "Only the commissioner can edit chemistry." };
  const row = await prisma.teamLines.findUnique({ where: { teamId }, select: { chemistry: true } });
  if (!row) return { ok: false as const, error: "This club has no lines set yet." };
  const chem = { ...((row.chemistry ?? {}) as Record<string, number>) };
  delete chem[sig];
  await prisma.teamLines.update({ where: { teamId }, data: { chemistry: chem } });
  revalidatePath(`/admin/chemistry/${slug}`);
  revalidatePath(`/teams/${slug}/lines/builder`);
  return { ok: true as const };
}
