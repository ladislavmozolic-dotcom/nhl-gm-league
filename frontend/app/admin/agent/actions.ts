"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { clearLowballs, weakestTeams } from "@/lib/free-agency-server";
import { getLeagueClock } from "@/lib/calendar-server";

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
export async function resetResignAction(playerId: number, clearLowball = false) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { teamId: true },
  });
  await prisma.player.update({
    where: { id: playerId },
    data: {
      resignStatus: null,
      resignRound: 0,
      resignOfferSalary: null,
      resignCounterSalary: null,
      resignCounterYears: null,
      resignOfferAt: null,
      rfaOsUsed: false,
    },
  }).catch(() => {});

  if (clearLowball && player?.teamId) {
    await prisma.faLowball.deleteMany({
      where: { playerId, teamId: player.teamId },
    }).catch(() => {});
  }

  revalidatePath("/admin/agent");
  revalidatePath("/free-agents");
  return { ok: true as const };
}

/** Commissioner intervention: directly update negotiation parameters (round,
 *  standing club offer, player counter ask, status, or faDemandOverride). */
export async function updateResignNegotiationAction(
  playerId: number,
  data: {
    status?: string | null;
    round?: number;
    offerSalary?: number | null;
    counterSalary?: number | null;
    counterYears?: number | null;
    faDemandOverride?: number | null;
    clearLowball?: boolean;
  }
) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, teamId: true, name: true },
  });
  if (!player) return { ok: false as const, error: "Player not found." };

  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) updateData.resignStatus = data.status;
  if (data.round !== undefined) updateData.resignRound = Math.max(0, Math.min(2, Math.round(data.round)));
  if (data.offerSalary !== undefined) {
    updateData.resignOfferSalary = data.offerSalary ? Math.round(data.offerSalary) : null;
    updateData.resignOfferAt = data.offerSalary ? new Date() : null;
  }
  if (data.counterSalary !== undefined) updateData.resignCounterSalary = data.counterSalary ? Math.round(data.counterSalary) : null;
  if (data.counterYears !== undefined) updateData.resignCounterYears = data.counterYears ? Math.max(1, Math.min(8, Math.round(data.counterYears))) : null;
  if (data.faDemandOverride !== undefined) updateData.faDemandOverride = data.faDemandOverride ? Math.round(data.faDemandOverride) : null;

  await prisma.player.update({
    where: { id: playerId },
    data: updateData,
  });

  if (data.clearLowball && player.teamId) {
    await prisma.faLowball.deleteMany({
      where: { playerId, teamId: player.teamId },
    }).catch(() => {});
  }

  revalidatePath("/admin/agent");
  revalidatePath("/free-agents");
  return { ok: true as const };
}

/** Commissioner override: force-sign/extend a player with his club.
 *  Handles deferred extension if in-season with 1 year left, or immediate deal.
 *  Logs to Transaction and SigningLog for complete transparency & revertibility. */
