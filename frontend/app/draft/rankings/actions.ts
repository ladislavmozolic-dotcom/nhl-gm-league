"use server";

import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { currentDraftSourceWhere } from "@/lib/draft-source";
import { countryFlag } from "@/lib/flags";
import { revalidatePath } from "next/cache";

const POSITIONS = ["C", "LW", "RW", "D", "G"];

export type SearchHit = {
  id: number; name: string; position: string; amateurLeague: string | null; country: string | null; flag: string;
  ov: number; potential: number; csRank: number | null; onBoard: boolean; drafted: boolean;
};

/** Search the draft class for a year by name / league / club so a GM can add players. */
export async function searchProspectsAction(year: number, q: string): Promise<{ ok: boolean; hits?: SearchHit[]; error?: string }> {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false, error: "Sign in as a GM." };
  const needle = q.trim();
  if (needle.length < 2) return { ok: true, hits: [] };
  const src = await currentDraftSourceWhere();
  const [rows, mine] = await Promise.all([
    prisma.draftProspect.findMany({
      where: { draftYear: year, ...src, OR: [{ name: { contains: needle, mode: "insensitive" } }, { amateurLeague: { contains: needle, mode: "insensitive" } }, { amateurClub: { contains: needle, mode: "insensitive" } }] },
      orderBy: [{ potential: "desc" }, { ov: "desc" }], take: 40,
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

/** Add a board prospect to the GM's board (rank 0). Returns the new ranking id. */
export async function addToBoardAction(draftProspectId: number) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Sign in as a GM." };
  const src = await currentDraftSourceWhere();
  const p = await prisma.draftProspect.findFirst({ where: { id: draftProspectId, ...src }, select: { id: true } });
  if (!p) return { ok: false as const, error: "Unknown prospect." };
  const row = await prisma.draftRanking.upsert({
    where: { teamId_draftProspectId: { teamId, draftProspectId } },
    create: { teamId, draftProspectId, rank: 0 }, update: {},
  });
  revalidatePath("/draft/rankings");
  return { ok: true as const, id: row.id };
}

/** Add a CUSTOM off-board player (not on the scouting board) to the GM's board.
 *  Name + position required; EP link and birth date optional (birth enables the ≤23
 *  age gate when actually drafted in the room). */
export async function addCustomToBoardAction(input: { year: number; name: string; position: string; epLink?: string; birthDate?: string }) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Sign in as a GM." };
  const name = (input.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (name.length < 2) return { ok: false as const, error: "Enter the player's full name." };
  const position = POSITIONS.includes(input.position) ? input.position : "C";
  const ep = (input.epLink ?? "").trim();
  if (ep && !/^https?:\/\//i.test(ep)) return { ok: false as const, error: "The EP link must be a full https:// URL." };
  const birth = (input.birthDate ?? "").trim();
  if (birth && isNaN(new Date(`${birth}T00:00:00Z`).getTime())) return { ok: false as const, error: "Enter a valid birth date (YYYY-MM-DD)." };
  const row = await prisma.draftRanking.create({
    data: { teamId, draftProspectId: null, customName: name, customPos: position, customEp: ep || null, customBirth: birth || null, customYear: input.year, rank: 0 },
  });
  revalidatePath("/draft/rankings");
  return { ok: true as const, id: row.id };
}

/** Remove a board/queue entry (by ranking id). */
export async function removeRankingAction(rankingId: number) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Sign in as a GM." };
  await prisma.draftRanking.deleteMany({ where: { id: rankingId, teamId } });
  revalidatePath("/draft/rankings");
  return { ok: true as const };
}

/** Save a scouting note (and optional tier) for one entry (by ranking id). */
export async function updateNoteAction(rankingId: number, note: string, tier?: string) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Sign in as a GM." };
  const clean = (note ?? "").trim().slice(0, 500) || null;
  const t = (tier ?? "").trim().slice(0, 24) || null;
  await prisma.draftRanking.updateMany({ where: { id: rankingId, teamId }, data: { note: clean, tier: t } });
  revalidatePath("/draft/rankings");
  return { ok: true as const };
}

/** Persist the QUEUE order. Given ranking ids get rank 1..n; the GM's other rows drop to 0. */
export async function saveQueueOrderAction(orderedRankingIds: number[]) {
  const teamId = await getTeamSession();
  if (teamId == null) return { ok: false as const, error: "Sign in as a GM." };
  const ids = [...new Set(orderedRankingIds.filter((n) => Number.isInteger(n)))];
  await prisma.$transaction([
    prisma.draftRanking.updateMany({ where: { teamId, id: { notIn: ids.length ? ids : [-1] } }, data: { rank: 0 } }),
    ...ids.map((id, i) => prisma.draftRanking.updateMany({ where: { teamId, id }, data: { rank: i + 1 } })),
  ]);
  revalidatePath("/draft/rankings");
  return { ok: true as const };
}
