import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { getTeamSession, canManageTeam } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { teamDashboard } from "@/lib/detailed-finance-server";
import { teamAttendance } from "@/lib/attendance-server";
import { teamSponsor } from "@/lib/sponsorship-server";
import { computeStandings } from "@/lib/sim/standings";
import { getArenaSections, selloutRevenue, computeTeamFinance, projectedPointsPct } from "@/lib/finance";
import { REGULAR_SEASON } from "@/lib/phase";
import PricingControl from "@/components/PricingControl";
import SponsorPicker from "@/components/SponsorPicker";

export const dynamic = "force-dynamic";

const M = (n: number) => `${n < 0 ? "-" : ""}$${(Math.abs(n) / 1e6).toFixed(1)}M`;
const N = (n: number) => n.toLocaleString("en-US");

export default async function FinanceDashboardPage() {
  const settings = await loadSettings();
  const sessionId = await getTeamSession();
  const team = sessionId ? await prisma.team.findUnique({ where: { id: sessionId }, select: { id: true, slug: true } }) : null;
  const dash = team ? await teamDashboard(team.id) : null;
  const canManage = team ? await canManageTeam(team.id) : false;
  const detailed = settings.financeMode === "detailed";
  const [att, sponsor] = team && canManage && detailed ? await Promise.all([teamAttendance(team.id), teamSponsor(team.id)]) : [null, null];

  // Basic mode: the actual bank-driving model is just gate revenue (home games,
  // scaled by attendance) minus salaries — the same calc used by /finance and
  // processFinances. No sense showing the hypothetical fan-interest/sponsorship/
  // merch breakdown when that system isn't the one moving the club's real cash.
  let basic: { revenue: number; expenses: number; result: number } | null = null;
  if (dash && !detailed) {
    const [teamFin, standings, homeGames, totalGames] = await Promise.all([
      prisma.team.findUnique({ where: { id: dash.teamId }, select: { popularity: true, capacity: true, arenaSections: true, players: { where: { rosterType: "NHL" }, select: { capHit: true } } } }),
      computeStandings(REGULAR_SEASON, "NHL"),
      prisma.game.count({ where: { season: REGULAR_SEASON, league: "NHL", status: "FINAL", seriesId: null, homeTeamId: dash.teamId } }),
      prisma.game.count({ where: { season: REGULAR_SEASON, league: "NHL", status: "FINAL", seriesId: null, OR: [{ homeTeamId: dash.teamId }, { awayTeamId: dash.teamId }] } }),
    ]);
    if (teamFin) {
      const st = standings.find((s) => s.teamId === dash.teamId);
      const fin = computeTeamFinance({
        popularity: teamFin.popularity,
        pointsPct: projectedPointsPct(st),
        selloutRevenue: selloutRevenue(getArenaSections(teamFin)),
        salary: teamFin.players.reduce((s, p) => s + (p.capHit ?? 0), 0),
        homeGamesPlayed: homeGames,
        totalGamesPlayed: totalGames,
        startingBank: settings.startingCapital,
      });
      basic = { revenue: fin.projectedIncome, expenses: fin.projectedExpenses, result: fin.projectedResult };
    }
  }

  if (!dash) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <PageHeader title="Finance Dashboard" subtitle="Detailed Finance" />
        <Card><p className="text-sm text-slate-400">Sign in as an NHL club to see its finance dashboard.</p></Card>
      </div>
    );
  }

  const tile = (label: string, value: string, sub?: string, accent?: string) => (
    <div className="rounded-lg bg-slate-800/40 border border-slate-700 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-lg font-black tabular-nums ${accent ?? ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title={`${dash.name} — Finances`} subtitle={detailed ? "Detailed Finance dashboard" : "Finances"} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tile("Cash", M(dash.cash))}
        {tile(detailed ? "Revenue" : "Revenue (gate)", M(detailed ? dash.revenue : basic?.revenue ?? 0))}
        {tile(detailed ? "Expenses" : "Expenses (salaries)", M(detailed ? dash.expenses : basic?.expenses ?? 0))}
        {tile("Projected profit", M(detailed ? dash.profit : basic?.result ?? 0), undefined, (detailed ? dash.profit : basic?.result ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300")}
      </div>

      {!detailed && (
        <Card><p className="text-sm text-slate-400">Basic finance: gate revenue from home games minus player salaries. Turn on <b>Detailed Finance</b> in engine settings for the full fan-interest → demand → revenue model (season tickets, sponsorship, merchandise breakdowns).</p></Card>
      )}

      {detailed && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card title="Revenue breakdown" accent="text-emerald-300">
          <div className="space-y-1.5">
            {dash.revenueLines.map((l) => (
              <div key={l.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{l.label}</span>
                <span className="tabular-nums font-semibold">{M(l.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm border-t border-slate-800 pt-1.5 mt-1.5">
              <span className="font-semibold">Total revenue</span><span className="tabular-nums font-bold text-emerald-300">{M(dash.revenue)}</span>
            </div>
          </div>
        </Card>

        <Card title="Expenses breakdown" accent="text-rose-300">
          <div className="space-y-1.5">
            {dash.expenseLines.map((l) => (
              <div key={l.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{l.label}</span>
                <span className="tabular-nums font-semibold">{M(l.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm border-t border-slate-800 pt-1.5 mt-1.5">
              <span className="font-semibold">Total expenses</span><span className="tabular-nums font-bold text-rose-300">{M(dash.expenses)}</span>
            </div>
          </div>
        </Card>
      </div>
      )}

      {detailed && (
      <Card title="Fan & business" accent="text-fuchsia-300">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tile("Fan Interest", `${dash.fanInterest}`, `${dash.fanDelta >= 0 ? "↑" : "↓"}${Math.abs(dash.fanDelta)}`)}
          {tile("Avg attendance", `${Math.round(dash.attendancePct * 100)}%`, `League #${dash.attendanceRank}`)}
          {tile("Season tickets", N(dash.sthSold), `/ ${N(dash.sthCap)}`)}
          {tile("Merch", `#${dash.merchRank}`, dash.topJersey ? `Top: ${dash.topJersey}` : undefined)}
        </div>
      </Card>
      )}

      {detailed && dash.reasons.length > 0 && (
        <Card title="Why are finances moving?" accent="text-sky-300">
          <ul className="text-sm text-slate-300 space-y-1">
            {dash.reasons.map((r, i) => <li key={i}>· {r}</li>)}
          </ul>
        </Card>
      )}

      {/* Team controls — set as your club */}
      {att && (
        <Card title="Ticket pricing" accent="text-sky-300">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-4 items-center">
            <div className="text-[13px] text-slate-400">Set what you charge — higher price earns more per seat but softens demand. Feeds attendance, season tickets and revenue.</div>
            <PricingControl att={att} />
          </div>
        </Card>
      )}
      {sponsor && (
        <Card title="Main sponsor" accent="text-emerald-300">
          <p className="text-[13px] text-slate-400 mb-3">Pick the deal that fits your ambitions — offer size scales with your brand strength (Fan Interest + Star Power).</p>
          <SponsorPicker sponsor={sponsor} />
        </Card>
      )}

      <div className="flex flex-wrap gap-2 text-xs pt-1">
        <span className="text-slate-500 py-1.5">League tables:</span>
        {[["Fan Interest", "/finance/fan-interest"], ["Season Tickets", "/finance/season-tickets"], ["Attendance", "/finance/attendance"], ["Merchandise", "/finance/merchandise"], ["Sponsorship", "/finance/sponsorship"]].map(([l, h]) => (
          <Link key={h} href={h} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">{l} →</Link>
        ))}
      </div>
    </div>
  );
}
