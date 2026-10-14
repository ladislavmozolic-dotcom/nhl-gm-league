import { prisma } from "@/lib/prisma";
import { leaveGroup } from "./server";

/** A GM seat changed hands (GM removed / new GM approved / GM moved to another club):
 *  the next GM of this club must not inherit the previous GM's private conversations,
 *  group memberships, picture or push devices. Public league-channel posts stay (they're
 *  league history). Best-effort — never throws into the admin action that calls it. */
export async function clearTeamChat(teamId: number): Promise<void> {
  try {
    const groups = await prisma.imMember.findMany({ where: { teamId }, select: { roomId: true } });
    for (const g of groups) await leaveGroup(g.roomId, teamId);
    await prisma.imRoom.deleteMany({ where: { kind: "dm", OR: [{ dmKey: { startsWith: `${teamId}-` } }, { dmKey: { endsWith: `-${teamId}` } }] } });
    await prisma.imRead.deleteMany({ where: { teamId } });
    await prisma.imProfile.deleteMany({ where: { teamId } });
    await prisma.imPushSub.deleteMany({ where: { teamId } });
    await prisma.imMute.deleteMany({ where: { teamId } });
  } catch (e) {
    console.error("[chat] clearTeamChat failed", e);
  }
}
