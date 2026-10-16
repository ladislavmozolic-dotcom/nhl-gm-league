import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseCorePrototype } from "../lib/sim/v3-core/diagnostic";
import type { SimSkater, SimTeam } from "../lib/sim/types";

const player = (id: number) => ({ id, type: "Two-Way Forward", attrs: { sk: 70, ph: 70, pa: 70, sc: 70, df: 70, st: 70, ck: 70 } } as SimSkater);
const team = (id: number) => ({ id, name: `Team ${id}`, forwards: [player(id * 10)], defense: [], teamTactics: { tempo: "balanced", forecheck: "balanced", puckStyle: "balanced" } } as unknown as SimTeam);

test("V3 Core diagnostic reports a deterministic event mix for real-team-shaped input", () => {
  const a = diagnoseCorePrototype(team(1), team(2), 7, 30);
  const b = diagnoseCorePrototype(team(1), team(2), 7, 30);
  assert.deepEqual(a, b);
  assert.equal(a.eventLog.length, 24);
  assert.ok(a.shots >= a.goals);
});
