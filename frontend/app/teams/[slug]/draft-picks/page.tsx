import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, SectionTitle } from "@/components/ui";
import { pickIdsWithTradeHistory } from "@/lib/trade-history-server";
import { getPickTradeHistoryAction } from "@/app/actions/pick-trade-history";
import PickTradeBadge from "@/components/PickTradeBadge";

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
  // bonus picks (round 8+) the commissioner awarded — contest prizes, rewards, …
  const bonus = await prisma.draftBonusPick.findMany({
    where: { teamId: team.id, ...(source === "real" ? { source: "real" } : { OR: [{ source: null }, { source: "profinhl" }] }) },
    orderBy: [{ year: "asc" }, { round: "asc" }, { id: "asc" }],
  });

  if (team.draftPicks.length === 0 && bonus.length === 0) {
    return <Card><p className="text-slate-500 text-center py-8">No draft picks.</p></Card>;
  }

  const allTeams = await prisma.team.findMany({ select: { id: true, profinhlLogoId: true, logoUrl: true, name: true, code: true } });
  const tradedPickIds = await pickIdsWithTradeHistory(team.draftPicks.map((p) => p.id));
  const draftPickMap = new Map<string, typeof team.draftPicks>();
  team.draftPicks.forEach((pick) => {
    const key = `${pick.year}-${pick.round}`;
    if (!draftPickMap.has(key)) draftPickMap.set(key, []);
    draftPickMap.get(key)!.push(pick);
  });
  // Multiple picks in the same round: this club's own original pick goes first,
  // then the rest alphabetically by the name of the club they originally belonged to.
  for (const picks of draftPickMap.values()) {
    picks.sort((a, b) => {
      const aOwn = a.ownerLogoId === team.profinhlLogoId;
      const bOwn = b.ownerLogoId === team.profinhlLogoId;
      if (aOwn !== bOwn) return aOwn ? -1 : 1;
      const aName = allTeams.find((t) => t.profinhlLogoId === a.ownerLogoId)?.name ?? "";
      const bName = allTeams.find((t) => t.profinhlLogoId === b.ownerLogoId)?.name ?? "";
      return aName.localeCompare(bName);
    });
  }
  const years = [...new Set([...team.draftPicks.map((p) => p.year), ...bonus.map((b) => b.year)])].sort((a, b) => a - b);
  const bonusByYear = new Map<number, typeof bonus>();
  for (const b of bonus) bonusByYear.set(b.year, [...(bonusByYear.get(b.year) ?? []), b]);

  return (
    <div className="space-y-4">
      <SectionTitle>Draft Picks</SectionTitle>
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider bg-slate-800/30">
                <th className="px-4 py-3 text-left font-medium w-16">Year</th>
                {[1, 2, 3, 4, 5, 6, 7].map((r) => <th key={r} className="px-2 py-3 text-center font-medium">Round {r}</th>)}
                <th className="px-2 py-3 text-center font-medium text-amber-400/80 border-l border-slate-800">★ Bonus picks</th>
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
                              <div key={idx} className="flex flex-col items-center gap-0.5">
                                <PickTradeBadge
                                  pickId={pick.id}
                                  teamName={ownerTeam?.name || "?"}
                                  code={ownerTeam?.code || String(pick.ownerLogoId)}
                                  logoUrl={ownerTeam?.logoUrl ?? null}
                                  size={32}
                                  clickable={tradedPickIds.has(pick.id)}
                                  fetchHistory={getPickTradeHistoryAction}
                                />
                                <span className="text-[9px] text-slate-600">{ownerTeam?.code || "?"}</span>
                              </div>
                            );
                          })}
                          {picks.length === 0 && <span className="text-slate-700">—</span>}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-3 text-center border-l border-slate-800">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {(bonusByYear.get(year) ?? []).map((b) => (
                        <span key={b.id} title={b.reason ?? "Bonus pick"}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold tabular-nums">
                          ★ R{b.round}
                          {b.reason && <span className="font-normal text-amber-200/70 max-w-[140px] truncate">{b.reason}</span>}
                        </span>
                      ))}
                      {!bonusByYear.get(year)?.length && <span className="text-slate-700">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
