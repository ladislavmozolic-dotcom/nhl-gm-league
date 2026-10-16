import test from "node:test";
import assert from "node:assert/strict";
import { resolveCoreAction } from "../lib/sim/v3-core/action-resolver";

const actor = { id: 1, skating: 90, puckHandling: 90, passing: 65, shooting: 90, defense: 50, physical: 60 };
const weakDefender = { skating: 55, defense: 55, physical: 55, blocking: 55 };

test("V3 Core resolver rewards a skilled carrier against a weaker gap defender", () => {
  const r = resolveCoreAction({ action: "CARRY", zone: "NEUTRAL", pressure: 0.2, fatigue: 0.1, actor, primaryDefender: weakDefender });
  assert.ok(r.successChance > 0.65);
  assert.equal(r.nextZone, "OFFENSIVE");
});

test("V3 Core resolver makes a pressured clearance safer than a forced carry", () => {
  const common = { zone: "DEFENSIVE" as const, pressure: 0.9, fatigue: 0.8, actor: { ...actor, skating: 50, puckHandling: 50, physical: 65 }, primaryDefender: { ...weakDefender, defense: 85 } };
  assert.ok(resolveCoreAction({ ...common, action: "CLEAR" }).successChance > resolveCoreAction({ ...common, action: "CARRY" }).successChance);
});

test("V3 Core resolver exposes shot quality as a consequence, not a random event", () => {
  const r = resolveCoreAction({ action: "SHOOT", zone: "OFFENSIVE", pressure: 0.1, fatigue: 0, actor, primaryDefender: weakDefender });
  assert.equal(r.shotQuality, "HIGH");
  assert.equal(r.turnoverChance, 1 - r.successChance);
});

