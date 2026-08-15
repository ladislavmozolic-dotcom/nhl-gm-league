import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import SortableTable, { type SortCol } from "@/components/SortableTable";

export const dynamic = "force-dynamic";

function contractTypeLabel(t: string | null): string {
  if (t === "TWO_WAY") return "2-way";
  if (t === "ONE_WAY") return "1-way";
  return "—";
}

export default async function ContractsPage() {
  const players = await prisma.player.findMany({
    where: { rosterType: { in: ["NHL", "AHL"] }, capHit: { gt: 0 } },
    include: { team: { select: { code: true, slug: true, logoUrl: true } } },
    orderBy: { capHit: "desc" },
  });

  const cols: SortCol[] = [
    { key: "name", label: "Player", kind: "player", sticky: true },
    { key: "team", label: "Team", kind: "team" },
    { key: "pos", label: "Pos", kind: "text" },
    { key: "cap", label: "Cap Hit", kind: "money" },
    { key: "yrs", label: "Years", kind: "years" },
    { key: "type", label: "Type", kind: "text" },
  ];
  const rows = players.map((p) => ({
    _id: p.id, name: p.name, slug: p.slug, photo: p.photoUrl,
    teamCode: p.team?.code, teamSlug: p.team?.slug, teamLogo: p.team?.logoUrl,
    pos: p.position, cap: p.capHit ?? 0, yrs: p.contractYears ?? null, type: contractTypeLabel(p.contractType),
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Contracts" subtitle={`${players.length} player${players.length === 1 ? "" : "s"} under an active contract`} />

      <Card>
        <p className="text-sm text-slate-400">
          Contract signing (e.g. a 2-year deal with year 1 two-way and year 2 one-way) will run
          through a dedicated signing engine — coming soon. This is the current contracts ledger. Click any column to sort.
        </p>
      </Card>

      {players.length === 0 ? (
        <Card><p className="text-slate-500 text-center py-8">No active contracts</p></Card>
      ) : (
        <Card bodyClassName="p-2">
          <SortableTable cols={cols} rows={rows} initialSort="cap" minWidth={720} />
        </Card>
      )}
    </div>
  );
}
