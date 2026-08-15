import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { computeStandings } from "@/lib/sim/standings";
import { getArenaSections, selloutRevenue, computeTeamFinance, money, STARTING_BANK } from "@/lib/finance";
import FinanceTable, { type FinanceRow } from "@/components/FinanceTable";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function FinancePage() {
  const [teams, settings, standings, homeCounts, cfg] = await Promise.all([
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: {
        id: true, name: true, slug: true, logoUrl: true, popularity: true,
        capacity: true, arenaSections: true, profinhlBank: true, ledgerAdj: true,
        players: { where: { rosterType: "NHL" }, select: { capHit: true } },
      },
    }),
    loadSettings(),
    computeStandings(SEASON, "NHL"),
    prisma.game.groupBy({
      by: ["homeTeamId"],
      where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null },
      _count: { _all: true },
    }),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } }),
  ]);
  const stById = new Map(standings.map((s) => [s.teamId, s]));
  const realMode = cfg?.rosterMode === "real";
  const homeById = new Map(homeCounts.map((h) => [h.homeTeamId, h._count._all]));

  const rows: FinanceRow[] = teams.map((t) => {
    const st = stById.get(t.id);
    const startBank = realMode ? STARTING_BANK : (t.profinhlBank ?? STARTING_BANK);
    const ledger = t.ledgerAdj ?? 0; // GM cash moves (trades/buyouts/fines) on top of ticket/salary
    const fin = computeTeamFinance({
      popularity: t.popularity,
      pointsPct: st?.pointsPct ?? 0.5,
      selloutRevenue: selloutRevenue(getArenaSections(t)),
      salary: t.players.reduce((s, p) => s + (p.capHit ?? 0), 0),
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
