// Sim-engine version stamps. V1 and the old shot-volume model are retired: every game runs
// the next-gen possession engine (V2). ENGINE_V1 survives only as the historical stamp that
// old Game rows carry; the LeagueConfig.simEngine column is kept so old rows/backups still load.

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
