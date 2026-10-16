import test from "node:test";
import assert from "node:assert/strict";
import { coreProfileFromGoalie, coreProfileFromSkater, corePrototypeTeamFromSimTeam } from "../lib/sim/v3-core/adapter";
import type { SimGoalie, SimSkater, SimTeam } from "../lib/sim/types";

const skater = { id: 9, type: "Sniper", attrs: { sk: 82, ph: 76, pa: 68, sc: 91, df: 54, st: 70, ck: 80 } } as SimSkater;
const goalie = { id: 30, quality: 84, con: 94, attrs: { rt: 89, rb: 78 } } as SimGoalie;

test("V3 Core adapter reuses existing skater attributes and profile type", () => {
  const p = coreProfileFromSkater(skater);
  assert.deepEqual(p, { id: 9, skating: 82, puckHandling: 76, passing: 68, shooting: 91, defense: 54, physical: 74, type: "Sniper" });
});

test("V3 Core adapter carries the existing starter attributes into the goalie layer", () => {
  assert.deepEqual(coreProfileFromGoalie(goalie), { id: 30, quality: 84, reflexes: 89, reboundControl: 78, condition: 94 });
});

test("V3 Core adapter carries team tactics into prototype risk and forecheck", () => {
  const team = { id: 4, forwards: [skater], defense: [], goalie, teamTactics: { tempo: "fast", forecheck: "aggressive", puckStyle: "rush" } } as unknown as SimTeam;
  const core = corePrototypeTeamFromSimTeam(team);
  assert.equal(core.id, 4);
  assert.equal(core.players[0].id, 9);
  assert.equal(core.tactics?.forecheck, 0.8);
  assert.equal(core.tactics?.risk, 0.86);
  assert.equal(core.goalie?.id, 30);
});
