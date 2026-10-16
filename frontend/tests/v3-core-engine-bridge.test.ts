import test from "node:test";
import assert from "node:assert/strict";
import { coreShootShare, type CoreEngineContext } from "../lib/sim/v3-core/engine-bridge";

const base = (over: Partial<CoreEngineContext> = {}, attrs: Record<string, number> = {}, type: string | null = null): CoreEngineContext => ({
  carrier: { id: 1, type, attrs: { sk: 70, ph: 70, pa: 70, sc: 70, df: 60, st: 60, ck: 60, ...attrs } as never },
  team: { teamTactics: { forecheck: "balanced", puckStyle: "balanced", tempo: "normal" } as never },
  zone: "OFF", shiftSeconds: 20, pressureSeconds: 5, scoreMargin: 0, secondsRemaining: 1800, rebound: false, ...over,
});

test("Core bridge: shoot share reacts to skills, player type, rebounds and late desperation — pure, no RNG", () => {
  const avg = coreShootShare(base());
  assert.ok(avg > 0.3 && avg < 0.8, `average ${avg}`);
  assert.ok(coreShootShare(base({}, { sc: 88, pa: 60 })) > avg, "a shooter shoots more");
  assert.ok(coreShootShare(base({}, { sc: 60, pa: 88 })) < avg, "a playmaker passes more");
  assert.ok(coreShootShare(base({}, {}, "Sniper")) > avg, "sniper type");
  assert.ok(coreShootShare(base({ rebound: true })) > avg, "a loose puck in the slot gets shot");
  assert.ok(coreShootShare(base({ scoreMargin: -1, secondsRemaining: 120 })) > avg, "down one late: shoot");
  assert.equal(coreShootShare(base()), coreShootShare(base()), "deterministic");
});
