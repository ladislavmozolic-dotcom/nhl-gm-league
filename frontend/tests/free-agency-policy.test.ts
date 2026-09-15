import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDemand, offerAcceptable, twoWayObjection } from "../lib/free-agency";

const demand = (round: number) => buildDemand({
  market: 70, grp: "F", age: 29, anchor: 5_000_000, comps: 12,
  perf: 1, morale: 70, round, priorBidders: 0,
});

test("an unsigned player lowers his demand between Frenzy rounds", () => {
  const r1 = demand(1), r2 = demand(2), r3 = demand(3);
  assert.ok(r2.salary < r1.salary);
  assert.ok(r3.salary < r2.salary);
  assert.ok(r2.floorSalary < r1.floorSalary);
  assert.ok(r3.floorSalary < r2.floorSalary);
});

test("the Agent still rejects an offer below the player's floor", () => {
  const d = demand(3);
  assert.equal(offerAcceptable(d, d.floorSalary - 50_000, d.years), false);
  assert.equal(offerAcceptable(d, d.floorSalary, d.years), true);
});

test("an established NHL player still refuses an ordinary two-way offer", () => {
  assert.match(twoWayObjection(true, { age: 28, overall: 75, lastSeasonGP: 70 }, 1, 1_000_000) ?? "", /established NHLer/i);
});
