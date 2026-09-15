import assert from "node:assert/strict";
import { test } from "node:test";
import { frenzyRoundCloseUtcMs } from "../lib/sim-clock";

test("a scheduled round runs four days of bidding followed by two days of improvement", () => {
  // 1 September 14:00 in Bratislava (CEST) is 12:00 UTC.
  const opened = "2027-09-01T12:00:00.000Z";
  const biddingClose = frenzyRoundCloseUtcMs(new Date(opened), 1, 1, opened, "BIDDING");
  assert.equal(new Date(biddingClose).toISOString(), "2027-09-05T12:00:00.000Z");

  const improvementStarted = new Date(biddingClose).toISOString();
  const decision = frenzyRoundCloseUtcMs(new Date(improvementStarted), 1, 5, improvementStarted, "IMPROVEMENT");
  assert.equal(new Date(decision).toISOString(), "2027-09-07T12:00:00.000Z");
});

test("all three rounds occupy eighteen real days", () => {
  let stageStart = new Date("2027-09-01T12:00:00.000Z");
  for (let round = 1; round <= 3; round++) {
    const offerClose = frenzyRoundCloseUtcMs(stageStart, round, 1, stageStart.toISOString(), "BIDDING");
    stageStart = new Date(offerClose);
    const decision = frenzyRoundCloseUtcMs(stageStart, round, 5, stageStart.toISOString(), "IMPROVEMENT");
    stageStart = new Date(decision);
  }
  assert.equal(stageStart.toISOString(), "2027-09-19T12:00:00.000Z");
});
