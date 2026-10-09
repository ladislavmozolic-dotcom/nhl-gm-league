// Live-game runner: drives simulateGameLive() against a wall clock so a game can be
// watched (and coached at its stoppages) in ~10 minutes instead of resolving instantly.
//
// Pure + synchronous (no DB, no timers): the owner calls `tick(now)` on an interval and
// `submit()` when a GM sends a change. Everything the engine does is a function of the
// seed, the starting teams and the command log, so a game can be replayed from those.

import { simulateGameLive, type SimOptions, type Stoppage, type StopReason, type TeamChange } from "./engine";
import type { SimEvent } from "./events";
import type { GameResult, SimTeam } from "./types";

// ---- clock ------------------------------------------------------------------

export type LiveClock = {
  startMs: number;          // wall time the puck drops
  gameSecPerSec: number;    // how fast game time runs while play is live
  intermissionSec: number;  // wall seconds the building sits between periods
  otBreakSec: number;       // shorter break before overtime
};

/** Regulation (3 × 20:00) should fit `regulationWallSec` of wall time INCLUDING both intermissions. */
export function makeClock(startMs: number, regulationWallSec = 540, intermissionSec = 30, otBreakSec = 15): LiveClock {
  const playing = Math.max(1, regulationWallSec - 2 * intermissionSec);
  return { startMs, gameSecPerSec: 3600 / playing, intermissionSec, otBreakSec };
}

const PERIOD = 1200;
const MAX_PERIODS = 40; // far beyond any playoff marathon
/** Wall seconds the building sits after period `i` (1-based): the two regulation intermissions, then the shorter break before each overtime. */
const breakAfter = (c: LiveClock, i: number) => (i <= 2 ? c.intermissionSec : c.otBreakSec);

/** Wall-clock ms at which the viewer's game clock reaches `absSeconds`. */
export function wallMsOf(c: LiveClock, absSeconds: number): number {
  let wall = absSeconds / c.gameSecPerSec;
  for (let i = 1; i <= MAX_PERIODS && absSeconds > i * PERIOD; i++) wall += breakAfter(c, i);
  return c.startMs + wall * 1000;
}

/** Viewer's game clock (absolute seconds) at wall time `nowMs`; holds still through intermissions (and overtime breaks). */
export function gameSecAt(c: LiveClock, nowMs: number): number {
  let wall = (nowMs - c.startMs) / 1000;
  if (wall <= 0) return 0;
  let game = 0;
  const periodWall = PERIOD / c.gameSecPerSec;
  for (let i = 1; i <= MAX_PERIODS; i++) {
    if (wall <= periodWall) return game + wall * c.gameSecPerSec;
    game += PERIOD; wall -= periodWall;
    const b = breakAfter(c, i);
    if (wall <= b) return game; // sitting in the break
    wall -= b;
  }
  return game + wall * c.gameSecPerSec;
}

/** Game seconds a `since` cursor reaches back, so an event the engine emitted late (a pre-rolled penalty) is never skipped. */
export const CURSOR_OVERLAP = 90;

/** Shootout attempts are spread along the clock right after a 5:00 overtime (3600 + 300). */
export const SO_BASE = 3900;
/** Game seconds between two shootout attempts — at the usual live pace that is a few seconds of watching each. */
export const SO_STEP = 12;

/** Absolute game seconds of an event (periods are 20:00 apart; OT continues the same axis; shootout attempts follow OT). */
export const eventAbs = (e: Pick<SimEvent, "period" | "seconds"> & { meta?: Record<string, unknown> }) =>
  e.meta?.so && e.period >= 5 ? SO_BASE + e.seconds : (e.period - 1) * PERIOD + e.seconds;

/** The shootout as live events, derived from the finished game (deterministic — nothing to persist). */
function shootoutEvents(result: GameResult, home: SimTeam, away: SimTeam, firstSeq: number): SimEvent[] {
  let h = 0, a = 0;
  const gk = (box: GameResult["home"]) => (box.backupGoalie?.decision ? box.backupGoalie.name : box.goalie.name); // a pulled starter's backup is in net
  return result.shootout.map((s, i): SimEvent => {
    const isHome = s.teamId === home.id;
    if (s.result === "goal") { if (isHome) h++; else a++; }
    const team = isHome ? home : away;
    return {
      seq: firstSeq + i, period: 5, seconds: (i + 1) * SO_STEP, type: "SHOOTOUT",
      teamId: s.teamId, teamCode: team.code ?? undefined, playerId: s.shooterId, playerName: s.shooterName,
      targetName: gk(isHome ? result.away : result.home), importance: "NOTABLE",
      meta: { so: true, round: s.round, result: s.result, homeSo: h, awaySo: a },
    };
  });
}

// ---- game -------------------------------------------------------------------

