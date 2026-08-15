// League Audit Log — records every simulation of a game (who, engine, seed) so
// results are reproducible and a commissioner can't quietly re-roll a result.

import { prisma } from "./prisma";
import { getTeamSession } from "./auth";

// Display name of the signed-in commissioner (for the audit trail).
export async function commissionerName(): Promise<string> {
  const teamId = await getTeamSession();
  if (teamId == null) return "Commissioner";
  const t = await prisma.team.findUnique({ where: { id: teamId }, select: { gmNickname: true, gmFirstName: true, gmLastName: true, gm: true, code: true } });
  return t?.gmNickname || [t?.gmFirstName, t?.gmLastName].filter(Boolean).join(" ").trim() || t?.gm || t?.code || "Commissioner";
}

// Log an audit row for each freshly-simulated game and stamp the game with its
// sim count + who/when. simCount>1 marks a re-simulation.
export async function recordSimAudit(gameIds: number[], byName: string): Promise<void> {
  if (!gameIds.length) return;
  const games = await prisma.game.findMany({
    where: { id: { in: gameIds } },
    select: { id: true, season: true, league: true, seed: true, engineVersion: true, simCount: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true },
  });
  const now = new Date();
  for (const g of games) {
    const action = g.simCount >= 1 ? "RESIMULATE" : "SIMULATE";
    await prisma.$transaction([
      prisma.gameAudit.create({
        data: { gameId: g.id, season: g.season, league: g.league ?? "NHL", action, byName, engineVersion: g.engineVersion, seed: g.seed, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, homeGoals: g.homeGoals, awayGoals: g.awayGoals },
      }),
      prisma.game.update({ where: { id: g.id }, data: { simCount: { increment: 1 }, lastSimBy: byName, lastSimAt: now } }),
    ]);
  }
}

export type AuditRow = {
  id: number; gameId: number; action: string; byName: string; engineVersion: string | null; seed: number | null;
  createdAt: string; league: string; homeCode: string | null; awayCode: string | null; homeGoals: number | null; awayGoals: number | null; simCount: number;
};

export async function recentAudits(limit = 100, league?: string): Promise<AuditRow[]> {
  const rows = await prisma.gameAudit.findMany({ where: league ? { league } : {}, orderBy: { createdAt: "desc" }, take: limit });
  const teamIds = [...new Set(rows.flatMap((r) => [r.homeTeamId, r.awayTeamId]).filter((x): x is number => x != null))];
  const tm = new Map((await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, code: true, name: true } })).map((t) => [t.id, t.code ?? t.name]));
  const counts = new Map((await prisma.game.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.gameId))] } }, select: { id: true, simCount: true } })).map((g) => [g.id, g.simCount]));
  return rows.map((r) => ({
    id: r.id, gameId: r.gameId, action: r.action, byName: r.byName, engineVersion: r.engineVersion, seed: r.seed,
    createdAt: r.createdAt.toISOString(), league: r.league,
    homeCode: r.homeTeamId != null ? (tm.get(r.homeTeamId) ?? null) : null, awayCode: r.awayTeamId != null ? (tm.get(r.awayTeamId) ?? null) : null,
    homeGoals: r.homeGoals, awayGoals: r.awayGoals, simCount: counts.get(r.gameId) ?? 1,
  }));
}

export async function gameAudits(gameId: number): Promise<AuditRow[]> {
  const rows = await prisma.gameAudit.findMany({ where: { gameId }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({
    id: r.id, gameId: r.gameId, action: r.action, byName: r.byName, engineVersion: r.engineVersion, seed: r.seed,
    createdAt: r.createdAt.toISOString(), league: r.league, homeCode: null, awayCode: null, homeGoals: r.homeGoals, awayGoals: r.awayGoals, simCount: 0,
  }));
}
