import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import WorldLeagueSetup from "@/components/WorldLeagueSetup";

export const dynamic = "force-dynamic";

export default async function AdminWorldDataPage() {
  if (!(await isAdmin())) redirect("/");
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const activeSource = cfg?.rosterMode === "real" ? "real" : "profinhl";

  const [leagues, totalProspects, linkedProspects, unlinkedProspects] = await Promise.all([
    prisma.worldLeague.findMany({
      include: { _count: { select: { teams: true, stats: true } } },
      orderBy: [{ region: "asc" }, { name: "asc" }],
    }),
    prisma.prospect.count({ where: { source: activeSource } }),
    prisma.prospect.count({ where: { source: activeSource, worldPlayerId: { not: null } } }),
    prisma.prospect.findMany({
      where: { source: activeSource, worldPlayerId: null },
      select: { id: true, name: true, position: true, epUrl: true, team: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 300,
    }),
  ]);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Around the World Data"
        subtitle="Manage real-world prospect sync across junior leagues, AHL, NCAA, Europe and manual links."
      />
      <WorldLeagueSetup
        leagues={leagues}
        totalProspects={totalProspects}
        linkedProspects={linkedProspects}
        unlinkedProspects={unlinkedProspects}
      />
    </div>
  );
}
