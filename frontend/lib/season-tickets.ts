// Season Tickets — the preseason campaign. Each club sells season tickets up to a
// cap (a share of arena capacity). How many it sells, how many holders renew, and
// whether a waiting list forms all flow from Fan Interest (results vs expectation,
// stars) relative to last season. Pure — no DB.

export type TicketPricing = "LOW" | "STANDARD" | "PREMIUM";

// League defaults (arena capacity and the season-ticket cap) — shared by the
// season-ticket and attendance engines.
export const DEFAULT_ARENA_CAPACITY = 18_500;
export const DEFAULT_STH_CAP = 14_000;
export const STH_SHARE = 0.78; // share of capacity a club can sell as season tickets

/** A club's arena config: its real capacity (falling back to the default) and its
 *  season-ticket cap derived from it. */
export function arenaFor(capacity: number | null | undefined): { capacity: number; sthCap: number } {
  const cap = capacity && capacity > 0 ? Math.round(capacity) : DEFAULT_ARENA_CAPACITY;
  return { capacity: cap, sthCap: Math.round(cap * STH_SHARE) };
}

export type SeasonTicketInput = {
  capacity: number;          // arena capacity
  sthCap: number;            // max seats sold as season tickets
  fanInterest: number;       // current Fan Interest 0..100
  baselineInterest: number;  // neutral (perform-to-expectation) interest — stands in for "last season"
  pricing?: TicketPricing;   // season-ticket pricing tier (Stage 4)
  reasons?: string[];        // fan-interest reasons, reused as positive factors
};

export type SeasonTickets = {
  capacity: number; sthCap: number;
  sold: number; prevSold: number; changePct: number;
  prevHolders: number; renewed: number; renewalRate: number; newHolders: number;
  waitingList: number;
  positives: string[]; negatives: string[];
};

// pricing nudges demand (higher price → fewer buyers) and the price itself
const PRICE_DEMAND: Record<TicketPricing, number> = { LOW: 0.05, STANDARD: 0, PREMIUM: -0.06 };

function sellThrough(interest: number, pricing: TicketPricing): number {
  const base = 0.55 + interest * 0.0045; // interest 100 → 1.0, 50 → 0.775
  return clamp(base + PRICE_DEMAND[pricing], 0.45, 1.0);
}
function renewal(interest: number, pricing: TicketPricing): number {
  return clamp(0.80 + interest * 0.0016 + PRICE_DEMAND[pricing] * 0.5, 0.72, 0.97);
}

export function seasonTickets(i: SeasonTicketInput): SeasonTickets {
  const pricing = i.pricing ?? "STANDARD";
  const sold = Math.min(i.sthCap, Math.round(i.sthCap * sellThrough(i.fanInterest, pricing)));
  const prevSold = Math.min(i.sthCap, Math.round(i.sthCap * sellThrough(i.baselineInterest, "STANDARD")));
  const changePct = prevSold > 0 ? ((sold - prevSold) / prevSold) * 100 : 0;

  const renewalRate = renewal(i.fanInterest, pricing);
  const prevHolders = prevSold;
  const renewed = Math.min(sold, Math.round(prevHolders * renewalRate));
  const newHolders = Math.max(0, sold - renewed);

  // a waiting list forms for red-hot clubs whose demand runs past the cap
  const nearCap = sold >= i.sthCap * 0.95;
  const waitingList = nearCap && i.fanInterest >= 86 ? Math.round((i.fanInterest - 84) * 220) : 0;

  const positives: string[] = [];
  const negatives: string[] = [];
  for (const r of i.reasons ?? []) {
    if (/short|falling|losing|cold|outside/i.test(r)) negatives.push(r);
    else positives.push(r);
  }
  if (i.fanInterest > i.baselineInterest + 3) positives.unshift(`Fan Interest ${Math.round(i.fanInterest)} (up on expectation)`);
  else if (i.fanInterest < i.baselineInterest - 3) negatives.unshift(`Fan Interest ${Math.round(i.fanInterest)} (below expectation)`);
  if (pricing === "PREMIUM") negatives.push("Premium season-ticket pricing");
  else if (pricing === "LOW") positives.push("Low season-ticket pricing");

  return {
    capacity: i.capacity, sthCap: i.sthCap,
    sold, prevSold, changePct,
    prevHolders, renewed, renewalRate, newHolders,
    waitingList,
    positives: positives.slice(0, 4), negatives: negatives.slice(0, 3),
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
