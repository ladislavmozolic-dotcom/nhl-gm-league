// Prisma-backed load/save for team lines. Pure model + auto-fill live in
// ./lines-core (client-safe). This module is server-only.

import { prisma } from "../prisma";
import type { GameStrategy } from "./types";
import type { TeamTactics } from "./tactics";
import { autoFill, normalize, type TeamLinesData, type ForwardLine, type DefensePair, type Situations } from "./lines-core";

export * from "./lines-core";

export async function loadTeamLines(teamId: number): Promise<TeamLinesData | null> {
  const row = await prisma.teamLines.findUnique({
    where: { teamId },
    include: {
      team: {
        select: {
          league: true,
          players: {
            where: { scratched: false, rosterType: { in: ["NHL", "AHL"] } },
            select: { id: true, rosterType: true, isGoalie: true, position: true, overall: true, shoots: true, df: true },
          },
        },
      },
    },
  });
  if (!row) return null;
  const fl = row.forwardLines as unknown as ForwardLine[];
  const dp = row.defensePairs as unknown as DefensePair[];
  if (!fl?.length || !dp?.length) return null;
  const normalized = normalize({
    forwardLines: fl, defensePairs: dp,
    situations: row.situations as unknown as Situations,
    strategy: row.strategy as unknown as GameStrategy,
    system: (row as { system?: unknown }).system as TeamTactics | undefined,
  });
  const rosterType = row.team.league === "AHL" ? "AHL" : "NHL";
  const active = row.team.players.filter((p) => p.rosterType === rosterType);
  const skaters = active.filter((p) => !p.isGoalie).map((p) => ({
    id: p.id, position: p.position, overall: p.overall ?? 0, shoots: p.shoots, df: p.df,
  }));
  const goalies = active.filter((p) => p.isGoalie).map((p) => ({ id: p.id, overall: p.overall ?? 0 }));
  // Reconcile every read with the current active, un-scratched roster. This
  // protects simulations and every Lines view even before the GM saves again.
  return autoFill(normalized, skaters, goalies);
}

/** Load just the team-system dials, independent of whether the club has set
 *  lines (loadTeamLines returns null when lines are empty, which would drop the
 *  system — a GM can set a system without editing lines). */
export async function loadTeamSystem(teamId: number): Promise<TeamTactics | null> {
  const row = await prisma.teamLines.findUnique({ where: { teamId }, select: { system: true } });
  return (row?.system as TeamTactics | null) ?? null;
}

export async function saveTeamLines(teamId: number, data: TeamLinesData): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      league: true,
      players: {
        where: { scratched: false, rosterType: { in: ["NHL", "AHL"] } },
        select: { id: true, rosterType: true, isGoalie: true, position: true, overall: true, shoots: true, df: true },
      },
    },
  });
  if (!team) throw new Error(`Team ${teamId} not found`);
  const rosterType = team.league === "AHL" ? "AHL" : "NHL";
  const active = team.players.filter((p) => p.rosterType === rosterType);
  const skaters = active.filter((p) => !p.isGoalie).map((p) => ({ id: p.id, position: p.position, overall: p.overall ?? 0, shoots: p.shoots, df: p.df }));
  const goalies = active.filter((p) => p.isGoalie).map((p) => ({ id: p.id, overall: p.overall ?? 0 }));
  const safe = autoFill(normalize(data), skaters, goalies);
  const payload = {
    forwardLines: safe.forwardLines as object,
    defensePairs: safe.defensePairs as object,
    situations: safe.situations as object,
    strategy: safe.strategy as object,
    ...(safe.system ? { system: safe.system as object } : {}),
  };
  await prisma.teamLines.upsert({ where: { teamId }, create: { teamId, ...payload }, update: payload });
}
