// V3 Core goalie layer.  Shot creation and finishing remain separate from the
// save contest so a club's starter can matter without distorting skater intent.
import type { CorePlayerProfile } from "./decision-engine";
import type { CoreResolution } from "./action-resolver";

export type CoreGoalieProfile = {
  id: number;
  quality: number;
  reflexes: number;
  reboundControl: number;
  condition: number; // 1..100, as on the existing goalie card
};

export type CoreShotResolution = {
  goalChance: number;
  reason: string;
};

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/**
 * Calculates a goal probability after the skater has already earned a shot
 * lane.  The baseline is the current NHL starter pool (measured from the
 * existing roster data), so goalie ratings move the outcome around the
 * calibrated league mean instead of silently depressing every V3 game.
 */
export function resolveCoreShot(input: {
  shooter: Pick<CorePlayerProfile, "shooting">;
  goalie: CoreGoalieProfile;
  shotQuality: NonNullable<CoreResolution["shotQuality"]>;
}): CoreShotResolution {
  // The starter-pool calibration targets roughly a 10% league shot conversion
  // once failed lanes and all shot qualities are included.
  const base = input.shotQuality === "HIGH" ? 0.34 : input.shotQuality === "MEDIUM" ? 0.24 : 0.12;
  const shooterEdge = (input.shooter.shooting - 70) * 0.0012;
  // NHL starter-pool means at the time of calibration: quality 84.16,
  // reflexes 88.88, rebound control 89.66, condition 99.03.
  const goalieEdge = (input.goalie.quality - 84.16) * 0.0035
    + (input.goalie.reflexes - 88.88) * 0.0008
    + (input.goalie.reboundControl - 89.66) * 0.0005
    + (input.goalie.condition - 99.03) * 0.001;
  const goalChance = clamp(base + shooterEdge - goalieEdge, 0.025, 0.45);
  return {
    goalChance,
    reason: `${input.shotQuality.toLowerCase()} lane, shooter finishing versus goalie quality and condition`,
  };
}
