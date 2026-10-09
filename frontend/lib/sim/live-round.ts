// A live ROUND: every game of one league day played out together on a shared wall clock.
// Pure (no DB): `playScheduledGames({ runGames })` hands us the prepared games, we run them
// to the end and give back the results; the caller then persists them exactly as for an
// instant sim. Until then nothing about these games is visible anywhere else on the site —
// the results only appear once the last game has been watched to the final horn.

import { simulateGame } from "./engine";
import { LiveGame, makeClock, type LiveClock, type LiveSnapshot, type ReplayCommand } from "./live";
import type { GameJob } from "./season";
import type { GameResult } from "./types";

export type LiveRoundConfig = {
  regulationMin: number;    // wall minutes a 60-minute game takes, intermissions included
  intermissionSec: number;
  lobbySec: number;         // countdown before the first puck drops
  maxWallMin: number;       // safety: after this long, everything left is fast-forwarded
};
export const DEFAULT_LIVE_CONFIG: LiveRoundConfig = { regulationMin: 16, intermissionSec: 30, lobbySec: 15, maxWallMin: 45 };

/** Where a running round is saved so a restarted server can pick it up (implemented against the DB in lib/live-server.ts). */
export type LivePersistence = {
  start(round: { id: string; season: string; round: number; clock: LiveClock; jobs: GameJob[] }): void;
  command(c: ReplayCommand & { gameId: number; absSeconds: number }): void;
  finish(id: string): void;
};
/** A round to pick back up: the original clock plus every change that had landed before the restart. */
export type LiveResume = { id: string; clock: LiveClock; replay: Map<number, ReplayCommand[]> };

type Entry = {
  game: LiveGame;
  job: GameJob;
  pristine: { home: GameJob["home"]; away: GameJob["away"] }; // untouched copies, for the batch fallback
  fellBack: boolean;
  lastChangeAt: Map<number, number>;
  lines: Map<number, unknown>; // the lines each club is icing right now (starts as the deployed lines, follows accepted changes)
};

export type LiveRound = {
  id: string;
  season: string;
  round: number;
  clock: LiveClock;
  startedAt: number;
  status: "running" | "finished";
  finishedAt?: number;
  entries: Map<number, Entry>;
  /** minimum wall seconds between two changes from the same club */
  changeCooldownSec: number;
};


type Registry = { current: LiveRound | null };
const g = globalThis as unknown as { __liveRound?: Registry };
const registry: Registry = (g.__liveRound ??= { current: null });

/** Playoff rounds are stored as 1000 + series round, so a playoff day never collides with a regular-season day index. */
export const PLAYOFF_ROUND_BASE = 1000;
const PLAYOFF_NAMES: Record<number, string> = { 1: "First Round", 2: "Second Round", 3: "Conference Finals", 4: "Stanley Cup Final" };
/** What the scoreboard calls a stored round number. */
export const roundTitle = (round: number) => (round >= PLAYOFF_ROUND_BASE ? `Playoffs · ${PLAYOFF_NAMES[round - PLAYOFF_ROUND_BASE] ?? `Round ${round - PLAYOFF_ROUND_BASE}`}` : `Regular season · day ${round}`);

export const activeLiveRound = (): LiveRound | null => registry.current;

/** Find the live game a club is in right now (for the "Watch live" link on a GM's page). */
export function liveGameOf(teamId: number): number | null {
  const r = registry.current;
  if (!r || r.status !== "running") return null;
  for (const [id, e] of r.entries) if (e.job.home.id === teamId || e.job.away.id === teamId) return id;
  return null;
}

const clampNum = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

/**
 * Build the `runGames` hook for playScheduledGames. Resolves once EVERY game has been watched
 * to the end (viewer time), then clears itself from the registry after a grace period.
 */
