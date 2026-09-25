import test from "node:test";
import assert from "node:assert/strict";
import { reshuffleBySlot } from "../lib/sim/line-reshuffle";
import { tacticalFitForwards, type TacticalFitPlayer } from "../lib/sim/tactical-fit";
import { DEFAULT_TACTICS } from "../lib/sim/tactics";

type Unit = { a: number | null; b: number | null };

test("reshuffleBySlot swaps a slot across units when it raises the score, and stops improving", () => {
  const units: Unit[] = [{ a: 1, b: 10 }, { a: 2, b: 20 }];
  // score prefers unit 0's "a" to be the LARGER of {1,2} — the opposite of how
  // it starts, so a single swap of the "a" slot should strictly improve it.
  const score = (us: Unit[]) => (us[0].a ?? 0) - (us[1].a ?? 0);
  const { units: result, swaps } = reshuffleBySlot(units, ["a"], score, () => "swapped");
  assert.equal(result[0].a, 2);
  assert.equal(result[1].a, 1);
  assert.equal(swaps.length, 1);
  // "b" was never touched (only "a" was requested as a swappable slot)
  assert.equal(result[0].b, 10);
  assert.equal(result[1].b, 20);
});

test("reshuffleBySlot leaves already-optimal units untouched", () => {
  const units: Unit[] = [{ a: 2, b: null }, { a: 1, b: null }];
  const score = (us: Unit[]) => (us[0].a ?? 0) - (us[1].a ?? 0); // already maximal
  const { units: result, swaps } = reshuffleBySlot(units, ["a"], score, () => "swapped");
  assert.deepEqual(result, units);
  assert.equal(swaps.length, 0);
});

test("reshuffleBySlot moves a power-forward-style Grinder off the 1st line onto the 4th, using real Tactical Fit", () => {
  // Same player-type.ts raw thresholds used in tactical-fit.test.ts: this trio
  // classifies as "Forechecker / Grinder" (high CK, moderate offense, DF<69).
  const player = (pos: string, over: Partial<TacticalFitPlayer> = {}): TacticalFitPlayer & { id: number } => ({
    id: 0, position: pos, pa: 45, sc: 45, sk: 55, ck: 80, df: 60, st: 65, fo: 50, en: 60, weight: 95, ...over,
  });
  // autoLines() would put the highest-overall trio on line 0 regardless of
  // archetype — simulate that: a Grinder trio (misplaced) on line 0, and a
  // skill trio (misplaced) on line 3.
  const byId = new Map<number, TacticalFitPlayer>([
    [1, player("LW")], [2, player("C")], [3, player("RW")], // grinders, currently on line 0
    [4, player("LW", { pa: 55, sc: 80, sk: 78, ck: 55, df: 55 })],
    [5, player("C", { pa: 80, sc: 55, sk: 75, ck: 55, df: 55 })],
    [6, player("RW", { pa: 55, sc: 80, sk: 78, ck: 55, df: 55 })], // skill players, currently on line 3
  ]);
  type FLine = { lw: number | null; c: number | null; rw: number | null };
  const lines: FLine[] = [
    { lw: 1, c: 2, rw: 3 },
    { lw: null, c: null, rw: null },
    { lw: null, c: null, rw: null },
    { lw: 4, c: 5, rw: 6 },
  ];
  const score = (ls: FLine[]) => ls.reduce((sum, l, i) =>
    sum + tacticalFitForwards([l.lw, l.c, l.rw].map((id) => id != null ? byId.get(id) ?? null : null), DEFAULT_TACTICS, undefined, i), 0);
  const before = score(lines);
  const { units: after } = reshuffleBySlot(lines, ["c", "lw", "rw"], score, () => "swap");
  const afterScore = score(after);
  assert.ok(afterScore > before, "reshuffling should raise total Tactical Fit");
  // Some of the Grinder trio (ids 1/2/3) should have moved onto the 4th line
  // (index 3, its best archetype fit), and some of the skill trio (4/5/6) onto
  // the 1st (index 0) — not necessarily a full swap (several placements tie
  // for identical players), just a net shift in that direction.
  const grinders = [1, 2, 3], skillPlayers = [4, 5, 6];
  const onLine3 = [after[3].lw, after[3].c, after[3].rw];
  const onLine0 = [after[0].lw, after[0].c, after[0].rw];
  assert.ok(onLine3.some((id) => id != null && grinders.includes(id)), "at least one Grinder should move onto the 4th line");
  assert.ok(onLine0.some((id) => id != null && skillPlayers.includes(id)), "at least one skill player should move onto the 1st line");
});
