import test from "node:test";
import assert from "node:assert/strict";
import { createMatchState } from "../lib/sim/v3-core/match-state";
import { advanceCoreClock, applyCoreTickState, withCoreLineChange } from "../lib/sim/v3-core/state-transition";

test("V3 Core transition rolls the regulation clock across a period boundary", () => {
  const state = createMatchState({ homeTeamId: 1, awayTeamId: 2, period: 1, secondsIntoPeriod: 1198 });
  const next = advanceCoreClock(state, 5);
  assert.equal(next.period, 2);
  assert.equal(next.secondsIntoPeriod, 3);
  assert.equal(next.totalSeconds, 1203);
});

test("V3 Core transition accumulates defensive-zone pressure and effort without mutation", () => {
  const state = createMatchState({ homeTeamId: 1, awayTeamId: 2 });
  const next = applyCoreTickState(state, { attackingTeamId: 1, action: "PASS", success: true, relativeZone: "OFFENSIVE", seconds: 5 });
  assert.equal(state.totalSeconds, 0);
  assert.equal(next.totalSeconds, 5);
  assert.ok(next.pressure[2] > state.pressure[2]);
  assert.ok(next.fatigue[1] > state.fatigue[1]);
  assert.ok(next.fatigue[2] > state.fatigue[2]);
});

test("V3 Core line change copies the unit and gives the new shift a fatigue reset", () => {
  const state = createMatchState({ homeTeamId: 1, awayTeamId: 2, fatigue: { 1: 0.5, 2: 0.1 } });
  const next = withCoreLineChange(state, 1, { forwards: [11, 12, 13], defense: [14, 15] });
  assert.deepEqual(next.onIce[1], { forwards: [11, 12, 13], defense: [14, 15] });
  assert.equal(next.fatigue[1], 0.36);
  assert.deepEqual(state.onIce[1], { forwards: [], defense: [] });
});
