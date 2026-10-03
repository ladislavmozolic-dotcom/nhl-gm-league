"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { worldScoutingMeta } from "@/lib/world-scouting";
import { currentDraftSourceWhere } from "@/lib/draft-source";
import { revalidatePath } from "next/cache";

export async function saveWorldPlayerToDraftList(worldPlayerId: number) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Sign in as a GM." };
  if (!Number.isSafeInteger(worldPlayerId) || worldPlayerId <= 0) return { ok: false as const, error: "Invalid player." };
  const player = await prisma.worldPlayer.findUnique({ where: { id: worldPlayerId }, select: { id: true, name: true, normalizedName: true, birthDate: true, position: true, epUrl: true } });
  if (!player) return { ok: false as const, error: "Player not found." };
  const { year, meta } = await worldScoutingMeta([player], teamId);
  const state = meta.get(player.id)!;
  if (!state.draftable) return { ok: false as const, error: "Player is not draft-eligible (must be strictly under 24 on 30 June of draft year with no UNHL rights)." };
  if (state.saved) return { ok: true as const, year };
  const source = await currentDraftSourceWhere();
  const candidates = await prisma.draftProspect.findMany({ where: { ...source, draftYear: year, name: { equals: player.name, mode: "insensitive" }, draftedByTeamId: null }, select: { id: true, birthDate: true } });
  const matching = candidates.filter((c) => !c.birthDate || c.birthDate === player.birthDate);
  if (matching.length === 1) {
    await prisma.draftRanking.upsert({ where: { teamId_draftProspectId: { teamId, draftProspectId: matching[0].id } }, create: { teamId, draftProspectId: matching[0].id, rank: 0 }, update: {} });
  } else {
    const existing = await prisma.draftRanking.findFirst({ where: { teamId, draftProspectId: null, customYear: year, customName: player.name, customBirth: player.birthDate } });
    if (!existing) await prisma.draftRanking.create({ data: { teamId, customYear: year, customName: player.name, customBirth: player.birthDate, customPos: player.position ?? "C", customEp: player.epUrl, rank: 0 } });
  }
  revalidatePath("/draft/rankings");
  return { ok: true as const, year };
}
