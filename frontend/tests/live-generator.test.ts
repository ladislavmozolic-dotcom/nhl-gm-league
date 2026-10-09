import test from "node:test";
import assert from "node:assert/strict";
import { simulateGame, simulateGameLive, type Stoppage, type TeamChange } from "../lib/sim/engine";
import type { TeamTactics } from "../lib/sim/tactics";
import type { GameResult } from "../lib/sim/types";
import { autoLines } from "../lib/sim/lines-core";
import { buildTeam } from "../lib/sim/ratings";
import { ENGINE_V3 } from "../lib/sim/version";
import type { SimGoalie, SimSkater } from "../lib/sim/types";

function makeTeam(id: number, strength: number, system?: TeamTactics, pullSec?: number, skip: number[] = []) {
  const attrs = { ck: strength, fg: strength, di: strength, sk: strength, st: strength, en: strength, du: strength, ph: strength, fo: strength, pa: strength, sc: strength, df: strength, ps: strength, ex: strength, ld: strength, mo: strength };
  const skaters: Array<Omit<SimSkater, "iceTime">> = Array.from({ length: 20 }, (_, i) => {
    const d = i >= 12;
    const position = d ? "D" : i % 3 === 1 ? "C" : i % 3 === 0 ? "LW" : "RW";
    return { id: id * 100 + i + 1, name: `T${id} P${i + 1}`, position, isDefense: d, isCenter: position === "C", overall: strength,
      attrs: { ...attrs }, offense: strength, playmaking: strength, defense: strength, faceoff: strength, discipline: 60 + (i % 20), hitting: strength, blocking: strength,
      con: 100, chem: 100, roleFit: 1, morale: 70, weight: 90, shoots: i % 2 ? "R" : "L", offSide: false, posPenalty: 1 };
  });
  const dressed = skaters.filter((_, i) => !skip.includes(i)); // a healthy scratch simply isn't in the team the game starts with
  const goalies: SimGoalie[] = [0, 1].map((i) => ({ id: id * 100 + 50 + i, name: `T${id} G${i + 1}`, overall: strength,
    attrs: { sk: strength, du: strength, en: strength, sz: strength, ag: strength, rb: strength, sc: strength, hs: strength, rt: strength, ph: strength, ps: strength, ex: strength, ld: strength, mo: strength },
    quality: strength, con: 100, du: strength, fatigued: false, morale: 70 }));
  const lines = autoLines(dressed.map((s) => ({ id: s.id, position: s.position, overall: s.overall, shoots: s.shoots, df: s.attrs.df })), goalies.map((g) => ({ id: g.id, overall: g.overall })));
  if (pullSec != null) lines.strategy = { ...lines.strategy, goaliePull: { ...lines.strategy.goaliePull, pullSec } };
  return buildTeam({ id, name: `T${id}`, code: `T${id}`, skaters: dressed as SimSkater[], goalies, lines, system });
}

function drain(g: Generator<Stoppage, GameResult, TeamChange | undefined>, onStop?: (s: Stoppage) => TeamChange | undefined) {
  const stops: Stoppage[] = [];
  let r = g.next();
  while (!r.done) { stops.push(r.value); r = g.next(onStop?.(r.value)); }
  return { result: r.value, stops };
}

test("draining the live generator reproduces the batch sim exactly", () => {
  for (const [seed, extra] of [[1, {}], [2, { noShootout: true }], [3, { rivalry: true }]] as const) {
    const opts = { seed, engineVersion: ENGINE_V3, ...extra };
    const batch = simulateGame(makeTeam(1, 62), makeTeam(2, 66), opts);
    const live = drain(simulateGameLive(makeTeam(1, 62), makeTeam(2, 66), opts)).result;
    assert.ok(JSON.stringify(live) === JSON.stringify(batch), `live != batch for seed ${seed}`);
  }
});

test("a live game pauses at real stoppages, starting with the opening draw", () => {
  const { stops } = drain(simulateGameLive(makeTeam(1, 62), makeTeam(2, 66), { seed: 7, engineVersion: ENGINE_V3 }));
  assert.ok(stops.length > 40, `expected dozens of stoppages, got ${stops.length}`);
  assert.equal(stops[0].why, "period-start");
  assert.equal(stops[0].period, 1);
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i].absSeconds >= stops[i - 1].absSeconds);
  assert.ok(stops.some((s) => s.why === "goal"));
  assert.deepEqual([...new Set(stops.map((s) => s.period))].slice(0, 3), [1, 2, 3]);
});

