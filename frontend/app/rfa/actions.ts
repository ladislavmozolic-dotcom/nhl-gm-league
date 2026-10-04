"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { getLeagueDate } from "@/lib/calendar-server";
import { loadSettings } from "@/lib/sim/settings";
import { arbitrationRange, ensureRfaCases } from "@/lib/rfa-server";
import { CURRENT_SEASON_START, TWO_WAY_AHL_SALARY } from "@/lib/finance";
import { twoWayObjection } from "@/lib/free-agency";

const refresh = () => { revalidatePath("/rfa"); revalidatePath("/offer-sheets"); };

async function ownedCase(caseId: number, teamId: number) {
  if (!(await canManageTeam(teamId))) return null;
  return prisma.rfaCase.findFirst({ where: { id: caseId, teamId }, include: { player: true } });
}

export async function tenderQualifyingOfferAction(caseId: number, teamId: number) {
  const c = await ownedCase(caseId, teamId);
  if (!c) return { ok: false as const, error: "You don't manage this RFA." };
  if (c.status !== "QO_DUE") return { ok: false as const, error: "The qualifying-offer deadline has already been resolved." };
  if (c.qoDueAt < await getLeagueDate()) return { ok: false as const, error: "The QO deadline has passed." };
  await prisma.rfaCase.update({ where: { id: caseId }, data: { status: "QO_TENDERED", qoTenderedAt: new Date() } });
  refresh();
  return { ok: true as const };
}

export async function fileArbitrationAction(caseId: number, teamId: number, filedBy: "CLUB" | "PLAYER") {
  const c = await ownedCase(caseId, teamId);
  if (!c) return { ok: false as const, error: "You don't manage this RFA." };
  if (!c.arbEligible) return { ok: false as const, error: "This player is not arbitration eligible yet." };
  if (!["QO_TENDERED", "NEGOTIATING", "OS_ELIGIBLE"].includes(c.status)) return { ok: false as const, error: "Tender a QO before filing arbitration." };
  await prisma.rfaCase.update({ where: { id: caseId }, data: { status: "ARB_FILED", arbFiledBy: filedBy, arbFiledAt: new Date() } });
  refresh();
  return { ok: true as const };
}

export async function decideArbitrationAction(caseId: number, teamId: number, clubAav: number, clubTerm: number, playerAav: number, playerTerm: number, contractType: "ONE_WAY" | "TWO_WAY" = "ONE_WAY") {
  const c = await ownedCase(caseId, teamId);
  if (!c) return { ok: false as const, error: "You don't manage this RFA." };
  if (c.status !== "ARB_FILED") return { ok: false as const, error: "No arbitration hearing is open." };
  if (![clubAav, playerAav].every(Number.isFinite) || clubAav <= 0 || playerAav <= 0) return { ok: false as const, error: "Enter both AAV submissions." };
  const range = await arbitrationRange(c.playerId, c.qoAmount);
  const target = Math.max(range.low, Math.min(range.high, Math.round((clubAav + playerAav) / 2 / 50_000) * 50_000));
  const term = Math.max(1, Math.min(2, Math.round((clubTerm + playerTerm) / 2)));
  const s = await loadSettings();
  // a two-way award obeys the same player-willingness rules as a two-way re-sign
  const type = contractType === "TWO_WAY" ? "TWO_WAY" : "ONE_WAY";
  const objection = twoWayObjection(type === "TWO_WAY", c.player, term, target, {
    olderAge: s.faTwoWayOlderAge, gpLimit: s.faTwoWayNhlGpLimit, weakOverall: s.faTwoWayWeakOverall,
    maxYears: s.faTwoWayMaxYears, ahlMaxYears: s.faTwoWayAhlMaxYears, fewGpMaxYears: s.faTwoWayFewGpMaxYears, maxSalary: s.faTwoWayMaxSalary,
  });
  if (objection) return { ok: false as const, error: objection };
  await prisma.rfaCase.update({ where: { id: caseId }, data: {
    status: "AWARDED", clubAskAav: Math.round(clubAav), clubAskTerm: Math.max(1, Math.round(clubTerm)),
    playerAskAav: Math.round(playerAav), playerAskTerm: Math.max(1, Math.round(playerTerm)),
    awardAav: target, awardTerm: term, awardContractType: type, walkAwayThreshold: s.arbWalkAwayThreshold,
    walkAwayDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
  } });
  refresh();
  return { ok: true as const, award: target, term, low: range.low, high: range.high, contractType: type };
}


export async function acceptArbitrationAwardAction(caseId: number, teamId: number) {
  const c = await ownedCase(caseId, teamId);
  if (!c || c.status !== "AWARDED" || !c.awardAav || !c.awardTerm) return { ok: false as const, error: "No award is ready to sign." };
  const expiry = CURRENT_SEASON_START + c.awardTerm;
  const twoWay = c.awardContractType === "TWO_WAY";
  await prisma.$transaction([
    prisma.player.update({ where: { id: c.playerId }, data: { capHit: c.awardAav, contractYears: c.awardTerm, contractExpiry: expiry, contractType: twoWay ? "TWO_WAY" : "ONE_WAY", ahlSalary: twoWay ? TWO_WAY_AHL_SALARY : null, contractText: `$${c.awardAav.toLocaleString("en-US")} × ${c.awardTerm}yr ${twoWay ? "two-way" : "one-way"} (arbitration award, through ${expiry})`, rightsReleased: false, resignStatus: null, resignRound: 0, franchiseTag: false } }),
    prisma.rfaCase.update({ where: { id: caseId }, data: { status: "SIGNED", resolvedAt: new Date() } }),
  ]);
  refresh();
  return { ok: true as const };
}

export async function walkAwayArbitrationAction(caseId: number, teamId: number) {
  const c = await ownedCase(caseId, teamId);
  if (!c || c.status !== "AWARDED" || !c.awardAav || !c.walkAwayThreshold) return { ok: false as const, error: "No walk-away decision is available." };
  if (c.awardAav < c.walkAwayThreshold) return { ok: false as const, error: "This award is below the league walk-away threshold." };
  await prisma.$transaction([
    prisma.player.update({ where: { id: c.playerId }, data: { rosterType: "UFA", rightsReleased: true, franchiseTag: false, resignStatus: "walkedToUFA", contractYears: 0, capHit: 0, contractText: "UFA — arbitration walk-away" } }),
    prisma.rfaCase.update({ where: { id: caseId }, data: { status: "WALKED_AWAY", walkAwayAt: new Date(), resolvedAt: new Date() } }),
  ]);
  refresh();
  return { ok: true as const };
}

export async function bootstrapRfaCasesAction(teamId: number) {
  if (!(await canManageTeam(teamId))) return { ok: false as const, error: "You don't manage this team." };
  await ensureRfaCases(teamId);
  refresh();
  return { ok: true as const };
}
