// Whole-league sim-engine selector + version stamps. The LeagueConfig.simEngine flag
// lets an admin switch the entire league between the stable v1 engine and the next-gen
// v2 rework — instantly and reversibly. Next-gen work is additive and lives behind this
// flag, so flipping back to "current" restores exact v1 behaviour.
//
// Mostly, the underlying possession/probability model is identical either way — same
// math, same seed, same result — and "nextgen" just unlocks presentation-layer
// upgrades that read data the engine already computes (e.g. weaving real HIT/BLOCK/
// TAKEAWAY events into the play-by-play instead of RNG flavour text). A small, growing
// set of upgrades are real gameplay differences instead: e.g. the home coach's
// "last change" line-matchup bias (engine.ts, `advanceShift`) actually changes which
// forward line is on the ice, so v1/v2 box scores for the HOME team can legitimately
// differ under "nextgen" — that's the intended effect, not a bug. Every such upgrade
// still checks `opts.engineVersion === ENGINE_V2` (or `st.isNextGen`) deep in
// engine.ts/playbyplay.ts and falls back to the untouched v1 path otherwise, so
// flipping the flag back to "current" still restores exact v1 behaviour instantly.

export type SimEngineChoice = "current" | "nextgen";

export const ENGINE_V1 = "1.0.1"; // stable — complete OT/endgame shot accounting
export const ENGINE_V2 = "2.1.0"; // next-gen — complete OT/endgame shot accounting + tuning
// Deliberately not selectable from LeagueConfig. V3 is an offline/work-in-progress
// branch: it may be passed directly to simulateGame by diagnostics, but production
// scheduling can only resolve to V1 or V2 until it has passed its own calibration.
export const ENGINE_V3 = "3.0.0-wip";

export function isNextGenEngine(version: string): boolean {
  return version === ENGINE_V2 || version === ENGINE_V3;
}

export function isExperimentalEngine(version: string): boolean {
  return version === ENGINE_V3;
}

/** The league's active sim engine. V1 is retired — every game runs on next-gen V2 regardless of the
 *  stored LeagueConfig.simEngine value (kept in the DB only so old rows/backups still load). */
export async function activeSimEngine(): Promise<SimEngineChoice> {
  return "nextgen";
}

/** Engine version string to stamp for a chosen engine, and to pass as
 *  SimOptions.engineVersion so simulateGame actually routes to that path. */
export function engineVersionFor(choice: SimEngineChoice): string {
  return choice === "nextgen" ? ENGINE_V2 : ENGINE_V1;
}
