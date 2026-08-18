"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/** Admin: undo a UFA signing / extension, restoring the player's prior contract. */
export async function revertSigningAction(logId: number) {
  if (!(await isAdmin())) throw new Error("Only a league admin can revert signings.");
  const log = await prisma.signingLog.findUnique({ where: { id: logId } });
  if (!log || log.reverted) return { ok: false as const, error: "Already reverted or not found." };

  if (log.kind === "EXTEND") {
    // a deferred extension never touched the current contract — just drop the future deal
    await prisma.player.update({
      where: { id: log.playerId },
      data: { extCapHit: null, extYears: null, extContractType: null, extClause: null, extNoTradeTeams: [], extText: null, resignStatus: null, resignRound: 0 },
    });
  } else {
    // an immediate signing overwrote the contract — restore the snapshot
    await prisma.player.update({
      where: { id: log.playerId },
      data: {
        capHit: log.prevCapHit ?? 0, contractYears: log.prevYears, contractExpiry: log.prevExpiry,
        contractType: log.prevType, tradeClause: log.prevClause, noTradeTeams: log.prevNoTrade,
        rosterType: log.prevRosterType ?? "NHL", teamId: log.prevTeamId ?? undefined,
        contractText: log.prevContractText,
        extCapHit: null, extYears: null, extContractType: null, extClause: null, extNoTradeTeams: [], extText: null,
        resignStatus: null, resignRound: 0,
      },
    });
    // drop the accepted FA offer so the player is a free agent again
    await prisma.faOffer.deleteMany({ where: { playerId: log.playerId, status: "ACCEPTED" } }).catch(() => {});
  }
  await prisma.signingLog.update({ where: { id: logId }, data: { reverted: true } });
  for (const p of ["/admin/signings", "/salary-cap", "/finance", "/free-agents", "/signings"]) revalidatePath(p);
  return { ok: true as const };
}
