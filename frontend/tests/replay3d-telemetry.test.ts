import test from "node:test";
import assert from "node:assert/strict";
import { computeGoalTelemetry, type GoalReplayData } from "../lib/replay3d/goal-replay";

const sampleGoal = (over: Partial<GoalReplayData>): GoalReplayData => ({
  period: 1,
  seconds: 320,
  teamId: 1,
  strength: "EV",
  emptyNet: false,
  scorerId: 97,
  scorerName: "C. McDavid",
  assistIds: [29, 2],
  assistNames: ["L. Draisaitl", "E. Bouchard"],
  sector: "SLOT",
  shotType: "WRIST",
  play: null,
  rush: null,
  xg: 0.18,
  forSkaters: [],
  againstSkaters: [],
  goalie: null,
  ownGoalie: null,
  ...over,
});

test("computeGoalTelemetry produces positive speeds and metric conversions", () => {
  const t = computeGoalTelemetry(sampleGoal({ shotType: "SLAP" }), 42);
  assert.ok(t.speedMph >= 80 && t.speedMph <= 115, `expected slap speed, got ${t.speedMph}`);
  assert.equal(t.speedKmh, Math.round(t.speedMph * 1.60934 * 10) / 10);
  assert.equal(t.shotTypeLabel, "SLAP SHOT");
});

test("computeGoalTelemetry calculates sector-appropriate distances", () => {
  const netFront = computeGoalTelemetry(sampleGoal({ sector: "NET_FRONT" }), 10);
  const point = computeGoalTelemetry(sampleGoal({ sector: "POINT" }), 10);

  assert.ok(netFront.distanceFt < 22, `net front distance ${netFront.distanceFt}`);
  assert.ok(point.distanceFt > 40, `point distance ${point.distanceFt}`);
  assert.equal(netFront.distanceM, Math.round(netFront.distanceFt * 0.3048 * 10) / 10);
});

test("computeGoalTelemetry flags high-danger chances and play styles", () => {
  const breakaway = computeGoalTelemetry(sampleGoal({ rush: "BREAKAWAY" }), 12);
  assert.equal(breakaway.playLabel, "BREAKAWAY");
  assert.ok(breakaway.isHighDanger);

  const oneTimer = computeGoalTelemetry(sampleGoal({ shotType: "ONE_TIMER", strength: "PP" }), 55);
  assert.equal(oneTimer.shotTypeLabel, "ONE-TIMER");
  assert.equal(oneTimer.playLabel, "POWER PLAY");

  const deflect = computeGoalTelemetry(sampleGoal({ play: "deflect" }), 88);
  assert.equal(deflect.shotTypeLabel, "DEFLECTION");
});

test("computeGoalTelemetry is deterministic with the same seed", () => {
  const a = computeGoalTelemetry(sampleGoal({ sector: "CIRCLE", shotType: "SNAP" }), 12345);
  const b = computeGoalTelemetry(sampleGoal({ sector: "CIRCLE", shotType: "SNAP" }), 12345);
  assert.deepEqual(a, b);

  const c = computeGoalTelemetry(sampleGoal({ sector: "CIRCLE", shotType: "SNAP" }), 99999);
  assert.notEqual(a.speedMph, c.speedMph);
});

test("teamKit resolves accurate uniforms for NHL and AHL clubs", async () => {
  const { teamKit } = await import("../lib/replay3d/team-colors");

  // NHL test
  const edmHome = teamKit("EDM", "EDMONTON OILERS", true);
  assert.equal(edmHome.jersey, "#041e42");
  assert.equal(edmHome.trim, "#ff4c00");
  assert.equal(edmHome.isDark, true);

  const edmAway = teamKit("EDM", "EDMONTON OILERS", false);
  assert.equal(edmAway.jersey, "#ffffff");
  assert.equal(edmAway.trim, "#041e42");
  assert.equal(edmAway.isDark, false);

  // AHL tests (Ontario Reign & Grand Rapids Griffins from game 216155)
  const ontario = teamKit({ slug: "ontario-reign", name: "ONTARIO REIGN" }, true);
  assert.equal(ontario.jersey, "#111111");
  assert.equal(ontario.trim, "#a2aaad");
  assert.equal(ontario.pants, "#111111");

  const griffins = teamKit({ slug: "grand-rapids-griffins", name: "GRAND RAPIDS GRIFFINS" }, false);
  assert.equal(griffins.jersey, "#ffffff");
  assert.equal(griffins.trim, "#ce1126");
  assert.equal(griffins.stripe, "#002868");
});

