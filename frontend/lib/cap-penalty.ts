// Cap-ceiling penalties a club carries into a later season, born from days spent
// over the salary cap (see lib/league-bank-server.ts). Kept in its own tiny file
// (prisma only) so lib/cap.ts can read it without an import cycle.
import { prisma } from "./prisma";

/** Amount the club's cap ceiling is reduced by in `seasonStart` (2026 = 2026-27). */
export async function capPenaltyFor(teamId: number, seasonStart: number): Promise<number> {
  const m = await capPenaltyMap(seasonStart);
  return m.get(teamId) ?? 0;
}

/** teamId → ceiling reduction for `seasonStart`, for every club that has one. */
export async function capPenaltyMap(seasonStart: number): Promise<Map<number, number>> {
  const [bank, rows] = await Promise.all([
    prisma.leagueBank.findUnique({ where: { id: 1 }, select: { capPenaltyMultiplier: true } }),
    prisma.teamCapPenalty.findMany({ where: { appliesSeasonStart: seasonStart, waived: false } }),
  ]);
  const mult = bank?.capPenaltyMultiplier ?? 2;
  const out = new Map<number, number>();
  for (const r of rows) {
    const amt = Math.max(0, Math.round(r.basis * mult) + r.manualAdj);
    if (amt > 0) out.set(r.teamId, (out.get(r.teamId) ?? 0) + amt);
  }
  return out;
}
