import test from "node:test";
import assert from "node:assert/strict";
import { tacticalFitFactor, TFIT_CENTRE } from "../lib/sim/engine";

test("Tactical Fit is a real, centred, bounded multiplier", () => {
  assert.equal(tacticalFitFactor(undefined), 1); // no manager line → neutral
  assert.equal(tacticalFitFactor(TFIT_CENTRE.F), 1); // league-typical fit → neutral
  assert.ok(tacticalFitFactor(100) > 1.02 && tacticalFitFactor(100) < 1.1); // well-built unit is rewarded
  assert.ok(tacticalFitFactor(30) < 1);
  assert.equal(tacticalFitFactor(TFIT_CENTRE.D, true), 1); // a D pair is judged against the D scale, not the forwards' // a mismatched unit is penalised
  assert.ok(tacticalFitFactor(0) >= 0.9 && tacticalFitFactor(100) <= 1.1); // clamped
});
