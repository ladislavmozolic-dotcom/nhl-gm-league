import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { getTeamSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tradeBlockBoard, matchesForTeam, teamRosterForBlock, type BlockPlayer } from "@/lib/trade-block-server";
import TradeBlockManager from "@/components/TradeBlockManager";

export const dynamic = "force-dynamic";

const money = (c: number | null) => (c != null ? `$${(c / 1_000_000).toFixed(1)}M` : "—");

function PlayerRow({ p, showTeam }: { p: BlockPlayer; showTeam?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {p.slug ? <Link href={`/players/${p.slug}`} className="text-sm font-semibold hover:text-blue-400 truncate">{p.name}</Link> : <span className="text-sm font-semibold truncate">{p.name}</span>}
          <span className="text-[11px] text-slate-500">{p.position}</span>
          {showTeam && <Link href={`/teams/${p.teamSlug}`} className="text-[11px] text-slate-500 hover:text-blue-400">{p.teamCode}</Link>}
        </div>
        {p.note && <div className="text-[11px] text-amber-400/80 truncate">“{p.note}”</div>}
      </div>
      <div className="text-right shrink-0 text-xs text-slate-400">
        <div className="tabular-nums"><span className="font-bold text-slate-200">{p.overall ?? "—"}</span> OV{p.age ? ` · ${p.age}y` : ""}</div>
        <div className="tabular-nums text-slate-500">{money(p.capHit)}{p.contractYears ? ` · ${p.contractYears}y` : ""}</div>
      </div>
    </div>
  );
}

export default async function TradeBlockPage() {
  const viewerId = await getTeamSession();
  const [board, mine, matches, viewerTeam] = await Promise.all([
    tradeBlockBoard(),
    viewerId ? teamRosterForBlock(viewerId) : Promise.resolve(null),
    viewerId ? matchesForTeam(viewerId) : Promise.resolve(null),
    viewerId ? prisma.team.findUnique({ where: { id: viewerId }, select: { name: true } }) : Promise.resolve(null),
  ]);
  const totalListed = board.reduce((t, b) => t + b.players.length, 0);

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Trade Block" subtitle={`${totalListed} player${totalListed === 1 ? "" : "s"} listed across ${board.length} team${board.length === 1 ? "" : "s"}`} />

      {!viewerId && <p className="text-sm text-slate-500"><Link href="/login" className="text-blue-400 hover:underline">Log in</Link> as a GM to list your own players and see matches for your needs.</p>}

      {viewerId && matches && (
        <Card title="🎯 Matches for your needs" accent="text-sky-400">
          {matches.needs.length === 0 ? (
            <p className="text-sm text-slate-500">Set your team&apos;s needs below and listed players who fit will show up here.</p>
          ) : matches.matches.length === 0 ? (
            <p className="text-sm text-slate-500">No listed players fit your needs ({matches.needs.join(", ")}) right now.</p>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-2">Listed players who fit your needs ({matches.needs.join(", ")}). Suggestions only — you judge the fit.</p>
              <div className="divide-y divide-slate-800/60">{matches.matches.map((p) => <PlayerRow key={p.id} p={p} showTeam />)}</div>
            </>
          )}
        </Card>
      )}

      {viewerId && mine && viewerTeam && (
        <Card title="Manage your Trade Block" accent="text-amber-400">
          <TradeBlockManager teamId={viewerId} teamName={viewerTeam.name} initialNeeds={mine.needs} players={mine.players} />
        </Card>
      )}

      <div>
        <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">Around the league</div>
        {board.length === 0 ? (
          <p className="text-slate-500 text-sm">No players are on the block yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {board.map((t) => (
              <div key={t.teamId} className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-800/30">
                  <Link href={`/teams/${t.slug}`} className="text-sm font-bold hover:text-blue-400">{t.name}</Link>
                  {t.needs.length > 0 && <span className="text-[11px] text-slate-500">needs: <span className="text-sky-400">{t.needs.join(", ")}</span></span>}
                </div>
                <div className="divide-y divide-slate-800/60">{t.players.map((p) => <PlayerRow key={p.id} p={p} />)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
