"use server";

// Finance Dashboard (Detailed) — folds Fan Interest, Season Tickets, Attendance,
// Merchandise and Sponsorship into one club P&L with plain-English reasons.

import { prisma } from "./prisma";
import { teamFanInterest } from "./fan-interest-server";
import { teamSeasonTickets } from "./season-tickets-server";
import { teamAttendance } from "./attendance-server";
import { teamMerchandise, leagueMerch } from "./merchandise-server";
import { teamSponsor } from "./sponsorship-server";

const HOME_GAMES = 41;
const SEASON_PRICE: Record<string, number> = { LOW: 2200, STANDARD: 2800, PREMIUM: 3600 };
const SINGLE_PRICE: Record<string, number> = { LOW: 55, STANDARD: 75, PREMIUM: 95 };
const LEAGUE_REVENUE = 17_000_000;
const OVERHEAD = 30_000_000; // arena ops, staff, travel, etc.

export type FinanceLine = { label: string; amount: number };
export type TeamDashboard = {
  teamId: number; name: string;
  cash: number; revenue: number; expenses: number; profit: number;
  revenueLines: FinanceLine[];
  fanInterest: number; fanDelta: number; attendancePct: number; attendanceRank: number;
  sthSold: number; sthCap: number; merchRank: number; topJersey: string | null;
  reasons: string[];
};

export async function teamDashboard(teamId: number): Promise<TeamDashboard | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, league: true, isAffiliate: true, bankAccount: true, ticketPricing: true } });
  if (!team || team.league !== "NHL" || team.isAffiliate) return null;

  const [fan, st, att, merch, sponsor, merchBoard, roster] = await Promise.all([
    teamFanInterest(teamId), teamSeasonTickets(teamId), teamAttendance(teamId), teamMerchandise(teamId), teamSponsor(teamId), leagueMerch(),
    prisma.player.findMany({ where: { teamId, rosterType: "NHL" }, select: { capHit: true } }),
  ]);

  const pricing = team.ticketPricing ?? "STANDARD";
  const sold = st?.sold ?? 0;
  const avg = att?.avg ?? 0;

  const seasonTicketRev = sold * (SEASON_PRICE[pricing] ?? 2800);
  const gateRev = Math.max(0, avg - sold) * (SINGLE_PRICE[pricing] ?? 75) * HOME_GAMES;
  const merchRev = merch?.total ?? 0;
  const sponsorRev = sponsor?.deal?.aav ?? 0;

  const revenueLines: FinanceLine[] = [
    { label: "Season tickets", amount: seasonTicketRev },
    { label: "Gate (single-game)", amount: gateRev },
    { label: "Merchandise", amount: merchRev },
    { label: "Sponsorship", amount: sponsorRev },
    { label: "League revenue", amount: LEAGUE_REVENUE },
  ];
  const revenue = revenueLines.reduce((t, l) => t + l.amount, 0);
  const salary = roster.reduce((t, p) => t + (p.capHit ?? 0), 0);
  const expenses = salary + OVERHEAD;
  const profit = revenue - expenses;

  const merchRank = merchBoard.findIndex((m) => m.teamId === teamId) + 1;

  // "why are finances improving/declining?" — the biggest movers
  const reasons: string[] = [];
  if (fan) {
    if (fan.delta >= 3) reasons.push(`Fan Interest up ${fan.delta} — ${fan.reasons[0]?.toLowerCase() ?? "strong season"}.`);
    else if (fan.delta <= -3) reasons.push(`Fan Interest down ${Math.abs(fan.delta)} — ${fan.reasons[0]?.toLowerCase() ?? "underperforming"}.`);
  }
  if (st && st.changePct >= 2) reasons.push(`Season-ticket demand up ${st.changePct.toFixed(1)}%.`);
  else if (st && st.changePct <= -2) reasons.push(`Season-ticket demand down ${Math.abs(st.changePct).toFixed(1)}%.`);
  if (att && att.pct > att.prevPct + 0.01) reasons.push(`Average attendance up to ${Math.round(att.pct * 100)}% (from ${Math.round(att.prevPct * 100)}%).`);
  if (merch && merch.changePct >= 5) reasons.push(`Merchandise revenue up ${merch.changePct.toFixed(0)}%${merch.topJersey ? ` — ${merch.topJersey} jerseys selling` : ""}.`);
  if (!sponsor?.deal) reasons.push("No sponsor signed yet — lock one in for guaranteed revenue.");

  return {
    teamId, name: team.name,
    cash: Math.round(team.bankAccount ?? 0), revenue, expenses, profit, revenueLines,
    fanInterest: fan?.interest ?? 0, fanDelta: fan?.delta ?? 0,
    attendancePct: att?.pct ?? 0, attendanceRank: att?.rank ?? 0,
    sthSold: sold, sthCap: st?.sthCap ?? 0, merchRank, topJersey: merch?.topJersey ?? null,
    reasons: reasons.slice(0, 4),
  };
}
