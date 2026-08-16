"use server";

// Season Tickets (DB side) — runs the preseason campaign for every club off its
// Fan Interest. Capacity and the season-ticket cap are league constants for now
// (arena ~18,500, up to 14,000 sold as season tickets).

import { prisma } from "./prisma";
import { leagueFanInterest, type TeamFan } from "./fan-interest-server";
import { seasonTickets, arenaFor, type SeasonTickets, type TicketPricing } from "./season-tickets";

export type TeamSeasonTickets = { teamId: number; code: string | null; name: string; fanInterest: number; pricing: TicketPricing } & SeasonTickets;

function build(fan: TeamFan, pricing: TicketPricing, capacity: number | null): TeamSeasonTickets {
  const arena = arenaFor(capacity);
  const st = seasonTickets({
    capacity: arena.capacity, sthCap: arena.sthCap,
    fanInterest: fan.interest, baselineInterest: fan.baseline,
    pricing, reasons: fan.reasons,
  });
  return { teamId: fan.teamId, code: fan.code, name: fan.name, fanInterest: fan.interest, pricing, ...st };
}

const asPricing = (s: string | null | undefined): TicketPricing => (s === "LOW" || s === "PREMIUM" ? s : "STANDARD");

/** Season-ticket campaign for every club, most sold first. */
export async function leagueSeasonTickets(): Promise<TeamSeasonTickets[]> {
  const fans = await leagueFanInterest();
  const teams = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, ticketPricing: true, capacity: true } });
  const byId = new Map(teams.map((t) => [t.id, t]));
  return fans.map((f) => build(f, asPricing(byId.get(f.teamId)?.ticketPricing), byId.get(f.teamId)?.capacity ?? null)).sort((a, b) => b.sold - a.sold);
}

/** Season-ticket campaign for a single club. */
export async function teamSeasonTickets(teamId: number): Promise<TeamSeasonTickets | null> {
  const all = await leagueSeasonTickets();
  return all.find((r) => r.teamId === teamId) ?? null;
}
