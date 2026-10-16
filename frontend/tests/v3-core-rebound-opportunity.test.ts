import test from "node:test";
import assert from "node:assert/strict";
import { decideCoreAction } from "../lib/sim/v3-core/decision-engine";
import { consumeReboundOpportunity, createMatchState, viewForTeam, withReboundOpportunity } from "../lib/sim/v3-core/match-state";
import { advanceCoreClock } from "../lib/sim/v3-core/state-transition";

const carrier = { id: 1, skating: 72, puckHandling: 70, passing: 70, shooting: 78, defense: 65, physical: 68 };
const decide = (rebound: boolean) => decideCoreAction({
  hasPossession: true, zone: "OFFENSIVE", pressure: 0.2, fatigue: 0.1,
  scoreMargin: 0, secondsRemaining: 600, rebound, carrier,
});

test("a rebound creates one short follow-up window only for the attacking team", () => {
  const state = withReboundOpportunity(createMatchState({ homeTeamId: 1, awayTeamId: 2 }), 1);
  assert.equal(viewForTeam(state, 1).hasRebound, true);
  assert.equal(viewForTeam(state, 2).hasRebound, false);
  assert.equal(viewForTeam(consumeReboundOpportunity(state, 1), 1).hasRebound, false);
});

test("a rebound window expires when play moves on", () => {
  const state = withReboundOpportunity(createMatchState({ homeTeamId: 1, awayTeamId: 2 }), 1, 5);
  assert.equal(viewForTeam(advanceCoreClock(state, 5), 1).hasRebound, false);
});

test("a rebound raises shooting intent without forcing a shot", () => {
  const ordinary = decide(false).candidates.find((candidate) => candidate.action === "SHOOT")!;
  const rebound = decide(true).candidates.find((candidate) => candidate.action === "SHOOT")!;
  assert.ok(rebound.score > ordinary.score);
  assert.ok(decide(true).candidates.some((candidate) => candidate.action === "PASS"));
});
