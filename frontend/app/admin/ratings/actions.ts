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
  const rows = await prisma.player.findMany({
    where: { name: { contains: q, mode: "insensitive" }, isGoalie: false },
    select: { id: true, name: true, isGoalie: true, team: { select: { name: true } }, overall: true, sc: true, pa: true, sk: true, df: true, ck: true, st: true, fo: true, ex: true, ld: true },
    take: 30,
    orderBy: { overall: "desc" },
  });
  return rows.map((r) => ({
    id: r.id, name: cleanName(r.name), teamName: r.team?.name ?? null, isGoalie: r.isGoalie,
    values: { overall: r.overall, sc: r.sc, pa: r.pa, sk: r.sk, df: r.df, ck: r.ck, st: r.st, fo: r.fo, ex: r.ex, ld: r.ld },
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
