"use server";

// Season Tickets (DB side) — runs the preseason campaign for every club off its
// Fan Interest. Capacity and the season-ticket cap are league constants for now
// (arena ~18,500, up to 14,000 sold as season tickets).

import { prisma } from "./prisma";
import { leagueFanInterest, type TeamFan } from "./fan-interest-server";
import { seasonTickets, DEFAULT_ARENA_CAPACITY, DEFAULT_STH_CAP, type SeasonTickets, type TicketPricing } from "./season-tickets";

const ARENA_CAPACITY = DEFAULT_ARENA_CAPACITY;
const STH_CAP = DEFAULT_STH_CAP;

export type TeamSeasonTickets = { teamId: number; code: string | null; name: string; fanInterest: number; pricing: TicketPricing } & SeasonTickets;

function build(fan: TeamFan, pricing: TicketPricing): TeamSeasonTickets {
  const st = seasonTickets({
    capacity: ARENA_CAPACITY, sthCap: STH_CAP,
    fanInterest: fan.interest, baselineInterest: fan.baseline,
    pricing, reasons: fan.reasons,
  });
  return { teamId: fan.teamId, code: fan.code, name: fan.name, fanInterest: fan.interest, pricing, ...st };
}

const asPricing = (s: string | null | undefined): TicketPricing => (s === "LOW" || s === "PREMIUM" ? s : "STANDARD");

/** Season-ticket campaign for every club, most sold first. */
export async function leagueSeasonTickets(): Promise<TeamSeasonTickets[]> {
  const fans = await leagueFanInterest();
  const teams = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, ticketPricing: true } });
  const priceById = new Map(teams.map((t) => [t.id, asPricing(t.ticketPricing)]));
  return fans.map((f) => build(f, priceById.get(f.teamId) ?? "STANDARD")).sort((a, b) => b.sold - a.sold);
}

/** Season-ticket campaign for a single club. */
export async function teamSeasonTickets(teamId: number): Promise<TeamSeasonTickets | null> {
  const all = await leagueSeasonTickets();
  return all.find((r) => r.teamId === teamId) ?? null;
}
