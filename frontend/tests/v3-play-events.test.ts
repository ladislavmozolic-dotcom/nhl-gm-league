import test from "node:test";
import assert from "node:assert/strict";
import { simulateGame } from "../lib/sim/engine";
import { autoLines } from "../lib/sim/lines-core";
import { buildTeam } from "../lib/sim/ratings";
import { ENGINE_V2, ENGINE_V3 } from "../lib/sim/version";
import { describeLiveEvent } from "../lib/sim/live-text";
import type { TeamTactics } from "../lib/sim/tactics";
import type { GameResult, SimGoalie, SimSkater } from "../lib/sim/types";

function makeTeam(id: number, strength: number, system?: TeamTactics) {
  const attrs = { ck: strength, fg: strength, di: strength, sk: strength, st: strength, en: strength, du: strength, ph: strength, fo: strength, pa: strength, sc: strength, df: strength, ps: strength, ex: strength, ld: strength, mo: strength };
  const skaters: Array<Omit<SimSkater, "iceTime">> = Array.from({ length: 20 }, (_, i) => {
    const d = i >= 12;
    const position = d ? "D" : i % 3 === 1 ? "C" : i % 3 === 0 ? "LW" : "RW";
    return { id: id * 100 + i + 1, name: `T${id} P${i + 1}`, position, isDefense: d, isCenter: position === "C", overall: strength,
      attrs: { ...attrs }, offense: strength, playmaking: strength, defense: strength, faceoff: strength, discipline: 60 + (i % 20), hitting: strength, blocking: strength,
      con: 100, chem: 100, roleFit: 1, morale: 70, weight: 90, shoots: i % 2 ? "R" : "L", offSide: false, posPenalty: 1 };
  });
  const goalies: SimGoalie[] = [0, 1].map((i) => ({ id: id * 100 + 50 + i, name: `T${id} G${i + 1}`, overall: strength,
    attrs: { sk: strength, du: strength, en: strength, sz: strength, ag: strength, rb: strength, sc: strength, hs: strength, rt: strength, ph: strength, ps: strength, ex: strength, ld: strength, mo: strength },
    quality: strength, con: 100, du: strength, fatigued: false, morale: 70 }));
  const lines = autoLines(skaters.map((s) => ({ id: s.id, position: s.position, overall: s.overall, shoots: s.shoots, df: s.attrs.df })), goalies.map((g) => ({ id: g.id, overall: g.overall })));
  return buildTeam({ id, name: `T${id}`, code: `T${id}`, skaters: skaters as SimSkater[], goalies, lines, system });
}

const run = (seed: number, version: string, playEvents?: boolean): GameResult =>
  simulateGame(makeTeam(1, 60 + (seed % 9)), makeTeam(2, 62 + ((seed * 3) % 9)), { seed, engineVersion: version, ...(playEvents === undefined ? {} : { experimentalV3: { playEvents } }) });
const count = (r: GameResult, type: string) => (r.events ?? []).filter((e) => e.type === type);

test("V3 hits, blocks and takeaways happen in the play: every one names the other player, box score = event count", () => {
  let hits = 0, blocks = 0, takes = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = run(seed, ENGINE_V3);
    assert.equal(count(r, "HIT").length, r.home.hits + r.away.hits, "every hit in the box score is an event");
    assert.equal(count(r, "BLOCK").length, r.home.blocks + r.away.blocks, "every block in the box score is an event");
    for (const e of [...count(r, "HIT"), ...count(r, "BLOCK"), ...count(r, "TAKEAWAY")]) assert.ok(e.targetName && e.playerName, `${e.type} must name both players`);
    // a block happens on a shot attempt: the blocker is on the other team from the shooter
    for (const e of count(r, "BLOCK")) assert.notEqual(e.teamId, Math.floor(e.targetId! / 100), "the blocker is on the other team from the shooter");
    hits += count(r, "HIT").length; blocks += count(r, "BLOCK").length; takes += count(r, "TAKEAWAY").length;
    for (const e of [...count(r, "HIT"), ...count(r, "BLOCK"), ...count(r, "TAKEAWAY")]) assert.ok(describeLiveEvent(e)!.text.length > 10);
  }
  assert.ok(hits / 80 > 15 && hits / 80 < 30, `hits per team-game ${hits / 80}`);
  assert.ok(blocks / 80 > 9 && blocks / 80 < 20, `blocks per team-game ${blocks / 80}`);
  assert.ok(takes / 80 > 4 && takes / 80 < 11, `takeaways per team-game ${takes / 80}`);
});

