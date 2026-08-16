// Player FORM — a DERIVED read on what a player is actually producing lately, kept
// deliberately separate from MO (morale, a stored psychological state). Form is not
// stored: it's computed on the fly from the player's last N games. So a player can
// have high MO + cold form, or low MO + hot form — which is realistic.

import { prisma } from "./prisma";

const LAST_N = 10;

export type SkaterForm = {
  kind: "skater"; games: number; goals: number; assists: number; points: number;
  toiSec: number; xg: number; ppg: number; pointsPer60: number; xgPer60: number;
  label: string; emoji: string; tone: string;
};
export type GoalieForm = {
  kind: "goalie"; games: number; saves: number; shotsAgainst: number; goalsAgainst: number;
  svPct: number; gaa: number; gsax: number;
  label: string; emoji: string; tone: string;
};
export type PlayerForm = SkaterForm | GoalieForm | null;

// thresholds on points-per-60 (individual), by role — a D bar sits lower than a F's
const F_BANDS: [number, string, string, string][] = [
  [3.4, "Excellent", "🔥", "text-orange-400"], [2.4, "Hot", "😎", "text-amber-400"],
  [1.5, "Steady", "➖", "text-slate-300"], [0.8, "Quiet", "🌡️", "text-sky-400"],
  [0, "Cold", "🧊", "text-blue-400"],
];
const D_BANDS: [number, string, string, string][] = [
  [1.9, "Excellent", "🔥", "text-orange-400"], [1.3, "Hot", "😎", "text-amber-400"],
  [0.8, "Steady", "➖", "text-slate-300"], [0.4, "Quiet", "🌡️", "text-sky-400"],
  [0, "Cold", "🧊", "text-blue-400"],
];
const G_BANDS: [number, string, string, string][] = [ // on save %
  [0.930, "Excellent", "🔥", "text-orange-400"], [0.915, "Hot", "😎", "text-amber-400"],
  [0.900, "Steady", "➖", "text-slate-300"], [0.885, "Shaky", "🌡️", "text-sky-400"],
  [0, "Cold", "🧊", "text-blue-400"],
];
const band = (bands: [number, string, string, string][], v: number) => bands.find(([t]) => v >= t) ?? bands[bands.length - 1];

export async function playerForm(playerId: number): Promise<PlayerForm> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { position: true, isGoalie: true } });
  if (!p) return null;
  const isGoalie = p.isGoalie || p.position === "G";

  if (isGoalie) {
    const rows = await prisma.goalieGameStat.findMany({
      where: { playerId, started: true, game: { status: "FINAL", league: "NHL", seriesId: null } },
      orderBy: { game: { gameDate: "desc" } }, take: LAST_N,
      select: { saves: true, shotsAgainst: true, goalsAgainst: true, xga: true },
    });
    if (!rows.length) return null;
    const saves = rows.reduce((t, r) => t + r.saves, 0);
    const sa = rows.reduce((t, r) => t + r.shotsAgainst, 0);
    const ga = rows.reduce((t, r) => t + r.goalsAgainst, 0);
    const xga = rows.reduce((t, r) => t + r.xga, 0);
    const svPct = sa ? saves / sa : 0;
    const [, label, emoji, tone] = band(G_BANDS, svPct);
    return { kind: "goalie", games: rows.length, saves, shotsAgainst: sa, goalsAgainst: ga, svPct, gaa: rows.length ? ga / rows.length : 0, gsax: +(xga - ga).toFixed(1), label, emoji, tone };
  }

  const rows = await prisma.playerGameStat.findMany({
    where: { playerId, game: { status: "FINAL", league: "NHL", seriesId: null } },
    orderBy: { game: { gameDate: "desc" } }, take: LAST_N,
    select: { goals: true, assists: true, points: true, toi: true, xg: true },
  });
  if (!rows.length) return null;
  const goals = rows.reduce((t, r) => t + r.goals, 0);
  const assists = rows.reduce((t, r) => t + r.assists, 0);
  const points = rows.reduce((t, r) => t + r.points, 0);
  const toiSec = rows.reduce((t, r) => t + r.toi, 0);
  const xg = rows.reduce((t, r) => t + r.xg, 0);
  const hours = Math.max(0.01, toiSec / 3600);
  const pointsPer60 = points / hours;
  const xgPer60 = xg / hours;
  const [, label, emoji, tone] = band(p.position === "D" ? D_BANDS : F_BANDS, pointsPer60);
  return {
    kind: "skater", games: rows.length, goals, assists, points, toiSec, xg: +xg.toFixed(2),
    ppg: +(points / rows.length).toFixed(2), pointsPer60: +pointsPer60.toFixed(2), xgPer60: +xgPer60.toFixed(2),
    label, emoji, tone,
  };
}