test("interleaved live games (NHL + AHL) don't leak settings into each other", () => {
  const nhlOpts = { seed: 11, engineVersion: ENGINE_V3 };
  const ahlOpts = { seed: 12, engineVersion: ENGINE_V3, league: "AHL" as const };
  const nhlBatch = simulateGame(makeTeam(1, 62), makeTeam(2, 66), nhlOpts);
  const ahlBatch = simulateGame(makeTeam(3, 58), makeTeam(4, 60), ahlOpts);
  const a = simulateGameLive(makeTeam(1, 62), makeTeam(2, 66), nhlOpts);
  const b = simulateGameLive(makeTeam(3, 58), makeTeam(4, 60), ahlOpts);
  let ra = a.next(), rb = b.next();
  while (!ra.done || !rb.done) {
    if (!ra.done) ra = a.next();
    if (!rb.done) rb = b.next();
  }
  assert.ok(JSON.stringify(ra.value) === JSON.stringify(nhlBatch), "NHL game changed when interleaved");
  assert.ok(JSON.stringify(rb.value) === JSON.stringify(ahlBatch), "AHL game changed when interleaved");
});

const AGGRESSIVE: TeamTactics = { tempo: "fast", forecheck: "aggressive", puckStyle: "shotVolume", dZone: "aggressive", ppStyle: "balanced", pkStyle: "aggressive" };

test("re-submitting an identical lineup at every stoppage changes nothing", () => {
  for (const seed of [21, 22, 23]) {
    const opts = { seed, engineVersion: ENGINE_V3 };
    const batch = simulateGame(makeTeam(1, 62), makeTeam(2, 66), opts);
    const swapped = drain(simulateGameLive(makeTeam(1, 62), makeTeam(2, 66), opts), () => ({ home: makeTeam(1, 62), away: makeTeam(2, 66) })).result;
    assert.ok(JSON.stringify(swapped) === JSON.stringify(batch), `no-op swap changed the game for seed ${seed}`);
  }
});

test("a real tactics change at a stoppage is adopted and the game still finishes cleanly", () => {
  let differs = 0;
  for (const seed of [31, 32, 33, 34, 35, 36]) {
    const opts = { seed, engineVersion: ENGINE_V3 };
    const batch = simulateGame(makeTeam(1, 62), makeTeam(2, 66), opts);
    let sent = false;
    const live = drain(simulateGameLive(makeTeam(1, 62), makeTeam(2, 66), opts), (s) => {
      if (sent || s.period < 2 || s.noChangeTeamIds.includes(1)) return undefined;
      sent = true;
      return { home: makeTeam(1, 62, AGGRESSIVE) };
    }).result;
    assert.ok(sent);
    assert.equal(live.home.skaters.length, batch.home.skaters.length);
    assert.equal(live.homeSystem?.tempo, "fast");     // the dials the game ended on
    assert.equal(live.awaySystem?.tempo, "balanced"); // the opponent is untouched
    if (JSON.stringify(live) !== JSON.stringify(batch)) differs++;
  }
  assert.ok(differs >= 5, `a tactics change should alter the game almost every time (${differs}/6)`);
});

test("a team with the wrong id is ignored", () => {
  const opts = { seed: 41, engineVersion: ENGINE_V3 };
  const batch = simulateGame(makeTeam(1, 62), makeTeam(2, 66), opts);
  const live = drain(simulateGameLive(makeTeam(1, 62), makeTeam(2, 66), opts), () => ({ home: makeTeam(9, 62, AGGRESSIVE) })).result;
  assert.ok(JSON.stringify(live) === JSON.stringify(batch), "a team with the wrong id must be ignored");
});

test("the team that just iced the puck cannot change for that draw", () => {
  let icingStops = 0;
  for (const seed of [51, 52, 53, 54]) {
    const opts = { seed, engineVersion: ENGINE_V3 };
    const batch = simulateGame(makeTeam(1, 62), makeTeam(2, 66), opts);
    // offer a (very different) lineup ONLY at stoppages where that team is barred from changing
    const live = drain(simulateGameLive(makeTeam(1, 62), makeTeam(2, 66), opts), (s) => {
      const barred = s.noChangeTeamIds;
      if (!barred.length) return undefined;
      icingStops++;
      return { home: barred.includes(1) ? makeTeam(1, 62, AGGRESSIVE) : undefined, away: barred.includes(2) ? makeTeam(2, 66, AGGRESSIVE) : undefined };
    }).result;
    assert.ok(JSON.stringify(live) === JSON.stringify(batch), `a barred change leaked into the game for seed ${seed}`);
  }
  assert.ok(icingStops > 0, "expected at least one icing stoppage across the seeds");
});

