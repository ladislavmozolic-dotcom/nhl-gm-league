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

import { prisma } from "../prisma";

export type SimEngineChoice = "current" | "nextgen";

export const ENGINE_V1 = "1.0.0"; // stable
export const ENGINE_V2 = "2.0.0"; // next-gen — same sim math, richer presentation (see engine.ts ENGINE_VERSION)

/** The league's active sim engine. Defaults to "current" (stable). */
export async function activeSimEngine(): Promise<SimEngineChoice> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { simEngine: true } });
  return cfg?.simEngine === "nextgen" ? "nextgen" : "current";
}

/** Engine version string to stamp for a chosen engine, and to pass as
 *  SimOptions.engineVersion so simulateGame actually routes to that path. */
export function engineVersionFor(choice: SimEngineChoice): string {
  return choice === "nextgen" ? ENGINE_V2 : ENGINE_V1;
}
