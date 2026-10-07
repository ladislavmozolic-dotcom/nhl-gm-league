import { PageHeader, Card, BackPill } from "@/components/ui";
import { getTeamSession, canManageTeam } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { teamDashboard } from "@/lib/detailed-finance-server";
import { teamAttendance } from "@/lib/attendance-server";
import { teamSponsor } from "@/lib/sponsorship-server";
import { computeStandings } from "@/lib/sim/standings";
import { getArenaSections, selloutRevenue, computeTeamFinance, projectedPointsPct, farmSalaryExpense, liveCapHit } from "@/lib/finance";
import { REGULAR_SEASON } from "@/lib/phase";
import PricingControl from "@/components/PricingControl";
import SponsorPicker from "@/components/SponsorPicker";
import FinanceNav from "@/components/FinanceNav";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

const M = (n: number) => `${n < 0 ? "-" : ""}$${(Math.abs(n) / 1e6).toFixed(1)}M`;
const N = (n: number) => n.toLocaleString("en-US");

export default async function FinanceDashboardPage() {
  const [settings, sessionId, lang] = await Promise.all([
    loadSettings(),
    getTeamSession(),
    getLang(),
  ]);

  const team = sessionId
    ? await prisma.team.findUnique({ where: { id: sessionId }, select: { id: true, slug: true, name: true, logoUrl: true } })
    : null;
  const dash = team ? await teamDashboard(team.id) : null;
  const canManage = team ? await canManageTeam(team.id) : false;
  const detailed = settings.financeMode === "detailed";
  const [att, sponsor] = team && canManage && detailed ? await Promise.all([teamAttendance(team.id), teamSponsor(team.id)]) : [null, null];

  let basic: { revenue: number; expenses: number; result: number } | null = null;
  if (dash && !detailed) {
    const [teamFin, standings, homeGames, totalGames] = await Promise.all([
      prisma.team.findUnique({
        where: { id: dash.teamId },
        select: {
          popularity: true,
          capacity: true,
          arenaSections: true,
          players: { where: { rosterType: "NHL" }, select: { capHit: true, retainedSalary: true, contractYears: true } },
          affiliateTeams: { select: { players: { where: { rosterType: "AHL" }, select: { capHit: true, ahlSalary: true, contractType: true, contractYears: true } } } },
        },
      }),
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
        salary:
          teamFin.players.reduce((s, p) => s + Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)), 0) +
          farmSalaryExpense(teamFin.affiliateTeams.flatMap((a) => a.players)),
        homeGamesPlayed: homeGames,
        totalGamesPlayed: totalGames,
        startingBank: settings.startingCapital,
      });
      basic = { revenue: fin.projectedIncome, expenses: fin.projectedExpenses, result: fin.projectedResult };
    }
  }

  const isSk = lang === "cs";

  if (!dash) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-4 px-3 sm:px-6">
        <PageHeader
          title={isSk ? "Klubový finančný pult" : "Finance Dashboard"}
          subtitle={isSk ? "Prehľad financií vášho klubu" : "Detailed franchise finance overview"}
        />
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-slate-400">
          <p className="text-sm">
            {isSk
              ? "Prihláste sa ako manažér NHL tímu pre zobrazenie finančného panelu vášho klubu."
              : "Sign in as an NHL club to see its finance dashboard."}
          </p>
        </div>
      </div>
    );
  }

  const tile = (label: string, value: string, sub?: string, accent?: string, icon?: string) => (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3.5 shadow-md backdrop-blur-sm relative overflow-hidden">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400 font-bold">
        <span>{label}</span>
        {icon && <span className="text-sm">{icon}</span>}
      </div>
      <div className={`text-xl font-black font-mono mt-1 ${accent ?? "text-white"}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-4 px-3 sm:px-6">
      <PageHeader
        title={`${dash.name} — ${isSk ? "Financie klubu" : "Franchise Finances"}`}
        subtitle={
          isSk
            ? detailed
              ? "Detailný finančný manažment — vstupenky, sponzoring, návštevnosť a merchandise"
              : "Základný finančný model — tržby zo vstupného mínus platy hráčov"
            : detailed
            ? "Detailed financial model — gate revenue, sponsorships, season tickets & merchandising"
            : "Basic financial model — home gate revenue minus player payroll"
        }
        right={team?.slug ? <BackPill href={`/teams/${team.slug}`}>{isSk ? "Menu tímu" : "Team menu"}</BackPill> : undefined}
      />

      <FinanceNav current="dashboard" lang={lang} />

      {/* Primary KPI HUD Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tile(isSk ? "Hotovosť v banke" : "Bank Balance", M(dash.cash), undefined, "text-amber-300", "💰")}
        {tile(
          isSk ? "Príjmy klubu" : "Projected Revenue",
          M(detailed ? dash.revenue : basic?.revenue ?? 0),
          detailed ? (isSk ? "Všetky zdroje" : "All revenue streams") : (isSk ? "Iba vstupné" : "Gate receipts"),
          "text-emerald-400",
          "▲"
        )}
        {tile(
          isSk ? "Výdavky klubu" : "Payroll Expenses",
          M(detailed ? dash.expenses : basic?.expenses ?? 0),
          isSk ? "Platy a prevádzka" : "Salaries & operations",
          "text-rose-300",
          "▼"
        )}
        {tile(
          isSk ? "Čistý zisk / strata" : "Projected Net Margin",
          M(detailed ? dash.profit : basic?.result ?? 0),
          undefined,
          (detailed ? dash.profit : basic?.result ?? 0) >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold",
          (detailed ? dash.profit : basic?.result ?? 0) >= 0 ? "📈" : "📉"
        )}
      </div>

      {!detailed && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400">
          <p>
            {isSk ? (
              <>
                <strong>Základný finančný model:</strong> tržby zo vstupného z domácich zápasov mínus platy hráčov.
                Zapnite <b>Detailné financie</b> v nastaveniach enginu pre kompletný ekonomický model (permanentky, sponzori, predaj dresov).
              </>
            ) : (
              <>
                <strong>Basic finance mode:</strong> gate revenue from home games minus player salaries. Turn on{" "}
                <b>Detailed Finance</b> in engine settings for the full fan-interest → demand → revenue model (season tickets, sponsorship, merchandise).
              </>
            )}
          </p>
        </div>
      )}

      {detailed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title={isSk ? "Rozpis príjmov" : "Revenue Breakdown"} accent="text-emerald-300">
            <div className="space-y-2 text-xs">
              {dash.revenueLines.map((l) => (
                <div key={l.label} className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">{l.label}</span>
                  <span className="font-mono font-semibold text-slate-200">{M(l.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 font-bold">
                <span className="text-white">{isSk ? "Celkové príjmy" : "Total Revenue"}</span>
                <span className="font-mono text-emerald-400 text-sm">{M(dash.revenue)}</span>
              </div>
            </div>
          </Card>

          <Card title={isSk ? "Rozpis výdavkov" : "Expense Breakdown"} accent="text-rose-300">
            <div className="space-y-2 text-xs">
              {dash.expenseLines.map((l) => (
                <div key={l.label} className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">{l.label}</span>
                  <span className="font-mono font-semibold text-slate-200">{M(l.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 font-bold">
                <span className="text-white">{isSk ? "Celkové výdavky" : "Total Expenses"}</span>
                <span className="font-mono text-rose-400 text-sm">{M(dash.expenses)}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {detailed && (
        <Card title={isSk ? "Fanúšikovia a komerčný rast" : "Fan Base & Brand Power"} accent="text-cyan-300">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tile(isSk ? "Záujem fanúšikov" : "Fan Interest", `${dash.fanInterest}`, `${dash.fanDelta >= 0 ? "↑" : "↓"}${Math.abs(dash.fanDelta)}`, "text-cyan-300", "🔥")}
            {tile(isSk ? "Priemerná návštevnosť" : "Avg Attendance", `${Math.round(dash.attendancePct * 100)}%`, `League #${dash.attendanceRank}`, "text-white", "🏟")}
            {tile(isSk ? "Permanentky" : "Season Tickets", N(dash.sthSold), `/ ${N(dash.sthCap)}`, "text-slate-200", "🎫")}
            {tile(isSk ? "Predaj dresov" : "Merchandise", `#${dash.merchRank}`, dash.topJersey ? `Top: ${dash.topJersey}` : undefined, "text-amber-300", "👕")}
          </div>
        </Card>
      )}

      {detailed && dash.reasons.length > 0 && (
        <Card title={isSk ? "Prečo sa financie vyvíjajú týmto smerom?" : "Key Financial Drivers"} accent="text-sky-300">
          <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
            {dash.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Interactive Controls */}
      {att && (
        <Card title={isSk ? "Cenotvorba vstupeniek" : "Ticket Pricing Strategy"} accent="text-sky-300">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr] gap-4 items-center">
            <div className="text-xs text-slate-400 leading-relaxed">
              {isSk
                ? "Nastavte ceny pre jednotlivé sektory arény. Vyššie ceny generujú viac peňazí na sedadlo, no môžu oslabiť dopyt fanúšikov a návštevnosť."
                : "Set seat prices across arena tiers. Higher pricing earns more revenue per seat but can soften spectator demand and arena attendance."}
            </div>
            <PricingControl att={att} />
          </div>
        </Card>
      )}

      {sponsor && (
        <Card title={isSk ? "Hlavný sponzor klubu" : "Primary Team Sponsor"} accent="text-emerald-300">
          <p className="text-xs text-slate-400 mb-3">
            {isSk
              ? "Vyberte si sponzorskú ponuku, ktorá vyhovuje vašim ligovým ambíciám. Výška ponuky závisí od sily značky a záujmu fanúšikov."
              : "Select a corporate sponsor deal matching your club ambitions. Offer payout scales with your market strength and Fan Interest."}
          </p>
          <SponsorPicker sponsor={sponsor} />
        </Card>
      )}
    </div>
  );
}
