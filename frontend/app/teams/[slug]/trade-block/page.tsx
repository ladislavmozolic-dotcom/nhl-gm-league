import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { canManageTeam } from "@/lib/auth";
import { teamRosterForBlock, matchesForTeam, type BlockPlayer } from "@/lib/trade-block-server";
import { cleanName } from "@/lib/playerName";
import TradeBlockManager from "@/components/TradeBlockManager";
import WaiverPlacer from "@/components/WaiverPlacer";

export const dynamic = "force-dynamic";

const money = (c: number | null) => (c != null ? `$${(c / 1_000_000).toFixed(1)}M` : "—");

export default async function TeamTradeBlockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  const canManage = await canManageTeam(team.id);
  if (!canManage) {
    return (
      <Card title="Trade Block" accent="text-amber-400">
        <p className="text-sm text-slate-500">Only {team.name}&apos;s GM manages this club&apos;s trade block. See who&apos;s available around the league on the <Link href="/trade-block" className="text-blue-400 hover:underline">league Trade Block</Link>.</p>
      </Card>
    );
  }

  const [mine, matches, waiverRoster] = await Promise.all([
    teamRosterForBlock(team.id),
    matchesForTeam(team.id),
    prisma.player.findMany({ where: { teamId: team.id, rosterType: "NHL" }, select: { id: true, name: true, position: true, capHit: true, tradeClause: true, waiverStatus: true } }),
  ]);
  const waiverPlayers = waiverRoster
    .map((p) => ({ id: p.id, name: cleanName(p.name), position: p.position ?? "", capHit: p.capHit ?? 0, clause: p.tradeClause, onWaivers: p.waiverStatus === "ON_WAIVERS" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const MatchRow = ({ p }: { p: BlockPlayer }) => (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {p.slug ? <Link href={`/players/${p.slug}`} className="text-sm font-semibold hover:text-blue-400 truncate">{p.name}</Link> : <span className="text-sm font-semibold truncate">{p.name}</span>}
          <span className="text-[11px] text-slate-500">{p.position}</span>
          <Link href={`/teams/${p.teamSlug}`} className="text-[11px] text-slate-500 hover:text-blue-400">{p.teamCode}</Link>
        </div>
        {p.note && <div className="text-[11px] text-amber-400/80 truncate">“{p.note}”</div>}
      </div>
      <div className="text-right shrink-0 text-xs text-slate-400"><span className="font-bold text-slate-200">{p.overall ?? "—"}</span> OV · {money(p.capHit)}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      {matches && matches.needs.length > 0 && matches.matches.length > 0 && (
        <Card title="🎯 Matches for your needs" accent="text-sky-400">
          <p className="text-xs text-slate-500 mb-2">Listed players around the league who fit your needs ({matches.needs.join(", ")}). Suggestions only.</p>
          <div className="divide-y divide-slate-800/60">{matches.matches.map((p) => <MatchRow key={p.id} p={p} />)}</div>
        </Card>
      )}
      <Card title="Manage your Trade Block" accent="text-amber-400">
        <TradeBlockManager teamId={team.id} teamName={team.name} initialNeeds={mine.needs} players={mine.players} />
      </Card>
      <WaiverPlacer teamId={team.id} players={waiverPlayers} />
    </div>
  );
}
