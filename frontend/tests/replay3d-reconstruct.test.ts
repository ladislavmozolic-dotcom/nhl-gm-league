import test from "node:test";
import assert from "node:assert/strict";
import { buildShotClip, clipAt, attackDirFor, RINK, type Actor, type ShotSpec } from "../lib/replay3d/reconstruct";

const team = (side: "home" | "away", n: number, dCount = 2): Actor[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${side}-${i}`, side, role: i >= n - dCount ? "D" : "F", name: `${side} ${i}`, number: 10 + i }));

const base = (over: Partial<ShotSpec>): ShotSpec => ({
  outcome: "goal", attackSide: "home", attackDir: 1,
  attackers: team("home", 5), defenders: team("away", 5),
  goalie: { id: "away-g", side: "away", role: "G", name: "Goalie", number: 31 },
  ownGoalie: { id: "home-g", side: "home", role: "G", name: "Own", number: 35 },
  shooterId: "home-0", assistIds: ["home-1", "home-3"], sector: "SLOT", shotType: "WRIST", seed: 42, ...over,
});

const variants: Array<[string, Partial<ShotSpec>]> = [
  ["cycle slot", {}],
  ["one-timer circle", { sector: "CIRCLE", shotType: "ONE_TIMER" }],
  ["point slap", { sector: "POINT", shotType: "SLAP", shooterId: "home-3", assistIds: ["home-4"] }],
  ["unassisted", { assistIds: [] }],
  ["rebound", { play: "rebound", sector: "NET_FRONT" }],
  ["wraparound", { play: "wrap", shotType: "BACKHAND", sector: "NET_FRONT" }],
  ["deflection", { play: "deflect", sector: "POINT", assistIds: ["home-3", "home-1"] }],
  ["breakaway", { rush: "BREAKAWAY", assistIds: [] }],
  ["2-on-1", { rush: "2ON1" }],
  ["3-on-2", { rush: "3ON2" }],
  ["empty net", { emptyNet: true, goalie: null, defenders: team("away", 6) }],
  ["power play 5v4", { defenders: team("away", 4) }],
  ["mirrored", { attackDir: -1 }],
];

for (const [name, over] of variants) {
  test(`3D replay — ${name}: finite, on the ice, puck ends in the net`, () => {
    const spec = base(over);
    const clip = buildShotClip(spec);
    assert.ok(clip.duration > 2 && clip.duration < 12, `duration ${clip.duration}`);
    assert.equal(clip.frames.length, Math.ceil(clip.duration * clip.fps) + 1);
    for (const fr of clip.frames) {
      for (const a of fr.a) {
        assert.ok(a && Number.isFinite(a.x) && Number.isFinite(a.z) && Number.isFinite(a.h), "finite actor");
        assert.ok(Math.abs(a.x) <= RINK.halfLength && Math.abs(a.z) <= RINK.halfWidth, `on ice ${a.x},${a.z}`);
      }
      assert.ok(Number.isFinite(fr.p.x) && Number.isFinite(fr.p.y) && Number.isFinite(fr.p.z), "finite puck");
    }
    const end = clip.frames[clip.frames.length - 1].p;
    const dir = spec.attackDir;
    assert.ok(end.x * dir > RINK.goalLine && end.x * dir < RINK.goalLine + RINK.netDepth, `puck in net x=${end.x}`);
    assert.ok(Math.abs(end.z) < RINK.netHalfWidth, `puck between posts z=${end.z}`);
    assert.ok(clip.goalT != null && clip.cues.some((c) => c.kind === "goal"));
    // never teleports: the puck moves at most ~200 ft/s between samples
    for (let i = 1; i < clip.frames.length; i++) {
      const a = clip.frames[i - 1].p, b = clip.frames[i].p;
      assert.ok(Math.hypot(b.x - a.x, b.z - a.z) * clip.fps < 200, `puck jump at frame ${i}`);
    }
  });
}

test("3D replay is deterministic per seed", () => {
  const a = buildShotClip(base({})), b = buildShotClip(base({}));
  assert.deepEqual(a.frames[40], b.frames[40]);
  const c = buildShotClip(base({ seed: 7 }));
  assert.notDeepEqual(a.frames[40].p, c.frames[40].p);
});

test("3D replay non-goal outcomes stay out of the net", () => {
  for (const outcome of ["save", "miss", "post", "block"] as const) {
    const clip = buildShotClip(base({ outcome }));
    const end = clip.frames[clip.frames.length - 1].p;
    assert.ok(!(end.x > RINK.goalLine && Math.abs(end.z) < RINK.netHalfWidth && end.y < RINK.netHeight), `${outcome} ended in the net`);
    assert.equal(clip.goalT, null);
    assert.ok(clipAt(clip, clip.duration / 2));
  }
});

test("teams swap ends every period", () => {
  assert.equal(attackDirFor("home", 1), 1);
  assert.equal(attackDirFor("home", 2), -1);
  assert.equal(attackDirFor("away", 1), -1);
  assert.equal(attackDirFor("away", 3), -1);
});

test("live clips (flow / hit / faceoff) stay finite and on the ice", async () => {
  const { buildFlowClip, buildHitClip, buildFaceoffClip } = await import("../lib/replay3d/reconstruct");
  const scene = { attackSide: "home" as const, attackDir: -1 as const, attackers: team("home", 5), defenders: team("away", 5), goalie: base({}).goalie, ownGoalie: base({}).ownGoalie, seed: 3 };
  const clips = [
    ...(["OFF", "NEU", "DEF"] as const).map((zone) => buildFlowClip({ ...scene, zone })),
    buildHitClip({ ...scene, hitterId: "away-3", victimId: "home-1" }),
    buildFaceoffClip({ ...scene, dot: { x: 0, z: 0 } }),
    buildFaceoffClip({ ...scene, dot: { x: 69, z: -22 } }),
  ];
  for (const clip of clips) {
    assert.equal(clip.shotT, null);
    assert.equal(clip.goalT, null);
    for (const fr of clip.frames) {
      for (const a of fr.a) assert.ok(a && Number.isFinite(a.x) && Math.abs(a.x) <= RINK.halfLength && Math.abs(a.z) <= RINK.halfWidth);
      assert.ok(Number.isFinite(fr.p.x) && Number.isFinite(fr.p.z));
    }
  }
});
