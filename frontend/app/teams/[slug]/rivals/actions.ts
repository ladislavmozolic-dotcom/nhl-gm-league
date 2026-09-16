"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageTeam, isAdmin } from "@/lib/auth";
import { rivalryPairIds } from "@/lib/rivalry-server";

/** Save this team's rival list. Rivalries are mutual — the flag is added/removed
 *  on both teams so a heated game triggers no matter who is home. GM- or admin-gated. */
export async function saveRivals(teamId: number, rivalIds: number[]) {
  if (!(await canManageTeam(teamId))) return { ok: false, error: "not authorized" };

  const before = await prisma.team.findUnique({ where: { id: teamId }, select: { rivalTeamIds: true } });
  const prev = new Set(before?.rivalTeamIds ?? []);
  const next = new Set(rivalIds.filter((id) => id !== teamId));

  // set this team's list
  await prisma.team.update({ where: { id: teamId }, data: { rivalTeamIds: [...next] } });

  // mirror on the other side
  const added = [...next].filter((id) => !prev.has(id));
  const removed = [...prev].filter((id) => !next.has(id));
  for (const id of added) {
    const t = await prisma.team.findUnique({ where: { id }, select: { rivalTeamIds: true } });
    const set = new Set(t?.rivalTeamIds ?? []); set.add(teamId);
    await prisma.team.update({ where: { id }, data: { rivalTeamIds: [...set] } });
  }
  for (const id of removed) {
    const t = await prisma.team.findUnique({ where: { id }, select: { rivalTeamIds: true } });
    const set = new Set(t?.rivalTeamIds ?? []); set.delete(teamId);
    await prisma.team.update({ where: { id }, data: { rivalTeamIds: [...set] } });
  }

  revalidatePath(`/teams`);
  return { ok: true };
}

/** Commissioner-only: force the 0-100 rivalry score for one team pair, bypassing
 *  the organic history-based calculation (e.g. a rivalry declared hot from day
 *  one). Pass score = null to clear the override and let it run organic again. */
export async function setRivalryOverride(teamAId: number, teamBId: number, score: number | null) {
  if (!(await isAdmin())) return { ok: false, error: "not authorized" };
  if (teamAId === teamBId) return { ok: false, error: "a team can't rival itself" };
  const [a, b] = rivalryPairIds(teamAId, teamBId);

  if (score == null) {
    await prisma.rivalryOverride.deleteMany({ where: { teamAId: a, teamBId: b } });
  } else {
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    await prisma.rivalryOverride.upsert({
      where: { teamAId_teamBId: { teamAId: a, teamBId: b } },
      update: { score: clamped },
      create: { teamAId: a, teamBId: b, score: clamped },
    });
  }

  revalidatePath(`/teams`);
  return { ok: true };
}
