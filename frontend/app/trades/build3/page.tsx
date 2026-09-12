import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getTeamSession } from "@/lib/auth";
import { teamAssets } from "@/lib/trade-assets";
import { teamCapStatus } from "@/lib/cap";
import TradeBuilder3 from "@/components/TradeBuilder3";
import TeamSelect from "@/components/TeamSelect";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TradeBuild3Page({ searchParams }: { searchParams: Promise<{ b?: string; c?: string }> }) {
  const session = await getTeamSession();
  if (!session) redirect("/login");
  const myTeam = await prisma.team.findUnique({ where: { id: session }, select: { id: true, name: true, logoUrl: true } });
  if (!myTeam) redirect("/login");

  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false, id: { not: myTeam.id } },
    select: { id: true, name: true, logoUrl: true }, orderBy: { name: "asc" },
  });

  const { b, c } = await searchParams;
  const bId = b ? Number(b) : null;
  const cId = c ? Number(c) : null;
  const teamB = bId ? teams.find((t) => t.id === bId) ?? null : null;
  const teamC = cId ? teams.find((t) => t.id === cId) ?? null : null;

  if (!teamB || !teamC || teamB.id === teamC.id) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader
          title="3-Team Trade Room"
          subtitle={`You are ${myTeam.name}. Pick the other two clubs.`}
          right={<Link href="/trades/build" className="text-sm text-slate-400 hover:text-blue-400">← 2-team Trade Room</Link>}
        />
        <Card>
          <form className="flex flex-col sm:flex-row gap-3">
            <TeamSelect name="b" placeholder="Club B…" teams={teams} defaultValue={bId} />
            <TeamSelect name="c" placeholder="Club C…" teams={teams} defaultValue={cId} />
            <button className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm whitespace-nowrap">Open</button>
          </form>
          {bId && cId && teamB === null && <p className="text-rose-400 text-sm mt-2">Pick two different clubs.</p>}
        </Card>
      </div>
    );
  }

  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const prospectSource = cfg?.rosterMode === "real" ? "real" : "profinhl";
  const [assetsA, assetsB, assetsC, capA, capB, capC] = await Promise.all([
    teamAssets(myTeam.id, prospectSource), teamAssets(teamB.id, prospectSource), teamAssets(teamC.id, prospectSource),
    teamCapStatus(myTeam.id), teamCapStatus(teamB.id), teamCapStatus(teamC.id),
  ]);

  return <TradeBuilder3 me={myTeam} teamB={teamB} teamC={teamC} assetsA={assetsA} assetsB={assetsB} assetsC={assetsC} capA={capA} capB={capB} capC={capC} />;
}
