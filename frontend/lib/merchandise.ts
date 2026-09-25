// Merchandise — jersey / apparel / other revenue, driven by Star Power and Fan
// Interest. A club's jersey sales are the sum of its players' individual pull;
// apparel and other goods scale with how hot the fanbase is. Pure — no DB.

import { DEFAULT_FINANCE_TUNING, type FinanceTuning } from "./finance-tuning";

// $ constants are commissioner-tunable (lib/finance-tuning.ts); defaults: $120 net
// per jersey, a ~94 Star Power sells ~31k jerseys.
const JERSEY_MIN = 150;

/** Season jersey units for a player of this Star Power (0..100). Superstars
 *  dominate — the curve is steep. A recent blockbuster arrival gets a boost. */
export function jerseyUnits(starScore: number, tradeBoost = 1, t: FinanceTuning = DEFAULT_FINANCE_TUNING): number {
  const base = t.jerseyScale * Math.pow(Math.max(0, starScore) / 100, 4);
  return Math.round(Math.max(JERSEY_MIN, base) * tradeBoost);
}

export function jerseyRevenue(units: number, t: FinanceTuning = DEFAULT_FINANCE_TUNING): number {
  return units * t.jerseyNet;
}

export type TeamMerch = {
  total: number; jerseys: number; apparel: number; other: number;
  prevTotal: number; changePct: number;
};

/** A club's merchandise revenue from its total jersey units and Fan Interest. */
export function teamMerch(input: { jerseyUnitsTotal: number; fanInterest: number; baselineInterest: number }, t: FinanceTuning = DEFAULT_FINANCE_TUNING): TeamMerch {
  const jerseys = jerseyRevenue(input.jerseyUnitsTotal, t);
  // apparel + other scale with fan heat (interest 50 → ~1.0×, 100 → ~1.6×)
  const heat = 0.6 + input.fanInterest * 0.01;
  const apparel = Math.round(t.apparelBase * heat);
  const other = Math.round(t.otherBase * heat);
  const total = jerseys + apparel + other;

  // last season ≈ the neutral baseline (jerseys move less season-to-season, so
  // fold the whole jersey line in and re-scale apparel/other at the baseline heat)
  const prevHeat = 0.6 + input.baselineInterest * 0.01;
  const prevTotal = Math.round(jerseys * 0.9 + t.apparelBase * prevHeat + t.otherBase * prevHeat);
  const changePct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

  return { total, jerseys, apparel, other, prevTotal, changePct };
}
