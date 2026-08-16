"use server";

// Dynamic Attendance (DB side) — season attendance per club off Fan Interest,
// ticket pricing and its season-ticket base, plus a live projection for each
// pricing tier so the GM can weigh revenue-per-seat against demand.

import { prisma } from "./prisma";
import { canManageTeam } from "./auth";
import { leagueFanInterest } from "./fan-interest-server";
import { DEFAULT_ARENA_CAPACITY, DEFAULT_STH_CAP, seasonTickets } from "./season-tickets";
import { attendancePct, priceSensitivity, revenueLevel, PRICING_LABEL, type TicketPricing } from "./attendance";

const CAP = DEFAULT_ARENA_CAPACITY;

export type TeamAttendance = {
  teamId: number; code: string | null; name: string;
  fanInterest: number; pricing: TicketPricing;
  capacity: number; avg: number; pct: number; prevPct: number; rank: number;
  sensitivity: "Low" | "Moderate" | "High"; revenue: "Low" | "Medium" | "High";
  projection: { pricing: TicketPricing; label: string; pct: number; revenue: "Low" | "Medium" | "High" }[];
};

const asPricing = (s: string | null | undefined): TicketPricing => (s === "LOW" || s === "PREMIUM" ? s : "STANDARD");

function sthFractionFor(interest: number, baseline: number, pricing: TicketPricing): { cur: number; prev: number } {
  const st = seasonTickets({ capacity: CAP, sthCap: DEFAULT_STH_CAP, fanInterest: interest, baselineInterest: baseline, pricing });
  return { cur: st.sold / CAP, prev: st.prevSold / CAP };
}

/** Attendance for every NHL club, highest average first. */
export async function leagueAttendance(): Promise<TeamAttendance[]> {
  const fans = await leagueFanInterest();
  const teams = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, ticketPricing: true } });
  const priceById = new Map(teams.map((t) => [t.id, asPricing(t.ticketPricing)]));

  const rows = fans.map((f) => {
    const pricing = priceById.get(f.teamId) ?? "STANDARD";
    const sth = sthFractionFor(f.interest, f.baseline, pricing);
    const pct = attendancePct({ fanInterest: f.interest, pricing, sthFraction: sth.cur });
    const prevPct = attendancePct({ fanInterest: f.baseline, pricing: "STANDARD", sthFraction: sth.prev });
    const projection = (["LOW", "STANDARD", "PREMIUM"] as TicketPricing[]).map((pr) => {
      const p = attendancePct({ fanInterest: f.interest, pricing: pr, sthFraction: sthFractionFor(f.interest, f.baseline, pr).cur });
      return { pricing: pr, label: PRICING_LABEL[pr], pct: p, revenue: revenueLevel(p, pr) };
    });
    return {
      teamId: f.teamId, code: f.code, name: f.name, fanInterest: f.interest, pricing,
      capacity: CAP, avg: Math.round(pct * CAP), pct, prevPct, rank: 0,
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
