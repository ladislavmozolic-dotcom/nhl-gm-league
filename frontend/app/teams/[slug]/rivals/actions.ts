"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";

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
