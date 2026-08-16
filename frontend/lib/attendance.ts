// Dynamic Attendance + Ticket Pricing. Each home game draws a crowd off Fan
// Interest and the specific game's pull (opponent quality, rivalry, importance),
// nudged by the club's ticket pricing. Higher price = more revenue per seat but
// softer demand. Pure — no DB.

export type TicketPricing = "LOW" | "STANDARD" | "PREMIUM";

export const PRICING_LABEL: Record<TicketPricing, string> = { LOW: "Low", STANDARD: "Standard", PREMIUM: "Premium" };
// demand shift and revenue-per-seat multiplier per tier
const PRICE_DEMAND: Record<TicketPricing, number> = { LOW: 0.05, STANDARD: 0, PREMIUM: -0.07 };
export const PRICE_REVENUE_MULT: Record<TicketPricing, number> = { LOW: 0.85, STANDARD: 1.0, PREMIUM: 1.22 };

export type AttendanceInput = {
  fanInterest: number;   // 0..100
  pricing: TicketPricing;
  attractiveness?: number; // game pull multiplier (1 = average); rivalry/marquee raise it
  sthFraction?: number;    // season-ticket share of capacity (a near-guaranteed floor)
};

/** Fraction of arena capacity filled (0..1). */
export function attendancePct(i: AttendanceInput): number {
  const base = 0.60 + i.fanInterest * 0.0040;         // interest 100 → 1.0, 50 → 0.80
  const draw = base * (i.attractiveness ?? 1) + PRICE_DEMAND[i.pricing];
  const floor = (i.sthFraction ?? 0) * 0.97;          // season-ticket holders mostly show up
  return clamp(Math.max(draw, floor), 0.45, 1.0);
}

/** A single game's pull from the matchup, independent of the home club's interest. */
export function gameAttractiveness(opts: { rivalry?: boolean; opponentStar?: number; important?: boolean }): number {
  let a = 1;
  if (opts.rivalry) a += 0.10;
  if ((opts.opponentStar ?? 0) >= 85) a += 0.07;      // a visiting superstar sells tickets
  else if ((opts.opponentStar ?? 0) >= 72) a += 0.03;
  if (opts.important) a += 0.06;                        // playoff race / late-season stakes
  return a;
}

/** Buyer price sensitivity — how much demand a price hike would cost this club.
 *  A red-hot contender can charge Premium and still sell out; a cold rebuilder can't. */
export function priceSensitivity(fanInterest: number): "Low" | "Moderate" | "High" {
  if (fanInterest >= 80) return "Low";
  if (fanInterest >= 60) return "Moderate";
  return "High";
}

export function revenueLevel(pct: number, pricing: TicketPricing): "Low" | "Medium" | "High" {
  const score = pct * PRICE_REVENUE_MULT[pricing];
  if (score >= 1.05) return "High";
  if (score >= 0.85) return "Medium";
  return "Low";
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
