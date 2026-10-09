import test from "node:test";
import assert from "node:assert/strict";
import { simulateGame } from "../lib/sim/engine";
import { encodeSim, decodeSim } from "../lib/sim/serialize";
import type { LivePersistence } from "../lib/sim/live-round";
import type { ReplayCommand } from "../lib/sim/live";
import { activeLiveRound, liveGameOf, liveGameView, liveRunner, liveScoreboard, queueLiveChange, _resetLiveRound } from "../lib/sim/live-round";
import type { GameJob } from "../lib/sim/season";
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


const AGGRESSIVE: TeamTactics = { tempo: "fast", forecheck: "aggressive", puckStyle: "shotVolume", dZone: "aggressive", ppStyle: "balanced", pkStyle: "aggressive" };
const job = (gameId: number, h: number, a: number, seed: number): GameJob => ({
  gameId, round: 1, league: "NHL", home: makeTeam(h, 62), away: makeTeam(a, 66),
  sim: { seed, engineVersion: ENGINE_V3 }, homeLines: {} as never, awayLines: {} as never,
});
const FAST = { regulationMin: 0.1, intermissionSec: 0, lobbySec: 0, maxWallMin: 1 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("a live round plays every game on one clock and hands back exactly the instant-sim results", async () => {
  _resetLiveRound();
  const jobs = [job(1, 1, 2, 101), job(2, 3, 4, 102), job(3, 5, 6, 103)];
  const expected = jobs.map((j) => JSON.stringify(simulateGame(makeTeam(j.home.id, 62), makeTeam(j.away.id, 66), j.sim)));
  const done = liveRunner({ season: "2026-27", round: 1 }, FAST)(jobs);

  assert.ok(activeLiveRound(), "the round registers itself immediately");
  assert.equal(liveGameOf(1), 1);
  assert.equal(liveGameOf(99), null);
  // mid-round the scoreboard covers all games and never goes backwards
  let prevGoals = 0; let sawLive = false;
  const timer = setInterval(() => {
    const sb = liveScoreboard()!;
    assert.equal(sb.games.length, 3);
    const goals = sb.games.reduce((t, x) => t + x.score.home + x.score.away, 0);
    assert.ok(goals >= prevGoals); prevGoals = goals;
    if (sb.games.some((x) => x.status === "live")) sawLive = true;
  }, 100);
  const results = await done;
  clearInterval(timer);
  assert.ok(sawLive, "games were observed in progress");
  assert.equal(results.size, 3);
  jobs.forEach((j, i) => assert.ok(JSON.stringify(results.get(j.gameId)) === expected[i], `game ${j.gameId} differs from the instant sim`));
  assert.equal(activeLiveRound()!.status, "finished");
  _resetLiveRound();
});

test("a coaching change during a live round is applied, logged, and rate-limited", async () => {
  _resetLiveRound();
  const j = job(7, 1, 2, 207);
  const done = liveRunner({ season: "2026-27", round: 1 }, FAST)([j]);
  await sleep(1500); // ~ a quarter of the game in
  const first = queueLiveChange(7, { teamId: 1, team: makeTeam(1, 62, AGGRESSIVE), by: "home GM", summary: "attack" });
  assert.ok(first.ok, first.error);
  const second = queueLiveChange(7, { teamId: 1, team: makeTeam(1, 62, AGGRESSIVE) });
  assert.equal(second.ok, false);
  assert.match(second.error ?? "", /Wait/);
  assert.equal(queueLiveChange(7, { teamId: 42, team: makeTeam(42, 60) }).ok, false);
  assert.equal(queueLiveChange(999, { teamId: 1, team: makeTeam(1, 62) }).ok, false);
  const results = await done;
  assert.equal(results.get(7)!.homeSystem?.tempo, "fast");
  const view = liveGameView(7, -1)!;
  assert.equal(view.status, "final");
  assert.equal(view.score.home, results.get(7)!.home.goals);
  _resetLiveRound();
});

test("an empty day resolves immediately", async () => {
  _resetLiveRound();
  const r = await liveRunner({ season: "2026-27", round: 1 }, FAST)([]);
  assert.equal(r.size, 0);
  _resetLiveRound();
});

test("serialized teams play exactly the same game as the originals", () => {
  const sim = { seed: 55, engineVersion: ENGINE_V3 };
  const a = simulateGame(makeTeam(1, 62), makeTeam(2, 66), sim);
  const home = decodeSim<ReturnType<typeof makeTeam>>(encodeSim(makeTeam(1, 62)));
  const away = decodeSim<ReturnType<typeof makeTeam>>(encodeSim(makeTeam(2, 66)));
  assert.ok(home.ppUnitStyleByPlayer instanceof Map);
  assert.ok(JSON.stringify(simulateGame(home, away, sim)) === JSON.stringify(a), "a decoded team plays a different game");
});

test("a round survives a restart: snapshot + change log rebuild the very same games", async () => {
  _resetLiveRound();
  const jobs = [job(21, 1, 2, 301), job(22, 3, 4, 302)];
  // what the DB would hold
  let snapshot = ""; const commands: string[] = [];
  const persist: LivePersistence = {
    start: (r) => { snapshot = encodeSim({ id: r.id, clock: r.clock, jobs: r.jobs }); },
    command: (c) => { commands.push(encodeSim(c)); },
    finish: () => {},
  };
  const done = liveRunner({ season: "2026-27", round: 1 }, FAST, { persist })(jobs);
  await sleep(1500);
  assert.ok(queueLiveChange(21, { teamId: 1, team: makeTeam(1, 62, AGGRESSIVE), by: "GM" }).ok);
  const reference = await done;
  assert.ok(commands.length >= 1, "the applied change was persisted");
  _resetLiveRound(); // "the server restarted": memory is gone

  const snap = decodeSim<{ id: string; clock: ReturnType<typeof import("../lib/sim/live").makeClock>; jobs: GameJob[] }>(snapshot);
  const replay = new Map<number, ReplayCommand[]>();
  for (const raw of commands) {
    const c = decodeSim<ReplayCommand & { gameId: number }>(raw);
    replay.set(c.gameId, [...(replay.get(c.gameId) ?? []), c]);
  }
  const resumed = await liveRunner({ season: "2026-27", round: 1 }, FAST, { resume: { id: snap.id, clock: snap.clock, replay } })(snap.jobs);
  for (const j of jobs) assert.ok(JSON.stringify(resumed.get(j.gameId)) === JSON.stringify(reference.get(j.gameId)), `game ${j.gameId} differs after recovery`);
  assert.equal(resumed.get(21)!.homeSystem?.tempo, "fast", "the pre-restart change was replayed");
  _resetLiveRound();
});

test("resuming mid-game fast-forwards to where the clock is and finishes the same game", async () => {
  _resetLiveRound();
  const jobs = [job(31, 1, 2, 401)];
  let snapshot = ""; const commands: string[] = [];
  const done = liveRunner({ season: "2026-27", round: 1 }, FAST, { persist: { start: (r) => { snapshot = encodeSim({ id: r.id, clock: r.clock, jobs: r.jobs }); }, command: (c) => { commands.push(encodeSim(c)); }, finish: () => {} } })(jobs);
  await sleep(1200);
  queueLiveChange(31, { teamId: 2, team: makeTeam(2, 66, AGGRESSIVE) });
  const reference = await done;
  _resetLiveRound();
  const snap = decodeSim<{ id: string; clock: { startMs: number }; jobs: GameJob[] }>(snapshot);
  // pretend the restart happened ~2s into the game: the clock starts 2s before "now"
  const clock = { ...snap.clock, startMs: Date.now() - 2000 } as never;
  const replay = new Map<number, ReplayCommand[]>();
  for (const raw of commands) { const c = decodeSim<ReplayCommand & { gameId: number }>(raw); replay.set(c.gameId, [...(replay.get(c.gameId) ?? []), c]); }
  const resumed = await liveRunner({ season: "2026-27", round: 1 }, FAST, { resume: { id: snap.id, clock, replay } })(snap.jobs);
  assert.ok(JSON.stringify(resumed.get(31)) === JSON.stringify(reference.get(31)), "mid-game recovery diverged");
  _resetLiveRound();
});

test("a timeout needs no lineup, shows as used, and is replayed after a restart", async () => {
  _resetLiveRound();
  const jobs = [job(41, 1, 2, 501)];
  let snapshot = ""; const commands: string[] = [];
  const persist: LivePersistence = { start: (r) => { snapshot = encodeSim({ id: r.id, clock: r.clock, jobs: r.jobs }); }, command: (c) => { commands.push(encodeSim(c)); }, finish: () => {} };
  const done = liveRunner({ season: "2026-27", round: 1 }, FAST, { persist })(jobs);
  await sleep(1200);
  assert.ok(queueLiveChange(41, { teamId: 1, timeout: true, by: "GM" }).ok);
  assert.ok(queueLiveChange(41, { teamId: 1, timeout: true, by: "GM" }).ok, "timeouts aren't rate-limited like lineup changes");
  await sleep(1500);
  assert.ok(liveGameView(41, -1)!.timeoutUsed.includes(1), "the view reports the timeout as spent");
  const reference = await done;
  assert.equal(reference.get(41)!.home.timeouts, 1);
  _resetLiveRound();
  const snap = decodeSim<{ id: string; clock: ReturnType<typeof import("../lib/sim/live").makeClock>; jobs: GameJob[] }>(snapshot);
  const replay = new Map<number, ReplayCommand[]>();
  for (const raw of commands) { const c = decodeSim<ReplayCommand & { gameId: number }>(raw); replay.set(c.gameId, [...(replay.get(c.gameId) ?? []), c]); }
  assert.ok([...replay.values()].flat().some((c) => c.timeout && !c.team), "the timeout was persisted without a team");
  const resumed = await liveRunner({ season: "2026-27", round: 1 }, FAST, { resume: { id: snap.id, clock: snap.clock, replay } })(snap.jobs);
  assert.ok(JSON.stringify(resumed.get(41)) === JSON.stringify(reference.get(41)), "timeout replay diverged");
  _resetLiveRound();
});