/** A GM's change, already turned into a ready-to-adopt SimTeam by the caller (which has the DB). */
export type LiveCommand = { teamId: number; team?: SimTeam; timeout?: boolean; by?: string; summary?: string; at?: number };
/** What actually happened to a command — the replay log. */
export type AppliedCommand = { stopIndex: number; absSeconds: number; teamId: number; by?: string; summary?: string };
/** A command as persisted for crash recovery: which stoppage it landed on, and the team it installed. */
export type ReplayCommand = { stopIndex: number; teamId: number; team?: SimTeam; timeout?: boolean; by?: string; summary?: string };

export type LiveSnapshot = {
  gameId: number;
  status: "pending" | "live" | "final";
  period: number; clock: number; absSeconds: number;
  score: { home: number; away: number };
  shots: { home: number; away: number };
  events: SimEvent[];        // up to the viewer's clock, oldest first; with `since`, only the recent tail
  /** pass back as `since`: the game-clock second of the newest event shown. Events overlap the cursor by a
   *  window (clients drop repeats by `seq`) because the engine rolls penalties ahead of time, so emission
   *  order is not time order. */
  cursor: number;
  /** the next stoppage the viewer hasn't reached — a change sent now lands there */
  nextChangeAt: number | null;
  /** benches that have already spent their one timeout */
  timeoutUsed: number[];
  /** shootout tally as the viewer has seen it — null until the shootout starts */
  shootout: { home: number; away: number } | null;
  endedIn?: GameResult["endedIn"];
};

export class LiveGame {
  readonly gameId: number;
  readonly home: SimTeam;
  readonly away: SimTeam;
  readonly clock: LiveClock;
  readonly log: AppliedCommand[] = [];
  result: GameResult | null = null;

  private gen: Generator<Stoppage, GameResult, TeamChange | undefined>;
  private paused: Stoppage | null = null;
  private stopIndex = 0;
  private pending: LiveCommand[] = [];
  private events: SimEvent[] = [];
  private sortedEvents: SimEvent[] | null = null; // time-ordered view of `events`, rebuilt lazily
  private timeoutUsedIds: number[] = [];
  private replay: Map<number, ReplayCommand[]>;
  private onApplied?: (cmd: ReplayCommand & { absSeconds: number }) => void;

  /**
   * `replay` re-installs persisted changes at the exact stoppages they originally landed on (crash
   * recovery: the game is deterministic from seed + teams + these). `onApplied` fires for every NEW
   * change the moment it takes effect, so the owner can persist it.
   */
  constructor(opts: { gameId: number; home: SimTeam; away: SimTeam; clock: LiveClock; sim: SimOptions; replay?: ReplayCommand[]; onApplied?: (cmd: ReplayCommand & { absSeconds: number }) => void }) {
    this.gameId = opts.gameId; this.home = opts.home; this.away = opts.away; this.clock = opts.clock;
    this.onApplied = opts.onApplied;
    this.replay = new Map();
    for (const c of opts.replay ?? []) this.replay.set(c.stopIndex, [...(this.replay.get(c.stopIndex) ?? []), c]);
    this.gen = simulateGameLive(opts.home, opts.away, { ...opts.sim, liveFeed: true });
    this.take(this.gen.next()); // the opening draw is available immediately
  }

  get done() { return this.result != null; }

  /** Queue a change; it is applied at the first stoppage the viewer hasn't reached yet. */
  submit(cmd: LiveCommand): { ok: boolean; error?: string } {
    if (this.done) return { ok: false, error: "The game is over." };
    if (cmd.teamId !== this.home.id && cmd.teamId !== this.away.id) return { ok: false, error: "That club is not in this game." };
    // newest lineup change per club wins; a pending lineup change and a timeout from the same bench both stand
    const prev = this.pending.find((p) => p.teamId === cmd.teamId);
    this.pending = this.pending.filter((p) => p.teamId !== cmd.teamId);
    this.pending.push({ ...cmd, team: cmd.team ?? prev?.team, timeout: !!(cmd.timeout || prev?.timeout), by: cmd.by ?? prev?.by, summary: cmd.summary ?? prev?.summary, at: Date.now() });
    return { ok: true };
  }

