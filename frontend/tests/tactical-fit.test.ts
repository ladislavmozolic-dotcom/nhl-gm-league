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
    forward("LW", { pa: 62, sc: 58, st: 60 }), // modest ratings so the 0..100 clamp doesn't hide the difference
    forward("C", { pa: 60, sc: 58, fo: 62, st: 60 }),
    forward("RW", { pa: 56, sc: 56, ck: 70, df: 66, st: 70 }),
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

test("scoring lines reward a hitter who also brings offence — a pure checker parked there is penalised", () => {
  // power forward: real offence (SC+PA 124, ~league p80) AND checking → fine on both scoring lines
  const power = (pos: string) => forward(pos, { pa: 62, sc: 62, sk: 62, ck: 82, df: 66, st: 70 });
  // pure checker (Hathaway-type): CK/DF/ST high but SC+PA 98, below the league median
  const checker = (pos: string) => forward(pos, { pa: 49, sc: 49, sk: 48, ck: 91, df: 69, st: 86 });
  const pf = [power("LW"), power("C"), power("RW")], ck = [checker("LW"), checker("C"), checker("RW")];
  for (const line of [0, 1]) {
    assert.ok(tacticalFitForwards(pf, DEFAULT_TACTICS, undefined, line) >= tacticalFitForwards(pf, DEFAULT_TACTICS), "a power-forward trio is not penalised on a scoring line");
    assert.ok(tacticalFitForwards(ck, DEFAULT_TACTICS, undefined, line) < tacticalFitForwards(ck, DEFAULT_TACTICS), "a pure-checker trio is penalised on a scoring line");
  }
  // FLA case: a Dual-Threat + a playmaking C with a pure checker (Hathaway) vs the same pair with a real power forward
  const tk = forward("LW", { sc: 64, pa: 67, ck: 67, df: 62, st: 65, sk: 66 }), be = forward("C", { sc: 62, pa: 59, ck: 71, df: 66, st: 65 });
  const hath = forward("RW", { sc: 49, pa: 49, ck: 91, df: 69, st: 86, sk: 48 }), wilson = forward("RW", { sc: 65, pa: 61, ck: 82, df: 66, st: 80, sk: 60 });
  assert.ok(tacticalFitForwards([tk, be, wilson], DEFAULT_TACTICS, undefined, 0) >= tacticalFitForwards([tk, be, hath], DEFAULT_TACTICS, undefined, 0), "a power forward fits the 1st line at least as well as a pure checker");
  // the 105 SC+PA bar: the same checker with SC+PA 106 instead of 98 adds clearly more on the 1st line, and the 4th line is unaffected
  const hath106 = forward("RW", { sc: 53, pa: 53, ck: 91, df: 69, st: 86, sk: 48 });
  assert.ok(tacticalFitForwards([tk, be, hath106], DEFAULT_TACTICS, undefined, 0) > tacticalFitForwards([tk, be, hath], DEFAULT_TACTICS, undefined, 0) + 10, "clearing 105 SC+PA matters on a scoring line");
  assert.ok(tacticalFitForwards([tk, be, hath], DEFAULT_TACTICS, undefined, 3) > tacticalFitForwards([tk, be, hath], DEFAULT_TACTICS, undefined, 0), "…and the pure checker belongs on the 4th line");
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

test("a line of Dual-Threats is not marked down for lacking a hitter, a no-offence checker still is", () => {
  const dual = (pos: string) => forward(pos, { sc: 66, pa: 67, ck: 64, df: 62, st: 64, sk: 66, ph: 66, fo: 66 });
  const checker = forward("RW", { sc: 49, pa: 49, ck: 91, df: 69, st: 86, sk: 48 });
  const stars = tacticalFitForwards([dual("LW"), dual("C"), dual("RW")], DEFAULT_TACTICS, undefined, 0);
  const withChecker = tacticalFitForwards([dual("LW"), dual("C"), checker], DEFAULT_TACTICS, undefined, 0);
  assert.ok(stars >= 95 && stars > withChecker + 10, "three Dual-Threats beat two + a pure checker on the 1st line");
});

test("D pair role fit is coverage: two genuine two-way D are not marked down, two of the same kind are", () => {
  const d = (shoots: string, a: Partial<TacticalFitPlayer>) => forward("D", { shoots, sk: 55, ck: 60, st: 78, ...a });
  const off = (s: string) => d(s, { pa: 66, sc: 55, sk: 62, df: 70, st: 76, ck: 62 });
  const def = (s: string) => d(s, { pa: 45, sc: 40, sk: 50, df: 82, st: 85, ck: 78 });
  const two = (s: string) => d(s, { pa: 58, sc: 48, sk: 56, df: 78, st: 82, ck: 72 });
  const fit = (a: TacticalFitPlayer, b: TacticalFitPlayer) => tacticalFitDefense([a, b], DEFAULT_TACTICS, undefined, 0);
  assert.ok(fit(off("L"), def("R")) >= fit(two("L"), two("R")), "offence + defence covers both jobs");
  assert.ok(fit(two("L"), two("R")) > fit(off("L"), off("R")) + 10, "two two-way D beat two offensive D");
});

test("AHL players are judged on the NHL scale (their ratings sit ~10 lower league-wide)", () => {
  const nhl = (pos: string) => forward(pos, { sc: 62, pa: 62, sk: 62, ck: 66, df: 63, st: 70, fo: 66, ph: 60 });
  const ahlLow = (pos: string) => ({ ...forward(pos, { sc: 50, pa: 52, sk: 50, ck: 65, df: 58, st: 69, fo: 59, ph: 60 }), ahl: true });
  const asNhl = tacticalFitForwards([nhl("LW"), nhl("C"), nhl("RW")], DEFAULT_TACTICS, undefined, 1);
  const asAhl = tacticalFitForwards([ahlLow("LW"), ahlLow("C"), ahlLow("RW")], DEFAULT_TACTICS, undefined, 1);
  const unshifted = tacticalFitForwards([ahlLow("LW"), ahlLow("C"), ahlLow("RW")].map((p) => ({ ...p, ahl: false })), DEFAULT_TACTICS, undefined, 1);
  assert.ok(Math.abs(asNhl - asAhl) <= 6, "an AHL unit at the same place in its league as an NHL unit gets a comparable fit");
  assert.ok(unshifted < asAhl - 15, "without the level shift the same AHL unit would collapse");
});
