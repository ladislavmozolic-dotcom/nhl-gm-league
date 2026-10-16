import test from "node:test";
import assert from "node:assert/strict";
import { coreDumpShare, coreShootShare, type CoreEngineContext } from "../lib/sim/v3-core/engine-bridge";

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

test("Core bridge: a neutral-zone dump-in is likelier for a tired unit, under a hard forecheck and for a low-risk team; less when chasing late", () => {
  const nz = (over: Partial<CoreEngineContext> = {}, tactics: Record<string, string> = {}) => coreDumpShare({ ...base({ zone: "NEU", ...over }), team: { teamTactics: { forecheck: "balanced", puckStyle: "balanced", tempo: "normal", ...tactics } as never } });
  const avg = nz();
  assert.ok(avg > 0.05 && avg < 0.5, `average ${avg}`);
  assert.ok(nz({ shiftSeconds: 90 }) > avg, "tired legs chip it in");
  assert.ok(nz({ oppForecheck: 0.9 }) > nz({ oppForecheck: 0.2 }), "hard forecheck");
  assert.ok(nz({}, { puckStyle: "cycle" }) > nz({}, { puckStyle: "rush" }), "a cycle team dumps more than a rush team");
  assert.ok(nz({ scoreMargin: -1, secondsRemaining: 120 }) < avg, "down one late: carry it in");
});