  /** Advance the engine as far as the wall clock has caught up with. Returns true if anything moved. */
  tick(nowMs: number): boolean {
    let moved = false;
    while (this.paused && wallMsOf(this.clock, this.paused.absSeconds) <= nowMs) {
      const stop = this.paused;
      const change: TeamChange = {};
      const rest: LiveCommand[] = [];
      const replayed = this.replay.get(this.stopIndex);
      if (replayed) {
        // recovering: exactly the changes that landed here before the restart, nothing else
        for (const cmd of replayed) {
          const home = cmd.teamId === this.home.id;
          if (cmd.team) { if (home) change.home = cmd.team; else change.away = cmd.team; }
          if (cmd.timeout) change.timeout = { ...change.timeout, [home ? "home" : "away"]: true };
          this.log.push({ stopIndex: this.stopIndex, absSeconds: stop.absSeconds, teamId: cmd.teamId, by: cmd.by, summary: cmd.summary });
        }
        this.replay.delete(this.stopIndex);
        rest.push(...this.pending);
      } else {
        for (const cmd of this.pending) {
          const home = cmd.teamId === this.home.id;
          // a timeout is always allowed; a lineup change from the club that just iced the puck is held for the next whistle
          const barred = stop.noChangeTeamIds.includes(cmd.teamId);
          const applyTeam = cmd.team && !barred ? cmd.team : undefined;
          if (!applyTeam && !cmd.timeout) { rest.push(cmd); continue; }
          if (cmd.team && barred) rest.push({ ...cmd, timeout: false });
          if (applyTeam) { if (home) change.home = applyTeam; else change.away = applyTeam; }
          if (cmd.timeout) change.timeout = { ...change.timeout, [home ? "home" : "away"]: true };
          this.log.push({ stopIndex: this.stopIndex, absSeconds: stop.absSeconds, teamId: cmd.teamId, by: cmd.by, summary: cmd.summary });
          this.onApplied?.({ stopIndex: this.stopIndex, absSeconds: stop.absSeconds, teamId: cmd.teamId, team: applyTeam, timeout: cmd.timeout, by: cmd.by, summary: cmd.summary });
        }
      }
      this.pending = rest;
      this.stopIndex++;
      this.take(this.gen.next(change.home || change.away || change.timeout ? change : undefined));
      moved = true;
    }
    return moved;
  }

  private take(r: IteratorResult<Stoppage, GameResult>) {
    if (r.done) {
      this.result = r.value; this.paused = null;
      if (r.value.endedIn === "SO" && r.value.shootout.length) {
        const next = this.events.length ? this.events[this.events.length - 1].seq + 1 : 0;
        this.events.push(...shootoutEvents(r.value, this.home, this.away, next)); this.sortedEvents = null;
      }
      return;
    }
    this.paused = r.value;
    this.timeoutUsedIds = r.value.timeoutUsedTeamIds;
    this.events.push(...r.value.events); this.sortedEvents = null;
  }

  /** Whether a viewer at `nowMs` has watched the whole game. */
  finished(nowMs: number): boolean {
    if (!this.result) return false;
    const evs = this.byTime();
    const last = evs.length ? eventAbs(evs[evs.length - 1]) : 0;
    return gameSecAt(this.clock, nowMs) >= last;
  }

  /** Time-ordered events (ties by emission order). */
  private byTime(): SimEvent[] {
    return (this.sortedEvents ??= [...this.events].sort((a, b) => eventAbs(a) - eventAbs(b) || a.seq - b.seq));
  }

  snapshot(nowMs: number, since = -1): LiveSnapshot {
    const g = gameSecAt(this.clock, nowMs);
    const visible = this.byTime().filter((e) => eventAbs(e) <= g);
    const over = this.finished(nowMs);
    const score = over && this.result
      ? { home: this.result.home.goals, away: this.result.away.goals }
      : { home: visible.filter((e) => e.type === "GOAL" && e.teamId === this.home.id).length, away: visible.filter((e) => e.type === "GOAL" && e.teamId === this.away.id).length };
    // shots on goal as the viewer has seen them
    const sog = (id: number) => visible.filter((e) => (e.type === "SHOT" || e.type === "GOAL") && e.teamId === id).length;
    const shots = over && this.result ? { home: this.result.home.shots, away: this.result.away.shots } : { home: sog(this.home.id), away: sog(this.away.id) };
    const soSeen = visible.filter((e) => e.type === "SHOOTOUT");
    const soTally = soSeen.length ? { home: (soSeen[soSeen.length - 1].meta as { homeSo: number }).homeSo, away: (soSeen[soSeen.length - 1].meta as { awaySo: number }).awaySo } : null;
    const period = Math.floor(g / PERIOD) + 1;
    return {
      gameId: this.gameId,
      status: nowMs < this.clock.startMs ? "pending" : over ? "final" : "live",
      period, clock: g - (period - 1) * PERIOD, absSeconds: g,
      score, shots,
      events: since < 0 ? visible : visible.filter((e) => eventAbs(e) > since - CURSOR_OVERLAP),
      cursor: visible.length ? eventAbs(visible[visible.length - 1]) : since,
      nextChangeAt: this.paused ? this.paused.absSeconds : null,
      timeoutUsed: this.timeoutUsedIds,
      shootout: soTally,
      endedIn: over ? this.result?.endedIn : undefined,
    };
  }

  /** The stoppage reason the engine is paused on (debug / UI hint). */
  get pausedWhy(): StopReason | null { return this.paused?.why ?? null; }
  get stopsSoFar() { return this.stopIndex; }
}
