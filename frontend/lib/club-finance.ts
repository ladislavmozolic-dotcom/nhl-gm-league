// Shared club revenue model — used by BOTH the Finance Dashboard (per team) and
// processFinances (all teams), so the numbers always match. Pure — no DB.

import type { TicketPricing } from "./season-tickets";

export type FinanceLine = { label: string; amount: number };

export const HOME_GAMES = 41;
export const MEDIA_AND_LEAGUE_LABEL = "National media & league distribution";
export const REVENUE_SHARING_LABEL = "Revenue sharing";
export const MEDIA_AND_LEAGUE_DISTRIBUTION = 55_000_000;
const SEASON_PRICE: Record<TicketPricing, number> = { LOW: 3000, STANDARD: 3800, PREMIUM: 4800 };
const SINGLE_PRICE: Record<TicketPricing, number> = { LOW: 75, STANDARD: 100, PREMIUM: 130 };
const PREMIUM_SEATING = 19_000_000; // club seats + suites — softer for a cold club
const DEFAULT_SPONSOR = 2_000_000;  // a bare-minimum sponsor if the GM signs nothing

export type ClubRevenueInput = {
  pricing: TicketPricing;
  sthSold: number;
  avgAttendance: number;
  fanInterest: number;
  merchTotal: number;
  sponsorAav: number; // 0 = unsigned → a bare default applies
};

/** The club's season revenue, itemised. Local commercial income leans on fan heat;
 *  national media and central league income is shared equally by all 32 clubs. */
export function clubRevenueLines(i: ClubRevenueInput): FinanceLine[] {
  // heat: interest 100 → 1.30×, 60 → 1.00×, 40 → 0.85× — cold clubs sell less
  const heat = 0.55 + i.fanInterest * 0.0075;
  return [
    { label: "Season tickets", amount: i.sthSold * SEASON_PRICE[i.pricing] },
    { label: "Gate (single-game)", amount: Math.round(Math.max(0, i.avgAttendance - i.sthSold) * SINGLE_PRICE[i.pricing] * HOME_GAMES) },
    { label: "Premium seating & suites", amount: Math.round(PREMIUM_SEATING * heat) },
    { label: "Merchandise", amount: i.merchTotal },
    { label: "Sponsorship", amount: i.sponsorAav > 0 ? i.sponsorAav : DEFAULT_SPONSOR },
    { label: MEDIA_AND_LEAGUE_LABEL, amount: MEDIA_AND_LEAGUE_DISTRIBUTION },
  ];
}

export function clubRevenueTotal(i: ClubRevenueInput): number {
  return clubRevenueLines(i).reduce((t, l) => t + l.amount, 0);
}

/** NHL-style revenue sharing. Clubs above the league-average local commercial
 * revenue contribute 20% of their excess; the complete pool is distributed to
 * below-average clubs in proportion to their revenue gap. The transfer is
 * league-wide zero-sum: it narrows market inequality without creating money. */
export function revenueSharingTransfers(clubs: Array<{ teamId: number; localRevenue: number }>): Map<number, number> {
  const transfers = new Map(clubs.map((c) => [c.teamId, 0]));
  if (clubs.length === 0) return transfers;

  const average = clubs.reduce((sum, c) => sum + c.localRevenue, 0) / clubs.length;
  const contributions = clubs.map((c) => Math.round(Math.max(0, c.localRevenue - average) * 0.20));
  const pool = contributions.reduce((sum, amount) => sum + amount, 0);
  const recipients = clubs
    .map((c, index) => ({ index, gap: Math.max(0, average - c.localRevenue) }))
    .filter((r) => r.gap > 0);
  const totalGap = recipients.reduce((sum, r) => sum + r.gap, 0);

  clubs.forEach((c, index) => transfers.set(c.teamId, contributions[index] === 0 ? 0 : -contributions[index]));
  if (pool === 0 || totalGap === 0 || recipients.length === 0) return transfers;

  let distributed = 0;
  recipients.forEach((r, receiverIndex) => {
    const receipt = receiverIndex === recipients.length - 1
      ? pool - distributed
      : Math.round(pool * r.gap / totalGap);
    distributed += receipt;
    const teamId = clubs[r.index].teamId;
    transfers.set(teamId, (transfers.get(teamId) ?? 0) + receipt);
  });
  return transfers;
}

// Fixed operating overhead (arena, travel, admin) — coaching and the minor-league
// affiliate are their own dynamic lines (real coach + AHL-roster salaries).
const FIXED_OVERHEAD_LINES: { label: string; amount: number }[] = [
  { label: "Arena operations", amount: 14_000_000 },
  { label: "Team travel", amount: 7_000_000 },
  { label: "Admin & staff", amount: 10_000_000 },
];
const FIXED_OVERHEAD = FIXED_OVERHEAD_LINES.reduce((t, l) => t + l.amount, 0); // 31M

/** The club's season expenses, itemised — NHL player salaries, real head-coach
 *  salaries (NHL + AHL), the AHL affiliate payroll (its roster + scratched), and
 *  fixed operating overhead. */
export function clubExpenseLines(salary: number, coachSalary: number, ahlSalary: number): FinanceLine[] {
  return [
    { label: "Player salaries (NHL)", amount: salary },
    { label: "Coaching (NHL + AHL)", amount: coachSalary },
    { label: "Minor-league affiliate", amount: ahlSalary },
    ...FIXED_OVERHEAD_LINES,
  ];
}

export function clubExpenseTotal(salary: number, coachSalary: number, ahlSalary: number): number {
  return salary + coachSalary + ahlSalary + FIXED_OVERHEAD;
}