export function liveRunner(meta: { season: string; round: number }, cfg: Partial<LiveRoundConfig> = {}, extra: { persist?: LivePersistence; resume?: LiveResume } = {}) {
  const c = { ...DEFAULT_LIVE_CONFIG, ...cfg };
  return (jobs: GameJob[]): Promise<Map<number, GameResult>> => new Promise((resolve) => {
    const clock = extra.resume?.clock ?? makeClock(Date.now() + clampNum(c.lobbySec, 0, 300) * 1000, clampNum(c.regulationMin, 0.02, 40) * 60, clampNum(c.intermissionSec, 0, 120));
    const startMs = clock.startMs;
    const roundId = extra.resume?.id ?? `${meta.season}:${meta.round}:${startMs}`;
    const entries = new Map<number, Entry>();
    for (const job of jobs) {
      const pristine = { home: structuredClone(job.home), away: structuredClone(job.away) };
      const game = new LiveGame({
        gameId: job.gameId, home: job.home, away: job.away, clock, sim: job.sim,
        replay: extra.resume?.replay.get(job.gameId),
        onApplied: (cmd) => extra.persist?.command({ ...cmd, gameId: job.gameId }),
      });
      entries.set(job.gameId, { game, job, pristine, fellBack: false, lastChangeAt: new Map(), lines: new Map<number, unknown>([[job.home.id, job.homeLines], [job.away.id, job.awayLines]]) });
    }
    const round: LiveRound = { id: roundId, season: meta.season, round: meta.round, clock, startedAt: startMs, status: "running", entries, changeCooldownSec: 10 };
    registry.current = round;
    if (!extra.resume) extra.persist?.start({ id: roundId, season: meta.season, round: meta.round, clock, jobs });

    const results = new Map<number, GameResult>();
    // a game that blows up mid-way is replayed in one go from its pristine teams and seed — never lost
    const fallBack = (e: Entry, err: unknown) => {
      console.error(`[live] game ${e.job.gameId} failed, falling back to an instant sim:`, err);
      e.fellBack = true;
      results.set(e.job.gameId, simulateGame(e.pristine.home, e.pristine.away, e.job.sim));
    };
    const step = (now: number) => {
      for (const e of entries.values()) {
        if (e.fellBack) continue;
        try { e.game.tick(now); } catch (err) { fallBack(e, err); }
      }
    };
    const allWatched = (now: number) => [...entries.values()].every((e) => e.fellBack || e.game.finished(now));
    const finish = () => {
      clearInterval(timer);
      for (const e of entries.values()) if (!e.fellBack && e.game.result) results.set(e.job.gameId, e.game.result);
      round.status = "finished"; round.finishedAt = Date.now();
      extra.persist?.finish(roundId);
      setTimeout(() => { if (registry.current === round) registry.current = null; }, 10 * 60_000).unref?.();
      resolve(results);
    };
    const timer = setInterval(() => {
      const now = Date.now();
      step(now);
      if (allWatched(now)) finish();
      else if (now - startMs > clampNum(c.maxWallMin, 0.1, 90) * 60_000) { step(Number.MAX_SAFE_INTEGER); finish(); } // runaway guard
    }, 500);
    if (extra.resume) step(Date.now()); // catch up on everything that already happened while the server was down
    if (!jobs.length || (extra.resume && allWatched(Date.now()))) finish();
  });
}

// ---- views ------------------------------------------------------------------

export type ScoreboardRow = {
  gameId: number; league: string | null;
  home: { id: number; code: string | null; name: string };
  away: { id: number; code: string | null; name: string };
  status: LiveSnapshot["status"]; period: number; clock: number;
  score: { home: number; away: number }; shots: { home: number; away: number };
  endedIn?: string;
  shootout: { home: number; away: number } | null;
};

export function liveScoreboard(nowMs = Date.now()): { round: number; title: string; playoff: boolean; season: string; startsAt: number; status: LiveRound["status"]; games: ScoreboardRow[] } | null {
  const r = registry.current;
  if (!r) return null;
  const games = [...r.entries.values()].map((e): ScoreboardRow => {
    const s = e.game.snapshot(nowMs, Number.MAX_SAFE_INTEGER); // a cursor past everything → no events, scoreboard only
    return {
      gameId: e.job.gameId, league: e.job.league,
      home: { id: e.job.home.id, code: e.job.home.code, name: e.job.home.name },
      away: { id: e.job.away.id, code: e.job.away.code, name: e.job.away.name },
      status: s.status, period: s.period, clock: s.clock, score: s.score, shots: s.shots, endedIn: s.endedIn, shootout: s.shootout,
    };
  });
  return { round: r.round, title: roundTitle(r.round), playoff: r.round >= PLAYOFF_ROUND_BASE, season: r.season, startsAt: r.startedAt, status: r.status, games };
}

export function liveGameView(gameId: number, since: number, nowMs = Date.now()) {
  const r = registry.current;
  const e = r?.entries.get(gameId);
  if (!r || !e) return null;
  return {
    round: r.round, startsAt: r.startedAt, now: nowMs,
    home: { id: e.job.home.id, code: e.job.home.code, name: e.job.home.name },
    away: { id: e.job.away.id, code: e.job.away.code, name: e.job.away.name },
    ...e.game.snapshot(nowMs, since),
    pausedWhy: e.game.pausedWhy,
  };
}

/** Queue a ready-built team change for a club in a live game (cooldown + game checks). */
export function queueLiveChange(gameId: number, change: { teamId: number; team?: GameJob["home"]; timeout?: boolean; by?: string; summary?: string; lines?: unknown }, nowMs = Date.now()): { ok: boolean; error?: string } {
  const r = registry.current;
  const e = r?.entries.get(gameId);
  if (!r || !e || r.status !== "running") return { ok: false, error: "That game is not live." };
  if (nowMs < r.startedAt - 10_000) return { ok: false, error: "The game hasn't started yet." };
  // the cooldown guards lineup changes; a timeout is its own once-per-game action
  const last = change.team ? (e.lastChangeAt.get(change.teamId) ?? 0) : 0;
  if (nowMs - last < r.changeCooldownSec * 1000) return { ok: false, error: `Wait ${Math.ceil((r.changeCooldownSec * 1000 - (nowMs - last)) / 1000)}s between changes.` };
  const res = e.game.submit(change);
  if (res.ok && change.team) { e.lastChangeAt.set(change.teamId, nowMs); if (change.lines) e.lines.set(change.teamId, change.lines); }
  return res;
}

/** The lines a club is icing in a live game, plus how many of its changes have taken effect so far. */
export function liveLinesOf(gameId: number, teamId: number): { lines: unknown; applied: number } | null {
  const e = registry.current?.entries.get(gameId);
  if (!e || !e.lines.has(teamId)) return null;
  return { lines: e.lines.get(teamId), applied: e.game.log.filter((l) => l.teamId === teamId).length };
}

/** Test/shutdown helper. */
export function _resetLiveRound() { registry.current = null; }
