import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { computeStandings } from "@/lib/sim/standings";
import { getArenaSections, selloutRevenue, computeTeamFinance, projectedPointsPct, farmSalaryExpense, liveCapHit, money } from "@/lib/finance";
import FinanceTable, { type FinanceRow } from "@/components/FinanceTable";
import { PageHeader } from "@/components/ui";
import FinanceNav from "@/components/FinanceNav";
import { leagueDetailedFinance } from "@/lib/detailed-finance-server";
import { getLang } from "@/lib/lang-server";
import { bankBalance } from "@/lib/league-bank-server";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function FinancePage() {
  const [teams, settings, standings, homeCounts, lang, bankBal, fineCount] = await Promise.all([
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: {
        id: true, name: true, slug: true, logoUrl: true, code: true, division: true, conference: true, popularity: true,
        capacity: true, arenaSections: true, bankAccount: true, ledgerAdj: true, seasonOpeningBank: true,
        players: { where: { rosterType: "NHL" }, select: { capHit: true, retainedSalary: true, contractYears: true } },
        affiliateTeams: { select: { players: { where: { rosterType: "AHL" }, select: { capHit: true, ahlSalary: true, contractType: true, contractYears: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    loadSettings(),
    computeStandings(SEASON, "NHL"),
    prisma.game.groupBy({
      by: ["homeTeamId"],
      where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null },
      _count: { _all: true },
    }),
    getLang(),
    bankBalance(),
    prisma.leagueBankEntry.count(),
  ]);

  const stById = new Map(standings.map((s) => [s.teamId, s]));
  const homeById = new Map(homeCounts.map((h) => [h.homeTeamId, h._count._all]));
  const detailed = settings.financeMode === "detailed" ? await leagueDetailedFinance(SEASON) : null;

  const rows: FinanceRow[] = teams.map((t) => {
    const st = stById.get(t.id);
    const df = detailed?.get(t.id);
    if (df) {
      const progress = Math.min(1, (st?.gp ?? 0) / 82);
      const openingBank = t.seasonOpeningBank ?? settings.startingCapital;
      const ledger = t.ledgerAdj ?? 0;
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        logoUrl: t.logoUrl,
        code: t.code,
        division: t.division,
        conference: t.conference,
        popularity: t.popularity,
        actualIncome: Math.round(df.revenue * progress),
        projectedIncome: df.revenue,
        actualExpenses: Math.round(df.expenses * progress),
        projectedExpenses: df.expenses,
        projectedResult: df.net,
        bankAccount: t.bankAccount ?? openingBank,
        projectedBankAccount: openingBank + df.net + ledger,
      };
    }

    const startBank = settings.startingCapital;
    const ledger = t.ledgerAdj ?? 0;
    const fin = computeTeamFinance({
      popularity: t.popularity,
      pointsPct: projectedPointsPct(st),
      selloutRevenue: selloutRevenue(getArenaSections(t)),
      salary:
        t.players.reduce((s, p) => s + Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)), 0) +
        farmSalaryExpense(t.affiliateTeams.flatMap((a) => a.players)),
      homeGamesPlayed: homeById.get(t.id) ?? 0,
      totalGamesPlayed: st?.gp ?? 0,
      startingBank: startBank,
    });

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      logoUrl: t.logoUrl,
      code: t.code,
      division: t.division,
      conference: t.conference,
      popularity: fin.popularity,
      actualIncome: fin.actualIncome,
      projectedIncome: fin.projectedIncome,
      actualExpenses: fin.actualExpenses,
      projectedExpenses: fin.projectedExpenses,
      projectedResult: fin.projectedResult,
      bankAccount: fin.bankAccount + ledger,
      projectedBankAccount: fin.projectedBankAccount + ledger,
    };
  });

  const isSk = lang === "cs";

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-2 px-3 sm:px-6">
      <PageHeader
        title={isSk ? `Financie ligy — ${SEASON}` : `League Finance — ${SEASON}`}
        subtitle={
          isSk
            ? `Platový strop ${money(settings.salaryCapUpper)} · Platová podlaha ${money(settings.salaryCapLower)} · Prehľad príjmov a nákladov klubov`
            : `Salary Cap ${money(settings.salaryCapUpper)} · Floor ${money(settings.salaryCapLower)} · Franchise revenue and expense ledger`
        }
      />
      <FinanceNav current="league" lang={lang} />

      {/* League Bank & Fines/Rewards Highlight Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-950 border border-slate-800 shadow-md backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-lg shrink-0">
            ⚖️
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>{isSk ? "Ligová pokladňa, odmeny a sankcie" : "League Bank, Rewards & Penalties"}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                {money(bankBal)}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {isSk
                ? `${fineCount} zaznamenaných operácií (pokuty za súpisky, platový strop a odmeny).`
                : `${fineCount} recorded movements (roster fines, cap penalties and rewards).`}
            </div>
          </div>
        </div>
        <Link
          href="/finance/fines-rewards"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all shadow-sm shrink-0"
        >
          <span>{isSk ? "Prezrieť odmeny & pokuty →" : "View Fines & Rewards →"}</span>
        </Link>
      </div>

      <FinanceTable rows={rows} lang={lang} />
    </div>
  );
}
