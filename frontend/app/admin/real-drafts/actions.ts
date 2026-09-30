"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { importRealDraft } from "@/lib/real-draft-import";
import { importPreviewClass, currentDraftYear } from "@/lib/draft-class-import";
import { importTankathonClass } from "@/lib/tankathon-import";
import { revalidatePath } from "next/cache";

/** Admin: import (or refresh) a real NHL draft year into real-roster Draft History. */
export async function importRealDraftAction(year: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  if (!Number.isInteger(year) || year < 1979 || year > 2100) return { ok: false as const, error: "Enter a valid draft year." };
  try {
    const r = await importRealDraft(year);
    revalidatePath("/admin/real-drafts");
    revalidatePath("/draft/history");
    if (r.inserted === 0) return { ok: false as const, error: `No draft data found for ${year} (not held yet?).` };
    return { ok: true as const, inserted: r.inserted, unmatched: r.unmatched };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Import failed." };
  }
}

/** Admin: remove a stored real draft year. */
export async function deleteRealDraftAction(year: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  await prisma.draftProspect.deleteMany({ where: { draftYear: year, source: "real" } });
  revalidatePath("/admin/real-drafts");
  revalidatePath("/draft/history");
  return { ok: true as const };
}

/** Admin: load a pasted early ranking as this season's draft class until Central Scouting publishes. */
export async function importPreviewClassAction(year: number, text: string) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  if (year !== (await currentDraftYear()) && year !== (await currentDraftYear()) + 1) return { ok: false as const, error: "Only the current or next draft year." };
  const r = await importPreviewClass(year, text);
  if (r.error) return { ok: false as const, error: r.error };
  revalidatePath("/draft/room");
  revalidatePath("/draft/rankings");
  return { ok: true as const, imported: r.imported, skipped: r.skipped };
}

/** Admin: load the Tankathon big board (in its order) as the preview class. */
export async function importTankathonAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  try {
    const r = await importTankathonClass();
    if (r.error) return { ok: false as const, error: r.error };
    revalidatePath("/draft/room"); revalidatePath("/draft/rankings"); revalidatePath("/around-the-world");
    return { ok: true as const, imported: r.imported, skipped: 0 };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Tankathon import failed." };
  }
}
