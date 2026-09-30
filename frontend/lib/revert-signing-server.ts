import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/** Core logic to revert a signing or contract extension, restoring pre-signing snapshot. */
export async function executeRevertSigning(logId: number) {
  if (!(await isAdmin())) {
    return { ok: false as const, error: "Only a league admin can revert signings." };
  }

  const log = await prisma.signingLog.findUnique({ where: { id: logId } });
  if (!log) {
    return { ok: false as const, error: "Signing log entry not found." };
  }
  if (log.reverted) {
    return { ok: false as const, error: "This signing has already been reverted." };
  }

  // Restore snapshot onto player
  const player = await prisma.player.findUnique({
    where: { id: log.playerId },
    select: { id: true, teamId: true, name: true },
  });

  if (!player) {
    return { ok: false as const, error: "Player record no longer exists." };
  }

  // Determine target teamId:
  // - If prevTeamId is set, use it.
  // - If prevTeamId is null:
  //   * for EXTEND: keep player's current teamId (player was already on the team)
  //   * for SIGN: send back to Free Agents team (code "FA" or id 66)
  let targetTeamId: number = player.teamId;
  if (log.prevTeamId != null) {
    targetTeamId = log.prevTeamId;
  } else if (log.kind !== "EXTEND") {
    const faTeam = await prisma.team.findFirst({
      where: { OR: [{ code: "FA" }, { name: { contains: "Free Agent", mode: "insensitive" } }] },
      select: { id: true },
    });
    if (faTeam) {
      targetTeamId = faTeam.id;
    }
  }

  await prisma.player.update({
    where: { id: log.playerId },
    data: {
      capHit: log.prevCapHit ?? 0,
      ahlSalary: log.prevAhlSalary,
      contractYears: log.prevYears,
      contractExpiry: log.prevExpiry,
      contractType: log.prevType,
      tradeClause: log.prevClause,
      noTradeTeams: log.prevNoTrade ?? [],
      rosterType: log.prevRosterType ?? (log.kind === "EXTEND" ? "NHL" : "UFA"),
      teamId: targetTeamId,
      contractText: log.prevContractText,
      extCapHit: null,
      extYears: null,
      extContractType: null,
      extClause: null,
      extNoTradeTeams: [],
      extText: null,
      resignStatus: null,
      resignRound: 0,
      rfaOsUsed: false,
      rightsReleased: false,
    },
  });

  if (log.kind !== "EXTEND") {
    // drop any accepted FA offer so the player is a free agent again
    await prisma.faOffer.deleteMany({
      where: { playerId: log.playerId, status: "ACCEPTED" },
    }).catch(() => {});
  }

  await prisma.signingLog.update({
    where: { id: logId },
    data: { reverted: true },
  });

  await prisma.transaction.create({
    data: {
      type: "SIGNING",
      message: log.kind === "EXTEND"
        ? `Commissioner reverted ${log.teamCode ?? "a club"}'s extension of ${log.playerName}.`
        : `Commissioner reverted ${log.teamCode ?? "a club"}'s signing of ${log.playerName} — returned to the ${log.prevRosterType === "RFA" ? "RFA" : "UFA"} market.`,
      playerId: log.playerId,
    },
  }).catch(() => {});

  const paths = [
    "/admin/signings",
    "/admin/agent",
    "/salary-cap",
    "/finance",
    "/free-agents",
    "/signings",
    `/players/${log.playerId}`,
  ];
  if (log.teamCode) paths.push(`/team/${log.teamCode}`);
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {}
  }

  return { ok: true as const };
}
