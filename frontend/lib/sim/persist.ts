// Persist a simulated GameResult into the DB: Game (with per-period linescore),
// per-player stats, goalie stats, and timestamped goal & penalty events.

import { prisma } from "../prisma";
import type { GameResult, TeamBox } from "./types";

export type GameMeta = {
  season?: string;
  league?: string;
  round?: number;
  gameDate?: Date;
  gameId?: number;   // if set, updates a pre-scheduled Game row instead of creating
  seriesId?: number; // playoff series link
  gameNum?: number;  // game number within a playoff series
};

// EDGE zone occupancy → OZ/NZ/DZ percentages (sum ~100) for one side.
function zonePct(side: "home" | "away", box: TeamBox) {
  const tot = box.ozTime + box.nzTime + box.dzTime || 1;
  return {
    [`${side}OzPct`]: (box.ozTime / tot) * 100,
    [`${side}NzPct`]: (box.nzTime / tot) * 100,
    [`${side}DzPct`]: (box.dzTime / tot) * 100,
  };
}

function skaterRows(box: TeamBox, gameId: number) {
  return box.skaters
    .filter((s) => s.goals || s.assists || s.shots || s.pim || s.plusMinus || s.hits || s.blocks || s.toi)
    .map((s) => ({
      gameId, playerId: s.id, teamId: box.teamId,
      goals: s.goals, assists: s.assists, points: s.points,
      shots: s.shots, pim: s.pim, plusMinus: s.plusMinus,
      ppGoals: s.ppGoals, shGoals: s.shGoals, gwg: s.gwg,
      hits: s.hits, blocks: s.blocks,
      faceoffWins: s.faceoffWins, faceoffLosses: s.faceoffLosses, toi: s.toi,
      conBefore: Math.round(s.conBefore), conAfter: Math.round(s.conAfter),
      xg: s.xg, hdShots: s.hdShots, topShot: s.topShotSpeed,
      shifts: s.shifts, positiveShifts: s.positiveShifts,
      shotZones: s.shotZones ?? [],
    }));
}

function goalieRows(box: TeamBox, gameId: number) {
  const lines = [box.goalie, ...(box.backupGoalie ? [box.backupGoalie] : [])];
  return lines.map((g) => ({
    gameId, playerId: g.id, teamId: box.teamId, started: g.started,
    shotsAgainst: g.shotsAgainst, saves: g.saves, goalsAgainst: g.goalsAgainst,
    conBefore: g.conBefore, conAfter: g.conAfter, fatigued: g.fatigued,
    decision: g.decision, xga: g.xga,
    hdShotsAg: g.hdShotsAg, hdSaves: g.hdSaves, mdShotsAg: g.mdShotsAg, mdSaves: g.mdSaves,
    ldShotsAg: g.ldShotsAg, ldSaves: g.ldSaves,
    faceZones: g.faceZones ?? [], saveZones: g.saveZones ?? [],
  }));
}

/**
 * Save a completed game. If meta.gameId is provided, fills in that scheduled
 * row; otherwise creates a new FINAL Game. Idempotent per gameId: re-saving
 * replaces existing stat/event rows.
 */
