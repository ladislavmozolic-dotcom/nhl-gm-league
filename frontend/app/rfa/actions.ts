"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { getLeagueClock, getLeagueDate } from "@/lib/calendar-server";
import { loadSettings } from "@/lib/sim/settings";
import { arbitrationRange, ensureRfaCases, qoFormInfo, qoOneWayMessage } from "@/lib/rfa-server";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { twoWayObjection } from "@/lib/free-agency";

const refresh = () => { revalidatePath("/rfa"); revalidatePath("/offer-sheets"); };

async function ownedCase(caseId: number, teamId: number) {
  if (!(await canManageTeam(teamId))) return null;
  return prisma.rfaCase.findFirst({ where: { id: caseId, teamId }, include: { player: true } });
}

export async function tenderQualifyingOfferAction(caseId: number, teamId: number, contractType: "ONE_WAY" | "TWO_WAY" = "ONE_WAY") {
  const c = await ownedCase(caseId, teamId);
  if (!c) return { ok: false as const, error: "You don't manage this RFA." };
  if (c.status !== "QO_DUE") return { ok: false as const, error: "The qualifying-offer deadline has already been resolved." };
  if (c.qoDueAt < await getLeagueDate()) return { ok: false as const, error: "The QO deadline has passed." };
  // the QO is a 1-year offer; as a two-way it must pass the same player-willingness rules
  const type = contractType === "TWO_WAY" ? "TWO_WAY" : "ONE_WAY";
  if (type === "TWO_WAY") {
    // CBA: an established player (180+ GP in 3 yrs, 60+ last season, no waivers) must get a one-way QO
    const info = (await qoFormInfo([c.player])).get(c.player.id);
    if (info?.oneWayRequired) return { ok: false as const, error: qoOneWayMessage(info) };
    const s = await loadSettings();
    const objection = twoWayObjection(true, c.player, 1, c.qoAmount, {
      olderAge: s.faTwoWayOlderAge, gpLimit: s.faTwoWayNhlGpLimit, weakOverall: s.faTwoWayWeakOverall,
      maxYears: s.faTwoWayMaxYears, ahlMaxYears: s.faTwoWayAhlMaxYears, fewGpMaxYears: s.faTwoWayFewGpMaxYears, maxSalary: s.faTwoWayMaxSalary,
    });
    if (objection) return { ok: false as const, error: objection };
  }
  await prisma.rfaCase.update({ where: { id: caseId }, data: { status: "QO_TENDERED", qoTenderedAt: new Date(), qoContractType: type } });
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
  if (type === "TWO_WAY") {
    const info = (await qoFormInfo([c.player])).get(c.player.id);
    if (info?.oneWayRequired) return { ok: false as const, error: qoOneWayMessage(info) };
  }
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


/** Put an arbitration signing into Recent Signings (public feed) and the revertible signing log. */
async function logArbitrationSigning(c: { playerId: number; teamId: number; awardAav: number | null; awardTerm: number | null; player: { name: string; capHit: number | null; contractYears: number | null; contractExpiry: number | null; ahlSalary: number | null; contractType: string | null; tradeClause: string | null; noTradeTeams: number[]; rosterType: string | null; teamId: number; contractText: string | null } }, deferred: boolean, startYear: number) {
  const team = await prisma.team.findUnique({ where: { id: c.teamId }, select: { code: true, parentTeam: { select: { code: true } } } });
  const code = team?.parentTeam?.code ?? team?.code ?? "?";
  const salary = c.awardAav ?? 0, years = c.awardTerm ?? 0;
  await prisma.transaction.create({ data: { type: "SIGNING", message: `${code} signed ${c.player.name} via arbitration — $${(salary / 1e6).toFixed(2)}M × ${years}yr${deferred ? ` (from ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")})` : ""}` } }).catch(() => {});
  await prisma.signingLog.create({ data: {
    playerId: c.playerId, playerName: c.player.name, teamCode: code, kind: "EXTEND", salary, years,
    prevCapHit: c.player.capHit, prevYears: c.player.contractYears, prevExpiry: c.player.contractExpiry,
    prevAhlSalary: c.player.ahlSalary != null ? Math.round(c.player.ahlSalary) : null,
    prevType: c.player.contractType, prevClause: c.player.tradeClause, prevNoTrade: c.player.noTradeTeams,
    prevRosterType: c.player.rosterType, prevTeamId: c.player.teamId, prevContractText: c.player.contractText,
  } }).catch(() => {});
}

export async function acceptArbitrationAwardAction(caseId: number, teamId: number) {
  const c = await ownedCase(caseId, teamId);
  if (!c || c.status !== "AWARDED" || !c.awardAav || !c.awardTerm) return { ok: false as const, error: "No award is ready to sign." };
  const twoWay = c.awardContractType === "TWO_WAY";
  const kind = twoWay ? "two-way" : "one-way";
  const type = twoWay ? "TWO_WAY" : "ONE_WAY";
  // Same rule as every other extension signed in-season: a player who still has a running deal
  // keeps it (salary, cap hit, term) until it expires — the award only STARTS next season. Only a
  // player whose deal has already run out (contractYears 0) takes the new contract right away.
  const phase = (await getLeagueClock()).phase;
  const deferred = (c.player.contractYears ?? 0) >= 1 && (phase === "regular" || phase === "playoffs");
  if (deferred) {
    const startYear = CURRENT_SEASON_START + (c.player.contractYears ?? 1);
    const expiry = startYear + c.awardTerm;
    await prisma.$transaction([
      prisma.player.update({ where: { id: c.playerId }, data: {
        extCapHit: c.awardAav, extYears: c.awardTerm, extContractType: type, extClause: null, extNoTradeTeams: [],
        extText: `$${c.awardAav.toLocaleString("en-US")} × ${c.awardTerm}yr ${kind} (arbitration award, through ${expiry})`,
        resignStatus: "extended", rightsReleased: false, franchiseTag: false,
      } }),
      prisma.rfaCase.update({ where: { id: caseId }, data: { status: "SIGNED", resolvedAt: new Date() } }),
    ]);
    await logArbitrationSigning(c, true, startYear);
    refresh();
    return { ok: true as const, deferred: true as const, startsSeason: startYear };
  }
  const expiry = CURRENT_SEASON_START + c.awardTerm;
  await prisma.$transaction([
    prisma.player.update({ where: { id: c.playerId }, data: { capHit: c.awardAav, contractYears: c.awardTerm, contractExpiry: expiry, contractType: type, ahlSalary: null /* two-way award: he is paid the FULL salary on the farm too — off the cap, into Finance (liveAhlSalary falls back to capHit) */, contractText: `$${c.awardAav.toLocaleString("en-US")} × ${c.awardTerm}yr ${kind} (arbitration award, through ${expiry})`, rightsReleased: false, resignStatus: null, resignRound: 0, franchiseTag: false } }),
    prisma.rfaCase.update({ where: { id: caseId }, data: { status: "SIGNED", resolvedAt: new Date() } }),
  ]);
  await logArbitrationSigning(c, false, CURRENT_SEASON_START);
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
