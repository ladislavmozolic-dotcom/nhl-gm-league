// Sponsorship — a single preseason decision. The club's brand strength (fan
// interest, roster star power, championships) sets the size of the offers; the GM
// weighs a safe deal against upside (championship bonuses). Also the playoff
// revenue model. Pure — no DB.

export type SponsorBonus = { when: string; amount: number };
export type SponsorOffer = { label: string; aav: number; years: number; bonuses: SponsorBonus[] };

/** Three deterministic offers for a club of the given brand strength (0..1). */
export function sponsorOffers(brandStrength: number): SponsorOffer[] {
  const base = 5_000_000 + clamp(brandStrength, 0, 1) * 8_000_000; // $5M … $13M
  const round = (n: number) => Math.round(n / 100_000) * 100_000;
  return [
    { label: "Offer A — steady", aav: round(base * 0.95), years: 2, bonuses: [{ when: "Make the playoffs", amount: 1_000_000 }, { when: "Reach the Conference Final", amount: 2_000_000 }] },
    { label: "Offer B — long-term upside", aav: round(base * 0.82), years: 4, bonuses: [{ when: "Win the Championship", amount: 3_000_000 }] },
    { label: "Offer C — cash now", aav: round(base * 1.06), years: 1, bonuses: [] },
  ];
}

/** Total value if every bonus hits (for display). */
export function sponsorMax(o: SponsorOffer): number {
  return o.aav + o.bonuses.reduce((t, b) => t + b.amount, 0);
}

// ---- Playoff revenue ----

const PLAYOFF_ROUND_LABEL = ["", "Round 1", "Second Round", "Conference Final", "Final"];

/** Ticket revenue for one home playoff game, escalating by round. A regular home
 *  game is the baseline (~$1.2M); the Final is roughly double. */
export function playoffGameRevenue(round: number, attendancePct: number, capacity: number): number {
  const perSeat = 65 + round * 22;                 // playoff pricing climbs each round
  return Math.round(capacity * clamp(attendancePct, 0, 1) * perSeat);
}

export function playoffRoundLabel(round: number): string {
  return PLAYOFF_ROUND_LABEL[round] ?? `Round ${round}`;
}

/** Merch uplift during a playoff run (multiplier on regular merch). */
export function playoffMerchBoost(round: number): number {
  return 1 + round * 0.07; // +7% per round deep
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
