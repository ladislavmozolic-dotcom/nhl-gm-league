"use server";

// Star Power (DB side) — gathers each player's career points and award pedigree,
// then scores them with the pure engine. Zero on-ice effect; purely business/media.

import { prisma } from "./prisma";
import { starPower, awardPrestige, starReasons, type StarTier, type StarBreakdown } from "./star-power";
import { cleanName } from "./playerName";

export type StarRow = {
  playerId: number; name: string; position: string; isGoalie: boolean;
  teamId: number | null; teamCode: string | null; teamSlug: string | null; teamLogo: string | null;
  score: number; tier: StarTier; reasons: string[];
};

type PlayerLite = {
  id: number; name: string; position: string; isGoalie: boolean; overall: number | null;
  age: number | null; teamId: number | null; lastSeasonPts: number | null; lastSeasonGP: number | null;
  lastSeasonSvPct: number | null;
};

/** Career regular-season NHL points and weighted award prestige, per player id. */
async function pedigree(ids: number[]): Promise<{ career: Map<number, number>; awards: Map<number, number> }> {
  const career = new Map<number, number>();
  const awards = new Map<number, number>();
  if (ids.length === 0) return { career, awards };
  const [stats, aws] = await Promise.all([
    prisma.playerSeasonStat.groupBy({ by: ["playerId"], where: { playerId: { in: ids }, isPlayoff: false, league: "NHL" }, _sum: { points: true } }),
    prisma.seasonAward.findMany({ where: { playerId: { in: ids } }, select: { playerId: true, category: true } }),
  ]);
  for (const s of stats) career.set(s.playerId, s._sum.points ?? 0);
  for (const a of aws) if (a.playerId != null) awards.set(a.playerId, (awards.get(a.playerId) ?? 0) + awardPrestige(a.category));
  return { career, awards };
}

function scoreOf(p: PlayerLite, careerPts: number, awardPts: number): { score: number; tier: StarTier; parts: StarBreakdown; reasons: string[] } {
  const r = starPower({
    overall: p.overall, age: p.age, isGoalie: p.isGoalie,
    lastSeasonPts: p.lastSeasonPts, lastSeasonGP: p.lastSeasonGP, lastSeasonSvPct: p.lastSeasonSvPct,
    careerPoints: careerPts, awardPoints: awardPts,
  });
  return { ...r, reasons: starReasons(r.parts) };
}

/** Star power for one player (or null if not found). */
export async function starPowerForPlayer(playerId: number): Promise<{ score: number; tier: StarTier; reasons: string[] } | null> {
  const p = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, name: true, position: true, isGoalie: true, overall: true, age: true, teamId: true, lastSeasonPts: true, lastSeasonGP: true, lastSeasonSvPct: true },
  });
  if (!p) return null;
  const { career, awards } = await pedigree([playerId]);
  const s = scoreOf(p, career.get(playerId) ?? 0, awards.get(playerId) ?? 0);
  return { score: s.score, tier: s.tier, reasons: s.reasons };
}

/** Each NHL club's biggest star (max Star Power) — the marquee draw. */
export async function teamStarPeaks(): Promise<Map<number, { score: number; tier: StarTier; name: string }>> {
  const players = await prisma.player.findMany({
    where: { rosterType: "NHL" },
    select: { id: true, name: true, position: true, isGoalie: true, overall: true, age: true, teamId: true, lastSeasonPts: true, lastSeasonGP: true, lastSeasonSvPct: true },
  });
  const { career, awards } = await pedigree(players.map((p) => p.id));
  const peaks = new Map<number, { score: number; tier: StarTier; name: string }>();
  for (const p of players) {
    if (p.teamId == null) continue;
    const s = scoreOf(p, career.get(p.id) ?? 0, awards.get(p.id) ?? 0);
    const cur = peaks.get(p.teamId);
    if (!cur || s.score > cur.score) peaks.set(p.teamId, { score: s.score, tier: s.tier, name: cleanName(p.name) });
  }
  return peaks;
}

/** Star power for every NHL player (unsorted), with team code. */
export async function allStarPowers(): Promise<StarRow[]> {
  const players = await prisma.player.findMany({
    where: { rosterType: "NHL" },
    select: { id: true, name: true, position: true, isGoalie: true, overall: true, age: true, teamId: true, lastSeasonPts: true, lastSeasonGP: true, lastSeasonSvPct: true },
  });
  const { career, awards } = await pedigree(players.map((p) => p.id));
  const teams = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, code: true, slug: true, logoUrl: true } });
  const teamById = new Map(teams.map((t) => [t.id, t]));
  return players.map((p) => {
    const s = scoreOf(p, career.get(p.id) ?? 0, awards.get(p.id) ?? 0);
    const t = p.teamId != null ? teamById.get(p.teamId) : null;
    return {
      playerId: p.id, name: cleanName(p.name), position: p.position, isGoalie: p.isGoalie,
      teamId: p.teamId, teamCode: t?.code ?? null, teamSlug: t?.slug ?? null, teamLogo: t?.logoUrl ?? null,
      score: s.score, tier: s.tier, reasons: s.reasons,
    };
  });
}

/** Top NHL players by star power, league-wide. */
export async function leagueStarLeaderboard(limit = 50): Promise<StarRow[]> {
  const rows = await allStarPowers();
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, limit);
}
