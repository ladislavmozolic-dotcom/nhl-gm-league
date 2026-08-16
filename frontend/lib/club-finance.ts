// Shared club revenue model — used by BOTH the Finance Dashboard (per team) and
// processFinances (all teams), so the numbers always match. Pure — no DB.

import type { TicketPricing } from "./season-tickets";

export type FinanceLine = { label: string; amount: number };

export const HOME_GAMES = 41;
const SEASON_PRICE: Record<TicketPricing, number> = { LOW: 3000, STANDARD: 3800, PREMIUM: 4800 };
const SINGLE_PRICE: Record<TicketPricing, number> = { LOW: 75, STANDARD: 100, PREMIUM: 130 };
const PREMIUM_SEATING = 19_000_000; // club seats + suites — softer for a cold club
const MEDIA = 26_000_000;           // local media & other + national share (mostly fixed TV)
const DEFAULT_SPONSOR = 2_000_000;  // a bare-minimum sponsor if the GM signs nothing
const OVERHEAD = 44_000_000;        // arena ops, staff, travel, minor-league, coaching, etc.

export type ClubRevenueInput = {
  pricing: TicketPricing;
  sthSold: number;
  avgAttendance: number;
  fanInterest: number;
  merchTotal: number;
  sponsorAav: number; // 0 = unsigned → a bare default applies
};

/** The club's season revenue, itemised. Ticket, premium and media lines all lean
 *  on fan heat, so a struggling club (low interest → soft attendance) earns far
 *  less — and with a big payroll can finish the season in the red. */
export function clubRevenueLines(i: ClubRevenueInput): FinanceLine[] {
  // heat: interest 100 → 1.30×, 60 → 1.00×, 40 → 0.85× — cold clubs sell less
  const heat = 0.55 + i.fanInterest * 0.0075;
  return [
    { label: "Season tickets", amount: i.sthSold * SEASON_PRICE[i.pricing] },
    { label: "Gate (single-game)", amount: Math.round(Math.max(0, i.avgAttendance - i.sthSold) * SINGLE_PRICE[i.pricing] * HOME_GAMES) },
    { label: "Premium seating & suites", amount: Math.round(PREMIUM_SEATING * heat) },
    { label: "Merchandise", amount: i.merchTotal },
    { label: "Sponsorship", amount: i.sponsorAav > 0 ? i.sponsorAav : DEFAULT_SPONSOR },
    { label: "Media & league", amount: Math.round(MEDIA * heat) },
  ];
}

export function clubRevenueTotal(i: ClubRevenueInput): number {
  return clubRevenueLines(i).reduce((t, l) => t + l.amount, 0);
}

// Overhead split into named lines (sum = OVERHEAD).
const OVERHEAD_LINES: { label: string; amount: number }[] = [
  { label: "Coaching & hockey ops", amount: 9_000_000 },
  { label: "Arena operations", amount: 14_000_000 },
  { label: "Team travel", amount: 7_000_000 },
  { label: "Minor-league affiliate", amount: 8_000_000 },
  { label: "Admin & staff", amount: 10_000_000 },
];

/** The club's season expenses, itemised — player salaries plus operating overhead. */
export function clubExpenseLines(salary: number): FinanceLine[] {
  return [{ label: "Player salaries", amount: salary }, ...OVERHEAD_LINES];
}

export function clubExpenseTotal(salary: number): number {
  return salary + OVERHEAD;
}

export function clubOverhead(): number {
  return OVERHEAD;
}
