// Merchandise — jersey / apparel / other revenue, driven by Star Power and Fan
// Interest. A club's jersey sales are the sum of its players' individual pull;
// apparel and other goods scale with how hot the fanbase is. Pure — no DB.

const JERSEY_NET = 120;        // club's net revenue per jersey sold ($)
const JERSEY_A = 40_000;       // scale: a ~94 Star Power sells ~31k jerseys
const JERSEY_MIN = 150;

/** Season jersey units for a player of this Star Power (0..100). Superstars
 *  dominate — the curve is steep. A recent blockbuster arrival gets a boost. */
export function jerseyUnits(starScore: number, tradeBoost = 1): number {
  const base = JERSEY_A * Math.pow(Math.max(0, starScore) / 100, 4);
  return Math.round(Math.max(JERSEY_MIN, base) * tradeBoost);
}

export function jerseyRevenue(units: number): number {
  return units * JERSEY_NET;
}

export type TeamMerch = {
  total: number; jerseys: number; apparel: number; other: number;
  prevTotal: number; changePct: number;
};

/** A club's merchandise revenue from its total jersey units and Fan Interest. */
export function teamMerch(input: { jerseyUnitsTotal: number; fanInterest: number; baselineInterest: number }): TeamMerch {
  const jerseys = jerseyRevenue(input.jerseyUnitsTotal);
  // apparel + other scale with fan heat (interest 50 → ~1.0×, 100 → ~1.6×)
  const heat = 0.6 + input.fanInterest * 0.01;
  const apparel = Math.round(3_200_000 * heat);
  const other = Math.round(1_400_000 * heat);
  const total = jerseys + apparel + other;

  // last season ≈ the neutral baseline (jerseys move less season-to-season, so
  // fold the whole jersey line in and re-scale apparel/other at the baseline heat)
  const prevHeat = 0.6 + input.baselineInterest * 0.01;
  const prevTotal = Math.round(jerseys * 0.9 + 3_200_000 * prevHeat + 1_400_000 * prevHeat);
  const changePct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

  return { total, jerseys, apparel, other, prevTotal, changePct };
}
