"use server";

// Offer-sheet engine (DB side). A rival club submits an offer sheet on another
// team's RFA once he's osEligible (July 1–8). Each player's AI decides by July
// 10: he signs the best offer that meets his demand AND beats his own club's
// standing offer, else declines. When signed, the poaching club sends the
// compensation picks — which MUST be its own original picks — to the old club.

import { prisma } from "./prisma";
import { loadSettings } from "./sim/settings";
import { compensationFor, compensationLabel } from "./offer-sheet";
import { twoWayObjection } from "./free-agency";
import { evaluateTeamOffer, weakestTeams, loadLeagueCap } from "./free-agency-server";
import { canManageTeam } from "./auth";
import { getLeagueClock } from "./calendar-server";
import { CURRENT_SEASON_START, capCeilingForPhase, ltirRelief } from "./finance";

type Ok = { ok: true };
type Err = { ok: false; error: string };
type OfferSheetRow = Awaited<ReturnType<typeof prisma.offerSheet.findMany>>[number];

/** DraftPick ids currently reserved by a pending offer sheet (can't be reused). */
async function reservedPickIds(exceptFromTeamId?: number, exceptPlayerId?: number): Promise<Set<number>> {
  const pending = await prisma.offerSheet.findMany({
    where: { status: "PENDING", NOT: exceptFromTeamId != null && exceptPlayerId != null ? { fromTeamId: exceptFromTeamId, playerId: exceptPlayerId } : undefined },
    select: { compPickIds: true },
  });
  const s = new Set<number>();
  for (const o of pending) for (const id of o.compPickIds) s.add(id);
  return s;
}

/** A club's own ORIGINAL, unreserved draft picks (teamId === its own logo), so a
 *  poaching club can only surrender picks that were truly its own — never picks
 *  it acquired from someone else. Ordered soonest-year first. */
async function availableOriginalPicks(teamId: number, reserved: Set<number>): Promise<{ id: number; round: number; year: number }[]> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { profinhlLogoId: true } });
  if (team?.profinhlLogoId == null) return []; // can't prove originality → no eligible picks
  const picks = await prisma.draftPick.findMany({
    where: { teamId, ownerLogoId: team.profinhlLogoId },
    select: { id: true, round: true, year: true },
    orderBy: [{ year: "asc" }, { round: "asc" }],
  });
  return picks.filter((p) => !reserved.has(p.id));
}

/** Match required rounds to a club's own original picks. Returns the pick ids to
 *  surrender, or the rounds it cannot cover. */
async function planPicks(teamId: number, requiredRounds: number[], reserved: Set<number>): Promise<{ ok: boolean; pickIds: number[]; missing: number[]; detail: { round: number; year: number }[] }> {
  const avail = await availableOriginalPicks(teamId, reserved);
  const byRound = new Map<number, { id: number; year: number }[]>();
  for (const p of avail) {
    const arr = byRound.get(p.round) ?? [];
    arr.push({ id: p.id, year: p.year });
    byRound.set(p.round, arr);
  }
  const pickIds: number[] = [];
  const missing: number[] = [];
  const detail: { round: number; year: number }[] = [];
  for (const r of [...requiredRounds].sort((a, b) => a - b)) {
    const pool = byRound.get(r) ?? [];
    const chosen = pool.shift(); // soonest year of that round
    if (!chosen) { missing.push(r); continue; }
    pickIds.push(chosen.id);
    detail.push({ round: r, year: chosen.year });
  }
  return { ok: missing.length === 0, pickIds, missing, detail };
}

/** Committed NHL cap + LTIR relief for a club (mirror of the FA action helper). */
async function teamCapInfo(teamId: number): Promise<{ committed: number; ltir: number }> {
  const roster = await prisma.player.findMany({
    where: { teamId, rosterType: "NHL" }, select: { capHit: true, injuryDaysLeft: true, condition: true, isGoalie: true },
  });
  const salaries = roster.reduce((t, p) => t + (p.capHit ?? 0), 0);
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { retainsBuyouts: true } });
  return { committed: salaries + (team?.retainsBuyouts ?? 0), ltir: ltirRelief(roster) };
}

