// Edge Parameters — ratings built from REAL NHL/AHL performance, relative to peers
// at the same position and league, on a per-60 basis. Pure: percentile → rating
// mapping + composite definitions. The server gathers the population and ranks.
//
// Principles (user spec): relative-to-NHL (not absolute thresholds), per-60 (not
// totals), composites with weights. 80% current real season + 20% prior.

export const CUR_W = 0.8;
export const LAST_W = 0.2;

/** Per-60 rate from a season total, TOI/game (seconds) and games played. */
export function per60(total: number, toiPerGameSec: number, gp: number): number {
  const minutes = (toiPerGameSec / 60) * gp;
  return minutes > 0 ? (total / minutes) * 60 : 0;
}

/** Blend a current-season and prior-season value 80/20 (skipping empty seasons). */
export function blend(cur: number | null | undefined, last: number | null | undefined): number {
  const c = cur ?? 0, l = last ?? 0;
  const hasC = cur != null && cur !== 0, hasL = last != null && last !== 0;
  if (hasC && hasL) return c * CUR_W + l * LAST_W;
  if (hasC) return c;
  if (hasL) return l;
  return 0;
}

/** Map a percentile (0..1, within position+league) to a 40–99 rating on the curve
 *  the user anchored: 99th→99, 75th→~88, 50th→~76, 25th→~65, bottom→~54. */
export function percentileToRating(p: number): number {
  return Math.round(clamp(54 + clamp(p, 0, 1) * 45, 40, 99));
}

/** Percentile (0..1) of `value` within a sorted-ascending population. */
export function percentileOf(value: number, sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0.5;
  let below = 0;
  for (const v of sortedAsc) { if (v < value) below++; else break; }
  // fraction strictly below + half the ties → stable mid-rank percentile
  let ties = 0;
  for (const v of sortedAsc) if (v === value) ties++;
  return (below + ties / 2) / sortedAsc.length;
}

// Composite definitions: each Edge parameter is a weighted average of sub-metric
// PERCENTILES (so different-scale rates combine cleanly). `invert` flags a metric
// where lower is better (e.g. penalties for Discipline). Metric keys are produced
// by the server per player.
export type Metric = { key: string; weight: number; invert?: boolean };
export const EDGE_COMPOSITES: Record<string, Metric[]> = {
  // scoring — goals lead; shots + finishing support (no xG/high-danger in feed yet)
  SC: [{ key: "g60", weight: 0.6 }, { key: "sh60", weight: 0.25 }, { key: "shpct", weight: 0.15 }],
  // passing — assists per 60 (primary-assist / xA refinement later, not in feed yet)
  PA: [{ key: "a60", weight: 1.0 }],
  // checking — hits per 60
  CK: [{ key: "hit60", weight: 1.0 }],
  // defense — blocks, PK usage, takeaways, +/- (F vs F, D vs D handled by grouping)
  DF: [{ key: "blk60", weight: 0.4 }, { key: "shtoi", weight: 0.3 }, { key: "tk60", weight: 0.2 }, { key: "pm60", weight: 0.1 }],
  // endurance — ice time per game
  EN: [{ key: "toi", weight: 1.0 }],
  // faceoffs — win % (sample-adjusted by the server)
  FO: [{ key: "fo", weight: 1.0 }],
  // discipline — inverse of penalties per 60
  DI: [{ key: "pim60", weight: 1.0, invert: true }],
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
