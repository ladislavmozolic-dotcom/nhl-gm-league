"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const VALID = new Set(["NTC", "NMC", "M_NTC"]);

/** Set no-trade / no-movement clauses — commissioner only (clauses are anchored to
 *  the player at signing; GMs can't hand them out or edit them). */
export async function setTeamClausesAction(
  teamId: number,
  rows: { playerId: number; clause: string | null; noTradeTeams: number[] }[],
) {
  if (!(await isAdmin())) throw new Error("Commissioner only.");
  const owned = await prisma.player.findMany({ where: { id: { in: rows.map((r) => r.playerId) }, teamId }, select: { id: true } });
  const ok = new Set(owned.map((o) => o.id));
  await prisma.$transaction(
    rows.filter((r) => ok.has(r.playerId)).map((r) => {
      const clause = r.clause && VALID.has(r.clause) ? r.clause : null;
      return prisma.player.update({
        where: { id: r.playerId },
        data: { tradeClause: clause, noTradeTeams: clause === "M_NTC" ? [...new Set(r.noTradeTeams)] : [] },
      });
    }),
  );
  revalidatePath(`/teams`);
  return { ok: true as const };
}
