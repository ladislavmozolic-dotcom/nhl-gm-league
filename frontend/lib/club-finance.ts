// Shared club revenue model — used by BOTH the Finance Dashboard (per team) and
// processFinances (all teams), so the numbers always match. Pure — no DB.

import type { TicketPricing } from "./season-tickets";

export type FinanceLine = { label: string; amount: number };

export const HOME_GAMES = 41;
const SEASON_PRICE: Record<TicketPricing, number> = { LOW: 3000, STANDARD: 3800, PREMIUM: 4800 };
const SINGLE_PRICE: Record<TicketPricing, number> = { LOW: 75, STANDARD: 100, PREMIUM: 130 };
const PREMIUM_SEATING = 22_000_000; // club seats + suites, scaled by fan heat
const MEDIA = 28_000_000;           // local media & other + national share, scaled by heat
const DEFAULT_SPONSOR = 5_000_000;  // a club always carries some sponsor income
const OVERHEAD = 42_000_000;        // arena ops, staff, travel, minor-league, etc.

export type ClubRevenueInput = {
  pricing: TicketPricing;
  sthSold: number;
  avgAttendance: number;
  fanInterest: number;
  merchTotal: number;
  sponsorAav: number; // 0 = unsigned → a default baseline applies
};

/** The club's season revenue, itemised. */
export function clubRevenueLines(i: ClubRevenueInput): FinanceLine[] {
  const heat = 0.7 + i.fanInterest * 0.006; // interest 100 → 1.3×, 50 → 1.0×
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

export function clubOverhead(): number {
  return OVERHEAD;
}
