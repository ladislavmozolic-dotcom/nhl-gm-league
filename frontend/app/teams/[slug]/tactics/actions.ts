"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { mergeTactics, type TeamTactics } from "@/lib/sim/tactics";

/** Save this team's system tactics (the 4 dials + preset). GM- or admin-gated.
 *  Stored on the team's TeamLines.system Json; the sim reads it on the next game. */
export async function saveSystem(teamId: number, tactics: TeamTactics) {
  if (!(await canManageTeam(teamId))) return { ok: false, error: "not authorized" };

  const clean = mergeTactics(tactics);
  const existing = await prisma.teamLines.findUnique({ where: { teamId }, select: { id: true } });
  if (existing) {
    await prisma.teamLines.update({ where: { teamId }, data: { system: clean as object } });
  } else {
    // create a minimal TeamLines row carrying just the system (lines auto-generate)
    await prisma.teamLines.create({ data: { teamId, system: clean as object } });
  }

  revalidatePath(`/teams`);
  return { ok: true };
}
