"use server";

import { prisma } from "@/lib/prisma";
import { processFinances } from "@/lib/finance-server";
import { importCoachSalariesFromProfinhl } from "@/lib/coach-import-server";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function savePopularity(rows: Array<{ id: number; popularity: number }>) {
  await prisma.$transaction(rows.map((r) =>
    prisma.team.update({ where: { id: r.id }, data: { popularity: Math.max(0, Math.min(200, Math.round(r.popularity))) } })));
  await processFinances("2026-27", "NHL"); // recompute banks with new popularity
  revalidatePath("/admin/finance");
  revalidatePath("/finance");
}

/** Pull coach salaries + links from profinhl.cz/Coaches.php (NHL + AHL). */
export async function importCoachSalariesAction() {
  if (!(await isAdmin())) return { ok: false as const, error: "Commissioner only." };
  const r = await importCoachSalariesFromProfinhl();
  revalidatePath("/admin/finance");
  revalidatePath("/finance/dashboard");
  return { ok: true as const, ...r };
}
