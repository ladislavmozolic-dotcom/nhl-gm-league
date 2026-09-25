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
import {
  MEDIA_AND_LEAGUE_LABEL,
  REVENUE_SHARING_LABEL,
  clubRevenueLines,
  clubExpenseLines,
  revenueSharingTransfers,
  type FinanceLine,
} from "./club-finance";
import { farmSalaryExpense, liveCapHit } from "./finance";
import { REGULAR_SEASON } from "./phase";
import { playoffGameRevenue, playoffMerchBoost, sponsorBonusEarned, type SponsorOffer } from "./sponsorship";
import { loadFinanceTuning, recentTradeArrivals } from "./finance-tuning-server";
import { tradeJerseyBoost } from "./finance-tuning";

const asPricing = (s: string | null | undefined): TicketPricing => (s === "LOW" || s === "PREMIUM" ? s : "STANDARD");

export type DetailedClubFinance = {
  revenue: number;
  expenses: number;
  salary: number;
  net: number;
  revenueLines: FinanceLine[];
  expenseLines: FinanceLine[];
  playoff?: { capacity: number; attendancePct: number; deepestRound: number; homeGames: number; gate: number; merch: number; sponsorBonus: number };
};

/** Full-season detailed revenue & net income for every NHL club. The regular
 * business model is projected for a full season; playoff gates, merchandise and
 * sponsor bonuses are added as they are actually earned. Revenue sharing is
 * computed league-wide and is exactly zero-sum. */
