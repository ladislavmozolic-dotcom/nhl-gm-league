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

test("4th-line fit rewards checking/defensive forwards over top-line skill types", () => {
  // playerType() thresholds (lib/player-type.ts): high SC/PA -> Sniper/Playmaker
  // (skill); high CK with low offense -> Forechecker/Grinder or Defensive Forward.
  const skillLine = [
    forward("LW", { pa: 55, sc: 80, sk: 78, ck: 55, df: 55, st: 60 }),
    forward("C", { pa: 80, sc: 55, sk: 75, ck: 55, df: 55, st: 60 }),
    forward("RW", { pa: 55, sc: 80, sk: 78, ck: 55, df: 55, st: 60 }),
  ];
  const grindLine = [
    forward("LW", { pa: 45, sc: 45, sk: 55, ck: 80, df: 75, st: 65 }),
    forward("C", { pa: 45, sc: 45, sk: 55, ck: 80, df: 75, st: 65 }),
    forward("RW", { pa: 45, sc: 45, sk: 55, ck: 80, df: 75, st: 65 }),
  ];
  const skillOn1st = tacticalFitForwards(skillLine, DEFAULT_TACTICS, undefined, 0);
  const skillOn4th = tacticalFitForwards(skillLine, DEFAULT_TACTICS, undefined, 3);
  const grindOn1st = tacticalFitForwards(grindLine, DEFAULT_TACTICS, undefined, 0);
  const grindOn4th = tacticalFitForwards(grindLine, DEFAULT_TACTICS, undefined, 3);
  assert.ok(skillOn1st > skillOn4th, "a skill trio should fit the 1st line better than the 4th");
  assert.ok(grindOn4th > grindOn1st, "a checking/defensive trio should fit the 4th line better than the 1st");
});

test("2nd line gives partial credit to a power-forward-style Forechecker/Grinder", () => {
  // Raw rule (player-type.ts): CK>=75 & PA+SC<110 & DF<69 -> Forechecker/Grinder,
  // even with a decent PA+SC (105 here) — a power forward, not a pure energy guy.
  const powerForward = (pos: string) => forward(pos, { pa: 55, sc: 50, sk: 60, ck: 76, df: 60, st: 65 });
  const trio = [powerForward("LW"), powerForward("C"), powerForward("RW")];
  const on1st = tacticalFitForwards(trio, DEFAULT_TACTICS, undefined, 0);
  const on2nd = tacticalFitForwards(trio, DEFAULT_TACTICS, undefined, 1);
  assert.ok(on2nd > on1st, "a power-forward-style Grinder trio should now fit the 2nd line better than the 1st");
});

test("3rd D pair rewards a true shut-down (Stay-at-Home) D more than a merely Defensive one", () => {
  // playerType() raw thresholds (lib/player-type.ts): P<53 & PA+SC<105 & DF>=78
  // -> Stay-at-Home Defenceman; SK>=40 & P>=53 & PA+SC<105 & DF>=78 -> Defensive
  // Defenceman. Both members mirrored L/R so roleFitOf/positionFactor are
  // identical across the two pairs — only the archetype match should differ.
  const stayAtHomeL = forward("D", { shoots: "L", pa: 45, sc: 40, sk: 55, df: 82, st: 75, ck: 78 });
  const stayAtHomeR = forward("D", { shoots: "R", pa: 45, sc: 40, sk: 55, df: 82, st: 75, ck: 78 });
  const defensiveL = forward("D", { shoots: "L", pa: 55, sc: 45, sk: 45, df: 80, st: 72, ck: 74 });
  const defensiveR = forward("D", { shoots: "R", pa: 55, sc: 45, sk: 45, df: 80, st: 72, ck: 74 });
  const stayAtHomeFit = tacticalFitDefense([stayAtHomeL, stayAtHomeR], DEFAULT_TACTICS, undefined, 2);
  const defensiveFit = tacticalFitDefense([defensiveL, defensiveR], DEFAULT_TACTICS, undefined, 2);
  assert.ok(stayAtHomeFit > defensiveFit, "a true Stay-at-Home pairing should fit the 3rd pair better than a merely Defensive pairing");
});

test("no lineIndex leaves the score unaffected by depth-chart archetype", () => {
  const line = [
    forward("LW", { pa: 80, sc: 55, sk: 75 }),
    forward("C", { pa: 55, sc: 80, sk: 75 }),
    forward("RW", { ck: 82, df: 77, st: 80 }),
  ];
  const noIndex = tacticalFitForwards(line, DEFAULT_TACTICS);
  const explicitUndefined = tacticalFitForwards(line, DEFAULT_TACTICS, undefined, undefined);
  assert.equal(noIndex, explicitUndefined);
});
