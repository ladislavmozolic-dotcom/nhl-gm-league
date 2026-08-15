// Ice-time promise enforcement. At signing a player is promised a deployment
// (line + PP/PK). If the GM doesn't actually play him there, the player warns
// the club (after 1/3 of the season), then — if it isn't fixed within a grace
// period and the season passes 2/3 — formally requests a trade. A disgruntled
// player is a runtime −20% + low morale until he's traded or the role is honored.

import { prisma } from "./prisma";
import { getLeagueClock } from "./calendar-server";
import { seasonFraction } from "./calendar";
import { loadTeamContext, projectSlot, playerMarket } from "./free-agency-server";

export const GRACE_GAMES = 10;
export const WARN_FRACTION = 1 / 3;
export const REQUEST_FRACTION = 2 / 3;

export type Deploy = { line: number | null; pp: boolean; pk: boolean };

const has = (arr: unknown, id: number): boolean =>
  Array.isArray(arr) && arr.some((u: any) => Array.isArray(u?.players) && u.players.includes(id));

/** Where the player is ACTUALLY deployed: from the GM's saved lines if he's in
 *  them, otherwise his talent-based auto-slot (so a GM must set lines to honor a
 *  promise that outruns the player's natural role). */
async function actualDeployment(playerId: number, teamId: number, isGoalie: boolean, df: number | null): Promise<Deploy> {
  const lines = await prisma.teamLines.findUnique({ where: { teamId } });
  if (lines) {
    const fwd = (lines.forwardLines as any[]) ?? [];
    const def = (lines.defensePairs as any[]) ?? [];
    const sit = (lines.situations as any) ?? {};
    let line: number | null = null;
    for (let i = 0; i < fwd.length; i++) if ([fwd[i]?.lw, fwd[i]?.c, fwd[i]?.rw].includes(playerId)) { line = i + 1; break; }
    if (line == null) for (let i = 0; i < def.length; i++) if ([def[i]?.ld, def[i]?.rd].includes(playerId)) { line = i + 1; break; }
    if (line != null) {
      return { line, pp: has(sit.pp, playerId), pk: has(sit.pk4, playerId) || has(sit.pk3, playerId) };
    }
    // saved lines exist but he's not in them → he's a scratch: worst possible role
    if (fwd.length || def.length) return { line: 5, pp: false, pk: false };
  }
  // no saved lines → fall back to his talent-based auto slot
  const ctx = await loadTeamContext(teamId);
  const { grp, market } = playerMarket({ isGoalie, position: null, capHit: null, sc: null, pa: null, df, sk: null, goalieRating: null } as any);
  const { line } = projectSlot(ctx, grp, market);
  return { line, pp: !isGoalie && line <= 2, pk: !isGoalie && (df ?? 0) >= 68 };
}

function promiseBroken(promiseLine: number, promisePP: boolean, promisePK: boolean, actual: Deploy): boolean {
  const lineWorse = actual.line != null && actual.line - promiseLine >= 1;
  const ppBroken = promisePP && !actual.pp;
  const pkBroken = promisePK && !actual.pk;
  return lineWorse || ppBroken || pkBroken;
}

const cleanName = (n: string) => n.replace(/\s*''?[A-Z]''?\s*|\s*\((NTC|NMC|R)\)/g, "").trim();

/** Run the promise check for the whole league. Called on each day-advance in the
 *  regular season. Returns how many players warned / requested a trade. */
export async function checkPromises(): Promise<{ warned: number; requested: number; notes: string[] }> {
  const clock = await getLeagueClock();
  if (clock.phase !== "regular") return { warned: 0, requested: 0, notes: [] };
  const frac = seasonFraction(clock.date);
  if (frac < WARN_FRACTION) return { warned: 0, requested: 0, notes: [] };

  // games played per NHL team (for the grace-period counter)
  const finals = await prisma.game.findMany({
    where: { season: "2026-27", status: "FINAL" }, select: { homeTeamId: true, awayTeamId: true },
  });
  const gp = new Map<number, number>();
  for (const g of finals) { gp.set(g.homeTeamId, (gp.get(g.homeTeamId) ?? 0) + 1); gp.set(g.awayTeamId, (gp.get(g.awayTeamId) ?? 0) + 1); }

  const players = await prisma.player.findMany({
    where: { rosterType: "NHL", signPromiseLine: { not: null }, team: { league: "NHL" } },
    select: {
      id: true, name: true, teamId: true, isGoalie: true, df: true, morale: true,
      signPromiseLine: true, signPromisePP: true, signPromisePK: true,
      promiseWarnGame: true, disgruntled: true, tradeRequested: true,
      team: { select: { code: true } },
    },
  });

  let warned = 0, requested = 0;
  const notes: string[] = [];

  for (const p of players) {
    const actual = await actualDeployment(p.id, p.teamId, p.isGoalie, p.df);
    const broken = promiseBroken(p.signPromiseLine!, !!p.signPromisePP, !!p.signPromisePK, actual);
    const name = cleanName(p.name);

    if (!broken) {
      if (p.promiseWarnGame != null || p.disgruntled || p.tradeRequested) {
        await prisma.player.update({ where: { id: p.id }, data: { promiseWarnGame: null, disgruntled: false, tradeRequested: false } });
      }
      continue;
    }

    const teamGames = gp.get(p.teamId) ?? 0;

    if (!p.tradeRequested && p.promiseWarnGame == null && frac >= WARN_FRACTION) {
      await prisma.player.update({ where: { id: p.id }, data: { promiseWarnGame: teamGames } });
      await prisma.transaction.create({
        data: { type: "PROMISE_WARNING", message: `${p.team?.code ?? "?"}: ${name} is unhappy with his ice time — expects the role he was promised, or he'll ask out.` },
      });
      warned++; notes.push(`${name} warned ${p.team?.code}`);
    } else if (!p.tradeRequested && p.promiseWarnGame != null && teamGames - p.promiseWarnGame >= GRACE_GAMES && frac >= REQUEST_FRACTION) {
      await prisma.player.update({
        where: { id: p.id },
        data: { tradeRequested: true, disgruntled: true, morale: Math.min(p.morale ?? 50, 30) },
      });
      await prisma.transaction.create({
        data: { type: "TRADE_REQUEST", message: `${p.team?.code ?? "?"}: ${name} has requested a trade — the club never gave him the role promised at signing.` },
      });
      requested++; notes.push(`${name} requested a trade from ${p.team?.code}`);
    }
  }
  return { warned, requested, notes };
}
