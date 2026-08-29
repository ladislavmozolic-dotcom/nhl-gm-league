"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import { SKATER_FIELDS } from "@/lib/skater-fields";

export type FoundRating = {
  id: number; name: string; teamName: string | null; isGoalie: boolean;
  values: Record<string, number | null>;
};

/** Search players and return their editable ratings. */
export async function searchRatings(query: string): Promise<FoundRating[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const fieldSelect = Object.fromEntries(SKATER_FIELDS.map((f) => [f, true]));
  const rows = await prisma.player.findMany({
    where: { name: { contains: q, mode: "insensitive" }, isGoalie: false },
    select: { id: true, name: true, isGoalie: true, team: { select: { name: true } }, ...fieldSelect },
    take: 30,
    orderBy: { overall: "desc" },
  });
  return rows.map((r) => ({
    id: r.id, name: cleanName(r.name), teamName: r.team?.name ?? null, isGoalie: r.isGoalie,
    values: Object.fromEntries(SKATER_FIELDS.map((f) => [f, (r as unknown as Record<string, number | null>)[f]])),
  }));
}

/** Save a player's edited ratings (clamped 20..99). */
export async function savePlayerRatings(id: number, values: Record<string, number>) {
  const clamp = (v: number) => Math.max(20, Math.min(99, Math.round(v)));
  const data: Record<string, number> = {};
  for (const f of SKATER_FIELDS) if (typeof values[f] === "number" && !Number.isNaN(values[f])) data[f] = clamp(values[f]);
  await prisma.player.update({ where: { id }, data });
  revalidatePath("/admin/ratings");
  return { ok: true };
}
