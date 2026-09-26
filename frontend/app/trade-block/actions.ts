"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { NEED_POSITIONS } from "@/lib/trade-block-server";

export async function setPlayerBlockAction(playerId: number, on: boolean, note: string) {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true, onBlock: true, morale: true, team: { select: { slug: true } } } });
  if (!p) throw new Error("Player not found.");
  if (!(await canManageTeam(p.teamId))) throw new Error("You can only list your own players.");
  const data: { onBlock: boolean; blockNote: string | null; morale?: number; mo?: number } = {
    onBlock: on, blockNote: on ? (note.trim().slice(0, 200) || null) : null,
  };
  // being shopped stings — a one-time morale dip when a player is first listed
  // (while he stays listed it doesn't recover; once he's off the block it drifts
  // back through games and +1 per off-day — lib/player-morale.ts recoverMoraleOffDays).
  // `mo` mirrors `morale` so the Ratings-strip "MO" parameter stays live too.
  if (on && !p.onBlock) { const m = Math.max(30, (p.morale ?? 75) - 8); data.morale = m; data.mo = m; }
  await prisma.player.update({ where: { id: playerId }, data });
  for (const path of ["/trade-block", "/", `/teams/${p.team.slug}/trades`, `/teams/${p.team.slug}/roster`]) revalidatePath(path);
  return { ok: true };
}

export async function setTeamNeedsAction(teamId: number, needs: string[]) {
  if (!(await canManageTeam(teamId))) throw new Error("You can only set your own team's needs.");
  const clean = [...new Set(needs.filter((n) => (NEED_POSITIONS as readonly string[]).includes(n)))];
  await prisma.team.update({ where: { id: teamId }, data: { needs: clean } });
  revalidatePath("/trade-block");
  return { ok: true, needs: clean };
}