test("V2 keeps its after-the-game hit/block/takeaway sprinkling (no target), V3 flag off does too", () => {
  for (const seed of [1, 2, 3]) {
    for (const r of [run(seed, ENGINE_V2), run(seed, ENGINE_V3, false)]) {
      for (const e of [...count(r, "HIT"), ...count(r, "BLOCK"), ...count(r, "TAKEAWAY")]) assert.equal(e.targetName, undefined);
      assert.ok(count(r, "HIT").length > 0);
    }
  }
});

test("V3 fights are events with a winner, a story and the injury; the play-by-play and the live feed tell the same bout", () => {
  let bouts = 0, hurt = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = simulateGame(makeTeam(1, 64), makeTeam(2, 66), { seed, engineVersion: ENGINE_V3, rivalry: true });
    const fights = count(r, "FIGHT");
    const majors = (r.events ?? []).filter((e) => e.type === "PENALTY" && (e.meta as { penalty?: string } | undefined)?.penalty === "Fighting").length;
    assert.equal(fights.length * 2, majors, "every bout is two fighting majors");
    const lines = r.playByPlay.filter((l) => l.kind === "fight");
    assert.equal(lines.length, fights.length);
    for (const f of fights) {
      const m = f.meta as { winnerId: number | null; hurtNames: string[] };
      assert.ok(m.winnerId === null || m.winnerId === f.playerId || m.winnerId === f.targetId, "the winner is one of the two");
      const live = describeLiveEvent(f)!.text;
      assert.ok(live.includes(f.playerName!) && live.includes(f.targetName!) && live.includes("5-minute majors"));
      assert.ok(lines.some((l) => l.text === live), "play-by-play and live feed use the same wording");
      for (const n of m.hurtNames) assert.ok(live.includes(`${n} is hurt in the fight`));
      hurt += m.hurtNames.length; bouts++;
    }
    assert.equal(count(simulateGame(makeTeam(1, 64), makeTeam(2, 66), { seed, engineVersion: ENGINE_V2, rivalry: true }), "FIGHT").length, 0, "V2 keeps the old fight line");
  }
  assert.ok(bouts > 8, `enough fights to say something (${bouts})`);
  assert.ok(hurt >= 1, "some fights end in an injury");
});

test("V3 long zone pressure is narrated, tired defences show up, V2 and pin:false have none", () => {
  let pressure = 0, tired = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = run(seed, ENGINE_V3);
    for (const e of count(r, "PRESSURE")) {
      const m = e.meta as { seconds: number; against: string; tired: boolean };
      assert.ok(m.seconds >= 20 && m.seconds < 200 && m.against, "pressure names the pinned team and how long");
      const t = describeLiveEvent(e)!.text;
      assert.ok(t.includes(String(m.seconds)) && t.includes(m.against) && t.includes("pinned"), t);
      assert.ok(r.playByPlay.some((l) => l.kind === "pressure" && l.text === t), "same wording in the play-by-play");
      pressure++; if (m.tired) tired++;
    }
    assert.equal(count(simulateGame(makeTeam(1, 60 + (seed % 9)), makeTeam(2, 62 + ((seed * 3) % 9)), { seed, engineVersion: ENGINE_V3, experimentalV3: { pin: false } }), "PRESSURE").length, 0);
    assert.equal(count(run(seed, ENGINE_V2), "PRESSURE").length, 0);
  }
  assert.ok(pressure > 40, `a few pins a game (${pressure} in 40)`);
  assert.ok(tired > 5, `some pins leave the defence gassed (${tired})`);
});
