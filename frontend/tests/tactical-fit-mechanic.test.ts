import test from "node:test";
import assert from "node:assert/strict";
import { tacticalFitFactor, TFIT_CENTRE } from "../lib/sim/engine";

test("Tactical Fit is a real, centred, bounded multiplier", () => {
  assert.equal(tacticalFitFactor(undefined), 1); // no manager line → neutral
  assert.equal(tacticalFitFactor(TFIT_CENTRE), 1); // league-typical fit → neutral
  assert.ok(tacticalFitFactor(90) > 1.04 && tacticalFitFactor(90) < 1.1); // well-built unit is rewarded
  assert.ok(tacticalFitFactor(30) < 1); // a mismatched unit is penalised
  assert.ok(tacticalFitFactor(0) >= 0.9 && tacticalFitFactor(100) <= 1.1); // clamped
});
