"use server";

// Merchandise (DB side) — jersey units per player from Star Power, aggregated to
// club merch revenue, plus the league-wide Top Selling Jerseys leaderboard.

import { allStarPowers } from "./star-power-server";
import { leagueFanInterest } from "./fan-interest-server";
import { jerseyUnits, teamMerch, type TeamMerch } from "./merchandise";

export type JerseyRow = { playerId: number; name: string; position: string; teamCode: string | null; star: number; units: number };
export type TeamMerchRow = { teamId: number; code: string | null; name: string; fanInterest: number; topJersey: string | null } & TeamMerch;

/** Every NHL player's season jersey units, highest first. */
export async function topJerseys(limit = 40): Promise<JerseyRow[]> {
  const stars = await allStarPowers();
  const rows = stars.map((s) => ({ playerId: s.playerId, name: s.name, position: s.position, teamCode: s.teamCode, star: s.score, units: jerseyUnits(s.score) }));
  rows.sort((a, b) => b.units - a.units);
  return rows.slice(0, limit);
}

/** Club merchandise revenue for every NHL team, highest first. */
export async function leagueMerch(): Promise<TeamMerchRow[]> {
  const [stars, fans] = await Promise.all([allStarPowers(), leagueFanInterest()]);
  const fanById = new Map(fans.map((f) => [f.teamId, f]));

  // jersey units + the club's best-selling name, per team
  const unitsByTeam = new Map<number, number>();
  const topByTeam = new Map<number, { name: string; units: number }>();
  for (const s of stars) {
    if (s.teamId == null) continue;
    const u = jerseyUnits(s.score);
    unitsByTeam.set(s.teamId, (unitsByTeam.get(s.teamId) ?? 0) + u);
    const cur = topByTeam.get(s.teamId);
    if (!cur || u > cur.units) topByTeam.set(s.teamId, { name: s.name, units: u });
  }

  const rows: TeamMerchRow[] = [];
  for (const [teamId, f] of fanById) {
    const merch = teamMerch({ jerseyUnitsTotal: unitsByTeam.get(teamId) ?? 0, fanInterest: f.interest, baselineInterest: f.baseline });
    rows.push({ teamId, code: f.code, name: f.name, fanInterest: f.interest, topJersey: topByTeam.get(teamId)?.name ?? null, ...merch });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

/** Merch for a single club. */
export async function teamMerchandise(teamId: number): Promise<TeamMerchRow | null> {
  const all = await leagueMerch();
  return all.find((r) => r.teamId === teamId) ?? null;
}
