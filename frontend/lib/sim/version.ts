// Sim-engine version stamps. V1 and the old shot-volume model are retired: every game runs
// the next-gen possession engine (V2). ENGINE_V1 survives only as the historical stamp that
// old Game rows carry; the LeagueConfig.simEngine column is kept so old rows/backups still load.

export type SimEngineChoice = "current" | "nextgen" | "v3";

export const ENGINE_V1 = "1.0.1"; // stable — complete OT/endgame shot accounting
export const ENGINE_V2 = "2.1.0"; // next-gen — complete OT/endgame shot accounting + tuning
// V3: the league resolves to it when the commissioner flips LeagueConfig.simEngine to "v3"
// (Admin → Simulation) — on the test instance and, since Oct 2026, on the live league too.
// The stored default is V2, so nothing changes until someone flips it.
export const ENGINE_V3 = "3.0.0-wip";

export function isNextGenEngine(version: string): boolean {
  return version === ENGINE_V2 || version === ENGINE_V3;
}

export function isExperimentalEngine(version: string): boolean {
  return version === ENGINE_V3;
}

/** Pure resolution rule: V3 when the commissioner's stored switch says "v3" (Admin → Simulation, on the
 *  live league too since Oct 2026); everything else runs V2. `sandbox` is kept for callers/tests. */
export function resolveSimEngine(stored: string | null | undefined, _sandbox = false): SimEngineChoice {
  return stored === "v3" ? "v3" : "nextgen";
}

/** The league's active sim engine. V1 is retired — every game runs on next-gen V2 unless this is the
 *  sandbox instance with the V3 switch on (see resolveSimEngine). */
export async function activeSimEngine(): Promise<SimEngineChoice> {
  const { prisma } = await import("../prisma");
  const lc = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { simEngine: true } });
  return resolveSimEngine(lc?.simEngine);
}

/** Engine version string to stamp for a chosen engine, and to pass as
 *  SimOptions.engineVersion so simulateGame actually routes to that path. */
export function engineVersionFor(choice: SimEngineChoice): string {
  return choice === "v3" ? ENGINE_V3 : choice === "nextgen" ? ENGINE_V2 : ENGINE_V1;
}
