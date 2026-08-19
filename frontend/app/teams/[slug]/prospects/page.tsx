import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { cleanName, epSearchName } from "@/lib/playerName";
import { Card, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamProspectsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const source = cfg?.rosterMode === "real" ? "real" : "profinhl";
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { prospects: { where: { source } } },
  });
  if (!team) notFound();

  // players moved to the reserve list by the post-season roster reconciliation
  const reserve = await prisma.player.findMany({
    where: { teamId: team.id, rosterType: "PROSPECT" },
    select: { id: true, name: true, position: true, age: true, ltir: true },
    orderBy: { name: "asc" },
  });
  const epUrl = (name: string) => `https://www.eliteprospects.com/search/player?q=${encodeURIComponent(epSearchName(name))}`;

  // drop prospects who are already on the org roster (NHL or AHL) — a dressing
  // player isn't a prospect even if EliteProspects still lists him "in the system".
  const orgPlayers = await prisma.player.findMany({
    where: { OR: [{ teamId: team.id }, { team: { parentTeamId: team.id } }], rosterType: { in: ["NHL", "AHL"] } },
    select: { name: true },
  });
  const pKey = (n: string) => epSearchName(n).toLowerCase();
  const rosterNames = new Set(orgPlayers.map((p) => pKey(p.name)));
  const prospects = team.prospects
    .filter((p) => !rosterNames.has(pKey(p.name)))
    .sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name)));

  if (prospects.length === 0 && reserve.length === 0) {
    return <Card><p className="text-slate-500 text-center py-8">No prospects.</p></Card>;
  }

  return (
    <div className="space-y-4">
      {reserve.length > 0 && (
        <>
          <SectionTitle count={reserve.length} accent="text-blue-400">Reserve List</SectionTitle>
          <Card bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider bg-slate-800/30">
                    <th className="px-4 py-3 text-left font-medium">Player</th>
                    <th className="px-4 py-3 text-center font-medium">Pos</th>
                    <th className="px-4 py-3 text-center font-medium">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {reserve.map((p) => (
                    <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                      <td className="px-4 py-3 font-medium"><a href={epUrl(p.name)} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 inline-flex items-center gap-1">{cleanName(p.name)}<span className="text-[9px] text-slate-500" aria-hidden>↗</span></a>{p.ltir && <span className="ml-2 text-[9px] font-semibold uppercase tracking-wider text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/30 rounded px-1.5 py-0.5">LTIR</span>}</td>
                      <td className="px-4 py-3 text-center text-slate-400">{p.position || "—"}</td>
                      <td className="px-4 py-3 text-center text-slate-400">{p.age ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {prospects.length > 0 && (<>
      <SectionTitle count={prospects.length}>Draft Prospects</SectionTitle>
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider bg-slate-800/30">
                <th className="px-4 py-3 text-left font-medium">Prospect</th>
                <th className="px-4 py-3 text-center font-medium">Pos</th>
                <th className="px-4 py-3 text-center font-medium">Draft Year</th>
                <th className="px-4 py-3 text-center font-medium">Round</th>
                <th className="px-4 py-3 text-center font-medium">Overall Pick</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                  <td className="px-4 py-3 font-medium"><a href={(p as any).epUrl ?? epUrl(p.name)} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 inline-flex items-center gap-1">{cleanName(p.name)}<span className="text-[9px] text-slate-500" aria-hidden>↗</span></a></td>
                  <td className="px-4 py-3 text-center text-slate-400">{(p as any).position || "—"}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{p.draftYear || "—"}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{p.overallPick ? `R${Math.ceil(p.overallPick / 32)}` : "—"}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{p.overallPick ? `#${p.overallPick}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      </>)}
    </div>
  );
}