test("a called timeout happens once, even when the bench keeps asking, and only for that bench", () => {
  for (const seed of [61, 62, 63]) {
    const opts = { seed, engineVersion: ENGINE_V3 };
    const { result } = drain(simulateGameLive(makeTeam(1, 62), makeTeam(2, 66), opts), (s) => (s.period >= 1 ? { timeout: { home: true } } : undefined));
    assert.equal(result.home.timeouts, 1, `home should have used exactly one timeout (seed ${seed})`);
    const called = result.events!.filter((e) => e.type === "TIMEOUT" && e.teamId === 1);
    assert.equal(called.length, 1);
    assert.match(String((called[0].meta as { why?: string }).why), /breather/);
    assert.ok(result.away.timeouts <= 1);
  }
});

test("a timeout is allowed at a draw where the icing team may not change lines", () => {
  let barredAsks = 0, used = 0;
  for (const seed of [71, 72, 73, 74, 75, 76]) {
    const opts = { seed, engineVersion: ENGINE_V3 };
    let asked = false;
    const { result } = drain(simulateGameLive(makeTeam(1, 62), makeTeam(2, 66), opts), (s) => {
      if (asked || !s.noChangeTeamIds.includes(1)) return undefined;
      asked = true; barredAsks++;
      return { timeout: { home: true } };
    });
    if (asked) { used += result.home.timeouts; }
  }
  assert.ok(barredAsks > 0, "no icing stoppage found across the seeds");
  assert.equal(used, barredAsks, "every timeout asked for on an icing stoppage should have been taken");
});

test("moving the goalie-pull mark mid-game makes a trailing team pull earlier", () => {
  const earliest = (change: boolean) => {
    let early = 0;
    for (let seed = 301; seed < 361; seed++) {
      const opts = { seed, engineVersion: ENGINE_V3, liveFeed: true };
      const { result } = drain(simulateGameLive(makeTeam(1, 55), makeTeam(2, 70), opts), (s) => (change && s.period === 1 ? { home: makeTeam(1, 55, undefined, 300) } : undefined));
      // pulls inside the last 5 minutes but earlier than the 90s default mark (1110s elapsed)
      early += result.events!.filter((e) => e.type === "GOALIE_PULL" && e.teamId === 1 && (e.meta as { pulled?: boolean }).pulled && e.period === 3 && e.seconds < 1050).length;
    }
    return early;
  };
  assert.equal(earliest(false), 0, "the default mark shouldn't pull this early");
  assert.ok(earliest(true) > 0, "a 5:00 pull mark should pull before the default one");
});

test("a healthy scratch can be dressed mid-game, and the skater he replaces keeps his stat line", () => {
  // idx 12..19 are defensemen; the game starts without idx 18 & 19 (the scratches)
  const startWith = () => makeTeam(1, 62, undefined, undefined, [18, 19]);
  const after = () => makeTeam(1, 62, undefined, undefined, [17, 19]); // idx 18 dresses, idx 17 sits
  const scratchId = 1 * 100 + 18 + 1, sitterId = 1 * 100 + 17 + 1;
  let swapped = 0;
  for (const seed of [81, 82, 83, 84]) {
    const opts = { seed, engineVersion: ENGINE_V3 };
    let sent = false;
    const { result } = drain(simulateGameLive(startWith(), makeTeam(2, 66), opts), (st) => {
      if (sent || st.period < 2) return undefined;
      sent = true; return { home: after() };
    });
    const box = result.home.skaters;
    const scratch = box.find((p) => p.id === scratchId);
    const sitter = box.find((p) => p.id === sitterId);
    assert.ok(sitter && sitter.toi > 0, "the player who sat down played before that and keeps his line");
    if (scratch && scratch.toi > 0) swapped++;
    const ids = box.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, "no duplicate stat lines");
  }
  assert.ok(swapped >= 3, `the scratch should get ice time in most games (${swapped}/4)`);
});
