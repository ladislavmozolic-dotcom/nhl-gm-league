import assert from "node:assert/strict";
import test from "node:test";
import { buyoutTerms } from "../lib/finance";

const settings = { buyoutPctOffseason: 33, buyoutPctSeason: 66 };

test("off-season buyout creates 33% dead cap for twice the remaining term", () => {
  assert.deepEqual(buyoutTerms(4_820_000, 4, false, settings), {
    pct: 33,
    perYear: 1_590_500,
    years: 8,
    totalCost: 12_724_000,
  });
});

test("regular-season buyout creates 66% dead cap for twice the remaining term", () => {
  assert.deepEqual(buyoutTerms(4_820_000, 4, true, settings), {
    pct: 66,
    perYear: 3_181_000,
    years: 8,
    totalCost: 25_448_000,
  });
});
