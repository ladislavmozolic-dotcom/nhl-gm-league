"use server";

import { prisma } from "@/lib/prisma";
import { processFinances } from "@/lib/finance-server";
import { revalidatePath } from "next/cache";

export async function savePopularity(rows: Array<{ id: number; popularity: number }>) {
  await prisma.$transaction(rows.map((r) =>
    prisma.team.update({ where: { id: r.id }, data: { popularity: Math.max(0, Math.min(200, Math.round(r.popularity))) } })));
  await processFinances("2026-27", "NHL"); // recompute banks with new popularity
  revalidatePath("/admin/finance");
  revalidatePath("/finance");
}
