import test from "node:test";
import assert from "node:assert/strict";
import { resolveCoreShot } from "../lib/sim/v3-core/goalie-resolver";

const shooter = { shooting: 78 };

test("V3 Core goalie layer lets a stronger, fresher goalie lower the same shot's goal chance", () => {
  const common = { shooter, shotQuality: "MEDIUM" as const };
  const average = resolveCoreShot({ ...common, goalie: { id: 1, quality: 84.16, reflexes: 88.88, reboundControl: 89.66, condition: 99.03 } });
  const elite = resolveCoreShot({ ...common, goalie: { id: 2, quality: 90, reflexes: 90, reboundControl: 85, condition: 100 } });
  assert.ok(elite.goalChance < average.goalChance);
});

test("V3 Core goalie layer exposes a bounded chance and a causal explanation", () => {
  const r = resolveCoreShot({ shooter: { shooting: 99 }, goalie: { id: 2, quality: 40, reflexes: 40, reboundControl: 40, condition: 30 }, shotQuality: "HIGH" });
  assert.ok(r.goalChance > 0 && r.goalChance < 1);
  assert.match(r.reason, /goalie quality/);
});
