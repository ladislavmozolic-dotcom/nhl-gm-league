"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/** Cancel a standing open-market Free Agent Frenzy offer — commissioner-only
 *  cleanup, e.g. a stuck/stale bid. */
export async function deleteFaOfferAction(offerId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  await prisma.faOffer.delete({ where: { id: offerId } }).catch(() => {});
  revalidatePath("/admin/agent");
  revalidatePath("/free-agents");
  return { ok: true as const };
}

/** Clear a club's own in-progress re-sign negotiation (Player.resignStatus/
 *  resignRound/resignOfferSalary/resignCounter* — there's no separate row for
 *  this, the state lives directly on the player) so the GM can start over. */
export async function resetResignAction(playerId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  await prisma.player.update({
    where: { id: playerId },
    data: { resignStatus: null, resignRound: 0, resignOfferSalary: null, resignCounterSalary: null, resignCounterYears: null },
  }).catch(() => {});
  revalidatePath("/admin/agent");
  return { ok: true as const };
}
