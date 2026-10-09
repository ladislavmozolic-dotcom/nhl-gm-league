import test from "node:test";
import assert from "node:assert/strict";
import { simulateGame } from "../lib/sim/engine";
import { LiveGame, eventAbs, gameSecAt, makeClock, wallMsOf } from "../lib/sim/live";
import { describeLiveEvent } from "../lib/sim/live-text";
import { autoLines } from "../lib/sim/lines-core";
import { buildTeam } from "../lib/sim/ratings";
import { ENGINE_V3 } from "../lib/sim/version";
import type { TeamTactics } from "../lib/sim/tactics";
import type { SimGoalie, SimSkater } from "../lib/sim/types";

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

const T0 = 1_000_000_000_000;
const clock = makeClock(T0, 540, 30, 15);
const AGGRESSIVE: TeamTactics = { tempo: "fast", forecheck: "aggressive", puckStyle: "shotVolume", dZone: "aggressive", ppStyle: "balanced", pkStyle: "aggressive" };

/** Run a game on a fake clock, one wall-second at a time, until it is over. */
function play(g: LiveGame, onSecond?: (nowMs: number, g: LiveGame) => void) {
  let now = T0 - 1000;
  const snaps = [] as ReturnType<LiveGame["snapshot"]>[];
  for (let i = 0; i < 4000 && !g.finished(now); i++) {
    now += 1000;
    onSecond?.(now, g);
    g.tick(now);
    snaps.push(g.snapshot(now));
  }
  return { now, snaps };
}

test("the clock maps game time to wall time with intermissions and never runs backwards", () => {
  assert.equal(wallMsOf(clock, 0), T0);
  const endReg = wallMsOf(clock, 3600);
  assert.ok(Math.abs((endReg - T0) / 1000 - 540) < 0.001, "regulation fits the 9-minute budget incl. two 30s breaks");
  assert.equal(gameSecAt(clock, T0 - 5000), 0);
  // frozen through the first intermission
  const endP1 = wallMsOf(clock, 1200);
  assert.equal(gameSecAt(clock, endP1 + 10_000), 1200);
  assert.equal(gameSecAt(clock, endP1 + 29_000), 1200);
  assert.ok(gameSecAt(clock, endP1 + 31_000) > 1200);
  let prev = -1;
  for (let ms = T0; ms < T0 + 700_000; ms += 500) { const g = gameSecAt(clock, ms); assert.ok(g >= prev); prev = g; }
  // wallMsOf and gameSecAt agree
  for (const a of [10, 800, 1200, 1500, 2400, 3000, 3599]) assert.ok(Math.abs(gameSecAt(clock, wallMsOf(clock, a)) - a) < 0.01, `round trip ${a}`);
});

test("a watched game with no coaching input is the same game the batch sim produces, and fits in 10 minutes", () => {
  for (const seed of [1, 2, 3]) {
    const sim = { seed, engineVersion: ENGINE_V3 };
    const batch = simulateGame(makeTeam(1, 62), makeTeam(2, 66), sim);
    const g = new LiveGame({ gameId: 1, home: makeTeam(1, 62), away: makeTeam(2, 66), clock, sim });
    const { now, snaps } = play(g);
    assert.ok(JSON.stringify(g.result) === JSON.stringify(batch), `live != batch (seed ${seed})`);
    const last = snaps[snaps.length - 1];
    assert.equal(last.status, "final");
    assert.deepEqual(last.score, { home: batch.home.goals, away: batch.away.goals });
    assert.ok((now - T0) / 1000 <= 600 || batch.endedIn !== "REG", `a regulation game took ${(now - T0) / 1000}s`);
    // scoreboard is monotonic and never ahead of what has been revealed
    for (let i = 1; i < snaps.length; i++) {
      assert.ok(snaps[i].score.home >= snaps[i - 1].score.home && snaps[i].score.away >= snaps[i - 1].score.away);
      for (const e of snaps[i].events) assert.ok(eventAbs(e) <= snaps[i].absSeconds + 1e-6, "an event was shown before its time");
    }
  }
});

