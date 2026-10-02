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

/** Rebuild every club's accumulated-overage and floor-underage penalty row for the current season from CapOverageDay. */
export async function recomputeCapPenalties(seasonStart = CURRENT_SEASON_START) {
  const bank = await getBank();
  const days = await prisma.capOverageDay.findMany({ where: { seasonStart }, select: { teamId: true, overBy: true, underFloorBy: true } });
  const byTeamOver = new Map<number, number[]>();
  const byTeamUnder = new Map<number, number[]>();
  for (const d of days) {
    if (d.overBy > 0) {
      const arr = byTeamOver.get(d.teamId) ?? [];
      arr.push(d.overBy);
      byTeamOver.set(d.teamId, arr);
    }
    if (d.underFloorBy > 0) {
      const arr = byTeamUnder.get(d.teamId) ?? [];
      arr.push(d.underFloorBy);
      byTeamUnder.set(d.teamId, arr);
    }
  }
  const allTeamIds = new Set([...byTeamOver.keys(), ...byTeamUnder.keys()]);
  for (const teamId of allTeamIds) {
    const overs = byTeamOver.get(teamId) ?? [];
    const unders = byTeamUnder.get(teamId) ?? [];
    const basis = !overs.length ? 0 : bank.capAccumulate === "peak" ? Math.max(...overs) : overs.reduce((s, n) => s + n, 0);
    const floorBasis = !unders.length ? 0 : bank.capAccumulate === "peak" ? Math.max(...unders) : unders.reduce((s, n) => s + n, 0);
    await prisma.teamCapPenalty.upsert({
      where: { teamId_sourceSeasonStart: { teamId, sourceSeasonStart: seasonStart } },
      update: { basis, floorBasis },
      create: { teamId, sourceSeasonStart: seasonStart, appliesSeasonStart: seasonStart + 1, basis, floorBasis },
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
        update: { overBy: over, fine: fined ? bank.capFinePerDay : 0 },
        create: { teamId: t.id, day, seasonStart: CURRENT_SEASON_START, overBy: over, fine: fined ? bank.capFinePerDay : 0 },
      });
    }
    if (cap.underFloorBy > 0) {
      const under = Math.round(cap.underFloorBy);
      const fined = await charge("FINE_FLOOR", bank.capFinePerDay, `under the salary cap floor by ${money(under)} on ${day} (accumulates into next season's cap floor increase)`);
      if (fined) capFines++;
      await prisma.capOverageDay.upsert({
        where: { teamId_day: { teamId: t.id, day } },
        update: { underFloorBy: under, fine: fined ? bank.capFinePerDay : 0 },
        create: { teamId: t.id, day, seasonStart: CURRENT_SEASON_START, underFloorBy: under, fine: fined ? bank.capFinePerDay : 0 },
      });
    }
  }
  await recomputeCapPenalties();
  await prisma.leagueBank.update({ where: { id: 1 }, data: { lastEnforcedDay: day } });
  return { ran: true, day, rosterFines, capFines, totalFined };
}

// ---- Game Picks (tipovačka) prizes, paid out of the league bank ----------------

const PICKS_SEASON = "2026-27";

/** Pay the winner(s) of one finished Game Picks week (ties: every tied club gets the prize). Idempotent per week. */
export async function payWeeklyPicksWinners(weekKey: string): Promise<{ paid: string[]; prize: number }> {
  const bank = await getBank();
  const profiles = await prisma.gamePicksProfile.findMany({ where: { season: PICKS_SEASON, league: "NHL" }, select: { teamId: true, weeklyPoints: true } });
  const pts = profiles.map((p) => ({ teamId: p.teamId, pts: Number((p.weeklyPoints as Record<string, number> | null)?.[weekKey] ?? 0) })).filter((x) => x.pts > 0);
  if (!pts.length || bank.picksWeeklyPrize <= 0) return { paid: [], prize: bank.picksWeeklyPrize };
  const top = Math.max(...pts.map((x) => x.pts));
  const paid: string[] = [];
  for (const w of pts.filter((x) => x.pts === top)) {
    const ok = await postEntry({ kind: "PAYOUT", amount: -bank.picksWeeklyPrize, teamId: w.teamId, note: `Game Picks — winner of week ${weekKey} (${top} pts)`, dedupeKey: `PICKS_WEEK:${weekKey}:${w.teamId}` });
    if (!ok) continue;
    await moveTeamBank(w.teamId, bank.picksWeeklyPrize);
    const t = await prisma.team.findUnique({ where: { id: w.teamId }, select: { name: true, slug: true } });
    if (t) await prisma.dmMessage.create({ data: { fromTeamId: w.teamId, toTeamId: w.teamId, body: `🏆 Game Picks: you won the week of ${weekKey} with ${top} pts — ${money(bank.picksWeeklyPrize)} paid into your bank.`, tradeUrl: "/league/picks" } }).catch(() => {});
    paid.push(t?.name ?? String(w.teamId));
  }
  return { paid, prize: bank.picksWeeklyPrize };
}

/** Called every cron tick: from 09:00 pays each completed week (up to yesterday's) that hasn't been paid yet. */
export async function payPicksIfDue(now: Date, hour: number): Promise<{ ran: boolean; weeks?: string[]; reason?: string }> {
  const bank = await getBank();
  if (!bank.autoPickPayouts) return { ran: false, reason: "auto payouts off" };
  if (hour < 9) return { ran: false, reason: "before 09:00" };
  const { pickWeekKey } = await import("./game-picks-server");
  const current = pickWeekKey(new Date(now.getTime() - 86400000)); // the week still collecting points
  const profiles = await prisma.gamePicksProfile.findMany({ where: { season: PICKS_SEASON, league: "NHL" }, select: { weeklyPoints: true } });
  const weeks = new Set<string>();
  for (const p of profiles) for (const k of Object.keys((p.weeklyPoints as Record<string, number> | null) ?? {})) if (k < current && (!bank.lastPickWeekPaid || k > bank.lastPickWeekPaid)) weeks.add(k);
  const sorted = [...weeks].sort();
  for (const w of sorted) await payWeeklyPicksWinners(w);
  if (sorted.length) await prisma.leagueBank.update({ where: { id: 1 }, data: { lastPickWeekPaid: sorted[sorted.length - 1] } });
  return { ran: true, weeks: sorted };
}

/** Season-end TOP 3 (Game Picks + Season Picks combined — the commissioner picks the clubs). Idempotent per place. */
export async function paySeasonTop3(teamIds: [number, number, number]): Promise<void> {
  const bank = await getBank();
  const prizes = [bank.picksPrize1, bank.picksPrize2, bank.picksPrize3];
  for (let i = 0; i < 3; i++) {
    if (!teamIds[i] || prizes[i] <= 0) continue;
    const ok = await postEntry({ kind: "PAYOUT", amount: -prizes[i], teamId: teamIds[i], note: `Tipovačka ${PICKS_SEASON} — ${i + 1}. miesto`, dedupeKey: `PICKS_SEASON:${PICKS_SEASON}:${i + 1}` });
    if (ok) await moveTeamBank(teamIds[i], prizes[i]);
  }
}