const M = (c: number) => `$${(c / 1_000_000).toFixed(1)}M`;

/** Live preview for the offer-sheet modal: required compensation for this AAV and
 *  whether the club owns the original picks to pay it. */
export async function getOsCompPlanAction(fromTeamId: number, salary: number): Promise<{
  enabled: boolean; rounds: number[]; label: string; canCover: boolean; missing: number[]; detail: { round: number; year: number }[];
}> {
  const settings = await loadSettings();
  if (!settings.osCompEnabled) return { enabled: false, rounds: [], label: "no compensation", canCover: true, missing: [], detail: [] };
  const rounds = compensationFor(salary, settings.osCompTiers);
  const reserved = await reservedPickIds(fromTeamId); // ignore this club's own pending sheet? preview is fresh
  const plan = await planPicks(fromTeamId, rounds, reserved);
  return { enabled: true, rounds, label: compensationLabel(rounds), canCover: plan.ok, missing: plan.missing, detail: plan.detail };
}

/** Submit an offer sheet on an osEligible RFA. Validates the window, eligibility,
 *  salary floor, cap room, and — crucially — that the club owns the compensation
 *  picks as its own originals, then reserves them. */
export async function submitOfferSheetAction(
  playerId: number, fromTeamId: number,
  salary: number, years: number, twoWay: boolean,
  line: number, pp: boolean, pk: boolean,
  grantClause?: string | null, mNtcBreadth?: number | null,
): Promise<Ok | Err> {
  if (!(await canManageTeam(fromTeamId))) return { ok: false, error: "You don't manage this team." };
  const settings = await loadSettings();
  const clock = await getLeagueClock();
  const inWindow = clock.frenzyOpen && clock.frenzyDay >= settings.osOpenDay && clock.frenzyDay <= settings.osCloseDay;
  if (!inWindow) return { ok: false, error: `The offer-sheet window is day ${settings.osOpenDay}–${settings.osCloseDay} of the off-season.` };

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { name: true, teamId: true, age: true, overall: true, lastSeasonGP: true, franchiseTag: true, resignStatus: true, contractYears: true },
  });
  if (!player) return { ok: false, error: "Player not found." };
  if (player.teamId === fromTeamId) return { ok: false, error: "He's already yours — re-sign him on the Contracts page." };
  if (player.franchiseTag) return { ok: false, error: "He's Franchise-tagged — his club gets two re-sign rounds before any offer sheet." };
  if (player.resignStatus !== "osEligible") return { ok: false, error: "He isn't open to offer sheets — his club is still negotiating with him." };

  const yrs = Math.max(1, Math.min(4, Math.round(years)));
  if (salary < 775_000) return { ok: false, error: "Below the league minimum salary." };
  // two-way rules mirror the FA/extension flow (real NHL games, older players only)
  const twoWayErr = twoWayObjection(twoWay, player, yrs, { olderAge: settings.faTwoWayOlderAge, gpLimit: settings.faTwoWayNhlGpLimit, maxYears: settings.faTwoWayMaxYears });
  if (twoWayErr) return { ok: false, error: twoWayErr };

  // cap room (off-season ceiling = cap + 10%)
  const cap = await loadLeagueCap();
  const { committed, ltir } = await teamCapInfo(fromTeamId);
  const ceiling = capCeilingForPhase(cap.upper, clock.phase) + ltir;
  if (committed + salary > ceiling) {
    return { ok: false, error: `Over the off-season ceiling — ${M(ceiling - committed)} of room left, this offer is ${M(salary)}.` };
  }

  // compensation: the club must own its OWN original picks to pay
  const rounds = settings.osCompEnabled ? compensationFor(salary, settings.osCompTiers) : [];
  const reserved = await reservedPickIds(fromTeamId, playerId); // free up this club's own prior sheet on him
  const plan = await planPicks(fromTeamId, rounds, reserved);
  if (!plan.ok) {
    const label = compensationLabel(rounds);
    const missLabel = compensationLabel(plan.missing);
    return { ok: false, error: `This offer costs ${label}, but you're short ${missLabel} of your own original picks. You can only surrender picks that were originally yours.` };
  }

  const clause = grantClause && ["NTC", "NMC", "M_NTC"].includes(grantClause) ? grantClause : null;
  const breadth = clause === "M_NTC" ? ([6, 12, 18, 24].includes(mNtcBreadth ?? 0) ? mNtcBreadth! : 12) : null;

  await prisma.offerSheet.upsert({
    where: { playerId_fromTeamId: { playerId, fromTeamId } },
    update: { salary, years: yrs, twoWay, line, pp, pk, grantClause: clause, mNtcBreadth: breadth, compPickIds: plan.pickIds, status: "PENDING", toTeamId: player.teamId, note: null },
    create: { playerId, fromTeamId, toTeamId: player.teamId, salary, years: yrs, twoWay, line, pp, pk, grantClause: clause, mNtcBreadth: breadth, compPickIds: plan.pickIds, status: "PENDING" },
  });
  return { ok: true };
}

