// Whole-league sim-engine selector + version stamps. The LeagueConfig.simEngine flag
// lets an admin switch the entire league between the stable v1 engine and the next-gen
// v2 rework — instantly and reversibly. Next-gen work is additive and lives behind this
// flag, so flipping back to "current" restores exact v1 behaviour.
//
// The underlying possession/probability model is identical either way — same math,
// same seed, same result. "nextgen" only unlocks presentation-layer upgrades that read
// data the engine already computes (e.g. weaving real HIT/BLOCK/TAKEAWAY events into
// the play-by-play instead of RNG flavour text). Each such upgrade checks
// `opts.engineVersion === ENGINE_V2` deep in engine.ts/playbyplay.ts and falls back to
// the untouched v1 path otherwise, so flipping the flag is instant and risk-free.

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
