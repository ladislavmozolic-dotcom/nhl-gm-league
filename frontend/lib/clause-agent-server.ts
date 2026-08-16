// Server glue for the clause agent: gather the real inputs (the player's
// projected lineup slot on each club + each club's standings strength) and run
// the deterministic verdict.

import { prisma } from "./prisma";
import { computeStandings } from "./sim/standings";
import { loadTeamContext, projectSlot, playerMarket, teamContentionMap } from "./free-agency-server";
import { clauseVerdict, type ClauseType, type ClauseVerdict } from "./clause-agent";

const SEL = {
  id: true, isGoalie: true, position: true, capHit: true, contractYears: true,
  tradeClause: true, noTradeTeams: true, teamId: true,
  sc: true, pa: true, df: true, sk: true,
  goalieRating: { select: { ag: true, rb: true, sc: true, hs: true } },
} as const;

export type ClauseTerms = ClauseVerdict & { playerId: number; playerName: string; fromTeamId: number; toTeamId: number };

/** What the player wants to waive his clause for a trade from his team to `toTeamId`.
 *  Returns null if he has no clause (or clauses are irrelevant). */
export async function clauseTerms(playerId: number, toTeamId: number): Promise<ClauseTerms | null> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { ...SEL, name: true } });
  if (!p || !p.tradeClause) return null;
  const fromTeamId = p.teamId;

  const [standings, fromCtx, toCtx, cmap] = await Promise.all([
    computeStandings(),
    loadTeamContext(fromTeamId),
    loadTeamContext(toTeamId),
    teamContentionMap(),
  ]);
  const ptsPct = new Map(standings.map((s) => [s.teamId, s.pointsPct]));
  const { grp, market } = playerMarket(p as Parameters<typeof playerMarket>[0]);
  const fromLine = projectSlot(fromCtx, grp, market).line;
  const toLine = projectSlot(toCtx, grp, market).line;

  const v = clauseVerdict({
    clause: p.tradeClause as ClauseType,
    capHit: p.capHit ?? 0, contractYears: p.contractYears ?? 1,
    fromLine, toLine,
    fromPointsPct: ptsPct.get(fromTeamId) ?? 0.5,
    toPointsPct: ptsPct.get(toTeamId) ?? 0.5,
    toTeamId, noTradeTeams: p.noTradeTeams ?? [],
  });
  // contention is a useful label for the UI (contender/middle/rebuild of the destination)
  void cmap;
  return { ...v, playerId, playerName: p.name, fromTeamId, toTeamId };
}
