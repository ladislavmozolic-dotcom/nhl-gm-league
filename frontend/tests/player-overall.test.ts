import assert from "node:assert/strict";
import { test } from "node:test";
import { livePlayerOverall } from "../lib/player-overall";

test("a goalie uses the current GoalieRating overall", () => {
  assert.equal(livePlayerOverall({
    isGoalie: true,
    overall: 71,
    goalieRating: { overall: 83 },
  }), 83);
});

test("an older goalie row falls back to Player.overall", () => {
  assert.equal(livePlayerOverall({
    isGoalie: true,
    overall: 75,
    goalieRating: null,
  }), 75);
});

test("a skater keeps Player.overall", () => {
  assert.equal(livePlayerOverall({
    isGoalie: false,
    overall: 91,
    goalieRating: { overall: 50 },
  }), 91);
});
