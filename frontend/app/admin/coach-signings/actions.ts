"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/** Admin: undo a head-coach hire or fire, restoring his contract state from
 *  before the move. Refuses if the coach has moved again since (traded seat,
 *  re-hired, re-fired) — that would silently clobber the newer state. */
export async function revertCoachSigningAction(logId: number) {
  if (!(await isAdmin())) throw new Error("Only a league admin can revert coach signings.");
  const log = await prisma.coachSigningLog.findUnique({ where: { id: logId } });
  if (!log || log.reverted) return { ok: false as const, error: "Already reverted or not found." };

  const coach = await prisma.coach.findUnique({ where: { id: log.coachId }, select: { id: true, teamId: true, salary: true, contract: true } });
  if (!coach) return { ok: false as const, error: "Coach not found." };

  if (log.kind === "HIRE") {
    if (coach.teamId !== log.teamId) return { ok: false as const, error: `${log.coachName} has moved since this hire — can't safely revert.` };
    await prisma.coach.update({ where: { id: coach.id }, data: { teamId: null, salary: 0, contract: 0 } });
  } else {
    if (coach.teamId !== null) return { ok: false as const, error: `${log.coachName} is no longer a free agent — can't safely revert.` };
    if (log.prevTeamId == null) return { ok: false as const, error: "No prior club on record for this firing." };
    await prisma.$transaction([
      prisma.coach.update({ where: { id: coach.id }, data: { teamId: log.prevTeamId, salary: log.prevSalary ?? 0, contract: log.prevContract ?? 0 } }),
      // refund the buyout that was debited when he was fired
      prisma.team.update({ where: { id: log.prevTeamId }, data: { bankAccount: { increment: log.payout }, ledgerAdj: { increment: log.payout } } }),
    ]);
  }

  await prisma.coachSigningLog.update({ where: { id: logId }, data: { reverted: true } });
  for (const p of ["/admin/coach-signings", "/coaches", "/finance", "/salary-cap"]) revalidatePath(p);
  return { ok: true as const };
}
