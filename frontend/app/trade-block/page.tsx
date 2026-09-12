import Link from "next/link";
import { PageHeader } from "@/components/ui";
import PlayerAvatar from "@/components/playerAvatar";
import { tradeBlockBoard, type BlockPlayer, type BlockTeam } from "@/lib/trade-block-server";

export const dynamic = "force-dynamic";

const money = (c: number | null) => (c != null ? `$${(c / 1_000_000).toFixed(1)}M` : "—");
// OV badge, brighter the higher the rating — matches the color scale used elsewhere (RosterMover etc.)
const ovColor = (ov: number) =>
  ov >= 80 ? "bg-emerald-500/30 text-emerald-200 border-emerald-400/60"
  : ov >= 70 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
  : ov >= 60 ? "bg-emerald-600/12 text-emerald-400/90 border-emerald-600/30"
  : "bg-emerald-700/10 text-emerald-500/70 border-emerald-700/25";

function PlayerRow({ p }: { p: BlockPlayer }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors">
      <PlayerAvatar src={p.photoUrl} alt={p.name} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {p.slug ? <Link href={`/players/${p.slug}`} className="text-base font-bold hover:text-blue-400 truncate">{p.name}</Link> : <span className="text-base font-bold truncate">{p.name}</span>}
          <span className="text-xs text-slate-500">{p.position}{p.farm ? " · AHL" : ""}</span>
        </div>
        {p.note && <div className="text-xs text-amber-400/80 truncate mt-0.5">&ldquo;{p.note}&rdquo;</div>}
      </div>
      <div className="text-right shrink-0 flex items-center gap-3">
        <span className={`shrink-0 w-10 text-center tabular-nums font-bold text-sm px-1 py-0.5 rounded border ${ovColor(p.overall ?? 0)}`}>{p.overall ?? "—"}</span>
        <div className="text-xs text-slate-400 tabular-nums">
          <div>{p.age ? `${p.age}y` : "—"}</div>
          <div className="text-slate-500">{money(p.capHit)}{p.contractYears ? ` · ${p.contractYears}y` : ""}</div>
        </div>
      </div>
    </div>
  );
}

function TeamBoard({ t }: { t: BlockTeam }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-black/20 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-800/40">
        <Link href={`/teams/${t.slug}`} className="flex items-center gap-2.5 min-w-0 hover:text-blue-400 transition-colors">
          {t.logoUrl ? <img src={t.logoUrl} alt="" className="w-9 h-9 object-contain shrink-0" />
            : <div className="w-9 h-9 rounded-full bg-slate-800 grid place-items-center text-xs font-bold text-slate-500 shrink-0">{t.code || "?"}</div>}
          <span className="text-lg font-black tracking-tight truncate">{t.name}</span>
        </Link>
        {t.needs.length > 0 && (
          <span className="text-[11px] text-slate-500 shrink-0 whitespace-nowrap">needs <span className="text-sky-400 font-semibold">{t.needs.join(", ")}</span></span>
        )}
      </div>
      <div className="divide-y divide-slate-800/60">{t.players.map((p) => <PlayerRow key={p.id} p={p} />)}</div>
    </div>
  );
}

// The league-wide Trade Block: just who's available. A GM lists / unlists his own
// players from his team's Trades page (/teams/[slug]/trades), not here. Each card
// is one ORGANIZATION — an AHL-rostered player still shows under his NHL parent's
// card (tagged "· AHL"), not a separate card for the affiliate.
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
          {board.map((t) => <TeamBoard key={t.teamId} t={t} />)}
        </div>
      )}
    </div>
  );
}
