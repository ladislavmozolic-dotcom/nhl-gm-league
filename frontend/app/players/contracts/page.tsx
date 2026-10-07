import { prisma } from "@/lib/prisma";
import { seasonLabel, CURRENT_SEASON_START } from "@/lib/finance";
import { PageHeader } from "@/components/ui";
import { getLang } from "@/lib/lang-server";
import ContractsLedgerView, { type ContractRow } from "@/components/ContractsLedgerView";

export const dynamic = "force-dynamic";

const CLAUSE_LABEL: Record<string, string> = { NTC: "NTC", NMC: "NMC", M_NTC: "M-NTC" };

export default async function ContractsPage() {
  const [lang, players] = await Promise.all([
    getLang(),
    prisma.player.findMany({
      where: { rosterType: { in: ["NHL", "AHL"] }, capHit: { gt: 0 }, contractYears: { gt: 0 } },
      include: { team: { select: { code: true, slug: true, logoUrl: true, name: true } } },
      orderBy: { capHit: "desc" },
    }),
  ]);

  const isCs = lang === "cs";

  const rows: ContractRow[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    photoUrl: p.photoUrl,
    position: p.position,
    teamCode: p.team?.code ?? null,
    teamSlug: p.team?.slug ?? null,
    teamLogoUrl: p.team?.logoUrl ?? null,
    teamName: p.team?.name ?? null,
    capHit: p.capHit ?? 0,
    years: p.contractYears ?? null,
    contractType: p.contractType,
    clause: p.tradeClause
      ? CLAUSE_LABEL[p.tradeClause] ?? p.tradeClause
      : p.extClause
      ? `${CLAUSE_LABEL[p.extClause] ?? p.extClause} (${seasonLabel(CURRENT_SEASON_START + (p.contractYears ?? 0))})`
      : null,
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={isCs ? "Zmluvy hráčov" : "Player Contracts"}
        subtitle={
          isCs
            ? `Prehľad všetkých ${players.length} aktívnych zmlúv v lige s platovými stropmi a klauzulami`
            : `${players.length} active player contracts across the league with cap hits and clauses`
        }
      />

      <ContractsLedgerView rows={rows} lang={lang} />
    </div>
  );
}
