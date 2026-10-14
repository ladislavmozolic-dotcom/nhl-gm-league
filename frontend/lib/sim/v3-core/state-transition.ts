// V3 Core state transition: time and game context evolve independently from
// decision and resolution.  It stays pure so every simulation seed is replayable.
import type { CoreAction } from "./decision-engine";
import { opponentId, type CoreOnIce, type RelativeZone, type V3CoreMatchState } from "./match-state";

const REGULATION_SECONDS = 3 * 20 * 60;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Advances regulation time without rolling the prototype into an invented OT. */
export function advanceCoreClock(state: V3CoreMatchState, seconds = 5): V3CoreMatchState {
  const totalSeconds = clamp(state.totalSeconds + Math.max(0, seconds), 0, REGULATION_SECONDS);
  const period = Math.min(3, Math.floor(Math.max(0, totalSeconds - 1) / 1200) + 1);
  const secondsIntoPeriod = totalSeconds === REGULATION_SECONDS ? 1200 : totalSeconds - (period - 1) * 1200;
  return { ...state, totalSeconds, period, secondsIntoPeriod };
}

/** Replaces a unit on the ice and lets a fresh shift shed part of its fatigue. */
export function withCoreLineChange(state: V3CoreMatchState, teamId: number, onIce: CoreOnIce): V3CoreMatchState {
  opponentId(state, teamId);
  return {
    ...state,
    onIce: { ...state.onIce, [teamId]: { forwards: [...onIce.forwards], defense: [...onIce.defense] } },
    fatigue: { ...state.fatigue, [teamId]: clamp(state.fatigue[teamId] - 0.14, 0.02, 1) },
  };
}

/** Applies the physical and territorial consequences of one abstract puck beat. */
export function applyCoreTickState(state: V3CoreMatchState, input: {
  attackingTeamId: number;
  action: CoreAction;
  success: boolean;
  relativeZone: RelativeZone;
  seconds?: number;
}): V3CoreMatchState {
  const defendingTeamId = opponentId(state, input.attackingTeamId);
  const seconds = Math.max(0, input.seconds ?? 5);
  const effort = seconds * (input.action === "SHOOT" || input.action === "CARRY" ? 0.00032 : 0.00022);
  const attackContinues = input.success && input.relativeZone === "OFFENSIVE" && input.action !== "SHOOT";
  const pressureGain = attackContinues ? 0.075 : input.success && input.relativeZone === "OFFENSIVE" ? 0.025 : -0.03;
  return {
    ...advanceCoreClock(state, seconds),
    fatigue: {
      ...state.fatigue,
      [input.attackingTeamId]: clamp(state.fatigue[input.attackingTeamId] + effort, 0, 1),
      [defendingTeamId]: clamp(state.fatigue[defendingTeamId] + effort * 0.82, 0, 1),
    },
    // Pressure is stored on the team defending its own zone: that is the value
    // the next possession view consumes as incoming pressure.
    pressure: {
      ...state.pressure,
      [defendingTeamId]: clamp(state.pressure[defendingTeamId] + pressureGain, 0, 1),
      [input.attackingTeamId]: clamp(state.pressure[input.attackingTeamId] - 0.025, 0, 1),
    },
  };
}
