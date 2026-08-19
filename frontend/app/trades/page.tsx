import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { money } from "@/lib/finance";
import TradeActions from "@/components/TradeActions";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

type AssetLabel = { text: string };

export default async function TradesPage() {
  const [session, admin, trades, teams] = await Promise.all([
    getTeamSession(),
    isAdmin(),
    prisma.trade.findMany({ take: 60, orderBy: { createdAt: "desc" } }),
    prisma.team.findMany({ select: { id: true, name: true, code: true, logoUrl: true } }),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const assets = await prisma.tradeAsset.findMany({ where: { tradeId: { in: trades.map((t) => t.id) } } });

  // batch-resolve names
  const playerIds = assets.filter((a) => a.playerId).map((a) => a.playerId!) as number[];
  const prospectIds = assets.filter((a) => a.prospectId).map((a) => a.prospectId!) as number[];
  const pickIds = assets.filter((a) => a.draftPickId).map((a) => a.draftPickId!) as number[];
  const [players, prospects, picks] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, name: true } }),
    prisma.prospect.findMany({ where: { id: { in: prospectIds } }, select: { id: true, name: true } }),
    prisma.draftPick.findMany({ where: { id: { in: pickIds } }, select: { id: true, year: true, round: true } }),
  ]);
  const pName = new Map(players.map((p) => [p.id, p.name]));
  const proName = new Map(prospects.map((p) => [p.id, p.name]));
  const pickLabel = new Map(picks.map((p) => [p.id, `${p.year} R${p.round}`]));

  const labelsFor = (tradeId: number, side: "FROM" | "TO"): AssetLabel[] =>
    assets.filter((a) => a.tradeId === tradeId && a.side === side).map((a) => {
      if (a.assetType === "PLAYER") return { text: `${pName.get(a.playerId ?? -1) ?? "Player"}${a.retentionPct ? ` (${a.retentionPct}% ret.)` : ""}` };
      if (a.assetType === "PROSPECT") return { text: `⭐ ${proName.get(a.prospectId ?? -1) ?? "Prospect"}` };
      if (a.assetType === "PICK") return { text: `🎫 ${pickLabel.get(a.draftPickId ?? -1) ?? "Pick"}` };
      if (a.assetType === "CASH") return { text: `💵 ${money(a.cashAmount ?? 0)}` };
      return { text: a.assetType };
    });

  const enriched = trades.map((t) => ({
    ...t,
    fromTeam: teamById.get(t.fromTeamId),
    toTeam: teamById.get(t.toTeamId),
    fromLabels: labelsFor(t.id, "FROM"),
    toLabels: labelsFor(t.id, "TO"),
  }));
  // A PENDING proposal is PRIVATE — only the two clubs involved (and the commissioner)
  // see it until it's accepted/declined. Completed deals are public history for everyone.
  const canSeePending = (t: { fromTeamId: number; toTeamId: number }) => admin || session === t.fromTeamId || session === t.toTeamId;
  const pending = enriched.filter((t) => t.status === "PENDING" && canSeePending(t));
  const history = enriched.filter((t) => t.status !== "PENDING");

  return (
    <div className="space-y-8 py-2">
      <PageHeader
        title="Trades"
        subtitle="Proposals and completed deals"
        right={session ? <Link href="/trades/build" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm">Propose a trade</Link> : undefined}
      />

      <section>
        <h2 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" /> Pending Proposals
        </h2>
        {pending.length === 0 ? (
          <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg shadow-black/20 p-8 text-center text-slate-500">No pending trades</div>
        ) : (
          <div className="grid gap-4">
            {pending.map((t) => (
              <TradeCard key={t.id} trade={t} admin={admin}
                action={session === t.toTeamId ? "receiver" : session === t.fromTeamId ? "proposer" : null} />
            ))}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4">History</h2>
          <div className="grid gap-4">
            {history.map((t) => <TradeCard key={t.id} trade={t} action={null} admin={admin} />)}
          </div>
        </section>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  ACCEPTED: "bg-green-500/20 text-green-400",
  DECLINED: "bg-red-500/20 text-red-400",
  CANCELLED: "bg-slate-600/30 text-slate-400",
  COMPLETED: "bg-green-500/20 text-green-400",
};

function TeamHead({ team }: { team?: { name: string; code: string | null; logoUrl: string | null } }) {
  return (
    <div className="flex items-center gap-2">
      {team?.logoUrl ? <img src={team.logoUrl} alt="" className="w-8 h-8 object-contain" />
        : <div className="w-8 h-8 bg-slate-800 rounded-full grid place-items-center text-xs font-bold text-slate-500">{team?.code || "?"}</div>}
      <span className="text-sm font-medium hidden sm:inline">{team?.name || "Unknown"}</span>
    </div>
  );
}

function AssetList({ team, labels }: { team?: { name: string }; labels: { text: string }[] }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-500 mb-1">{team?.name || "Team"} sends</p>
      {labels.length === 0 ? <p className="text-slate-600 text-sm">nothing</p> : (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l, i) => <span key={i} className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-200">{l.text}</span>)}
        </div>
      )}
    </div>
  );
}

function TradeCard({ trade, action, admin }: {
  trade: {
    id: number; status: string; condition: string | null; createdAt: Date;
    fromTeam?: { name: string; code: string | null; logoUrl: string | null };
    toTeam?: { name: string; code: string | null; logoUrl: string | null };
    fromLabels: { text: string }[]; toLabels: { text: string }[];
  };
  action: "receiver" | "proposer" | null;
  admin?: boolean;
}) {
  return (
    <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg shadow-black/20 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TeamHead team={trade.fromTeam} />
          <span className="text-slate-600 text-lg">⇄</span>
          <TeamHead team={trade.toTeam} />
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLE[trade.status] ?? "bg-slate-700 text-slate-300"}`}>{trade.status}</span>
      </div>

      <div className="bg-slate-950/50 rounded-lg p-3 mb-3 flex gap-4">
        <AssetList team={trade.fromTeam} labels={trade.fromLabels} />
        <AssetList team={trade.toTeam} labels={trade.toLabels} />
      </div>

      {trade.condition && <p className="text-xs text-amber-300/80 mb-3">📎 {trade.condition}</p>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-600">{trade.createdAt.toLocaleDateString("sk-SK", { day: "numeric", month: "long", year: "numeric" })}</p>
        {(action || admin) && <TradeActions tradeId={trade.id} role={action} admin={admin} />}
      </div>
    </div>
  );
}
