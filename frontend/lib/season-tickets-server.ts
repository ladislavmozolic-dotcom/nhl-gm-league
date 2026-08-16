"use server";

// Season Tickets (DB side) — runs the preseason campaign for every club off its
// Fan Interest. Capacity and the season-ticket cap are league constants for now
// (arena ~18,500, up to 14,000 sold as season tickets).

import { leagueFanInterest, type TeamFan } from "./fan-interest-server";
import { seasonTickets, type SeasonTickets } from "./season-tickets";

const ARENA_CAPACITY = 18_500;
const STH_CAP = 14_000;

export type TeamSeasonTickets = { teamId: number; code: string | null; name: string; fanInterest: number } & SeasonTickets;

function build(fan: TeamFan): TeamSeasonTickets {
  const st = seasonTickets({
    capacity: ARENA_CAPACITY, sthCap: STH_CAP,
    fanInterest: fan.interest, baselineInterest: fan.baseline,
    pricing: "STANDARD", reasons: fan.reasons,
  });
  return { teamId: fan.teamId, code: fan.code, name: fan.name, fanInterest: fan.interest, ...st };
}

/** Season-ticket campaign for every club, most sold first. */
export async function leagueSeasonTickets(): Promise<TeamSeasonTickets[]> {
  const fans = await leagueFanInterest();
  return fans.map(build).sort((a, b) => b.sold - a.sold);
}

/** Season-ticket campaign for a single club. */
export async function teamSeasonTickets(teamId: number): Promise<TeamSeasonTickets | null> {
  const fans = await leagueFanInterest();
  const fan = fans.find((f) => f.teamId === teamId);
  return fan ? build(fan) : null;
}