test("a change sent mid-game lands at the next stoppage the viewer hasn't reached, and is logged", () => {
  const sim = { seed: 7, engineVersion: ENGINE_V3 };
  const g = new LiveGame({ gameId: 1, home: makeTeam(1, 62), away: makeTeam(2, 66), clock, sim });
  const sentAt = T0 + 200_000; // ~ 24 minutes of game time in
  let sent = false;
  play(g, (now) => {
    if (!sent && now >= sentAt) { sent = true; assert.ok(g.submit({ teamId: 1, team: makeTeam(1, 62, AGGRESSIVE), by: "home GM", summary: "all-out attack" }).ok); }
  });
  assert.equal(g.log.length, 1);
  assert.equal(g.log[0].teamId, 1);
  assert.ok(g.log[0].absSeconds >= gameSecAt(clock, sentAt), "applied before the viewer got there");
  assert.ok(g.log[0].absSeconds - gameSecAt(clock, sentAt) < 240, "should land within a few minutes of game time");
  assert.equal(g.result!.homeSystem?.tempo, "fast");
  assert.equal(g.result!.awaySystem?.tempo, "balanced");
});

test("a game can be replayed exactly from its seed and command log", () => {
  const sim = { seed: 9, engineVersion: ENGINE_V3 };
  const a = new LiveGame({ gameId: 1, home: makeTeam(1, 62), away: makeTeam(2, 66), clock, sim });
  let sent = false;
  play(a, (now) => { if (!sent && now >= T0 + 150_000) { sent = true; a.submit({ teamId: 2, team: makeTeam(2, 66, AGGRESSIVE) }); } });
  // replay on a fresh game, re-submitting at the logged stoppages (before the clock reaches them)
  const b = new LiveGame({ gameId: 1, home: makeTeam(1, 62), away: makeTeam(2, 66), clock, sim });
  const queue = [...a.log];
  play(b, (now, g) => {
    while (queue.length && wallMsOf(clock, queue[0].absSeconds) - 1 <= now) { const c = queue.shift()!; g.submit({ teamId: c.teamId, team: makeTeam(2, 66, AGGRESSIVE) }); }
  });
  assert.ok(JSON.stringify(a.result) === JSON.stringify(b.result), "replay diverged");
});

test("a GM who keeps resubmitting every few seconds never breaks or stalls a game", () => {
  for (const seed of [11, 12, 13, 14, 15, 16]) {
    const g = new LiveGame({ gameId: 1, home: makeTeam(1, 62), away: makeTeam(2, 66), clock, sim: { seed, engineVersion: ENGINE_V3 } });
    play(g, (now) => { if (Math.floor((now - T0) / 1000) % 7 === 0) g.submit({ teamId: 1, team: makeTeam(1, 62, AGGRESSIVE) }); });
    assert.ok(g.done, `seed ${seed} did not finish`);
    assert.ok(g.log.length >= 1);
  }
});

test("submissions for a club that isn't in the game, or after it ended, are refused", () => {
  const g = new LiveGame({ gameId: 1, home: makeTeam(1, 62), away: makeTeam(2, 66), clock, sim: { seed: 3, engineVersion: ENGINE_V3 } });
  assert.equal(g.submit({ teamId: 99, team: makeTeam(99, 60) }).ok, false);
  play(g);
  assert.equal(g.submit({ teamId: 1, team: makeTeam(1, 62, AGGRESSIVE) }).ok, false);
});

