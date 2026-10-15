import test from "node:test";
import assert from "node:assert/strict";
import { simulateGame } from "../lib/sim/engine";
import { autoLines } from "../lib/sim/lines-core";
import { buildTeam } from "../lib/sim/ratings";
import { ENGINE_V2, ENGINE_V3 } from "../lib/sim/version";
import { describeLiveEvent } from "../lib/sim/live-text";
import { puckRaceText } from "../lib/sim/rush-text";
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
  assert.ok(tired >= 1, `some pins leave the defence gassed (${tired})`);
});

test("V3 dump-ins are a race for the puck: both sides win some, the goalie plays some, V2 and dump:false have none", () => {
  const raceLine = (t: string) => /wins the race to the dumped-in puck|play the dump-in|gets to the dump-in/.test(t);
  let dumps = 0, won = 0, goalie = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = run(seed, ENGINE_V3);
    const lines = r.playByPlay.filter((l) => raceLine(l.text));
    const entries = (r.events ?? []).filter((e) => e.type === "ZONE_ENTRY" && (e.meta as { entryType?: string } | undefined)?.entryType === "dump");
    assert.equal(lines.length, entries.length, "every dump-in is followed by a race result in the play-by-play");
    for (const l of lines.filter((x) => /wins the race/.test(x.text))) { const m = l.text.match(/^(.+) wins the race/); assert.ok(!r.playByPlay.some((x) => x.time === l.time && x.text.startsWith(`${m![1]} dumps the puck`)), "the chaser is not the dumper: " + l.text); }
    won += lines.filter((l) => /wins the race/.test(l.text)).length;
    goalie += lines.filter((l) => /play the dump-in/.test(l.text)).length;
    dumps += entries.length;
    const off = simulateGame(makeTeam(1, 60 + (seed % 9)), makeTeam(2, 62 + ((seed * 3) % 9)), { seed, engineVersion: ENGINE_V3, experimentalV3: { dump: false } });
    assert.equal(off.playByPlay.filter((l) => raceLine(l.text)).length, 0);
    assert.equal(run(seed, ENGINE_V2).playByPlay.filter((l) => raceLine(l.text)).length, 0);
  }
  assert.ok(dumps / 80 > 12 && dumps / 80 < 40, `dump-ins per team-game ${dumps / 80}`);
  assert.ok(won / dumps > 0.25 && won / dumps < 0.6, `attackers win ${(won / dumps).toFixed(2)} of the races`);
  assert.ok(goalie >= 20, `the goalie plays the puck now and then (${goalie})`);
  // the live feed and the play-by-play share one wording
  assert.equal(puckRaceText({ won: "def", goalie: true, next: "B" }, "G", "A"), "G comes out to play the dump-in behind the net and hands it to B.");
});

test("V3 fights after a hard hit are an answer for it, same wording live and in the play-by-play", () => {
  let revenge = 0, bouts = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const r = simulateGame(makeTeam(1, 64), makeTeam(2, 66), { seed, engineVersion: ENGINE_V3, rivalry: true });
    for (const f of count(r, "FIGHT")) {
      bouts++;
      const m = f.meta as { revenge?: { forName: string; retaliatorId: number } };
      if (!m.revenge) continue;
      revenge++;
      assert.ok(m.revenge.retaliatorId === f.playerId || m.revenge.retaliatorId === f.targetId, "the retaliator is one of the two fighters");
      const t = describeLiveEvent(f)!.text;
      assert.ok(/answers for the hit on|wants a word after that hit/.test(t), t);
      assert.ok(r.playByPlay.some((l) => l.text === t));
    }
  }
  assert.ok(revenge >= 4 && revenge < bouts, `some, not all, fights are answers to a hit (${revenge}/${bouts})`);
});

test("V3 goals and saves say how the shot was taken and how it was stopped; V2 keeps its plain wording", () => {
  let goalsHow = 0, goals = 0, saves = 0, savesHow = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const r = run(seed, ENGINE_V3);
    for (const l of r.playByPlay.filter((x) => x.kind === "goal" && /^GOAL/.test(x.text) && !/\(EN\)/.test(x.text))) { goals++; if (/scored by .+ with a (slap shot|wrist shot|snap shot|backhand|tip-in|one-timer)/.test(l.text)) goalsHow++; }
    for (const l of r.playByPlay.filter((x) => x.kind === "save")) { saves++; if (/^Stopped by .+ with the (glove|blocker|pad|skate|stick|chest|shoulder)/.test(l.text)) savesHow++; }
    const live = (r.events ?? []).filter((e) => e.type === "GOAL" && !(e.meta as { so?: boolean } | undefined)?.so && !(e.meta as { emptyNet?: boolean } | undefined)?.emptyNet);
    for (const g of live) assert.match(describeLiveEvent(g)!.text, / — .+ with a .+/);
    const v2 = run(seed, ENGINE_V2);
    for (const l of v2.playByPlay.filter((x) => x.kind === "goal" || x.kind === "save")) assert.ok(!/ with a (slap|wrist|snap|backhand|tip|one-timer)|with the (glove|blocker|pad)/.test(l.text), `V2 text changed: ${l.text}`);
  }
  assert.ok(goals > 20 && goalsHow === goals, `every goal says how (${goalsHow}/${goals})`);
  assert.ok(saves > 200 && savesHow === saves, `every save says how (${savesHow}/${saves})`);
});