export async function saveGameResult(result: GameResult, meta: GameMeta = {}) {
  const finalFields = {
    status: "FINAL",
    homeGoals: result.home.goals,
    awayGoals: result.away.goals,
    homeShots: result.home.shots,
    awayShots: result.away.shots,
    homeGoalsByPeriod: result.home.goalsByPeriod,
    awayGoalsByPeriod: result.away.goalsByPeriod,
    homeShotsByPeriod: result.home.shotsByPeriod,
    awayShotsByPeriod: result.away.shotsByPeriod,
    homeXg: result.home.xgFor,
    awayXg: result.away.xgFor,
    homeHd: result.home.hdFor,
    awayHd: result.away.hdFor,
    ...zonePct("home", result.home),
    ...zonePct("away", result.away),
    homeShotSectors: result.home.shotSectors,
    awayShotSectors: result.away.shotSectors,
    homeTopShot: result.home.topShotSpeed || null,
    awayTopShot: result.away.topShotSpeed || null,
    homeTopShotBy: result.home.topShotBy || null,
    awayTopShotBy: result.away.topShotBy || null,
    homeAvgShot: result.home.shots ? result.home.shotSpeedSum / result.home.shots : null,
    awayAvgShot: result.away.shots ? result.away.shotSpeedSum / result.away.shots : null,
    homeSystem: (result.homeSystem ?? undefined) as object | undefined,
    awaySystem: (result.awaySystem ?? undefined) as object | undefined,
    endedIn: result.endedIn,
    otPeriods: result.otPeriods,
    winnerTeamId: result.winner,
    seed: result.seed,
    engineVersion: result.engineVersion ?? null,
    playByPlay: result.playByPlay,
    shootout: result.shootout ?? [],
    playedAt: new Date(),
  };

  const goalRows = (gameId: number) => result.goals.map((g) => ({
    gameId, period: g.period, seconds: g.seconds,
    teamId: g.team, teamCode: g.teamCode,
    scorerId: g.scorer, scorerName: g.scorerName,
    assistIds: g.assists, assistNames: g.assistNames,
    strength: g.strength, emptyNet: g.emptyNet,
  }));
  const penaltyRows = (gameId: number) => result.penalties.map((p) => ({
    gameId, period: p.period, seconds: p.seconds,
    teamId: p.team, teamCode: p.teamCode,
    playerId: p.playerId, playerName: p.playerName,
    type: p.type, minutes: p.minutes, severity: p.severity,
  }));
  const eventRows = (gameId: number) => (result.events ?? []).map((e) => ({
    gameId, seq: e.seq, period: e.period, seconds: e.seconds, type: e.type,
    teamId: e.teamId ?? null, playerId: e.playerId ?? null, targetId: e.targetId ?? null,
    zone: e.zone ?? null, sector: e.sector ?? null, shotType: e.shotType ?? null,
    strength: e.strength ?? null, xg: e.xg ?? null, importance: e.importance,
    meta: (e.meta ?? undefined) as object | undefined,
  }));

  return prisma.$transaction(async (tx) => {
    let gameId: number;

    if (meta.gameId != null) {
      // a pre-scheduled row: also stamp the calendar date (and round) so the
      // Scores page can group by day and back-to-backs land on consecutive dates.
      await tx.game.update({
        where: { id: meta.gameId },
        data: {
          ...finalFields,
          ...(meta.gameDate ? { gameDate: meta.gameDate } : {}),
          ...(meta.round != null ? { round: meta.round } : {}),
        },
      });
      gameId = meta.gameId;
      await tx.playerGameStat.deleteMany({ where: { gameId } });
      await tx.goalieGameStat.deleteMany({ where: { gameId } });
      await tx.gameGoal.deleteMany({ where: { gameId } });
      await tx.gamePenalty.deleteMany({ where: { gameId } });
      await tx.gameEvent.deleteMany({ where: { gameId } });
    } else {
      const game = await tx.game.create({
        data: {
          season: meta.season ?? "2026-27",
          league: meta.league ?? "NHL",
          round: meta.round,
          gameDate: meta.gameDate,
          seriesId: meta.seriesId,
          gameNum: meta.gameNum,
          homeTeamId: result.home.teamId,
          awayTeamId: result.away.teamId,
          ...finalFields,
        },
      });
      gameId = game.id;
    }

    const players = [...skaterRows(result.home, gameId), ...skaterRows(result.away, gameId)];
    if (players.length) await tx.playerGameStat.createMany({ data: players });
    await tx.goalieGameStat.createMany({
      data: [...goalieRows(result.home, gameId), ...goalieRows(result.away, gameId)],
    });
    if (result.goals.length) await tx.gameGoal.createMany({ data: goalRows(gameId) });
    if (result.penalties.length) await tx.gamePenalty.createMany({ data: penaltyRows(gameId) });
    if (result.events?.length) await tx.gameEvent.createMany({ data: eventRows(gameId) });

    return gameId;
  });
}
