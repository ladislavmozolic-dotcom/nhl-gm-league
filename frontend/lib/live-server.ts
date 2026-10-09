import "server-only";

import { prisma } from "./prisma";
import { loadSettings, mergeSettings, type EngineSettings } from "./sim/settings";
import { activeSimEngine } from "./sim/version";
import { loadSimTeam } from "./sim";
import { syncChem } from "./sim/season";
import { validateTeamLines, type TeamLinesData } from "./sim/lines";
import { liveRunner, queueLiveChange, type LivePersistence } from "./sim/live-round";
import type { LiveClock, ReplayCommand } from "./sim/live";
import { encodeSim, toJsonValue, fromJsonValue } from "./sim/serialize";
import type { GameJob } from "./sim/season";
import type { GameResult } from "./sim/types";

/** Live rounds need the V3 engine AND the commissioner's switch. Anything else = instant sim, as before. */
export async function liveMatchesActive(): Promise<boolean> {
  const [settings, engine] = await Promise.all([loadSettings(), activeSimEngine()]);
  return settings.liveMatchesEnabled && engine === "v3";
}

/** Saves a running round to the DB so a restarted server can resume it. Fire-and-forget: a failed write is logged, never fatal. */
function dbPersistence(settings: EngineSettings, resumedId?: string): LivePersistence {
  let roundId = resumedId;
  const log = (what: string) => (e: unknown) => console.error(`[live] couldn't persist ${what}:`, e);
  return {
    start: (r) => {
      roundId = r.id;
      const games = r.jobs.map((j) => ({ ...j, sim: { ...j.sim, settings: undefined } })); // settings are stored once, below
      prisma.liveRound.create({ data: { id: r.id, season: r.season, round: r.round, clock: toJsonValue(r.clock) as object, games: toJsonValue(games) as object, settings: toJsonValue(settings) as object } })
        .catch(log("round snapshot"));
    },
    command: (c) => {
      const row = { gameId: c.gameId, stopIndex: c.stopIndex, teamId: c.teamId, team: c.team, timeout: c.timeout, by: c.by, summary: c.summary };
      // append to the jsonb array in one statement — no read-modify-write race between games
      prisma.$executeRawUnsafe(`UPDATE "LiveRound" SET commands = commands || $1::jsonb, "updatedAt" = now() WHERE id = $2`, `[${encodeSim(row)}]`, roundId ?? "")
        .catch(log("an in-game change"));
    },
    finish: (id) => { prisma.liveRound.update({ where: { id }, data: { status: "DONE" } }).catch(log("round completion")); },
  };
}

/** A persisted round still marked RUNNING for this day, if the server was restarted mid-way. */
async function resumableRound(season: string, round: number) {
  return prisma.liveRound.findFirst({ where: { season, round, status: "RUNNING" }, orderBy: { createdAt: "desc" } });
}

/**
 * The `runGames` hook for playScheduledGames. Normally starts a fresh live round (saved as it goes);
 * if this day's round was cut short by a restart it instead RESUMES it: the stored teams are
 * rebuilt, every change that had taken effect is replayed at the same stoppage, and the games are
 * fast-forwarded to where the clock is now.
 */
export async function liveRunGames(season: string, round: number): Promise<(jobs: GameJob[]) => Promise<Map<number, GameResult>>> {
  const s = await loadSettings();
  const periodSec = Math.min(600, Math.max(60, s.livePeriodSec));
  const intermissionSec = Math.min(120, Math.max(10, s.liveIntermissionSec));
  const cfg = { regulationMin: (3 * periodSec + 2 * intermissionSec) / 60, intermissionSec }; // three periods plus both intermissions

  const saved = await resumableRound(season, round);
  if (saved) {
    try {
      const settings = mergeSettings(fromJsonValue<Partial<EngineSettings>>(saved.settings));
      const games = fromJsonValue<GameJob[]>(saved.games).map((g) => ({ ...g, sim: { ...g.sim, settings } }));
      const replay = new Map<number, ReplayCommand[]>();
      for (const c of fromJsonValue<Array<ReplayCommand & { gameId: number }>>(saved.commands)) replay.set(c.gameId, [...(replay.get(c.gameId) ?? []), c]);
      const run = liveRunner({ season, round }, cfg, { persist: dbPersistence(settings, saved.id), resume: { id: saved.id, clock: fromJsonValue<LiveClock>(saved.clock), replay } });
      console.log(`[live] resuming round ${round} (${games.length} games, ${[...replay.values()].flat().length} changes replayed)`);
      return () => run(games); // the stored teams, not the freshly prepared ones — they are the games that were in progress
    } catch (e) {
      console.error("[live] couldn't resume the saved round, starting over:", e);
      await prisma.liveRound.update({ where: { id: saved.id }, data: { status: "ABORTED" } }).catch(() => {});
    }
  }
  return liveRunner({ season, round }, cfg, { persist: dbPersistence(s) });
}

/**
 * A GM's in-game change: validate the lines exactly like the Lines editor does (strict), build
 * the club into a SimTeam from them WITHOUT touching the saved lines, and queue it for the next
 * stoppage. Caller must already have checked `canManageTeam(teamId)`.
 */
export async function submitLiveChange(input: { gameId: number; teamId: number; lines?: TeamLinesData; timeout?: boolean; by: string }): Promise<{ ok: boolean; error?: string }> {
  if (!input.lines) {
    if (!input.timeout) return { ok: false, error: "Nothing to change." };
    return queueLiveChange(input.gameId, { teamId: input.teamId, timeout: true, by: input.by, summary: "timeout" });
  }
  let safe: TeamLinesData;
  try { safe = await validateTeamLines(input.teamId, input.lines, { strict: true }); }
  catch (e) { return { ok: false, error: (e as Error).message }; }
  const settings = await loadSettings();
  let team;
  try {
    team = await loadSimTeam(input.teamId, undefined, {
      chemBase: settings.chemistryBase,
      offPos: { wing: settings.offPosWingPct, center: settings.offPosCenterPct, def: settings.offPosDefPct, chemCap: settings.offPosChemCap },
      linesOverride: safe,
    });
  } catch (e) { return { ok: false, error: `Couldn't build that lineup: ${(e as Error).message}` }; }
  syncChem(team, settings.chemistryBase);
  return queueLiveChange(input.gameId, { teamId: input.teamId, team, timeout: input.timeout, by: input.by, summary: input.timeout ? "timeout + lines/tactics change" : "lines/tactics change", lines: safe });
}
