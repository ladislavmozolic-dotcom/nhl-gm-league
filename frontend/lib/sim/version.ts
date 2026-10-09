// Sim-engine version stamps. V1 and the old shot-volume model are retired: every game runs
// the next-gen possession engine (V2). ENGINE_V1 survives only as the historical stamp that
// old Game rows carry; the LeagueConfig.simEngine column is kept so old rows/backups still load.

export type SimEngineChoice = "current" | "nextgen" | "v3";

export const ENGINE_V1 = "1.0.1"; // stable — complete OT/endgame shot accounting
export const ENGINE_V2 = "2.1.0"; // next-gen — complete OT/endgame shot accounting + tuning
// V3 is a work-in-progress branch. It can be passed directly to simulateGame by
// diagnostics, and the league resolves to it ONLY on the sandbox/test instance
// (SANDBOX=1) when the commissioner flips LeagueConfig.simEngine to "v3". On the live
// league the stored value is ignored, so V3 can never run there by accident.
export const ENGINE_V3 = "3.0.0-wip";

export function isNextGenEngine(version: string): boolean {
  return version === ENGINE_V2 || version === ENGINE_V3;
}

export function isExperimentalEngine(version: string): boolean {
  return version === ENGINE_V3;
}

/** Pure resolution rule: V3 only when this is the sandbox instance AND the stored switch says "v3";
 *  everything else (including a "v3" value copied into the live DB) runs V2. */
export function resolveSimEngine(stored: string | null | undefined, sandbox: boolean): SimEngineChoice {
  return sandbox && stored === "v3" ? "v3" : "nextgen";
}

/** The league's active sim engine. V1 is retired — every game runs on next-gen V2 unless this is the
 *  sandbox instance with the V3 switch on (see resolveSimEngine). */
export async function activeSimEngine(): Promise<SimEngineChoice> {
  if (process.env.SANDBOX !== "1") return "nextgen"; // live never touches the DB or V3 here
  const { prisma } = await import("../prisma");
  const lc = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { simEngine: true } });
  return resolveSimEngine(lc?.simEngine, true);
}

/** Engine version string to stamp for a chosen engine, and to pass as
 *  SimOptions.engineVersion so simulateGame actually routes to that path. */
export function engineVersionFor(choice: SimEngineChoice): string {
  return choice === "v3" ? ENGINE_V3 : choice === "nextgen" ? ENGINE_V2 : ENGINE_V1;
}