/** Pull an offer sheet before the July 10 decision. */
export async function withdrawOfferSheetAction(playerId: number, fromTeamId: number): Promise<Ok | Err> {
  if (!(await canManageTeam(fromTeamId))) return { ok: false, error: "You don't manage this team." };
  const os = await prisma.offerSheet.findUnique({ where: { playerId_fromTeamId: { playerId, fromTeamId } } });
  if (!os || os.status !== "PENDING") return { ok: false, error: "No live offer sheet to withdraw." };
  await prisma.offerSheet.update({ where: { id: os.id }, data: { status: "WITHDRAWN" } });
  return { ok: true };
}

/** Sign an accepted offer sheet: move the player, set the contract, and transfer
 *  the compensation picks to his old club. */
async function executeOfferSheet(os: OfferSheetRow, playerName: string): Promise<void> {
  const expiry = CURRENT_SEASON_START + os.years;
  const clause = os.grantClause && ["NTC", "NMC", "M_NTC"].includes(os.grantClause) ? os.grantClause : null;
  const noTradeTeams = clause === "M_NTC" ? await weakestTeams(os.mNtcBreadth ?? 12, os.fromTeamId) : [];
  const from = await prisma.team.findUnique({ where: { id: os.fromTeamId }, select: { code: true } });
  const to = await prisma.team.findUnique({ where: { id: os.toTeamId }, select: { code: true } });

  await prisma.$transaction([
    prisma.player.update({
      where: { id: os.playerId },
      data: {
        teamId: os.fromTeamId, rosterType: "NHL",
        capHit: os.salary, contractYears: os.years, contractExpiry: expiry,
        contractType: os.twoWay ? "TWO_WAY" : "ONE_WAY",
        contractText: `$${os.salary.toLocaleString("en-US")} × ${os.years}yr (through ${expiry})`,
        signPromiseLine: os.line, signPromisePP: os.pp, signPromisePK: os.pk,
        tradeClause: clause, noTradeTeams,
        franchiseTag: false, resignStatus: null, resignRound: 0, resignCounterSalary: null, resignCounterYears: null, resignOfferSalary: null,
        disgruntled: false, tradeRequested: false,
      },
    }),
    // compensation picks go to the old club (ownerLogoId stays — they remain that club's originals now returning home / arriving)
    prisma.draftPick.updateMany({ where: { id: { in: os.compPickIds } }, data: { teamId: os.toTeamId } }),
    prisma.offerSheet.update({ where: { id: os.id }, data: { status: "ACCEPTED" } }),
    prisma.transaction.create({
      data: { type: "SIGNING", message: `${from?.code ?? "?"} signed ${playerName} to an offer sheet — $${(os.salary / 1e6).toFixed(2)}M × ${os.years}yr; ${to?.code ?? "?"} receives ${compensationLabel(await compRounds(os.compPickIds))}` },
    }),
  ]);
}

