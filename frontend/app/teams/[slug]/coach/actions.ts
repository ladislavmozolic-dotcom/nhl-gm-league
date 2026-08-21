"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { coachDemand, coachBuyout } from "@/lib/coach-contract";

/** Fire the team's current head coach. The club pays out his WHOLE remaining
 *  contract (salary × years) from the bank, and he returns to the free-agent pool. */
export async function fireCoachAction(teamId: number, slug: string) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "Not authorized." };
  const coach = await prisma.coach.findUnique({ where: { teamId } });
  if (!coach) return { ok: false as const, error: "This club has no head coach to fire." };

  const payout = coachBuyout(coach.salary, coach.contract);
  await prisma.$transaction([
    // lump-sum buyout: bankAccount + ledgerAdj (so it survives every processFinances recompute)
    prisma.team.update({ where: { id: teamId }, data: { bankAccount: { decrement: payout }, ledgerAdj: { decrement: payout } } }),
    // release to the FA pool; his old deal is void (renegotiated on the next signing)
    prisma.coach.update({ where: { id: coach.id }, data: { teamId: null, salary: 0, contract: 0 } }),
  ]);
  revalidatePath(`/teams/${slug}/coach`);
  revalidatePath(`/teams/${slug}`);
  revalidatePath("/coaches");
  return { ok: true as const, coachName: coach.name, payout };
}

/** Hire a free-agent coach onto this club. He signs the contract his ratings
 *  command (salary + term, max 4 yrs). The seat must be vacant — fire first. */
export async function hireCoachAction(teamId: number, coachId: number, slug: string) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "Not authorized." };
  const [seat, coach] = await Promise.all([
    prisma.coach.findUnique({ where: { teamId }, select: { id: true, name: true } }),
    prisma.coach.findUnique({ where: { id: coachId }, select: { id: true, name: true, overall: true, teamId: true } }),
  ]);
  if (!coach) return { ok: false as const, error: "Coach not found." };
  if (coach.teamId != null) return { ok: false as const, error: `${coach.name} is already under contract elsewhere.` };
  if (seat) return { ok: false as const, error: `Fire ${seat.name} first — a club can carry only one head coach.` };

  const { salary, years } = coachDemand(coach.overall);
  await prisma.coach.update({ where: { id: coach.id }, data: { teamId, salary, contract: years } });
  revalidatePath(`/teams/${slug}/coach`);
  revalidatePath(`/teams/${slug}`);
  revalidatePath("/coaches");
  return { ok: true as const, coachName: coach.name, salary, years };
}
