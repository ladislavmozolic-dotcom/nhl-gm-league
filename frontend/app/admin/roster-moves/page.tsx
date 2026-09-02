import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import PlayerLink from "@/components/PlayerLink";
import AdminTransferButton from "@/components/AdminTransferButton";
import TeamPicker from "@/components/TeamPicker";
import { money } from "@/lib/finance";
import { cleanName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

async function orgRoster(teamId: number) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { affiliateTeams: { select: { id: true, name: true } } },
  });
  if (!team) return null;
  const orgIds = [team.id, ...team.affiliateTeams.map((a) => a.id)];
  const players = await prisma.player.findMany({
    where: { teamId: { in: orgIds }, rosterType: { in: ["NHL", "AHL"] } },
    select: { id: true, name: true, slug: true, position: true, overall: true, isGoalie: true, capHit: true, rosterType: true },
    orderBy: [{ rosterType: "asc" }, { overall: "desc" }],
  });
  return { team, players };
}

export default async function AdminRosterMovesPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  if (!(await isAdmin())) redirect("/login");

  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, name: true, code: true, slug: true, logoUrl: true },
    orderBy: { name: "asc" },
  });
  if (teams.length < 2) return <div className="py-2">Need at least two teams.</div>;

  const sp = await searchParams;
  const teamA = teams.find((t) => t.slug === sp.a) ?? teams[0];
  const teamB = teams.find((t) => t.slug === sp.b) ?? teams[1];

  const [orgA, orgB] = await Promise.all([orgRoster(teamA.id), orgRoster(teamB.id)]);
  if (!orgA || !orgB) return <div className="py-2">Team not found.</div>;

  const Column = ({ org, other }: { org: NonNullable<typeof orgA>; other: NonNullable<typeof orgA> }) => (
    <Card bodyClassName="p-0">
      <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="sticky top-0 z-10 bg-slate-900 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
              <th className="px-3 py-2 text-left">Player</th>
              <th className="px-2 py-2 text-center">Pos</th>
              <th className="px-2 py-2 text-center">OV</th>
              <th className="px-2 py-2 text-center">Level</th>
              <th className="px-2 py-2 text-right">Cap Hit</th>
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {org.players.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-slate-600">no players</td></tr>}
            {org.players.map((p) => (
              <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                  <PlayerLink id={p.id} name={p.name} slug={p.slug} />
                </td>
                <td className="px-2 py-1.5 text-center text-slate-400">{p.position ?? (p.isGoalie ? "G" : "—")}</td>
                <td className="px-2 py-1.5 text-center tabular-nums font-bold text-emerald-400">{p.overall ?? "—"}</td>
                <td className="px-2 py-1.5 text-center text-slate-500">{p.rosterType}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{p.capHit ? money(p.capHit) : "—"}</td>
                <td className="px-3 py-1.5 text-right">
                  <AdminTransferButton playerId={p.id} playerName={cleanName(p.name)} toTeamId={other.team.id} toTeamName={other.team.code ?? other.team.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Roster Moves — Move Players Between Clubs" subtitle="Commissioner override: transfer any player between two organizations directly — no trade proposal, no consent, no cap check."
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400 whitespace-nowrap">← Admin</Link>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {teamA.logoUrl && <img src={teamA.logoUrl} alt="" className="w-8 h-8 object-contain" />}
            <TeamPicker side="a" current={teamA.slug} teams={teams} />
          </div>
          <Column org={orgA} other={orgB} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            {teamB.logoUrl && <img src={teamB.logoUrl} alt="" className="w-8 h-8 object-contain" />}
            <TeamPicker side="b" current={teamB.slug} teams={teams} />
          </div>
          <Column org={orgB} other={orgA} />
        </div>
      </div>
    </div>
  );
}
