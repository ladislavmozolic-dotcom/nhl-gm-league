import test from "node:test";
import assert from "node:assert/strict";
import { runCorePrototype } from "../lib/sim/v3-core/prototype-loop";

const player = (id: number, shooting = 70) => ({ id, skating: 72, puckHandling: 70, passing: 70, shooting, defense: 68, physical: 68 });
const input = { home: { id: 1, players: [player(1, 92), player(2)] }, away: { id: 2, players: [player(3), player(4)] }, seed: 42, ticks: 80 };

test("V3 Core prototype is deterministic for the same seed and roster", () => {
  assert.deepEqual(runCorePrototype(input), runCorePrototype(input));
});

test("V3 Core prototype emits causal outcomes after every chosen action", () => {
  const r = runCorePrototype(input);
  assert.ok(r.events.some((e) => e.action === "TURNOVER" || e.action === "SAVE" || e.action === "GOAL"));
  for (const goal of r.events.filter((e) => e.action === "GOAL")) assert.equal(goal.outcome, "GOAL");
  assert.ok(r.state.score[1] >= 0 && r.state.score[2] >= 0);
});

test("V3 Core prototype advances a regulation clock and rotates declared lines", () => {
  const r = runCorePrototype({
    ...input,
    ticks: 20,
    home: { ...input.home, lines: { forwards: [[1], [2]], defense: [] } },
    away: { ...input.away, lines: { forwards: [[3], [4]], defense: [] } },
  });
  assert.equal(r.state.totalSeconds, 100);
  assert.deepEqual(r.state.onIce[1].forwards, [1]); // shift 2 returns to line one
  assert.deepEqual(r.state.onIce[2].forwards, [3]);
});
