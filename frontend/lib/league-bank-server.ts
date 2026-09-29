// League Bank — the commissioner's pot. Opening balance 20M; fines, forfeited
// suspension salary and manual income flow in, bonuses / pick-em payouts go out.
// Balance is always openingBalance + Σ LeagueBankEntry.amount.
//
// Daily enforcement — REGULAR SEASON ONLY (off-season + playoffs: +10% cap cushion, no fines).
// (called from the cron, once per Europe/Bratislava day):
//   • NHL roster not compliant  → nhlRosterFine   (default 100K)
//   • AHL roster not compliant  → ahlRosterFine   (default  50K)
//   • club over the salary cap  → capFinePerDay    (default 200K) and the overage
//     is logged in CapOverageDay; accumulated overage × capPenaltyMultiplier
//     (default 2×) becomes a cap-ceiling reduction NEXT season (TeamCapPenalty,
//     read by lib/cap.ts and the Cap Central pages).
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { posGroup } from "./ratingBands";
import { DRESS_TARGET, ROSTER_LIMITS } from "./roster-rules";
import { teamCapStatus } from "./cap";
import { getLeagueClock } from "./calendar-server";
import { CURRENT_SEASON_START, money } from "./finance";

export async function getBank() {
  return prisma.leagueBank.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export async function bankBalance(): Promise<number> {
  const [bank, agg] = await Promise.all([getBank(), prisma.leagueBankEntry.aggregate({ _sum: { amount: true } })]);
  return bank.openingBalance + (agg._sum.amount ?? 0);
}

/** Move money on a club's own books (bank + the ledger adjustment that survives recomputes). */
export async function moveTeamBank(teamId: number, delta: number) {
  if (!delta) return;
  await prisma.team.update({ where: { id: teamId }, data: { bankAccount: { increment: delta }, ledgerAdj: { increment: delta } } });
}

/** Record a league-bank movement. Returns false if `dedupeKey` was already booked. */
export async function postEntry(e: { kind: string; amount: number; teamId?: number | null; note?: string; day?: string | null; dedupeKey?: string }): Promise<boolean> {
  const team = e.teamId ? await prisma.team.findUnique({ where: { id: e.teamId }, select: { name: true } }) : null;
  try {
    await prisma.leagueBankEntry.create({ data: { kind: e.kind, amount: Math.round(e.amount), teamId: e.teamId ?? null, teamName: team?.name ?? null, note: e.note ?? null, day: e.day ?? null, dedupeKey: e.dedupeKey ?? null } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
    throw err;
  }
}

/** Forfeited suspension salary: the club pays it (never gets it back) and it lands in the league bank.
 *  A negative amount refunds the club after an appeal. Returns false when the rule is switched off
 *  (caller then falls back to crediting the club, the old behaviour). */
export async function suspensionSalaryToBank(teamId: number | null, amount: number, note: string): Promise<boolean> {
  const bank = await getBank();
  if (!bank.suspensionToBank) return false;
  if (!amount) return true;
  await postEntry({ kind: amount > 0 ? "SUSPENSION_SALARY" : "REFUND", amount, teamId, note });
  if (amount < 0 && teamId) await moveTeamBank(teamId, -amount); // refund goes back to the club
  return true;
}

/** A player fine (Player Safety, CBA max $5,000): the club pays it, the league bank collects it. */
export async function playerFineToBank(teamId: number | null, amount: number, note: string) {
  if (!teamId || amount <= 0) return;
  const bank = await getBank();
  if (!bank.suspensionToBank) return;
  await postEntry({ kind: "FINE_PLAYER", amount, teamId, note });
  await moveTeamBank(teamId, -amount);
}

type Counts = { F: number; D: number; G: number };
async function sideCheck(teamId: number, rosterType: "NHL" | "AHL"): Promise<{ total: number; counts: Counts }> {
  const rows = await prisma.player.findMany({ where: { teamId, rosterType }, select: { position: true, isGoalie: true, scratched: true } });
  const counts: Counts = { F: 0, D: 0, G: 0 };
  for (const p of rows) if (!p.scratched) counts[posGroup(p.position, p.isGoalie)]++;
  return { total: rows.length, counts };
}
const offLines = (c: Counts) => c.F !== DRESS_TARGET.F || c.D !== DRESS_TARGET.D || c.G !== DRESS_TARGET.G;
const fmt = (c: Counts) => `${c.F}F/${c.D}D/${c.G}G`;

export type RosterProblem = { nhl: string | null; ahl: string | null };

/** Why (if at all) a club's NHL / AHL roster breaks the league criteria. */
export async function rosterProblems(teamId: number, affiliateId: number | null): Promise<RosterProblem> {
  const nhl = await sideCheck(teamId, "NHL");
  const ahl = affiliateId ? await sideCheck(affiliateId, "AHL") : null;
  const nhlWhy: string[] = [];
  if (nhl.total > ROSTER_LIMITS.proMax) nhlWhy.push(`${nhl.total} players (max ${ROSTER_LIMITS.proMax})`);
  if (offLines(nhl.counts)) nhlWhy.push(`dressed ${fmt(nhl.counts)}, need ${fmt(DRESS_TARGET)}`);
  const ahlWhy: string[] = [];
  if (ahl) {
    if (offLines(ahl.counts)) ahlWhy.push(`dressed ${fmt(ahl.counts)}, need ${fmt(DRESS_TARGET)}`);
    if (ahl.total + nhl.total > ROSTER_LIMITS.orgMax) ahlWhy.push(`organisation ${ahl.total + nhl.total} players (max ${ROSTER_LIMITS.orgMax})`);
  }
  return { nhl: nhlWhy.length ? nhlWhy.join("; ") : null, ahl: ahlWhy.length ? ahlWhy.join("; ") : null };
}

async function notifyClub(teamId: number, slug: string, body: string) {
  await prisma.dmMessage.create({ data: { fromTeamId: teamId, toTeamId: teamId, body, tradeUrl: `/finance/${slug}` } }).catch(() => {});
}

/** Rebuild every club's accumulated-overage penalty row for the current season from CapOverageDay. */
export async function recomputeCapPenalties(seasonStart = CURRENT_SEASON_START) {
  const bank = await getBank();
  const days = await prisma.capOverageDay.findMany({ where: { seasonStart }, select: { teamId: true, overBy: true } });
  const basis = new Map<number, number>();
  for (const d of days) {
    basis.set(d.teamId, bank.capAccumulate === "peak" ? Math.max(basis.get(d.teamId) ?? 0, d.overBy) : (basis.get(d.teamId) ?? 0) + d.overBy);
  }
  for (const [teamId, b] of basis) {
    await prisma.teamCapPenalty.upsert({
      where: { teamId_sourceSeasonStart: { teamId, sourceSeasonStart: seasonStart } },
      update: { basis: b },
      create: { teamId, sourceSeasonStart: seasonStart, appliesSeasonStart: seasonStart + 1, basis: b },
    });
  }
}

export type EnforcementResult = { ran: boolean; reason?: string; day?: string; rosterFines?: number; capFines?: number; totalFined?: number };

/** One day's automatic check. Idempotent per (club, day, kind). `force` skips the on/off + start-day gates (manual run). */
export async function enforceLeagueDay(day: string, opts: { force?: boolean } = {}): Promise<EnforcementResult> {
  const bank = await getBank();
  if (!opts.force) {
    if (!bank.enforcementEnabled) return { ran: false, reason: "enforcement is off" };
    if (!bank.enforcementStart || day < bank.enforcementStart) return { ran: false, reason: `fines start ${bank.enforcementStart ?? "(not set)"}` };
    // fines only bite in the regular season — off-season and playoffs the cap may be exceeded by 10%
    if ((await getLeagueClock()).phase !== "regular") return { ran: false, reason: "not the regular season" };
  }
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, slug: true, name: true, passwordHash: true, affiliateTeams: { select: { id: true } } },
  });
  let rosterFines = 0, capFines = 0, totalFined = 0;
  for (const t of teams) {
    if (!bank.finesForAiClubs && !t.passwordHash) continue; // AI-run club: nobody to fine
    const problems = await rosterProblems(t.id, t.affiliateTeams[0]?.id ?? null);
    const charge = async (kind: string, amount: number, why: string) => {
      if (amount <= 0) return false;
      const booked = await postEntry({ kind, amount, teamId: t.id, day, note: why, dedupeKey: `${kind}:${t.id}:${day}` });
      if (!booked) return false;
      await moveTeamBank(t.id, -amount);
      await notifyClub(t.id, t.slug, `💸 League fine ${money(amount)} — ${why}. Charged to your bank and paid into the league bank.`);
      totalFined += amount;
      return true;
    };
    if (problems.nhl && await charge("FINE_NHL_ROSTER", bank.nhlRosterFine, `NHL roster not compliant on ${day}: ${problems.nhl}`)) rosterFines++;
    if (problems.ahl && await charge("FINE_AHL_ROSTER", bank.ahlRosterFine, `AHL roster not compliant on ${day}: ${problems.ahl}`)) rosterFines++;

    const cap = await teamCapStatus(t.id);
    if (cap.overBy > 0) {
      const over = Math.round(cap.overBy);
      const fined = await charge("FINE_CAP", bank.capFinePerDay, `over the salary cap by ${money(over)} on ${day} (accumulates into next season's cap reduction)`);
      if (fined) capFines++;
      await prisma.capOverageDay.upsert({
        where: { teamId_day: { teamId: t.id, day } },
        update: { overBy: over },
        create: { teamId: t.id, day, seasonStart: CURRENT_SEASON_START, overBy: over, fine: fined ? bank.capFinePerDay : 0 },
      });
    }
  }
  await recomputeCapPenalties();
  await prisma.leagueBank.update({ where: { id: 1 }, data: { lastEnforcedDay: day } });
  return { ran: true, day, rosterFines, capFines, totalFined };
}
