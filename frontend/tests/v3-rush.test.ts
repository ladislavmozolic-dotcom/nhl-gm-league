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


const play = (seed: number, rush: boolean, extra: object = {}): GameResult =>
  simulateGame(makeTeam(1, 60 + (seed % 9)), makeTeam(2, 62 + ((seed * 3) % 9)), { seed, engineVersion: ENGINE_V3, experimentalV3: { transitionRush: rush }, ...extra });
const withRush = (r: GameResult) => (r.events ?? []).filter((e) => e.type === "RUSH");

test("rushes follow the V3 default; turning the flag off removes them, V2 never rushes", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const dflt = simulateGame(makeTeam(1, 62), makeTeam(2, 66), { seed, engineVersion: ENGINE_V3 });
    const off = simulateGame(makeTeam(1, 62), makeTeam(2, 66), { seed, engineVersion: ENGINE_V3, experimentalV3: { transitionRush: false } });
    assert.equal(withRush(off).length, 0, "the flag off must remove every rush");
    assert.ok(JSON.stringify(dflt) === JSON.stringify(simulateGame(makeTeam(1, 62), makeTeam(2, 66), { seed, engineVersion: ENGINE_V3, experimentalV3: { transitionRush: true } })), `default V3 should be rush-on (seed ${seed})`);
    const v2 = simulateGame(makeTeam(1, 62), makeTeam(2, 66), { seed, engineVersion: ENGINE_V2, experimentalV3: { transitionRush: true } });
    assert.equal(withRush(v2).length, 0, "V2 must never run the V3 rush logic");
  }
});

test("with rushes on, odd-man rushes of every kind happen, tagged on their shots and goals, with real-hockey conversion", () => {
  const kinds: Record<string, { n: number; shots: number; goals: number }> = {};
  let penaltyShots = 0, rushGames = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const r = play(seed, true);
    const ev = r.events ?? [];
    if (withRush(r).length) rushGames++;
    for (const e of ev) {
      const k = (e.meta as { kind?: string; rush?: string } | undefined);
      if (e.type === "RUSH" && k?.kind) (kinds[k.kind] ??= { n: 0, shots: 0, goals: 0 }).n++;
      else if (e.type === "SHOT" && k?.rush) (kinds[k.rush] ??= { n: 0, shots: 0, goals: 0 }).shots++;
      else if (e.type === "GOAL" && k?.rush) kinds[k.rush].goals++;
      else if (e.type === "PENALTY_SHOT") penaltyShots++;
    }
  }
  for (const k of ["BREAKAWAY", "2ON1", "3ON2"]) assert.ok(kinds[k] && kinds[k].n > 40 && kinds[k].shots > 30, `${k} should be common (${JSON.stringify(kinds[k])})`);
  const conv = (k: string) => kinds[k].goals / kinds[k].shots;
  assert.ok(conv("BREAKAWAY") > 0.15 && conv("BREAKAWAY") < 0.40, `breakaway conversion ${conv("BREAKAWAY").toFixed(3)}`);
  assert.ok(conv("BREAKAWAY") > conv("2ON1") && conv("2ON1") > 0.06 && conv("3ON2") > 0.05, "a breakaway beats a 2-on-1 beats a normal look");
  assert.ok(rushGames > 300, `most games should feature at least one rush (${rushGames}/400)`);
  assert.ok(penaltyShots > 0, "a foul on a breakaway should occasionally earn a penalty shot over 400 games");
});

test("the stat lines still add up with rushes and penalty shots in the game", () => {
  for (let seed = 1; seed <= 150; seed++) {
    const r = play(seed, true);
    const ev = r.events ?? [];
    for (const [box, other] of [[r.home, r.away], [r.away, r.home]] as const) {
      assert.equal(ev.filter((e) => e.type === "SHOT" && e.teamId === box.teamId).length, box.shots, `shots vs SHOT events (seed ${seed})`);
      const goalEvents = ev.filter((e) => e.type === "GOAL" && e.teamId === box.teamId && !(e.meta as { so?: boolean } | undefined)?.so).length;
      const regGoals = box.goals - (r.endedIn === "SO" && r.winner === box.teamId ? 1 : 0);
      assert.equal(goalEvents, regGoals, `goals vs GOAL events (seed ${seed})`);
      // every shot the other side took was faced by one of this box's goalies (empty-net shots aside)
      const faced = box.goalie.shotsAgainst + (box.backupGoalie?.shotsAgainst ?? 0);
      assert.ok(faced <= other.shots && other.shots - faced <= 12, `goalie shots faced ${faced} vs shots ${other.shots} (seed ${seed})`);
      for (const g of [box.goalie, box.backupGoalie].filter(Boolean) as typeof box.goalie[]) assert.equal(g.saves + g.goalsAgainst, g.shotsAgainst, `saves+GA=SA (seed ${seed})`);
    }
  }
});

