import test from "node:test";
import assert from "node:assert/strict";
import { createMatchState, opponentId, viewForTeam, withPossession, withScore } from "../lib/sim/v3-core/match-state";

test("V3 Core match state starts neutral and keeps both teams explicit", () => {
  const state = createMatchState({ homeTeamId: 1, awayTeamId: 2, fatigue: { 1: -2, 2: 4 } });
  assert.equal(state.period, 1);
  assert.equal(state.puckZone, "NEUTRAL");
  assert.equal(state.fatigue[1], 0);
  assert.equal(state.fatigue[2], 1);
  assert.equal(opponentId(state, 1), 2);
});

test("V3 Core perspective derives zone, score and possession from one source of truth", () => {
  const initial = createMatchState({ homeTeamId: 10, awayTeamId: 20 });
  const state = withScore(withPossession(initial, 10, "AWAY_DEFENSIVE"), 10, 2);
  const home = viewForTeam(state, 10);
  const away = viewForTeam(state, 20);
  assert.equal(home.relativeZone, "OFFENSIVE");
  assert.equal(home.hasPossession, true);
  assert.equal(home.scoreMargin, 2);
  assert.equal(away.relativeZone, "DEFENSIVE");
  assert.equal(away.hasPossession, false);
  assert.equal(away.scoreMargin, -2);
});