test("a shootout is narrated attempt by attempt, in order, and the final score only lands at the end", () => {
  let seed = 0;
  for (let sd = 1; sd < 400 && !seed; sd++) if (simulateGame(makeTeam(1, 62), makeTeam(2, 62), { seed: sd, engineVersion: ENGINE_V3 }).endedIn === "SO") seed = sd;
  assert.ok(seed, "no shootout game found");
  const g = new LiveGame({ gameId: 1, home: makeTeam(1, 62), away: makeTeam(2, 62), clock, sim: { seed, engineVersion: ENGINE_V3 } });
  const { snaps } = play(g);
  const res = g.result!;
  const final = snaps[snaps.length - 1];
  const so = final.events.filter((e) => e.type === "SHOOTOUT");
  // the snapshots only hand out NEW events each call? no — each call here asks from the start, so the last holds everything
  assert.equal(so.length, res.shootout.length, "every attempt is in the feed");
  so.forEach((e, i) => { assert.equal(e.playerId, res.shootout[i].shooterId); assert.equal((e.meta as { result: string }).result, res.shootout[i].result); });
  for (let i = 1; i < final.events.length; i++) assert.ok(eventAbs(final.events[i]) >= eventAbs(final.events[i - 1]), "events out of order");
  // the tally the viewer sees only ever grows, appears only after overtime, and the score stays tied until the end
  let prev = -1, seenSo = false;
  for (const sn of snaps) {
    if (sn.shootout) { seenSo = true; assert.ok(sn.absSeconds >= 3900); const t = sn.shootout.home + sn.shootout.away; assert.ok(t >= prev); prev = t; if (sn.status === "live") assert.equal(sn.score.home, sn.score.away, "score must stay tied during the shootout"); }
  }
  assert.ok(seenSo, "the shootout was never visible live");
  assert.equal(final.status, "final");
  assert.deepEqual(final.score, { home: res.home.goals, away: res.away.goals });
  assert.notEqual(final.score.home, final.score.away);
  assert.match(describeLiveEvent(so[0])!.text, /^Shootout, round 1/);
});

test("a polling client with a cursor never misses an event, even though the engine rolls penalties ahead of time", () => {
  let oldDesignLost = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = new LiveGame({ gameId: 1, home: makeTeam(1, 62), away: makeTeam(2, 62), clock, sim: { seed, engineVersion: ENGINE_V3 } });
    const got = new Set<number>(), gotOld = new Set<number>();
    let since = -1, seqCursor = -1, now = T0 - 1000;
    for (let i = 0; i < 4000 && !g.finished(now); i++) {
      now += 1000; g.tick(now);
      const sn = g.snapshot(now, since);
      for (const e of sn.events) got.add(e.seq);
      if (sn.cursor > since) since = sn.cursor;
      // what the previous design did: "everything with a higher seq than the last one I saw"
      const full = g.snapshot(now).events;
      for (const e of full) if (e.seq > seqCursor) gotOld.add(e.seq);
      if (full.length) seqCursor = full[full.length - 1].seq;
    }
    const all = g.snapshot(now + 60_000).events; // the full, final history
    const missing = all.filter((e) => !got.has(e.seq));
    assert.equal(missing.length, 0, `seed ${seed}: the cursor skipped ${missing.map((e) => `${e.type}@${e.period}:${e.seconds}`).slice(0, 3).join(", ")}`);
    for (let i = 1; i < all.length; i++) assert.ok(eventAbs(all[i]) >= eventAbs(all[i - 1]), "history must be time-ordered");
    oldDesignLost += all.filter((e) => !gotOld.has(e.seq)).length;
  }
  assert.ok(oldDesignLost > 0, "sanity: the seq-based cursor really would have lost events on these games");
});

test("the clock handles playoff marathons: every overtime period adds its own break and time never runs backwards", () => {
  // 3 regulation periods + 3 full 20:00 overtimes
  for (const a of [3700, 4801, 6000, 7300, 8400]) assert.ok(Math.abs(gameSecAt(clock, wallMsOf(clock, a)) - a) < 0.01, `round trip ${a}`);
  // each extra period costs 300s of play (at 4/s…) plus its break — check the wall gap between two OT ends
  const gap = (wallMsOf(clock, 6001) - wallMsOf(clock, 4801)) / 1000;
  assert.ok(Math.abs(gap - (1200 / clock.gameSecPerSec + clock.otBreakSec)) < 0.01, `one more OT period should take its play time + one OT break, got ${gap}s`);
  let prev = -1;
  for (let ms = T0; ms < T0 + 3_000_000; ms += 700) { const g = gameSecAt(clock, ms); assert.ok(g >= prev); prev = g; }
});
