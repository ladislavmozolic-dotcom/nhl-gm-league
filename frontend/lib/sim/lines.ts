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

export async function saveTeamLines(teamId: number, data: TeamLinesData, opts: { strict?: boolean } = {}): Promise<TeamLinesData> {
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
  const normalized = normalize(data);
  const fIds = normalized.forwardLines.flatMap((l) => [l.lw, l.c, l.rw]);
  const dIds = normalized.defensePairs.flatMap((p) => [p.ld, p.rd]);
  if (opts.strict && (normalized.forwardLines.length !== 4 || fIds.some((id) => id == null))) throw new Error("Fill all 12 forward slots before saving.");
  if (opts.strict && (normalized.defensePairs.length !== 3 || dIds.some((id) => id == null))) throw new Error("Fill all 6 defense slots before saving.");
  const fiveOnFive = [...fIds, ...dIds].filter((id): id is number => id != null);
  const duplicateInsideUnit = [
    ...normalized.forwardLines.map((l) => [l.lw, l.c, l.rw]),
    ...normalized.defensePairs.map((p) => [p.ld, p.rd]),
  ].some((unit) => {
    const ids = unit.filter((id): id is number => id != null);
    return new Set(ids).size !== ids.length;
  });
  if (opts.strict && duplicateInsideUnit) throw new Error("A player cannot occupy two positions in the same line or pair.");
  const isDefense = (position: string) => /(^|\/)D(\/|$)/.test(position) || position === "D";
  if (opts.strict && skaters.filter((p) => !isDefense(p.position)).length < 12) throw new Error("The active roster must contain at least 12 forwards.");
  if (opts.strict && skaters.filter((p) => isDefense(p.position)).length < 6) throw new Error("The active roster must contain at least 6 defensemen.");
  const activeIds = new Set(skaters.map((p) => p.id));
  if (opts.strict && fiveOnFive.some((id) => !activeIds.has(id))) throw new Error("The lineup contains a player who is no longer on the active roster. Reload Lines and try again.");

  // 5v5 is already complete and valid, so autoFill leaves the GM's exact lines
  // untouched and only reconciles/fills ancillary special-situation slots.
  const safe = autoFill(normalized, skaters, goalies);
  const payload = {
    forwardLines: safe.forwardLines as object,
    defensePairs: safe.defensePairs as object,
    situations: safe.situations as object,
    strategy: safe.strategy as object,
    ...(safe.system ? { system: safe.system as object } : {}),
  };
  await prisma.teamLines.upsert({ where: { teamId }, create: { teamId, ...payload }, update: payload });
  return safe;
}
