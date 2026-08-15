// Prisma-backed load/save for team lines. Pure model + auto-fill live in
// ./lines-core (client-safe). This module is server-only.

import { prisma } from "../prisma";
import type { GameStrategy } from "./types";
import type { TeamTactics } from "./tactics";
import { normalize, type TeamLinesData, type ForwardLine, type DefensePair, type Situations } from "./lines-core";

export * from "./lines-core";

export async function loadTeamLines(teamId: number): Promise<TeamLinesData | null> {
  const row = await prisma.teamLines.findUnique({ where: { teamId } });
  if (!row) return null;
  const fl = row.forwardLines as unknown as ForwardLine[];
  const dp = row.defensePairs as unknown as DefensePair[];
  if (!fl?.length || !dp?.length) return null;
  return normalize({
    forwardLines: fl, defensePairs: dp,
    situations: row.situations as unknown as Situations,
    strategy: row.strategy as unknown as GameStrategy,
    system: (row as { system?: unknown }).system as TeamTactics | undefined,
  });
}

/** Load just the team-system dials, independent of whether the club has set
 *  lines (loadTeamLines returns null when lines are empty, which would drop the
 *  system — a GM can set a system without editing lines). */
export async function loadTeamSystem(teamId: number): Promise<TeamTactics | null> {
  const row = await prisma.teamLines.findUnique({ where: { teamId }, select: { system: true } });
  return (row?.system as TeamTactics | null) ?? null;
}

export async function saveTeamLines(teamId: number, data: TeamLinesData): Promise<void> {
  const payload = {
    forwardLines: data.forwardLines as object,
    defensePairs: data.defensePairs as object,
    situations: data.situations as object,
    strategy: data.strategy as object,
    ...(data.system ? { system: data.system as object } : {}),
  };
  await prisma.teamLines.upsert({ where: { teamId }, create: { teamId, ...payload }, update: payload });
}
