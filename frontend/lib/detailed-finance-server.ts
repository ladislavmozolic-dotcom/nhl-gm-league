"use server";

// Finance Dashboard (Detailed) — folds Fan Interest, Season Tickets, Attendance,
// Merchandise and Sponsorship into one club P&L with plain-English reasons.

import { prisma } from "./prisma";
import { teamFanInterest, leagueFanInterest } from "./fan-interest-server";
import { teamSeasonTickets } from "./season-tickets-server";
import { teamAttendance } from "./attendance-server";
import { teamMerchandise, leagueMerch } from "./merchandise-server";
import { teamSponsor } from "./sponsorship-server";
import { allStarPowers } from "./star-power-server";
import { seasonTickets, arenaFor, type TicketPricing } from "./season-tickets";
import { attendancePct } from "./attendance";
import { teamMerch, jerseyUnits } from "./merchandise";
import { clubRevenueLines, clubRevenueTotal, clubOverhead, clubExpenseLines, type FinanceLine } from "./club-finance";

const asPricing = (s: string | null | undefined): TicketPricing => (s === "LOW" || s === "PREMIUM" ? s : "STANDARD");

/** Full-season detailed revenue & net income for EVERY NHL club, in a single pass
 *  (one Fan-Interest + one Star-Power computation, shared). Used by processFinances
 *  to drive the bank in detailed mode. Returns per-team season totals (not pro-rated). */
export async function leagueDetailedFinance(): Promise<Map<number, { revenue: number; salary: number; net: number }>> {
  const [fans, stars, teams] = await Promise.all([
    leagueFanInterest(),
    allStarPowers(),
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, ticketPricing: true, sponsorDeal: true, capacity: true, players: { where: { rosterType: "NHL" }, select: { capHit: true } } } }),
  ]);
  const jerseyByTeam = new Map<number, number>();
  for (const s of stars) if (s.teamId != null) jerseyByTeam.set(s.teamId, (jerseyByTeam.get(s.teamId) ?? 0) + jerseyUnits(s.score));
  const fanById = new Map(fans.map((f) => [f.teamId, f]));

  const out = new Map<number, { revenue: number; salary: number; net: number }>();
  for (const t of teams) {
    const f = fanById.get(t.id);
    if (!f) continue;
    const pricing = asPricing(t.ticketPricing);
    const arena = arenaFor(t.capacity);
    const st = seasonTickets({ capacity: arena.capacity, sthCap: arena.sthCap, fanInterest: f.interest, baselineInterest: f.baseline, pricing });
    const avg = Math.round(attendancePct({ fanInterest: f.interest, pricing, sthFraction: st.sold / arena.capacity }) * arena.capacity);
    const merch = teamMerch({ jerseyUnitsTotal: jerseyByTeam.get(t.id) ?? 0, fanInterest: f.interest, baselineInterest: f.baseline });
    const deal = t.sponsorDeal as { aav?: number } | null;
    const revenue = clubRevenueTotal({ pricing, sthSold: st.sold, avgAttendance: avg, fanInterest: f.interest, merchTotal: merch.total, sponsorAav: deal?.aav ?? 0 });
    const salary = t.players.reduce((s, p) => s + (p.capHit ?? 0), 0);
    out.set(t.id, { revenue, salary, net: revenue - salary - clubOverhead() });
  }
  return out;
}

export type TeamDashboard = {
  teamId: number; name: string;
  cash: number; revenue: number; expenses: number; profit: number;
  revenueLines: FinanceLine[]; expenseLines: FinanceLine[];
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

  const pricing = asPricing(team.ticketPricing);
  const sold = st?.sold ?? 0;
  const avg = att?.avg ?? 0;

  const revenueLines: FinanceLine[] = clubRevenueLines({
    pricing, sthSold: sold, avgAttendance: avg,
    fanInterest: fan?.interest ?? 0, merchTotal: merch?.total ?? 0, sponsorAav: sponsor?.deal?.aav ?? 0,
  });
  const revenue = revenueLines.reduce((t, l) => t + l.amount, 0);
  const salary = roster.reduce((t, p) => t + (p.capHit ?? 0), 0);
  const expenseLines = clubExpenseLines(salary);
  const expenses = expenseLines.reduce((t, l) => t + l.amount, 0);
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
    cash: Math.round(team.bankAccount ?? 0), revenue, expenses, profit, revenueLines, expenseLines,
    fanInterest: fan?.interest ?? 0, fanDelta: fan?.delta ?? 0,
    attendancePct: att?.pct ?? 0, attendanceRank: att?.rank ?? 0,
    sthSold: sold, sthCap: st?.sthCap ?? 0, merchRank, topJersey: merch?.topJersey ?? null,
    reasons: reasons.slice(0, 4),
  };
}
