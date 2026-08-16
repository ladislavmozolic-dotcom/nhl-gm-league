// Fan Interest + Expectations — the heart of the Detailed Finance system. Each
// club carries a dynamic 0–100 Fan Interest that swings with results relative to
// what the fans EXPECTED before the season. The same result lands differently:
// a contender bounced in round 1 disappoints; a rebuilder sneaking into the
// playoffs delights. Pure — no DB.

export type ExpectationTier = "Championship Contender" | "Playoff Team" | "Bubble Team" | "Rebuilding Team";

// The points % the fans expect from each preseason tier. Over/underperforming
// this is the single biggest driver of Fan Interest.
export const EXPECTATION_PACE: Record<ExpectationTier, number> = {
  "Championship Contender": 0.62,
  "Playoff Team": 0.55,
  "Bubble Team": 0.50,
  "Rebuilding Team": 0.42,
};

// A hotter baseline for clubs the fans already rate — expectation stands in for
// market heat since we don't model market size directly.
const TIER_BASE: Record<ExpectationTier, number> = {
  "Championship Contender": 72,
  "Playoff Team": 64,
  "Bubble Team": 56,
  "Rebuilding Team": 48,
};

export type FanInterestInput = {
  tier: ExpectationTier;
  gp: number;                 // games played (0 = preseason → baseline only)
  pointsPct: number;          // season points percentage (0..1)
  last10Pts?: number;         // points in the last 10 games (0..20)
  streak?: number;            // + = win streak, - = losing streak (games)
  topStarPower?: number;      // best Star Power on the roster (marquee draw)
  playoffSpot?: boolean;      // currently in a playoff position
  leagueTop3?: boolean;       // top-3 in the league
};

export type FanInterest = { interest: number; baseline: number; delta: number; reasons: string[] };

/** Compute a club's Fan Interest, its neutral baseline (results == expectation),
 *  the delta between them, and the human reasons behind the swing. */
export function fanInterest(i: FanInterestInput): FanInterest {
  const base = TIER_BASE[i.tier];
  const expectedPct = EXPECTATION_PACE[i.tier];
  const starBump = clamp(((i.topStarPower ?? 0) - 55) / 40, 0, 1) * 12; // marquee draw, record-independent

  // baseline = the club performing exactly to expectation, neutral form
  const baseline = Math.round(clamp(base + starBump, 0, 100));

  if (i.gp <= 0) {
    // preseason: nothing has happened yet — interest sits at the baseline
    const reasons: string[] = [`Preseason expectation: ${i.tier}`];
    if (starBump >= 6) reasons.push("Marquee star power on the roster");
    return { interest: baseline, baseline, delta: 0, reasons };
  }

  const perf = (i.pointsPct - expectedPct) * 100; // percentage points over/under
  const perfSwing = clamp(perf * 0.9, -20, 20);    // the key driver
  const formSwing = i.last10Pts != null ? clamp((i.last10Pts / 20 - 0.5) * 8, -4, 4) : 0;
  const streakSwing = clamp((i.streak ?? 0) / 5, -1, 1) * 6;
  const playoffSwing = (i.playoffSpot ? 4 : -2) + (i.leagueTop3 ? 4 : 0);

  const interest = Math.round(clamp(base + starBump + perfSwing + formSwing + streakSwing + playoffSwing, 0, 100));

  const reasons: string[] = [];
  if (perfSwing >= 5) reasons.push("Exceeding preseason expectations");
  else if (perfSwing <= -5) reasons.push("Falling short of expectations");
  if ((i.streak ?? 0) >= 3) reasons.push(`${i.streak}-game winning streak`);
  else if ((i.streak ?? 0) <= -3) reasons.push(`${Math.abs(i.streak!)}-game losing streak`);
  if (i.leagueTop3) reasons.push("Among the league's best");
  else if (i.playoffSpot) reasons.push("In a playoff spot");
  else if (!i.playoffSpot && i.gp > 10) reasons.push("Outside the playoff picture");
  if (formSwing >= 2.5) reasons.push("Hot recent form");
  else if (formSwing <= -2.5) reasons.push("Cold recent form");
  if (starBump >= 8 && reasons.length < 3) reasons.push("Marquee star power");

  return { interest, baseline, delta: interest - baseline, reasons: reasons.slice(0, 4) };
}

export function interestArrow(delta: number): string {
  if (delta >= 2) return "↑";
  if (delta <= -2) return "↓";
  return "→";
}

export function interestAccent(delta: number): string {
  if (delta >= 2) return "text-emerald-400";
  if (delta <= -2) return "text-rose-400";
  return "text-slate-400";
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
