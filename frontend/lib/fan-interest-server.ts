"use server";

// Fan Interest (DB side) — sets each club's preseason expectation from roster
// strength, then computes live Fan Interest from results vs that expectation,
// recent form, streaks and marquee star power.

import { prisma } from "./prisma";
import { computeStandings } from "./sim/standings";
import { teamStarPeaks } from "./star-power-server";
import { fanInterest, type ExpectationTier, type FanInterest } from "./fan-interest";

const SEASON = "2026-27";

export type TeamFan = {
  teamId: number; code: string | null; name: string;
  tier: ExpectationTier; star: { score: number; name: string } | null;
} & FanInterest;

/** Preseason expectation tier for every NHL club, by roster strength rank
 *  (top-9 overall as the core proxy). */
async function expectationTiers(): Promise<Map<number, ExpectationTier>> {
  const players = await prisma.player.findMany({
    where: { rosterType: "NHL" },
    select: { teamId: true, overall: true },
  });
  const byTeam = new Map<number, number[]>();
  for (const p of players) {
    if (p.teamId == null) continue;
    const arr = byTeam.get(p.teamId) ?? [];
    arr.push(p.overall ?? 60);
    byTeam.set(p.teamId, arr);
  }
  const strength = [...byTeam.entries()].map(([teamId, ovrs]) => {
    const core = ovrs.sort((a, b) => b - a).slice(0, 9);
    return { teamId, s: core.reduce((t, x) => t + x, 0) / Math.max(1, core.length) };
  });
  strength.sort((a, b) => b.s - a.s);
  const n = strength.length;
  const tiers = new Map<number, ExpectationTier>();
  strength.forEach((row, i) => {
    const pct = i / Math.max(1, n);
    tiers.set(row.teamId, pct < 0.25 ? "Championship Contender" : pct < 0.55 ? "Playoff Team" : pct < 0.80 ? "Bubble Team" : "Rebuilding Team");
  });
  return tiers;
}

/** Last-10 points and current streak per team, from finished games. */
async function formAndStreak(): Promise<Map<number, { last10: number; streak: number }>> {
  const games = await prisma.game.findMany({
    where: { season: SEASON, league: "NHL", status: "FINAL" },
    select: { homeTeamId: true, awayTeamId: true, winnerTeamId: true, endedIn: true, gameDate: true, round: true },
    orderBy: [{ gameDate: "asc" }, { round: "asc" }, { id: "asc" }],
  });
  // per team, chronological list of "points earned" (2 win, 1 OT/SO loss, 0 loss) + win flag
  const seq = new Map<number, { pts: number; win: boolean }[]>();
  const push = (teamId: number, pts: number, win: boolean) => {
    const a = seq.get(teamId) ?? []; a.push({ pts, win }); seq.set(teamId, a);
  };
  for (const g of games) {
    if (g.winnerTeamId == null) continue;
    const otLoss = g.endedIn === "OT" || g.endedIn === "SO";
    const loser = g.winnerTeamId === g.homeTeamId ? g.awayTeamId : g.homeTeamId;
    push(g.winnerTeamId, 2, true);
    push(loser, otLoss ? 1 : 0, false);
  }
  const out = new Map<number, { last10: number; streak: number }>();
  for (const [teamId, list] of seq) {
    const last10 = list.slice(-10).reduce((t, x) => t + x.pts, 0);
    let streak = 0;
    for (let k = list.length - 1; k >= 0; k--) {
      if (k === list.length - 1) { streak = list[k].win ? 1 : -1; continue; }
      if (list[k].win === (streak > 0)) streak += streak > 0 ? 1 : -1;
      else break;
    }
    out.set(teamId, { last10, streak });
  }
  return out;
}

/** Fan Interest for every NHL club, sorted highest first. */
export async function leagueFanInterest(): Promise<TeamFan[]> {
  const [standings, tiers, form, peaks] = await Promise.all([
    computeStandings(SEASON, "NHL"), expectationTiers(), formAndStreak(), teamStarPeaks(),
  ]);
  const half = Math.ceil(standings.length / 2);

  const rows: TeamFan[] = standings.map((s, rank) => {
    const tier = tiers.get(s.teamId) ?? "Bubble Team";
    const f = form.get(s.teamId);
    const peak = peaks.get(s.teamId) ?? null;
    const fi = fanInterest({
      tier, gp: s.gp, pointsPct: s.pointsPct,
      last10Pts: f?.last10, streak: f?.streak,
      topStarPower: peak?.score,
      playoffSpot: rank < half, leagueTop3: rank < 3,
    });
    return { teamId: s.teamId, code: s.code, name: s.name, tier, star: peak ? { score: peak.score, name: peak.name } : null, ...fi };
  });
  rows.sort((a, b) => b.interest - a.interest);
  return rows;
}

/** Fan Interest for a single club. */
export async function teamFanInterest(teamId: number): Promise<TeamFan | null> {
  const all = await leagueFanInterest();
  return all.find((r) => r.teamId === teamId) ?? null;
}
