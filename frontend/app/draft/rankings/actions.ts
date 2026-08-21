"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { currentDraftSourceWhere } from "@/lib/draft-source";
import { countryFlag } from "@/lib/flags";
import { revalidatePath } from "next/cache";

export type SearchHit = {
  id: number; name: string; position: string; amateurLeague: string | null; country: string | null; flag: string;
  ov: number; potential: number; csRank: number | null; onBoard: boolean; drafted: boolean;
};

/** Search the draft class for a year — available (or already-drafted) prospects by
 *  name / league / club — so a GM can add them to the board. Marks which are already
 *  on this GM's board. */
export async function searchProspectsAction(year: number, q: string): Promise<{ ok: boolean; hits?: SearchHit[]; error?: string }> {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false, error: "Sign in as a GM." };
  const needle = q.trim();
  if (needle.length < 2) return { ok: true, hits: [] };
  const src = await currentDraftSourceWhere();
  const [rows, mine] = await Promise.all([
    prisma.draftProspect.findMany({
      where: {
        draftYear: year, ...src,
        OR: [{ name: { contains: needle, mode: "insensitive" } }, { amateurLeague: { contains: needle, mode: "insensitive" } }, { amateurClub: { contains: needle, mode: "insensitive" } }],
      },
      orderBy: [{ potential: "desc" }, { ov: "desc" }],
      take: 40,
      select: { id: true, name: true, position: true, amateurLeague: true, country: true, ov: true, potential: true, csRank: true, draftedByTeamId: true },
    }),
    prisma.draftRanking.findMany({ where: { teamId, prospect: { draftYear: year } }, select: { draftProspectId: true } }),
  ]);
  const onBoard = new Set(mine.map((m) => m.draftProspectId));
  return { ok: true, hits: rows.map((p) => ({
    id: p.id, name: p.name, position: p.position, amateurLeague: p.amateurLeague, country: p.country, flag: countryFlag(p.country),
    ov: p.ov, potential: p.potential, csRank: p.csRank, onBoard: onBoard.has(p.id), drafted: p.draftedByTeamId != null,
  })) };
}

async function ownProspect(teamId: number, draftProspectId: number) {
  const src = await currentDraftSourceWhere();
  return prisma.draftProspect.findFirst({ where: { id: draftProspectId, ...src }, select: { id: true } });
}

/** Add a prospect to the GM's board (rank 0 = board-only, not yet queued). */
export async function addToBoardAction(draftProspectId: number) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Sign in as a GM." };
  if (!(await ownProspect(teamId, draftProspectId))) return { ok: false as const, error: "Unknown prospect." };
  await prisma.draftRanking.upsert({
    where: { teamId_draftProspectId: { teamId, draftProspectId } },
    create: { teamId, draftProspectId, rank: 0 },
    update: {},
  });
  revalidatePath("/draft/rankings");
  return { ok: true as const };
}

/** Remove a prospect from the board entirely. */
export async function removeFromBoardAction(draftProspectId: number) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Sign in as a GM." };
  await prisma.draftRanking.deleteMany({ where: { teamId, draftProspectId } });
  revalidatePath("/draft/rankings");
  return { ok: true as const };
}

/** Save a scouting note (and optional tier) for one prospect. */
export async function updateNoteAction(draftProspectId: number, note: string, tier?: string) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Sign in as a GM." };
  const clean = (note ?? "").trim().slice(0, 500) || null;
  const t = (tier ?? "").trim().slice(0, 24) || null;
  await prisma.draftRanking.upsert({
    where: { teamId_draftProspectId: { teamId, draftProspectId } },
    create: { teamId, draftProspectId, rank: 0, note: clean, tier: t },
    update: { note: clean, tier: t },
  });
  revalidatePath("/draft/rankings");
  return { ok: true as const };
}

/** Persist the full draft QUEUE order. The given prospect ids get rank 1..n (in order);
 *  every other board row for this GM drops to rank 0 (board-only). */
export async function saveQueueOrderAction(orderedProspectIds: number[]) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Sign in as a GM." };
  const ids = [...new Set(orderedProspectIds.filter((n) => Number.isInteger(n)))];
  await prisma.$transaction([
    // anything not in the queue → board-only (rank 0)
    prisma.draftRanking.updateMany({ where: { teamId, draftProspectId: { notIn: ids.length ? ids : [-1] } }, data: { rank: 0 } }),
    ...ids.map((id, i) => prisma.draftRanking.updateMany({ where: { teamId, draftProspectId: id }, data: { rank: i + 1 } })),
  ]);
  revalidatePath("/draft/rankings");
  return { ok: true as const };
}
