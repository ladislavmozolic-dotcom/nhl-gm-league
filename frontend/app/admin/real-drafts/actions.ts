"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { importRealDraft } from "@/lib/real-draft-import";
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
