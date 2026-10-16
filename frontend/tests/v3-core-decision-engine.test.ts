import test from "node:test";
import assert from "node:assert/strict";
import { decideCoreAction, type CoreDecisionInput } from "../lib/sim/v3-core/decision-engine";

const base: CoreDecisionInput = {
  hasPossession: true, zone: "NEUTRAL", pressure: 0.2, fatigue: 0.1, scoreMargin: 0, secondsRemaining: 900,
  carrier: { id: 7, skating: 92, puckHandling: 88, passing: 55, shooting: 55, defense: 50, physical: 50 },
};

test("V3 Core favours a skilled fresh carrier through the neutral zone", () => {
  assert.equal(decideCoreAction(base).action, "CARRY");
});

test("V3 Core clears rather than forcing a play under defensive-zone pressure", () => {
  const decision = decideCoreAction({ ...base, zone: "DEFENSIVE", pressure: 0.95, fatigue: 0.85, carrier: { ...base.carrier, skating: 45, puckHandling: 45, passing: 45 } });
  assert.equal(decision.action, "CLEAR");
});

test("V3 Core lets an elite sniper choose a late offensive-zone shot", () => {
  const decision = decideCoreAction({ ...base, zone: "OFFENSIVE", scoreMargin: -1, secondsRemaining: 90, carrier: { ...base.carrier, shooting: 96, type: "Sniper" } });
  assert.equal(decision.action, "SHOOT");
});

test("V3 Core makes a defending unit contain while protecting a late lead", () => {
  const decision = decideCoreAction({ ...base, hasPossession: false, zone: "DEFENSIVE", scoreMargin: 1, secondsRemaining: 100, carrier: { ...base.carrier, defense: 85, type: "Defensive Forward" } });
  assert.equal(decision.action, "CONTAIN");
});
