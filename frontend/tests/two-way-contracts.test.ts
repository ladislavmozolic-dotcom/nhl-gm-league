import assert from "node:assert/strict";
import test from "node:test";
import { farmSalaryExpense, liveAhlSalary, TWO_WAY_AHL_SALARY } from "../lib/finance";

test("a real two-way contract uses the fixed AHL salary on the farm", () => {
  const player = { capHit: 800_000, ahlSalary: TWO_WAY_AHL_SALARY, contractType: "TWO_WAY", contractYears: 2 };
  assert.equal(liveAhlSalary(player), 100_000);
  assert.equal(farmSalaryExpense([player]), 100_000);
});

test("legacy contracts without an explicit AHL salary keep their listed salary", () => {
  assert.equal(liveAhlSalary({ capHit: 100_000, contractType: "TWO_WAY", contractYears: 8 }), 100_000);
  assert.equal(liveAhlSalary({ capHit: 900_000, contractType: "TWO_WAY", contractYears: 2 }), 900_000);
  assert.equal(liveAhlSalary({ capHit: 1_500_000, contractType: "ONE_WAY", contractYears: 1 }), 1_500_000);
});

test("expired farm contracts no longer cost salary", () => {
  assert.equal(liveAhlSalary({ capHit: 900_000, ahlSalary: 100_000, contractType: "TWO_WAY", contractYears: 0 }), 0);
});
