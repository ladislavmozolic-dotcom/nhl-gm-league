import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { tradeBlockBoard, type BlockPlayer } from "@/lib/trade-block-server";

export const dynamic = "force-dynamic";

const money = (c: number | null) => (c != null ? `$${(c / 1_000_000).toFixed(1)}M` : "—");

function PlayerRow({ p }: { p: BlockPlayer }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {p.slug ? <Link href={`/players/${p.slug}`} className="text-sm font-semibold hover:text-blue-400 truncate">{p.name}</Link> : <span className="text-sm font-semibold truncate">{p.name}</span>}
          <span className="text-[11px] text-slate-500">{p.position}</span>
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

// The league-wide Trade Block: just who's available. A GM lists / unlists his own
// players from his team's Trades page (/teams/[slug]/trades), not here.
export default async function TradeBlockPage() {
  const board = await tradeBlockBoard();
  const totalListed = board.reduce((t, b) => t + b.players.length, 0);

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Trade Block" subtitle={`${totalListed} player${totalListed === 1 ? "" : "s"} listed across ${board.length} team${board.length === 1 ? "" : "s"}`} />
      <p className="text-sm text-slate-500">Players around the league whose GMs have made them available. To list or unlist your own, go to your team&apos;s <b className="text-slate-300">Trades</b> page.</p>

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
  );
}
