"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";

export type FoundProfilePlayer = {
  id: number; name: string; teamName: string | null; isGoalie: boolean;
  birthDate: string | null; birthPlace: string | null; nationality: string | null;
  height: string | null; weight: number | null; number: number | null; shoots: string | null;
};

/** Search players by (clean) name for the profile editor. */
export async function searchProfilePlayers(query: string): Promise<FoundProfilePlayer[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await prisma.player.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    select: {
      id: true, name: true, isGoalie: true, birthDate: true, birthPlace: true, nationality: true,
      height: true, weight: true, number: true, shoots: true, team: { select: { name: true } },
    },
    take: 40,
    orderBy: { overall: "desc" },
  });
  return rows.map((r) => ({
    id: r.id, name: cleanName(r.name), teamName: r.team?.name ?? null, isGoalie: r.isGoalie,
    birthDate: r.birthDate, birthPlace: r.birthPlace, nationality: r.nationality,
    height: r.height, weight: r.weight, number: r.number, shoots: r.shoots,
  }));
}

export type ProfileValues = {
  birthDate: string | null; birthPlace: string | null; nationality: string | null;
  height: string | null; weight: number | null; number: number | null; shoots: string | null;
};

/** Save a player's bio/profile fields. */
export async function savePlayerProfile(id: number, v: ProfileValues) {
  await prisma.player.update({
    where: { id },
    data: {
      birthDate: v.birthDate || null,
      birthPlace: v.birthPlace?.trim() || null,
      nationality: v.nationality?.trim().toUpperCase() || null,
      height: v.height?.trim() || null,
      weight: v.weight ?? null,
      number: v.number ?? null,
      shoots: v.shoots || null,
    },
  });
  revalidatePath("/admin/profile");
  return { ok: true };
}
