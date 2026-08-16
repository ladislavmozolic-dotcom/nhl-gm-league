"use server";

import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const VALID = new Set(["NTC", "NMC", "M_NTC"]);

/** Set no-trade / no-movement clauses for the team's own players (GM or admin). */
export async function setTeamClausesAction(
  teamId: number,
  rows: { playerId: number; clause: string | null; noTradeTeams: number[] }[],
) {
  if (!(await canManageTeam(teamId))) throw new Error("You don't manage this team.");
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
