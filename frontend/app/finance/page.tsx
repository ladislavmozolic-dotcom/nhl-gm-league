import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { computeStandings } from "@/lib/sim/standings";
import { getArenaSections, selloutRevenue, computeTeamFinance, projectedPointsPct, farmSalaryExpense, money } from "@/lib/finance";
import FinanceTable, { type FinanceRow } from "@/components/FinanceTable";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function FinancePage() {
  const [teams, settings, standings, homeCounts] = await Promise.all([
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: {
        id: true, name: true, slug: true, logoUrl: true, popularity: true,
        capacity: true, arenaSections: true, ledgerAdj: true,
        players: { where: { rosterType: "NHL" }, select: { capHit: true, retainedSalary: true } },
        affiliateTeams: { select: { players: { where: { rosterType: "AHL" }, select: { capHit: true } } } },
      },
    }),
    loadSettings(),
    computeStandings(SEASON, "NHL"),
    prisma.game.groupBy({
      by: ["homeTeamId"],
      where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null },
      _count: { _all: true },
    }),
  ]);
  const stById = new Map(standings.map((s) => [s.teamId, s]));
  const homeById = new Map(homeCounts.map((h) => [h.homeTeamId, h._count._all]));

  const rows: FinanceRow[] = teams.map((t) => {
    const st = stById.get(t.id);
    // the league's actual configured starting capital — matches what processFinances
    // (the function that sets the real team.bankAccount) uses, not the legacy
    // realMode/profinhlBank fallback this used to read, which could disagree with it.
    const startBank = settings.startingCapital;
    const ledger = t.ledgerAdj ?? 0; // GM cash moves (trades/buyouts/fines) on top of ticket/salary
    const fin = computeTeamFinance({
      popularity: t.popularity,
      pointsPct: projectedPointsPct(st),
      selloutRevenue: selloutRevenue(getArenaSections(t)),
      salary: t.players.reduce((s, p) => s + Math.max(0, (p.capHit ?? 0) - (p.retainedSalary ?? 0)), 0)
        + farmSalaryExpense(t.affiliateTeams.flatMap((a) => a.players)),
      homeGamesPlayed: homeById.get(t.id) ?? 0,
      totalGamesPlayed: st?.gp ?? 0,
      startingBank: startBank,
    });
    return {
      id: t.id, name: t.name, slug: t.slug, logoUrl: t.logoUrl,
      popularity: fin.popularity,
      actualIncome: fin.actualIncome, projectedIncome: fin.projectedIncome,
      actualExpenses: fin.actualExpenses, projectedExpenses: fin.projectedExpenses,
      projectedResult: fin.projectedResult,
      bankAccount: fin.bankAccount + ledger, projectedBankAccount: fin.projectedBankAccount + ledger,
    };
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={`${SEASON} Finance`}
        subtitle={`Salary cap ${money(settings.salaryCapUpper)} · floor ${money(settings.salaryCapLower)} · click a column to sort`}
      />
      <FinanceTable rows={rows} />
    </div>
  );
}
