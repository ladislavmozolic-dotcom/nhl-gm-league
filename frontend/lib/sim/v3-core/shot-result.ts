// V3 Core shot-result layer. A shot lane is only the start of a scoring event:
// this layer resolves the visible result without granting an automatic save or goal.
import type { CorePlayerProfile } from "./decision-engine";
import type { CoreResolution } from "./action-resolver";
import { resolveCoreShot, type CoreGoalieProfile } from "./goalie-resolver";

export type CoreShotOutcome = "MISS" | "BLOCK" | "GOAL" | "SAVE" | "REBOUND";
export type CoreShotResult = {
  chances: Record<CoreShotOutcome, number>;
  reason: string;
};

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/**
 * Splits an earned shooting lane into mutually exclusive hockey outcomes.
 * The shooter-versus-goalie goal probability stays owned by goalie-resolver;
 * defender skill determines blocked lanes, and rebound control only redistributes
 * saves into recoverable loose pucks.
 */
export function resolveCoreShotResult(input: {
  shooter: Pick<CorePlayerProfile, "shooting">;
  defender: Pick<CorePlayerProfile, "defense" | "physical"> & { blocking?: number };
  goalie: CoreGoalieProfile;
  shotQuality: NonNullable<CoreResolution["shotQuality"]>;
  pressure: number;
}): CoreShotResult {
  const quality = input.shotQuality;
  const laneGoal = resolveCoreShot({ shooter: input.shooter, goalie: input.goalie, shotQuality: quality }).goalChance;
  const defenderBlock = input.defender.blocking ?? input.defender.defense;
  const blockBase = quality === "HIGH" ? 0.10 : quality === "MEDIUM" ? 0.17 : 0.24;
  const missBase = quality === "HIGH" ? 0.05 : quality === "MEDIUM" ? 0.10 : 0.17;
  const block = clamp(blockBase + (defenderBlock - 70) * 0.003 + input.pressure * 0.08, 0.04, 0.38);
  const miss = clamp(missBase + input.pressure * 0.05 - (input.shooter.shooting - 70) * 0.0015, 0.02, 0.28);
  // `SHOOT` reaching this layer already means the action resolver awarded a
  // shooting lane. Preserve its calibrated shooter-versus-goalie conversion;
  // blocks and misses divide the non-goal remainder rather than applying a
  // second blanket penalty to every goal.
  const goal = laneGoal;
  const remaining = Math.max(0, 1 - block - miss - goal);
  const reboundShare = clamp(0.10 + (89.66 - input.goalie.reboundControl) * 0.006 + (quality === "HIGH" ? 0.05 : 0), 0.04, 0.28);
  const rebound = remaining * reboundShare;
  const save = Math.max(0, remaining - rebound);
  return {
    chances: { MISS: miss, BLOCK: block, GOAL: goal, SAVE: save, REBOUND: rebound },
    reason: `${quality.toLowerCase()} shot: lane pressure, defender block, goalie contest and rebound control`,
  };
}
