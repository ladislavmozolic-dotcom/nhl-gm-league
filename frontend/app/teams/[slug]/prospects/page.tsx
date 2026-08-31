import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { cleanName, epSearchName, epProfileUrl } from "@/lib/playerName";
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

  // players moved off the active roster by the post-season roster reconciliation
  // (or manually, by the Comish/Co-Comish, from Admin > Contracts). Split by the
  // ltir flag: Reserve List = injured, off the cap, expected back; Prospect Pool =
  // left the NHL by choice (e.g. a move to Europe), no injury implication.
  const offRoster = await prisma.player.findMany({
    where: { teamId: team.id, rosterType: "PROSPECT" },
    select: { id: true, name: true, position: true, age: true, ltir: true },
    orderBy: { name: "asc" },
  });
  const reserve = offRoster.filter((p) => p.ltir);
  const prospectPool = offRoster.filter((p) => !p.ltir);
  const epUrl = epProfileUrl;

  // A player is NOT a prospect if he's on this org's roster OR he already graduated
  // by the games-played rule (≥10 NHL, ≥15 AHL, ≥5 AHL for goalies) anywhere.
  const orgPlayers = await prisma.player.findMany({
    where: {
      OR: [
        { AND: [{ OR: [{ teamId: team.id }, { team: { parentTeamId: team.id } }] }, { rosterType: { in: ["NHL", "AHL"] } }] },
        { lastSeasonGP: { gte: 10 } }, { lastSeasonAhlGP: { gte: 15 } }, { AND: [{ isGoalie: true }, { lastSeasonAhlGP: { gte: 5 } }] },
      ],
    },
    select: { name: true },
  });
  const pKey = (n: string) => epSearchName(n).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const rosterNames = new Set(orgPlayers.map((p) => pKey(p.name)));
  const prospects = team.prospects
    .filter((p) => !rosterNames.has(pKey(p.name)))
    .sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name)));

  if (prospects.length === 0 && reserve.length === 0 && prospectPool.length === 0) {
    return <Card><p className="text-slate-500 text-center py-8">No prospects.</p></Card>;
  }

  const OffRosterTable = ({ rows }: { rows: typeof offRoster }) => (
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
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                <td className="px-4 py-3 font-medium"><a href={epUrl(p.name)} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 inline-flex items-center gap-1">{cleanName(p.name)}<span className="text-[9px] text-slate-500" aria-hidden>↗</span></a></td>
                <td className="px-4 py-3 text-center text-slate-400">{p.position || "—"}</td>
                <td className="px-4 py-3 text-center text-slate-400">{p.age ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      {reserve.length > 0 && (
        <>
          <SectionTitle count={reserve.length} accent="text-amber-400">Reserve List <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">LTIR · off the cap</span></SectionTitle>
          <OffRosterTable rows={reserve} />
        </>
      )}

      {prospectPool.length > 0 && (
        <>
          <SectionTitle count={prospectPool.length} accent="text-blue-400">Prospect Pool <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">left the NHL — e.g. Europe</span></SectionTitle>
          <OffRosterTable rows={prospectPool} />
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
                  {(p as any).undrafted && !p.draftYear ? (
                    <td colSpan={3} className="px-4 py-3 text-center text-slate-500 italic">Undrafted</td>
                  ) : (<>
                    <td className="px-4 py-3 text-center text-slate-400">{p.draftYear || "—"}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{p.overallPick ? `R${Math.ceil(p.overallPick / 32)}` : "—"}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{p.overallPick ? `#${p.overallPick}` : "—"}</td>
                  </>)}
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
