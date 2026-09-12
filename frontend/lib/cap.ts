// One place for salary-cap compliance. The effective ceiling is the phase
// ceiling (strict in-season, +10% off-season cushion) plus LTIR relief; a legal
// club sits between the lower limit (floor) and that ceiling.

import { prisma } from "./prisma";
import { getLeagueClock } from "./calendar-server";
import { loadLeagueCap } from "./free-agency-server";
import { loadSettings } from "./sim/settings";
import { capCeilingForPhase, ltirRelief, deadMoneyForYear, liveCapHit, CURRENT_SEASON_START } from "./finance";

export type CapStatus = {
  committed: number; ltir: number; ceiling: number; space: number;
  floor: number; underFloorBy: number; overBy: number;
  phase: string; cushioned: boolean; compliant: boolean;
  // `space` is measured against `ceiling`, which off-season includes the
  // +10% compliance grace (OFFSEASON_CUSHION) — real, but not spendable room:
  // a GM who signs up to it is still meaningfully over the real cap, just not
  // in violation yet. `strictSpace` is the same figure against the actual,
  // uncushioned league ceiling — what Cap Central calls "Actual Cap Space".
  // Anywhere this gets shown to a GM as "how much can I spend" should read
  // strictSpace, not space, or it silently overstates room by the cushion.
  strictSpace: number;
  // How much of this club's trade-retention capacity is already used by
  // ACTIVE retentions from past trades (see RetentionStatus below) — surfaced
  // here too so the Trade Builder can show it alongside cap space without a
  // second round-trip.
  retentionSlotsUsed: number; retentionSlotsMax: number;
  retentionPctUsed: number; retentionPctMax: number;
  retentionMaxPct: number; // max % a single contract may have retained (the slider's own cap)
  capUpper: number; // the real, uncushioned league cap ceiling — the base retentionPctUsed/Max are computed against
};

export type RetentionStatus = {
  slotsUsed: number; slotsMax: number;
  pctOfCap: number; pctMax: number;
  deadCapAmount: number;
};

/** Active trade-retention (Buyout rows with totalCost=0) for one club: how many
 *  "slots" it's using and the combined dead-money cap hit they carry this season. */
async function activeRetentionRecords(teamId: number): Promise<{ slotsUsed: number; deadCapAmount: number }> {
  const records = await prisma.buyout.findMany({ where: { teamId, totalCost: 0 }, select: { perYear: true, years: true, startYear: true } });
  const active = records.filter((r) => CURRENT_SEASON_START >= r.startYear && CURRENT_SEASON_START < r.startYear + r.years);
  return { slotsUsed: active.length, deadCapAmount: deadMoneyForYear(active, CURRENT_SEASON_START) };
}

/** How much of a club's configured retention capacity — max retained contracts
 *  (retentionMaxPlayersOut) and max % of the cap tied up in retention
 *  (retentionMaxTotalPct) — is already spoken for by active retentions from
 *  past trades. Note: per the Admin > Salary Retention page's own TODO, these
 *  two limits aren't enforced by the trade engine (lib/trade-exec.ts) yet —
 *  this is purely informational, so a GM can see their real room before
 *  proposing a deal. */
export async function teamRetentionStatus(teamId: number): Promise<RetentionStatus> {
  const [settings, cap, { slotsUsed, deadCapAmount }] = await Promise.all([loadSettings(), loadLeagueCap(), activeRetentionRecords(teamId)]);
  return {
    slotsUsed, slotsMax: settings.retentionMaxPlayersOut,
    pctOfCap: cap.upper > 0 ? (deadCapAmount / cap.upper) * 100 : 0,
    pctMax: settings.retentionMaxTotalPct,
    deadCapAmount,
  };
}

/** A team's live cap-relevant totals, split the way Cap Central shows them:
 *  totalSalaries = Σ full (gross) cap hits of the NHL roster — a player's own
 *  Cap Hit never changes just because someone else is paying part of it.
 *  retainsBuyouts = the net adjustment on top: NEGATIVE for relief this club
 *  gets from acquiring a player another club partly retained (Player.
 *  retainedSalary — never this team's to carry), POSITIVE for dead money this
 *  team itself is carrying this season from a buyout or its own trade
 *  retention (Buyout rows, summed live — nothing caches this). */
