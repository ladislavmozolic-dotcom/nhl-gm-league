// Whole-league sim-engine selector + version stamps. The LeagueConfig.simEngine flag
// lets an admin switch the entire league between the stable v1 engine and the next-gen
// v2 rework — instantly and reversibly. Next-gen work is additive and lives behind this
// flag, so flipping back to "current" restores exact v1 behaviour.
//
// Phase 0: the v2 engine isn't built yet — both choices run the current engine and stamp
// v1. Phase 1 will route "nextgen" to the v2 code path and stamp ENGINE_V2.

import { prisma } from "../prisma";

export type SimEngineChoice = "current" | "nextgen";

export const ENGINE_V1 = "1.0.0"; // stable, must equal engine.ts ENGINE_VERSION
export const ENGINE_V2 = "2.0.0"; // next-gen target (in development)

/** The league's active sim engine. Defaults to "current" (stable). */
export async function activeSimEngine(): Promise<SimEngineChoice> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { simEngine: true } });
  return cfg?.simEngine === "nextgen" ? "nextgen" : "current";
}

/** Engine version string to stamp for a chosen engine. Phase 0: always v1 (v2 not built). */
export function engineVersionFor(_choice: SimEngineChoice): string {
  return ENGINE_V1;
}