test("rushes and penalty shots are narrated in the play-by-play and the live feed", () => {
  let rushLines = 0, psLines = 0, liveRush = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const r = play(seed, true);
    for (const l of r.playByPlay) { if (l.kind === "rush") rushLines++; if (/Penalty shot awarded/.test(l.text)) psLines++; if (/breakaway|2-on-1|three-on-two/i.test(l.text)) liveRush++; }
    for (const e of r.events ?? []) { const d = describeLiveEvent(e); if (e.type === "RUSH") assert.ok(d && d.text.length > 20, "a rush must produce a live line"); }
  }
  assert.ok(rushLines > 100 && liveRush > 100, `rush lines: ${rushLines}, breakaway/2-on-1 mentions: ${liveRush}`);
  assert.ok(psLines > 0, "penalty shots should appear in the play-by-play");
});

const both = (seed: number): GameResult => simulateGame(makeTeam(1, 60 + (seed % 9)), makeTeam(2, 62 + ((seed * 3) % 9)), { seed, engineVersion: ENGINE_V3, experimentalV3: { transitionRush: true, stoppageRealism: true } });

test("named stoppages follow the V3 default; the flag off removes them, V2 never produces them", () => {
  for (const seed of [11, 12, 13]) {
    const dflt = simulateGame(makeTeam(1, 62), makeTeam(2, 66), { seed, engineVersion: ENGINE_V3 });
    const off = simulateGame(makeTeam(1, 62), makeTeam(2, 66), { seed, engineVersion: ENGINE_V3, experimentalV3: { stoppageRealism: false } });
    assert.equal((off.events ?? []).filter((e) => e.type === "WHISTLE").length, 0, "the flag off must remove every named whistle");
    assert.ok(JSON.stringify(dflt) === JSON.stringify(simulateGame(makeTeam(1, 62), makeTeam(2, 66), { seed, engineVersion: ENGINE_V3, experimentalV3: { stoppageRealism: true } })), "default V3 should be stoppage-realism-on");
    const v2 = simulateGame(makeTeam(1, 62), makeTeam(2, 66), { seed, engineVersion: ENGINE_V2, experimentalV3: { stoppageRealism: true } });
    assert.equal((v2.events ?? []).filter((e) => e.type === "WHISTLE").length, 0);
  }
});

test("with named stoppages on, every kind of whistle occurs, is narrated, and replaces the random 'Off-side.' colour", () => {
  const reasons: Record<string, number> = {};
  let colour = 0, narratedOffside = 0, games = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const r = both(seed); games++;
    for (const e of r.events ?? []) if (e.type === "WHISTLE") { const k = (e.meta as { reason: string }).reason; reasons[k] = (reasons[k] ?? 0) + 1; assert.ok(describeLiveEvent(e)!.text.length > 10); }
    for (const l of r.playByPlay) { if (l.text === "Off-side.") colour++; if (/^Offside —/.test(l.text)) narratedOffside++; }
  }
  for (const k of ["offside", "puck-out", "tie-up", "hand-pass", "high-stick"]) assert.ok((reasons[k] ?? 0) > games * 1.5, `${k} should happen a few times a game (${reasons[k]} in ${games} games)`);
  assert.equal(colour, 0, "the random off-side filler must be gone when real offsides are narrated");
  assert.ok(narratedOffside > games * 3, `offsides should read as real stoppages (${narratedOffside})`);
});

test("a delay-of-game call is a defenseman sending it over the glass (V3 only)", () => {
  let calls = 0, byForward = 0, glassLines = 0, v2Glass = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const r = both(seed);
    const pos = new Map([...r.home.skaters, ...r.away.skaters].map((p) => [p.id, p.position]));
    for (const e of r.events ?? []) if (e.type === "PENALTY" && (e.meta as { penalty?: string }).penalty === "Delay of game") { calls++; if (!/D/.test(pos.get(e.playerId!) ?? "")) byForward++; }
    glassLines += r.playByPlay.filter((l) => /over the glass/.test(l.text)).length;
    if (seed <= 150) { const v2 = simulateGame(makeTeam(1, 60 + (seed % 9)), makeTeam(2, 62 + ((seed * 3) % 9)), { seed, engineVersion: ENGINE_V2 }); v2Glass += v2.playByPlay.filter((l) => /over the glass/.test(l.text)).length; }
  }
  assert.ok(calls > 20, `expected a handful of delay-of-game calls over 500 games, got ${calls}`);
  assert.equal(byForward, 0, "only defensemen should be called for it");
  assert.ok(glassLines >= calls * 0.9, "every call is narrated as puck over the glass");
  assert.equal(v2Glass, 0, "V2 narration is untouched");
});

test("both V3 realism flags together keep every stat line consistent", () => {
  for (let seed = 200; seed < 320; seed++) {
    const r = both(seed), ev = r.events ?? [];
    for (const [box, other] of [[r.home, r.away], [r.away, r.home]] as const) {
      assert.equal(ev.filter((e) => e.type === "SHOT" && e.teamId === box.teamId).length, box.shots);
      const faced = box.goalie.shotsAgainst + (box.backupGoalie?.shotsAgainst ?? 0);
      assert.ok(faced <= other.shots && other.shots - faced <= 12);
      for (const g of [box.goalie, box.backupGoalie].filter(Boolean) as typeof box.goalie[]) assert.equal(g.saves + g.goalsAgainst, g.shotsAgainst);
    }
  }
});
