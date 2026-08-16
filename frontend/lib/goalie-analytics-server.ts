// Goalie Analytics Center — a goalie is far more than GAA/SV%. Danger-split save
// rates, expected goals (xGA) and goals saved above expected (GSAx), a last-10
// trend, and a workload/fatigue read — all from the tracked event data.

import { prisma } from "./prisma";

const SEASON = "2026-27";

export type DangerSplit = { shots: number; saves: number; svPct: number };
export type GoalieAnalytics = {
  gp: number; shotsAgainst: number; saves: number; goalsAgainst: number;
  svPct: number; xga: number; gsax: number; gaa: number;
  high: DangerSplit; mid: DangerSplit; low: DangerSplit;
  last10: { gp: number; gsax: number; svPct: number };
  fatigue: { level: "Fresh" | "Normal" | "Elevated" | "High"; recentStarts: number; recentWindow: number; condition: number; note: string };
} | null;

const split = (shots: number, saves: number): DangerSplit => ({ shots, saves, svPct: shots ? saves / shots : 0 });

export async function goalieAnalytics(playerId: number): Promise<GoalieAnalytics> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { position: true, isGoalie: true, condition: true, teamId: true } });
  if (!p || (!(p.isGoalie || p.position === "G"))) return null;
  const where = { playerId, started: true, game: { season: SEASON, league: "NHL", status: "FINAL" as const, seriesId: null } };

  const agg = await prisma.goalieGameStat.aggregate({
    where, _count: { _all: true },
    _sum: { shotsAgainst: true, saves: true, goalsAgainst: true, xga: true, hdShotsAg: true, hdSaves: true, mdShotsAg: true, mdSaves: true, ldShotsAg: true, ldSaves: true },
  });
  if (!agg._count._all) return null;
  const s = agg._sum;
  const shotsAgainst = s.shotsAgainst ?? 0, saves = s.saves ?? 0, goalsAgainst = s.goalsAgainst ?? 0, xga = s.xga ?? 0;
  const gp = agg._count._all;

  // last 10 starts → GSAx trend
  const last = await prisma.goalieGameStat.findMany({ where, orderBy: { game: { gameDate: "desc" } }, take: 10, select: { saves: true, shotsAgainst: true, goalsAgainst: true, xga: true } });
  const l10sa = last.reduce((t, r) => t + r.shotsAgainst, 0), l10sv = last.reduce((t, r) => t + r.saves, 0);
  const l10gsax = last.reduce((t, r) => t + (r.xga - r.goalsAgainst), 0);

  // workload / fatigue: of the team's last 8 games, how many did he start? + CON
  const recentTeamGames = await prisma.game.findMany({
    where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null, OR: [{ homeTeamId: p.teamId }, { awayTeamId: p.teamId }] },
    orderBy: [{ round: "desc" }], take: 8, select: { id: true },
  });
  const windowIds = recentTeamGames.map((g) => g.id);
  const recentStarts = windowIds.length ? await prisma.goalieGameStat.count({ where: { playerId, started: true, gameId: { in: windowIds } } }) : 0;
  const recentWindow = windowIds.length;
  const con = Math.round(p.condition ?? 100);
  const density = recentWindow ? recentStarts / recentWindow : 0;
  let level: "Fresh" | "Normal" | "Elevated" | "High";
  if ((recentStarts >= 8 && recentWindow >= 8) || con < 92) level = "High";
  else if ((recentStarts >= 7 && recentWindow >= 8) || density >= 0.8 || con < 96) level = "Elevated";
  else if (recentStarts <= 2 || con >= 100) level = "Fresh";
  else level = "Normal";
  const note = level === "High" || level === "Elevated"
    ? `Started ${recentStarts} of the last ${recentWindow} — carrying a heavy load; a rest steadies rebound control & reactions.`
    : `Started ${recentStarts} of the last ${recentWindow} — well within a manageable workload.`;

  return {
    gp, shotsAgainst, saves, goalsAgainst,
    svPct: shotsAgainst ? saves / shotsAgainst : 0, xga: +xga.toFixed(1), gsax: +(xga - goalsAgainst).toFixed(1), gaa: gp ? goalsAgainst / gp : 0,
    high: split(s.hdShotsAg ?? 0, s.hdSaves ?? 0), mid: split(s.mdShotsAg ?? 0, s.mdSaves ?? 0), low: split(s.ldShotsAg ?? 0, s.ldSaves ?? 0),
    last10: { gp: last.length, gsax: +l10gsax.toFixed(1), svPct: l10sa ? l10sv / l10sa : 0 },
    fatigue: { level, recentStarts, recentWindow, condition: con, note },
  };
}
