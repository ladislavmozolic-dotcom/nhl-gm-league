import test from "node:test";
import assert from "node:assert/strict";
import { resolveCoreShotResult } from "../lib/sim/v3-core/shot-result";
import { resolveCoreShot } from "../lib/sim/v3-core/goalie-resolver";

const shooter = { shooting: 80 };
const goalie = { id: 1, quality: 84, reflexes: 89, reboundControl: 90, condition: 99 };
const resolve = (defense: number, reboundControl = 90) => resolveCoreShotResult({
  shooter, defender: { defense, physical: 70 }, goalie: { ...goalie, reboundControl }, shotQuality: "MEDIUM", pressure: 0.3,
});

test("shot-result chances are exhaustive and non-negative", () => {
  const result = resolve(72);
  const total = Object.values(result.chances).reduce((sum, chance) => sum + chance, 0);
  assert.ok(Math.abs(total - 1) < 1e-12);
  for (const chance of Object.values(result.chances)) assert.ok(chance >= 0 && chance <= 1);
});

test("a stronger shot blocker closes more lanes", () => {
  assert.ok(resolve(90).chances.BLOCK > resolve(55).chances.BLOCK);
});

test("weaker rebound control creates more recoverable rebounds without changing misses", () => {
  const secure = resolve(72, 96).chances;
  const loose = resolve(72, 70).chances;
  assert.ok(loose.REBOUND > secure.REBOUND);
  assert.equal(loose.MISS, secure.MISS);
});

test("the outcome split preserves the calibrated shooter-versus-goalie goal chance", () => {
  const result = resolve(72).chances;
  const goal = resolveCoreShot({ shooter, goalie, shotQuality: "MEDIUM" }).goalChance;
  assert.equal(result.GOAL, goal);
});
