// Generic local-search swap pass, used by GM Assist's "Suggest Lines" (see
// app/teams/[slug]/lines/actions.ts) to move already-dressed personnel to the
// line/pair their real depth-chart archetype fits best (Tactical Fit's
// Depth-Chart Archetype Fit piece — lib/sim/tactical-fit.ts, Rules §16), WITHOUT
// ever changing who's dressed — autoLines() already decided that by overall.

/** Swap same-SLOT values (e.g. every unit's "c" key, or "lw", or "rw") ACROSS
 *  units whenever the swap raises `scoreOf(units)` by more than a small
 *  threshold (avoids churn on a near-tie). Bounded hill-climb (max `maxPasses`
 *  full passes over every slot key × every pair of units) — a local optimum is
 *  fine here since this only feeds an advisory suggestion the GM can still
 *  edit or discard, not something that needs to be globally optimal. */
export function reshuffleBySlot<T extends Record<string, unknown>>(
  units: T[],
  slotKeys: (keyof T)[],
  scoreOf: (units: T[]) => number,
  describeSwap: (a: number, b: number, key: keyof T, i: number, j: number) => string,
  opts: { maxPasses?: number; improveThreshold?: number } = {},
): { units: T[]; swaps: string[] } {
  const { maxPasses = 6, improveThreshold = 0.5 } = opts;
  const result = units.map((u) => ({ ...u }));
  const swaps: string[] = [];
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (const key of slotKeys) {
      for (let i = 0; i < result.length; i++) {
        for (let j = i + 1; j < result.length; j++) {
          const a = result[i][key] as number | null, b = result[j][key] as number | null;
          if (a == null || b == null || a === b) continue;
          const before = scoreOf(result);
          result[i] = { ...result[i], [key]: b };
          result[j] = { ...result[j], [key]: a };
          const after = scoreOf(result);
          if (after > before + improveThreshold) { improved = true; swaps.push(describeSwap(a, b, key, i, j)); }
          else { result[i] = { ...result[i], [key]: a }; result[j] = { ...result[j], [key]: b }; }
        }
      }
    }
    if (!improved) break;
  }
  return { units: result, swaps };
}
