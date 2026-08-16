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

/** Apply one Coach-Advice suggestion: flip a single dial on the current system. */
export async function applyCoachSuggestionAction(teamId: number, dial: string, value: string) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "not authorized" };
  if (!["tempo", "forecheck", "puckStyle", "dZone"].includes(dial)) return { ok: false as const, error: "bad dial" };
  const row = await prisma.teamLines.findUnique({ where: { teamId }, select: { system: true } });
  const current = mergeTactics((row?.system as Partial<TeamTactics>) ?? null);
  const clean = mergeTactics({ ...current, [dial]: value } as TeamTactics);
  if (row) await prisma.teamLines.update({ where: { teamId }, data: { system: clean as object } });
  else await prisma.teamLines.create({ data: { teamId, system: clean as object } });
  revalidatePath(`/teams`);
  return { ok: true as const };
}
