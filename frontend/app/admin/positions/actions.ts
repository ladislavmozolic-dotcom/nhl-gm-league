"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";

export type FoundPlayer = {
  id: number; name: string; position: string | null; shoots: string | null;
  isGoalie: boolean; teamName: string | null;
};

/** Search players by (clean) name for the position editor. */
export async function searchPlayers(query: string): Promise<FoundPlayer[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await prisma.player.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: { id: true, name: true, position: true, shoots: true, isGoalie: true, team: { select: { name: true } } },
    take: 40,
    orderBy: { overall: "desc" },
  });
  return rows.map((r) => ({
    id: r.id, name: cleanName(r.name), position: r.position, shoots: r.shoots,
    isGoalie: r.isGoalie, teamName: r.team?.name ?? null,
  }));
}

/** Save a player's positions (slash-joined, e.g. "C/RW") and shooting side. */
export async function savePlayerPosition(id: number, position: string, shoots: string | null) {
  const pos = position.trim().toUpperCase() || "D";
  await prisma.player.update({
    where: { id },
    data: { position: pos, isGoalie: pos === "G", shoots: shoots || null },
  });
  revalidatePath("/admin/positions");
  return { ok: true };
}