export async function teamCapCommitted(teamId: number): Promise<{ totalSalaries: number; retainsBuyouts: number; committed: number }> {
  const [roster, buyouts] = await Promise.all([
    prisma.player.findMany({ where: { teamId, rosterType: "NHL" }, select: { capHit: true, retainedSalary: true, contractYears: true } }),
    prisma.buyout.findMany({ where: { teamId }, select: { perYear: true, years: true, startYear: true } }),
  ]);
  // a player whose contract has fully expired (contractYears 0) carries no
  // salary until he re-signs or is swept to UFA — his frozen last capHit must
  // not still count against the cap (see liveCapHit).
  const totalSalaries = roster.reduce((s, p) => s + liveCapHit(p), 0);
  const retentionRelief = roster.reduce((s, p) => s + (p.retainedSalary ?? 0), 0);
  const deadMoney = deadMoneyForYear(buyouts, CURRENT_SEASON_START);
  const retainsBuyouts = deadMoney - retentionRelief;
  return { totalSalaries, retainsBuyouts, committed: totalSalaries + retainsBuyouts };
}

/** Cap status for one club. Pass `phaseOverride` (e.g. "regular") to test
 *  compliance against a different phase — used for the opening-day check. */
export async function teamCapStatus(teamId: number, phaseOverride?: string): Promise<CapStatus> {
  const [roster, capInfo, cap, clock, settings, retention] = await Promise.all([
    prisma.player.findMany({ where: { teamId, rosterType: "NHL" }, select: { capHit: true, retainedSalary: true, injuryDaysLeft: true, condition: true, isGoalie: true, contractYears: true } }),
    teamCapCommitted(teamId),
    loadLeagueCap(),
    getLeagueClock(),
    loadSettings(),
    activeRetentionRecords(teamId),
  ]);
  const phase = phaseOverride ?? clock.phase;
  const committed = capInfo.committed;
  // LTIR relief is based on what this club actually carries for the injured
  // player (net of any retention it benefits from), matching `committed` above —
  // and, same as there, a contract-less player's frozen capHit is 0, not stale.
  const ltirRoster = roster.map((p) => ({ ...p, capHit: Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)) }));
  const ltir = ltirRelief(ltirRoster);
  const ceiling = capCeilingForPhase(cap.upper, phase) + ltir;
  const floor = cap.lower;
  return {
    committed, ltir, ceiling, space: ceiling - committed, floor,
    underFloorBy: Math.max(0, floor - committed),
    overBy: Math.max(0, committed - ceiling),
    phase, cushioned: phase !== "regular" && phase !== "playoffs",
    compliant: committed <= ceiling && committed >= floor,
    strictSpace: cap.upper + ltir - committed,
    retentionSlotsUsed: retention.slotsUsed, retentionSlotsMax: settings.retentionMaxPlayersOut,
    retentionPctUsed: cap.upper > 0 ? (retention.deadCapAmount / cap.upper) * 100 : 0,
    retentionPctMax: settings.retentionMaxTotalPct,
    retentionMaxPct: settings.retentionMaxPct,
    capUpper: cap.upper,
  };
}

export type CapOffender = { teamId: number; code: string | null; name: string; over: number; underFloor: number };

/** Every non-compliant NHL club, judged against `phase` (defaults to now). */
export async function leagueCapCompliance(phase?: string): Promise<CapOffender[]> {
  const teams = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, code: true, name: true } });
  const out: CapOffender[] = [];
  for (const t of teams) {
    const s = await teamCapStatus(t.id, phase);
    if (s.overBy > 0 || s.underFloorBy > 0) out.push({ teamId: t.id, code: t.code, name: t.name, over: s.overBy, underFloor: s.underFloorBy });
  }
  return out;
}

/** Would adding `addHit` to this club's cap keep it legal for the current phase?
 *  (Used to gate in-season call-ups / waiver claims / signings.) */
export async function canAddCapHit(teamId: number, addHit: number): Promise<{ ok: boolean; status: CapStatus }> {
  const status = await teamCapStatus(teamId);
  return { ok: status.committed + addHit <= status.ceiling, status };
}
