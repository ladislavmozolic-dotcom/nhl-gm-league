// Server glue for the clause agent: gather the real inputs (the player's
// projected lineup slot on each club + each club's standings strength) and run
// the deterministic verdict.

import { prisma } from "./prisma";
import { computeStandings } from "./sim/standings";
import { loadTeamContext, projectSlot, playerMarket, teamContentionMap, type TeamContext } from "./free-agency-server";
import { clauseVerdict, tradeImprovement, type ClauseType, type ClauseVerdict } from "./clause-agent";
import { liveCapHit } from "./finance";

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
    capHit: liveCapHit(p), contractYears: p.contractYears ?? 1,
    fromLine, toLine,
    fromPointsPct: ptsPct.get(fromTeamId) ?? 0.5,
    toPointsPct: ptsPct.get(toTeamId) ?? 0.5,
    toTeamId, noTradeTeams: p.noTradeTeams ?? [],
  });
  // contention is a useful label for the UI (contender/middle/rebuild of the destination)
  void cmap;
  return { ...v, playerId, playerName: p.name, fromTeamId, toTeamId };
}

export type TradeMoraleMove = { playerId: number; fromTeamId: number; toTeamId: number };

/** MO bump/dip for players who just changed teams in a trade — the same "bigger
 *  role + a stronger club" read the clause agent uses to negotiate a waiver fee,
 *  but applied to every traded skater/goalie (not just ones with a clause): a
 *  player who projects into more ice time and/or a stronger club feels the
 *  upgrade, one buried deeper on a weaker club sours a bit. Only rosterType
 *  "NHL" players are scored — an AHL reassignment isn't a lineup-slot swap in
 *  this sense. Returns a Map<playerId, delta> already scaled by `swingCap`
 *  (the league's moraleTradeSwing setting), ready to add to current morale. */
export async function tradeMoraleDeltas(moves: TradeMoraleMove[], swingCap: number): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!moves.length || !swingCap) return out;
  const players = await prisma.player.findMany({ where: { id: { in: moves.map((m) => m.playerId) }, rosterType: "NHL" }, select: SEL });
  if (!players.length) return out;
  const pById = new Map(players.map((p) => [p.id, p]));

  const teamIds = [...new Set(moves.flatMap((m) => [m.fromTeamId, m.toTeamId]))];
  const [standings, cmap] = await Promise.all([computeStandings(), teamContentionMap()]);
  const ptsPct = new Map(standings.map((s) => [s.teamId, s.pointsPct]));
  const ctxByTeam = new Map<number, TeamContext>(
    await Promise.all(teamIds.map(async (id): Promise<[number, TeamContext]> => [id, await loadTeamContext(id, cmap)])),
  );

  for (const m of moves) {
    const p = pById.get(m.playerId);
    const fromCtx = ctxByTeam.get(m.fromTeamId), toCtx = ctxByTeam.get(m.toTeamId);
    if (!p || !fromCtx || !toCtx) continue;
    const { grp, market } = playerMarket(p as Parameters<typeof playerMarket>[0]);
    const fromLine = projectSlot(fromCtx, grp, market).line;
    const toLine = projectSlot(toCtx, grp, market).line;
    const improvement = tradeImprovement({
      fromLine, toLine,
      fromPointsPct: ptsPct.get(m.fromTeamId) ?? 0.5, toPointsPct: ptsPct.get(m.toTeamId) ?? 0.5,
    });
    out.set(m.playerId, improvement * swingCap);
  }
  return out;
}
