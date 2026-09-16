import test from "node:test";
import assert from "node:assert/strict";
import { tacticalFitDefense, tacticalFitForwards, type TacticalFitPlayer } from "../lib/sim/tactical-fit";
import { DEFAULT_TACTICS } from "../lib/sim/tactics";

const forward = (position: string, attrs: Partial<TacticalFitPlayer> = {}): TacticalFitPlayer => ({
  position, pa: 72, sc: 72, sk: 72, ck: 68, df: 66, st: 70, fo: 70, en: 72, weight: 90, ...attrs,
});

test("forward tactical fit reacts to slot correctness", () => {
  const lw = forward("LW", { pa: 83, fo: 80 });
  const c = forward("C", { sc: 84, sk: 82 });
  const rw = forward("RW", { ck: 82, df: 77, st: 80 });
  const natural = tacticalFitForwards([lw, c, rw], DEFAULT_TACTICS);
  const misplaced = tacticalFitForwards([c, rw, lw], DEFAULT_TACTICS);
  assert.ok(natural > misplaced);
});

test("defence tactical fit reacts to the LD/RD handedness", () => {
  const offensive = forward("D", { shoots: "L", pa: 84, sk: 82, sc: 79, df: 65, st: 64, ck: 62 });
  const shutdown = forward("D", { shoots: "R", pa: 60, sk: 65, sc: 58, df: 86, st: 84, ck: 82 });
  const natural = tacticalFitDefense([offensive, shutdown], DEFAULT_TACTICS);
  const wrongSides = tacticalFitDefense([{ ...offensive, shoots: "R" }, { ...shutdown, shoots: "L" }], DEFAULT_TACTICS);
  assert.ok(natural > wrongSides);
});

test("per-line system override changes the same tactical-fit score", () => {
  const line = [
    forward("LW", { pa: 85, st: 84 }),
    forward("C", { pa: 83, fo: 82, st: 82 }),
    forward("RW", { ck: 82, df: 76, st: 86 }),
  ];
  const balanced = tacticalFitForwards(line, DEFAULT_TACTICS);
  const cycle = tacticalFitForwards(line, DEFAULT_TACTICS, "cycle");
  assert.notEqual(cycle, balanced);
});
