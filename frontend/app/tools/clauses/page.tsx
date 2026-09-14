import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import SortableTable, { type SortCol } from "@/components/SortableTable";

export const dynamic = "force-dynamic";

const CLAUSE_LABEL: Record<string, string> = { NTC: "NTC", NMC: "NMC", M_NTC: "M-NTC" };

export default async function ClausesPage() {
  const [players, teams] = await Promise.all([
    prisma.player.findMany({
      where: { tradeClause: { not: null }, team: { league: { in: ["NHL", "AHL"] } } },
      include: { team: { select: { code: true, slug: true, logoUrl: true } } },
      orderBy: { capHit: "desc" },
    }),
    prisma.team.findMany({ select: { id: true, code: true } }),
  ]);
  const teamCodeById = new Map(teams.map((t) => [t.id, t.code]));

  const cols: SortCol[] = [
    { key: "name", label: "Player", kind: "player", sticky: true },
    { key: "team", label: "Team", kind: "team" },
    { key: "pos", label: "Pos", kind: "text" },
    { key: "cap", label: "Cap Hit", kind: "money" },
    { key: "clause", label: "Clause", kind: "text" },
    { key: "protected", label: "Protected against", kind: "text" },
  ];
  const rows = players.map((p) => ({
    _id: p.id, name: p.name, slug: p.slug, photo: p.photoUrl,
    teamCode: p.team?.code, teamSlug: p.team?.slug, teamLogo: p.team?.logoUrl,
    pos: p.position, cap: p.capHit ?? 0,
    clause: p.tradeClause ? (CLAUSE_LABEL[p.tradeClause] ?? p.tradeClause) : "",
    protected: p.tradeClause === "M_NTC" ? (p.noTradeTeams ?? []).map((id) => teamCodeById.get(id)).filter(Boolean).join(", ") : "",
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Clauses" subtitle={`${players.length} player${players.length === 1 ? "" : "s"} carrying a no-trade / no-movement clause`} />

      <Card>
        <p className="text-sm text-slate-400">NTC blocks any trade · NMC blocks trade, waivers &amp; demotion · M-NTC blocks trades to a chosen list of teams only.</p>
      </Card>

      {players.length === 0 ? (
        <Card><p className="text-slate-500 text-center py-8">No player currently carries a clause</p></Card>
      ) : (
        <Card bodyClassName="p-0">
          <SortableTable cols={cols} rows={rows} initialSort="cap" minWidth={760} />
        </Card>
      )}
    </div>
  );
}