export async function leagueDetailedFinance(season = REGULAR_SEASON): Promise<Map<number, DetailedClubFinance>> {
  const [fans, stars, teams, playoffSeries, playoffGames, tuning, arrivals] = await Promise.all([
    leagueFanInterest(),
    allStarPowers(),
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, ticketPricing: true, sponsorDeal: true, capacity: true, headCoach: { select: { salary: true } }, affiliateTeams: { select: { headCoach: { select: { salary: true } }, players: { where: { rosterType: "AHL" }, select: { capHit: true, ahlSalary: true, contractType: true, contractYears: true } } } }, players: { where: { rosterType: "NHL" }, select: { capHit: true, retainedSalary: true, contractYears: true } } } }),
    prisma.playoffSeries.findMany({ where: { season, league: "NHL" }, select: { round: true, highSeedTeamId: true, lowSeedTeamId: true, winnerTeamId: true } }),
    prisma.game.findMany({ where: { season, league: "NHL", status: "FINAL", seriesId: { not: null } }, select: { homeTeamId: true, round: true } }),
    loadFinanceTuning(),
    recentTradeArrivals(),
  ]);
  const jerseyByTeam = new Map<number, number>();
  for (const s of stars) if (s.teamId != null) jerseyByTeam.set(s.teamId, (jerseyByTeam.get(s.teamId) ?? 0) + jerseyUnits(s.score, tradeJerseyBoost(arrivals.get(s.playerId), tuning), tuning));
  const fanById = new Map(fans.map((f) => [f.teamId, f]));

  const deepestRound = new Map<number, number>();
  for (const series of playoffSeries) {
    for (const teamId of [series.highSeedTeamId, series.lowSeedTeamId])
      deepestRound.set(teamId, Math.max(deepestRound.get(teamId) ?? 0, series.round));
  }
  const championId = playoffSeries.find((s) => s.round === 4 && s.winnerTeamId)?.winnerTeamId ?? null;

  type Working = DetailedClubFinance & {
    teamId: number;
    capacity: number;
    attendancePct: number;
    localRevenue: number;
    merchTotal: number;
    deal: SponsorOffer | null;
  };
  const working: Working[] = [];
  for (const t of teams) {
    const f = fanById.get(t.id);
    if (!f) continue;
    const pricing = asPricing(t.ticketPricing);
    const arena = arenaFor(t.capacity);
    const st = seasonTickets({ capacity: arena.capacity, sthCap: arena.sthCap, fanInterest: f.interest, baselineInterest: f.baseline, pricing });
    const attPct = attendancePct({ fanInterest: f.interest, pricing, sthFraction: st.sold / arena.capacity });
    const avg = Math.round(attPct * arena.capacity);
    const merch = teamMerch({ jerseyUnitsTotal: jerseyByTeam.get(t.id) ?? 0, fanInterest: f.interest, baselineInterest: f.baseline }, tuning);
    const deal = t.sponsorDeal as SponsorOffer | null;
    const revenueLines = clubRevenueLines({ pricing, sthSold: st.sold, avgAttendance: avg, fanInterest: f.interest, merchTotal: merch.total, sponsorAav: deal?.aav ?? 0 });
    const localRevenue = revenueLines.filter((line) => line.label !== MEDIA_AND_LEAGUE_LABEL).reduce((sum, line) => sum + line.amount, 0);
    // real dollars this club owes — a retained acquisition only costs it the
    // post-retention share; the retaining club carries the rest.
    const salary = t.players.reduce((s, p) => s + Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)), 0);
    const coachSalary = (t.headCoach?.salary ?? 0) + t.affiliateTeams.reduce((s, a) => s + (a.headCoach?.salary ?? 0), 0);
    const ahlSalary = farmSalaryExpense(t.affiliateTeams.flatMap((a) => a.players));
    const expenseLines = clubExpenseLines(salary, coachSalary, ahlSalary);
    const expenses = expenseLines.reduce((sum, line) => sum + line.amount, 0);
    working.push({
      teamId: t.id, capacity: arena.capacity, attendancePct: attPct, localRevenue, merchTotal: merch.total, deal,
      revenue: 0, expenses, salary, net: 0, revenueLines, expenseLines,
    });
  }

  const sharing = revenueSharingTransfers(working.map((w) => ({ teamId: w.teamId, localRevenue: w.localRevenue })));
  const playoffGateByTeam = new Map<number, number>();
  const playoffHomeGames = new Map<number, number>();
  for (const game of playoffGames) {
    const club = working.find((w) => w.teamId === game.homeTeamId);
    if (!club) continue;
    const gate = playoffGameRevenue(game.round ?? 1, club.attendancePct, club.capacity, tuning);
    playoffGateByTeam.set(club.teamId, (playoffGateByTeam.get(club.teamId) ?? 0) + gate);
    playoffHomeGames.set(club.teamId, (playoffHomeGames.get(club.teamId) ?? 0) + 1);
  }

  const out = new Map<number, DetailedClubFinance>();
  for (const club of working) {
    const round = deepestRound.get(club.teamId) ?? 0;
    const playoffGate = playoffGateByTeam.get(club.teamId) ?? 0;
    const playoffMerch = round > 0 ? Math.round(club.merchTotal * (playoffMerchBoost(round, tuning) - 1)) : 0;
    const sponsorBonus = sponsorBonusEarned(club.deal, {
      madePlayoffs: round >= 1,
      reachedConferenceFinal: round >= 3,
      wonChampionship: championId === club.teamId,
    });
    const revenueLines = [
      ...club.revenueLines,
      { label: REVENUE_SHARING_LABEL, amount: sharing.get(club.teamId) ?? 0 },
      ...(playoffGate > 0 ? [{ label: "Playoff gates", amount: playoffGate }] : []),
      ...(playoffMerch > 0 ? [{ label: "Playoff merchandise", amount: playoffMerch }] : []),
      ...(sponsorBonus > 0 ? [{ label: "Sponsor performance bonuses", amount: sponsorBonus }] : []),
    ];
    const revenue = revenueLines.reduce((sum, line) => sum + line.amount, 0);
    out.set(club.teamId, {
      revenue, expenses: club.expenses, salary: club.salary, net: revenue - club.expenses, revenueLines, expenseLines: club.expenseLines,
      playoff: { capacity: club.capacity, attendancePct: club.attendancePct, deepestRound: round, homeGames: playoffHomeGames.get(club.teamId) ?? 0, gate: playoffGate, merch: playoffMerch, sponsorBonus },
    });
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

export async function teamDashboard(teamId: number, season = REGULAR_SEASON): Promise<TeamDashboard | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, league: true, isAffiliate: true, bankAccount: true } });
  if (!team || team.league !== "NHL" || team.isAffiliate) return null;

  const [fan, st, att, merch, sponsor, merchBoard, leagueFinance] = await Promise.all([
    teamFanInterest(teamId), teamSeasonTickets(teamId), teamAttendance(teamId), teamMerchandise(teamId), teamSponsor(teamId), leagueMerch(),
    leagueDetailedFinance(season),
  ]);
  const finance = leagueFinance.get(teamId);
  if (!finance) return null;
  const sold = st?.sold ?? 0;

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
  const sharing = finance.revenueLines.find((line) => line.label === REVENUE_SHARING_LABEL)?.amount ?? 0;
  if (sharing > 0) reasons.push(`Revenue sharing adds $${(sharing / 1_000_000).toFixed(1)}M from the league pool.`);

  return {
    teamId, name: team.name,
    cash: Math.round(team.bankAccount ?? 0), revenue: finance.revenue, expenses: finance.expenses, profit: finance.net,
    revenueLines: finance.revenueLines, expenseLines: finance.expenseLines,
    fanInterest: fan?.interest ?? 0, fanDelta: fan?.delta ?? 0,
    attendancePct: att?.pct ?? 0, attendanceRank: att?.rank ?? 0,
    sthSold: sold, sthCap: st?.sthCap ?? 0, merchRank, topJersey: merch?.topJersey ?? null,
    reasons: reasons.slice(0, 4),
  };
}