async function compRounds(pickIds: number[]): Promise<number[]> {
  if (!pickIds.length) return [];
  const picks = await prisma.draftPick.findMany({ where: { id: { in: pickIds } }, select: { round: true } });
  return picks.map((p) => p.round);
}

/** Resolve all live offer sheets (July 10). For each player, sign the best offer
 *  that meets his demand AND beats his own club's standing offer; decline the
 *  rest. RFAs left unsigned reopen to their own club's further re-sign rounds. */
export async function resolveOfferSheets(): Promise<{ signed: number; declined: number; details: string[] }> {
  const pending = await prisma.offerSheet.findMany({ where: { status: "PENDING" } });
  if (pending.length === 0) return { signed: 0, declined: 0, details: [] };

  const byPlayer = new Map<number, typeof pending>();
  for (const os of pending) {
    const arr = byPlayer.get(os.playerId) ?? [];
    arr.push(os);
    byPlayer.set(os.playerId, arr);
  }

  let signed = 0, declined = 0;
  const details: string[] = [];

  for (const [playerId, sheets] of byPlayer) {
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { name: true, teamId: true, resignStatus: true, franchiseTag: true, resignOfferSalary: true },
    });
    // no longer eligible (signed elsewhere, tagged, etc.) → decline them all
    if (!player || player.resignStatus !== "osEligible" || player.franchiseTag) {
      await prisma.offerSheet.updateMany({ where: { id: { in: sheets.map((s) => s.id) }, status: "PENDING" }, data: { status: "DECLINED", note: "No longer available." } });
      declined += sheets.length;
      continue;
    }
    const ownOffer = player.resignOfferSalary ?? 0;

    // rank qualifying offers: meets demand, beats own club, picks still valid
    let winner: { os: (typeof sheets)[number]; utility: number } | null = null;
    for (const os of sheets) {
      if (os.salary <= ownOffer) continue; // must beat his own club's offer
      const ev = await evaluateTeamOffer(playerId, os.fromTeamId, os.salary, os.years, { line: os.line, pp: os.pp, pk: os.pk }, undefined, undefined, undefined, { clause: os.grantClause, breadth: os.mNtcBreadth });
      if (!ev?.acceptable) continue;
      // re-verify the poaching club still owns those original picks
      const stillOwned = await picksStillOwned(os.fromTeamId, os.compPickIds);
      if (!stillOwned) continue;
      if (!winner || ev.utility > winner.utility) winner = { os, utility: ev.utility };
    }

    if (winner) {
      await executeOfferSheet(winner.os, player.name);
      signed++;
      const others = sheets.filter((s) => s.id !== winner!.os.id);
      if (others.length) await prisma.offerSheet.updateMany({ where: { id: { in: others.map((s) => s.id) }, status: "PENDING" }, data: { status: "DECLINED", note: "He signed a better offer sheet." } });
      declined += others.length;
      const from = await prisma.team.findUnique({ where: { id: winner.os.fromTeamId }, select: { code: true } });
      details.push(`${player.name} → ${from?.code ?? "?"} (offer sheet)`);
    } else {
      // nobody cleared the bar — he stays, and reopens to his own club's next rounds
      await prisma.offerSheet.updateMany({ where: { id: { in: sheets.map((s) => s.id) }, status: "PENDING" }, data: { status: "DECLINED", note: "Didn't beat his club / meet his ask." } });
      declined += sheets.length;
      await prisma.player.update({ where: { id: playerId }, data: { resignStatus: "open", resignRound: 0 } });
    }
  }
  return { signed, declined, details };
}

async function picksStillOwned(teamId: number, pickIds: number[]): Promise<boolean> {
  if (pickIds.length === 0) return true;
  const owned = await prisma.draftPick.count({ where: { id: { in: pickIds }, teamId } });
  return owned === pickIds.length;
}