test("V3 period ends carry a recap (score, shots this period, hits) in the play-by-play and the live feed; V2 keeps the plain line", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const r = run(seed, ENGINE_V3);
    const ends = (r.events ?? []).filter((e) => e.type === "PERIOD_END");
    assert.equal(ends.length, 3, "one recap per regulation period");
    let shotsSum = 0;
    for (const e of ends) {
      const m = e.meta as { score: { home: number; away: number }; shots: { home: number; away: number }; hits: { home: number; away: number } };
      shotsSum += m.shots.home + m.shots.away;
      const t = describeLiveEvent(e)!.text;
      assert.match(t, /^End of the \d(st|nd|rd) period — /);
      assert.ok(r.playByPlay.some((l) => l.kind === "period" && /^End of the \d(st|nd|rd) period — /.test(l.text) && l.period === e.period), "the play-by-play has the same recap");
    }
    const last = ends[2].meta as { score: { home: number; away: number } };
    assert.ok(last.score.home <= r.home.goals && last.score.away <= r.away.goals, "the recap score never runs ahead of the final");
    assert.ok(shotsSum > 30 && shotsSum < 120, `shots over three periods look sane (${shotsSum})`);
    for (const l of run(seed, ENGINE_V2).playByPlay.filter((x) => x.kind === "period" && /^End of the/.test(x.text))) assert.ok(!l.text.includes(" — "), l.text);
  }
});

test("V3 an injury or knock from a hit comes with a real hit on him in the same second", () => {
  let hitInj = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = run(seed, ENGINE_V3);
    for (const e of (r.events ?? []).filter((x) => (x.type === "INJURY" || x.type === "KNOCK") && ["Hit", "Collision"].includes((x.meta as { mechanism?: string } | undefined)?.mechanism ?? ""))) {
      if ((e.meta as { mechanism?: string }).mechanism !== "Hit") continue;
      hitInj++;
      const hit = (r.events ?? []).find((h) => h.type === "HIT" && h.period === e.period && h.seconds === e.seconds && h.targetId === e.playerId);
      assert.ok(hit, `no hit on ${e.playerName} at ${e.period}:${e.seconds}`);
      if (e.type === "INJURY") assert.equal(e.targetId, hit!.playerId, "the injury names the player who hit him");
    }
  }
  assert.ok(hitInj >= 10, `enough hit injuries to say something (${hitInj})`);
});

test("V3 fouls are called ON an opposing player, in the play-by-play and the live feed; V2 keeps its plain line", () => {
  const FOUL = ["Tripping", "Hooking", "Slashing", "Holding", "Interference", "Cross-checking", "Roughing", "High-sticking", "Boarding", "Elbowing"];
  let named = 0, fouls = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const r = run(seed, ENGINE_V3);
    for (const e of (r.events ?? []).filter((x) => x.type === "PENALTY" && FOUL.includes((x.meta as { penalty?: string } | undefined)?.penalty ?? "") && !(x.meta as { washedOut?: boolean } | undefined)?.washedOut)) {
      fouls++;
      const on = (e.meta as { on?: string }).on;
      if (!on) continue;
      named++;
      assert.notEqual(on.split(" ")[0], e.playerName!.split(" ")[0], `${e.playerName} fouled ${on} — must be the other team`);
      const t = describeLiveEvent(e)!.text;
      assert.ok(t.includes(` on ${on} (`), t);
      assert.ok(r.playByPlay.some((l) => l.kind === "penalty" && l.text.includes(` on ${on} (`)), "same victim in the play-by-play");
    }
    for (const l of run(seed, ENGINE_V2).playByPlay.filter((x) => x.kind === "penalty")) assert.ok(!/ penalty for \w[\w-]* on /.test(l.text), l.text);
  }
  assert.ok(fouls > 40 && named / fouls > 0.9, `almost every foul names its victim (${named}/${fouls})`);
});

test("V3 power plays end with a recap (length, shots, goals); V2 keeps the plain line", () => {
  let ends = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const r = run(seed, ENGINE_V3);
    for (const e of (r.events ?? []).filter((x) => x.type === "PP_END")) {
      const m = e.meta as { seconds: number; shots: number; goals: number } | undefined;
      if (!m) continue; // a power play that began in the previous period's final seconds still gets one; skip only the odd carry-over
      ends++;
      assert.ok(m.seconds >= 0 && m.seconds <= 720 && m.shots >= 0 && m.goals >= 0 && m.goals <= m.shots, JSON.stringify(m));
      const t = describeLiveEvent(e)!.text;
      assert.match(t, /power play is over — \d+:\d\d, \d+ shots?, (no goal|\d+ goals?)\.$/);
      assert.ok(r.playByPlay.some((l) => l.text === t), "same wording in the play-by-play");
    }
    for (const l of run(seed, ENGINE_V2).playByPlay.filter((x) => /power play is over/.test(x.text))) assert.ok(!l.text.includes(" — "), l.text);
  }
  assert.ok(ends > 30, `enough power plays to check (${ends})`);
});
