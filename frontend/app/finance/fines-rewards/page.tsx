import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import FinanceNav from "@/components/FinanceNav";
import { getBank, bankBalance } from "@/lib/league-bank-server";
import { getLang } from "@/lib/lang-server";
import { isAdmin } from "@/lib/auth";
import FinesRewardsView, {
  type LedgerEntry,
  type TeamFinancialSummary,
} from "@/components/FinesRewardsView";

export const dynamic = "force-dynamic";

export default async function FinesRewardsPage() {
  const [bank, balance, rawEntries, teams, lang, admin] = await Promise.all([
    getBank(),
    bankBalance(),
    prisma.leagueBankEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: { id: true, name: true, code: true, logoUrl: true, slug: true },
      orderBy: { name: "asc" },
    }),
    getLang(),
    isAdmin(),
  ]);

  const isSk = lang === "cs";
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // Convert raw bank entries to LedgerEntry format
  const entries: LedgerEntry[] = rawEntries.map((e) => {
    let category: LedgerEntry["category"] = "OTHER";
    if (e.kind.startsWith("FINE_")) category = "FINE";
    else if (e.kind === "SUSPENSION_SALARY") category = "DISCIPLINE";
    else if (e.kind === "PAYOUT" || e.kind === "BONUS") category = "REWARD";
    else if (e.kind === "REFUND") category = "REFUND";

    const t = e.teamId ? teamMap.get(e.teamId) : null;

    return {
      id: `bank-${e.id}`,
      date: e.day ?? e.createdAt.toISOString().slice(0, 10),
      rawDate: e.createdAt.toISOString(),
      kind: e.kind,
      category,
      amount: e.amount,
      teamId: e.teamId,
      teamName: e.teamName ?? t?.name ?? null,
      teamCode: t?.code ?? null,
      teamLogoUrl: t?.logoUrl ?? null,
      teamSlug: t?.slug ?? null,
      note: e.note,
    };
  });

  // Calculate team summaries
  const teamSummaries: TeamFinancialSummary[] = teams.map((t) => {
    const clubEntries = entries.filter((e) => e.teamId === t.id);

    let totalFines = 0;
    let totalRewards = 0;
    let fineCount = 0;
    let rewardCount = 0;

    for (const e of clubEntries) {
      if (e.category === "FINE" || e.category === "DISCIPLINE") {
        totalFines += e.amount;
        fineCount++;
      } else if (e.category === "REWARD") {
        totalRewards += Math.abs(e.amount);
        rewardCount++;
      } else if (e.category === "REFUND") {
        totalFines = Math.max(0, totalFines - Math.abs(e.amount));
      }
    }

    return {
      teamId: t.id,
      name: t.name,
      code: t.code,
      logoUrl: t.logoUrl,
      slug: t.slug,
      totalFines,
      totalRewards,
      netImpact: totalRewards - totalFines,
      fineCount,
      rewardCount,
    };
  });

  // Sort team summaries by highest fines first, then lowest net impact
  teamSummaries.sort((a, b) => b.totalFines - a.totalFines || a.netImpact - b.netImpact);

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-2 px-3 sm:px-6">
      <PageHeader
        title={isSk ? "Odmeny a pokuty — Ligová pokladňa" : "Fines & Rewards — League Bank"}
        subtitle={
          isSk
            ? "Transparentný prehľad ligových sankcií, pokút za súpisky, zhabaných platov a vyplatených odmien klubom"
            : "Transparent ledger of roster penalties, cap overage fines, safety rulings, and club rewards"
        }
      />

      <FinanceNav current="fines-rewards" lang={lang} />

      <FinesRewardsView
        entries={entries}
        bankBalanceAmount={balance}
        openingBalance={bank.openingBalance}
        teamSummaries={teamSummaries}
        isAdmin={admin}
        lang={lang}
      />
    </div>
  );
}
