import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamDraftPicksPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const source = cfg?.rosterMode === "real" ? "real" : "profinhl";
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { draftPicks: { where: { source }, orderBy: [{ year: "asc" }, { round: "asc" }] } },
  });
  if (!team) notFound();

  if (team.draftPicks.length === 0) {
    return <Card><p className="text-slate-500 text-center py-8">No draft picks.</p></Card>;
  }

  const allTeams = await prisma.team.findMany({ select: { id: true, profinhlLogoId: true, logoUrl: true, name: true, code: true } });
  const draftPickMap = new Map<string, typeof team.draftPicks>();
  team.draftPicks.forEach((pick) => {
    const key = `${pick.year}-${pick.round}`;
    if (!draftPickMap.has(key)) draftPickMap.set(key, []);
    draftPickMap.get(key)!.push(pick);
  });
  const years = [...new Set(team.draftPicks.map((p) => p.year))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <SectionTitle>Draft Picks</SectionTitle>
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider bg-slate-800/30">
                <th className="px-4 py-3 text-left font-medium w-16">Year</th>
                {[1, 2, 3, 4, 5, 6, 7].map((r) => <th key={r} className="px-2 py-3 text-center font-medium">Round {r}</th>)}
              </tr>
            </thead>
            <tbody>
              {years.map((year) => (
                <tr key={year} className="border-b border-slate-800/40 last:border-0">
                  <td className="px-4 py-3 font-bold text-white">{year}</td>
                  {[1, 2, 3, 4, 5, 6, 7].map((round) => {
                    const picks = draftPickMap.get(`${year}-${round}`) || [];
                    return (
                      <td key={round} className="px-2 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {picks.map((pick, idx) => {
                            const ownerTeam = allTeams.find((t) => t.profinhlLogoId === pick.ownerLogoId);
                            return (
                              <div key={idx} className="flex flex-col items-center gap-0.5" title={ownerTeam?.name || "?"}>
                                {ownerTeam?.logoUrl ? <img src={ownerTeam.logoUrl} alt={ownerTeam.name} className="w-8 h-8 object-contain" />
                                  : <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-500">{pick.ownerLogoId}</div>}
                                <span className="text-[9px] text-slate-600">{ownerTeam?.code || "?"}</span>
                              </div>
                            );
                          })}
                          {picks.length === 0 && <span className="text-slate-700">—</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
