"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { NEED_POSITIONS } from "@/lib/trade-block-server";

export async function setPlayerBlockAction(playerId: number, on: boolean, note: string) {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true } });
  if (!p) throw new Error("Player not found.");
  if (!(await canManageTeam(p.teamId))) throw new Error("You can only list your own players.");
  await prisma.player.update({ where: { id: playerId }, data: { onBlock: on, blockNote: on ? (note.trim().slice(0, 200) || null) : null } });
  for (const path of ["/trade-block", "/"]) revalidatePath(path);
  return { ok: true };
}

export async function setTeamNeedsAction(teamId: number, needs: string[]) {
  if (!(await canManageTeam(teamId))) throw new Error("You can only set your own team's needs.");
  const clean = [...new Set(needs.filter((n) => (NEED_POSITIONS as readonly string[]).includes(n)))];
  await prisma.team.update({ where: { id: teamId }, data: { needs: clean } });
  revalidatePath("/trade-block");
  return { ok: true, needs: clean };
}
