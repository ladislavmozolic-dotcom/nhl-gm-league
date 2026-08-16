"use server";

// Dynamic Attendance (DB side) — season attendance per club off Fan Interest,
// ticket pricing and its season-ticket base, plus a live projection for each
// pricing tier so the GM can weigh revenue-per-seat against demand.

import { prisma } from "./prisma";
import { canManageTeam } from "./auth";
import { leagueFanInterest } from "./fan-interest-server";
import { arenaFor, seasonTickets } from "./season-tickets";
import { attendancePct, priceSensitivity, revenueLevel, PRICING_LABEL, type TicketPricing } from "./attendance";

export type TeamAttendance = {
  teamId: number; code: string | null; name: string;
  fanInterest: number; pricing: TicketPricing;
  capacity: number; avg: number; pct: number; prevPct: number; rank: number;
  sensitivity: "Low" | "Moderate" | "High"; revenue: "Low" | "Medium" | "High";
  projection: { pricing: TicketPricing; label: string; pct: number; revenue: "Low" | "Medium" | "High" }[];
};

const asPricing = (s: string | null | undefined): TicketPricing => (s === "LOW" || s === "PREMIUM" ? s : "STANDARD");

function sthFractionFor(interest: number, baseline: number, pricing: TicketPricing, arena: { capacity: number; sthCap: number }): { cur: number; prev: number } {
  const st = seasonTickets({ capacity: arena.capacity, sthCap: arena.sthCap, fanInterest: interest, baselineInterest: baseline, pricing });
  return { cur: st.sold / arena.capacity, prev: st.prevSold / arena.capacity };
}

/** Attendance for every NHL club, highest average first. */
export async function leagueAttendance(): Promise<TeamAttendance[]> {
  const fans = await leagueFanInterest();
  const teams = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, ticketPricing: true, capacity: true } });
  const byId = new Map(teams.map((t) => [t.id, t]));

  const rows = fans.map((f) => {
    const pricing = asPricing(byId.get(f.teamId)?.ticketPricing);
    const arena = arenaFor(byId.get(f.teamId)?.capacity ?? null);
    const sth = sthFractionFor(f.interest, f.baseline, pricing, arena);
    const pct = attendancePct({ fanInterest: f.interest, pricing, sthFraction: sth.cur });
    const prevPct = attendancePct({ fanInterest: f.baseline, pricing: "STANDARD", sthFraction: sth.prev });
    const projection = (["LOW", "STANDARD", "PREMIUM"] as TicketPricing[]).map((pr) => {
      const p = attendancePct({ fanInterest: f.interest, pricing: pr, sthFraction: sthFractionFor(f.interest, f.baseline, pr, arena).cur });
      return { pricing: pr, label: PRICING_LABEL[pr], pct: p, revenue: revenueLevel(p, pr) };
    });
    return {
      teamId: f.teamId, code: f.code, name: f.name, fanInterest: f.interest, pricing,
      capacity: arena.capacity, avg: Math.round(pct * arena.capacity), pct, prevPct, rank: 0,
      sensitivity: priceSensitivity(f.interest), revenue: revenueLevel(pct, pricing), projection,
    };
  });
  rows.sort((a, b) => b.pct - a.pct);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** Attendance for a single club. */
export async function teamAttendance(teamId: number): Promise<TeamAttendance | null> {
  const all = await leagueAttendance();
  return all.find((r) => r.teamId === teamId) ?? null;
}

/** GM sets the club's ticket-pricing tier. */
export async function setTicketPricingAction(teamId: number, pricing: TicketPricing): Promise<{ ok: boolean; error?: string }> {
  if (!(await canManageTeam(teamId))) return { ok: false, error: "You don't manage this team." };
  if (!["LOW", "STANDARD", "PREMIUM"].includes(pricing)) return { ok: false, error: "Bad pricing tier." };
  await prisma.team.update({ where: { id: teamId }, data: { ticketPricing: pricing } });
  return { ok: true };
}
