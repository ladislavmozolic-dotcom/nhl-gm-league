// Sponsorship — a single preseason decision. The club's brand strength (fan
// interest, roster star power, championships) sets the size of the offers; the GM
// weighs a safe deal against upside (championship bonuses). Also the playoff
// revenue model. Pure — no DB. $ constants: lib/finance-tuning.ts (commish-tunable).

import { DEFAULT_FINANCE_TUNING, type FinanceTuning } from "./finance-tuning";

export type SponsorBonus = { when: string; amount: number };
export type SponsorOffer = { label: string; aav: number; years: number; bonuses: SponsorBonus[] };

/** Three deterministic offers for a club of the given brand strength (0..1). */
export function sponsorOffers(brandStrength: number, t: FinanceTuning = DEFAULT_FINANCE_TUNING): SponsorOffer[] {
  const base = t.sponsorBase + clamp(brandStrength, 0, 1) * t.sponsorRange; // default $5M … $13M
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
export function playoffGameRevenue(round: number, attendancePct: number, capacity: number, t: FinanceTuning = DEFAULT_FINANCE_TUNING): number {
  const perSeat = t.playoffSeatBase + round * t.playoffSeatPerRound; // playoff pricing climbs each round
  return Math.round(capacity * clamp(attendancePct, 0, 1) * perSeat);
}

export function playoffRoundLabel(round: number): string {
  return PLAYOFF_ROUND_LABEL[round] ?? `Round ${round}`;
}

/** Merch uplift during a playoff run (multiplier on regular merch). */
export function playoffMerchBoost(round: number, t: FinanceTuning = DEFAULT_FINANCE_TUNING): number {
  return 1 + round * (t.playoffMerchPerRoundPct / 100); // default +7% per round deep
}

export type SponsorMilestones = {
  madePlayoffs: boolean;
  reachedConferenceFinal: boolean;
  wonChampionship: boolean;
};

/** Earned performance bonuses from the signed sponsor deal. The offer labels are
 * persisted as JSON, so matching is intentionally tolerant of wording/case. */
export function sponsorBonusEarned(deal: SponsorOffer | null, milestones: SponsorMilestones): number {
  if (!deal) return 0;
  return deal.bonuses.reduce((total, bonus) => {
    const condition = bonus.when.toLowerCase();
    const earned = condition.includes("championship")
      ? milestones.wonChampionship
      : condition.includes("conference final")
        ? milestones.reachedConferenceFinal
        : condition.includes("playoff")
          ? milestones.madePlayoffs
          : false;
    return total + (earned ? bonus.amount : 0);
  }, 0);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