export async function forceSignResignAction(
  playerId: number,
  data: {
    salary: number;
    years: number;
    twoWay?: boolean;
    clause?: string | null;
    mNtcBreadth?: number | null;
  }
) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      id: true,
      name: true,
      teamId: true,
      contractYears: true,
      contractExpiry: true,
      capHit: true,
      ahlSalary: true,
      contractType: true,
      tradeClause: true,
      noTradeTeams: true,
      contractText: true,
      rosterType: true,
      team: { select: { code: true } },
    },
  });

  if (!player || !player.teamId) {
    return { ok: false as const, error: "Player has no club." };
  }

  const salary = Math.max(775_000, Math.round(data.salary));
  const years = Math.max(1, Math.min(8, Math.round(data.years)));
  const twoWay = !!data.twoWay;
  const clause = data.clause && ["NTC", "NMC", "M_NTC"].includes(data.clause) ? data.clause : null;
  const breadth = clause === "M_NTC" ? ([6, 12, 18, 24].includes(data.mNtcBreadth ?? 0) ? data.mNtcBreadth! : 12) : null;

  const clock = await getLeagueClock();
  const phase = clock.phase;
  const deferred = (player.contractYears ?? 0) >= 1 && (phase === "regular" || phase === "playoffs");
  const startYear = CURRENT_SEASON_START + (deferred ? (player.contractYears ?? 1) : 0);
  const expiry = startYear + years;
  const noTradeTeams = clause === "M_NTC" ? await weakestTeams(breadth ?? 12, player.teamId) : [];

  const contractText = twoWay
    ? `$${salary.toLocaleString("en-US")} × ${years}yr (2-way, through ${expiry})`
    : `$${salary.toLocaleString("en-US")} × ${years}yr (through ${expiry})`;

  const releaseNonRoster = player.rosterType === "NONROSTER" ? { rosterType: "NHL" } : {};
  const newDeal = deferred
    ? {
        extCapHit: salary,
        extYears: years,
        extContractType: twoWay ? "TWO_WAY" : "ONE_WAY",
        extClause: clause,
        extNoTradeTeams: noTradeTeams,
        extText: contractText,
        resignStatus: "extended",
      }
    : {
        capHit: salary,
        contractYears: years,
        contractExpiry: expiry,
        contractType: twoWay ? "TWO_WAY" : "ONE_WAY",
        tradeClause: clause,
        noTradeTeams,
        contractText,
        ahlSalary: null,
        extCapHit: null,
        extYears: null,
        extContractType: null,
        extClause: null,
        extNoTradeTeams: [],
        extText: null,
        resignStatus: null,
      };

  await prisma.player.update({
    where: { id: playerId },
    data: {
      ...releaseNonRoster,
      ...newDeal,
      resignRound: 0,
      resignOfferSalary: null,
      resignCounterSalary: null,
      resignCounterYears: null,
      rfaOsUsed: false,
      rightsReleased: false,
      disgruntled: false,
      tradeRequested: false,
      resignOfferAt: null,
      promiseWarnGame: null,
      tradeRequestReason: null,
      iceUnhappyChecks: 0,
      iceWarnedAt: null,
    },
  });

  await clearLowballs(playerId);

  const teamCode = player.team?.code ?? "?";
  await prisma.transaction.create({
    data: {
      type: "SIGNING",
      playerId: player.id,
      message: `${teamCode} re-signed ${player.name} [Commissioner Override] — $${(salary / 1e6).toFixed(2)}M × ${years}yr${deferred ? ` (from ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")})` : ""}`,
    },
  });

  await prisma.signingLog.create({
    data: {
      playerId,
      playerName: player.name,
      teamCode,
      kind: "EXTEND",
      salary,
      years,
      prevCapHit: player.capHit,
      prevYears: player.contractYears,
      prevExpiry: player.contractExpiry,
      prevAhlSalary: player.ahlSalary != null ? Math.round(player.ahlSalary) : null,
      prevType: player.contractType,
      prevClause: player.tradeClause,
      prevNoTrade: player.noTradeTeams,
      prevRosterType: player.rosterType,
      prevTeamId: player.teamId,
      prevContractText: player.contractText,
    },
  });

  revalidatePath("/admin/agent");
  revalidatePath("/admin/signings");
  revalidatePath("/free-agents");
  return { ok: true as const };
}

/** Break off talks: send player to test UFA or make RFA offer-sheet eligible. */
export async function forceWalkResignAction(playerId: number, toUFA: boolean) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };

  const status = toUFA ? "walkedToUFA" : "osEligible";
  await prisma.player.update({
    where: { id: playerId },
    data: {
      resignStatus: status,
      resignRound: 2,
    },
  });

  revalidatePath("/admin/agent");
  revalidatePath("/free-agents");
  return { ok: true as const };
}

/** Clear lowball insult penalty for a player with their club. */
export async function clearPlayerLowballAction(playerId: number, teamId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };

  await prisma.faLowball.deleteMany({
    where: { playerId, teamId },
  }).catch(() => {});

  revalidatePath("/admin/agent");
  return { ok: true as const };
}

/** Revoke a tendered qualifying offer (commissioner-only): the RFA case goes back to
 *  "QO due" with the tender and any arbitration progress cleared. If his QO deadline has
 *  already passed, the next deadline sweep treats him as un-tendered (rights lapse) — the
 *  confirm dialog on the button says so. */
export async function cancelQualifyingOfferAction(caseId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const c = await prisma.rfaCase.findUnique({ where: { id: caseId } });
  if (!c) return { ok: false as const, error: "Case not found." };
  if (!["QO_TENDERED", "NEGOTIATING", "ARB_FILED", "AWARDED", "OS_ELIGIBLE"].includes(c.status)) return { ok: false as const, error: "No tendered QO to cancel." };
  await prisma.rfaCase.update({
    where: { id: caseId },
    data: {
      status: "QO_DUE", qoTenderedAt: null, arbFiledBy: null, arbFiledAt: null,
      clubAskAav: null, clubAskTerm: null, playerAskAav: null, playerAskTerm: null,
      awardAav: null, awardTerm: null, awardContractType: null,
      walkAwayThreshold: null, walkAwayDeadline: null, walkAwayAt: null, offerSheetEligibleAt: null, resolvedAt: null,
    },
  });
  revalidatePath("/admin/agent");
  revalidatePath("/rfa");
  revalidatePath("/offer-sheets");
  return { ok: true as const };
}

/** Commissioner shortcut: issue an open arbitration verdict now instead of waiting the 48 hours. */
export async function forceArbitrationVerdictAction(caseId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const { issueArbitrationVerdict } = await import("@/lib/rfa-server");
  const r = await issueArbitrationVerdict(caseId);
  revalidatePath("/admin/agent"); revalidatePath("/rfa");
  return r.ok ? { ok: true as const, award: r.award, term: r.term } : { ok: false as const, error: r.error ?? "Failed" };
}
