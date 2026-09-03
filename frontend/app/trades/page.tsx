import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin, isCommission } from "@/lib/auth";
import { money } from "@/lib/finance";
import TradeActions from "@/components/TradeActions";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

type AssetLabel = { text: string; logoUrl?: string | null };

export default async function TradesPage() {
  const [session, admin, commission, trades, teams] = await Promise.all([
    getTeamSession(),
    isAdmin(),
    isCommission(),
    prisma.trade.findMany({ take: 60, orderBy: { createdAt: "desc" } }),
    prisma.team.findMany({ select: { id: true, name: true, code: true, logoUrl: true, rookieGm: true } }),
  ]);
  const commishQueue = await prisma.trade.count({ where: { status: { in: ["AWAITING_COMMISH", "MODIFIED"] } } });
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const assets = await prisma.tradeAsset.findMany({ where: { tradeId: { in: trades.map((t) => t.id) } } });

  // batch-resolve names
  const playerIds = assets.filter((a) => a.playerId).map((a) => a.playerId!) as number[];
  const prospectIds = assets.filter((a) => a.prospectId).map((a) => a.prospectId!) as number[];
  const pickIds = assets.filter((a) => a.draftPickId).map((a) => a.draftPickId!) as number[];
  const [players, prospects, picks] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, name: true } }),
    prisma.prospect.findMany({ where: { id: { in: prospectIds } }, select: { id: true, name: true } }),
    prisma.draftPick.findMany({ where: { id: { in: pickIds } }, select: { id: true, year: true, round: true, ownerLogoId: true } }),
  ]);
  const pName = new Map(players.map((p) => [p.id, p.name]));
  const proName = new Map(prospects.map((p) => [p.id, p.name]));
  // ownerLogoId = the pick's ORIGINAL team (not necessarily current holder) — show
  // that team's logo/code so "2027 R3" doesn't leave the reader guessing whose pick it is.
  const origTeams = picks.length
    ? await prisma.team.findMany({ where: { profinhlLogoId: { in: picks.map((p) => p.ownerLogoId).filter((x): x is number => x != null) } }, select: { profinhlLogoId: true, code: true, name: true, logoUrl: true } })
    : [];
  const teamByLogoId = new Map(origTeams.map((t) => [t.profinhlLogoId, t]));
  const pickInfo = new Map(picks.map((p) => [p.id, { label: `${p.year} R${p.round}`, origTeam: teamByLogoId.get(p.ownerLogoId) ?? null }]));

  const labelsFor = (tradeId: number, side: "FROM" | "TO"): AssetLabel[] =>
    assets.filter((a) => a.tradeId === tradeId && a.side === side).map((a) => {
      if (a.assetType === "PLAYER") return { text: `${pName.get(a.playerId ?? -1) ?? "Player"}${a.retentionPct ? ` (${a.retentionPct}% ret.)` : ""}` };
      if (a.assetType === "PROSPECT") return { text: `⭐ ${proName.get(a.prospectId ?? -1) ?? "Prospect"}` };
      if (a.assetType === "PICK") {
        const info = pickInfo.get(a.draftPickId ?? -1);
        const orig = info?.origTeam;
        return { text: `🎫 ${info?.label ?? "Pick"}${orig ? ` (${orig.code ?? orig.name})` : ""}`, logoUrl: orig?.logoUrl };
      }
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
  // Only COMPLETED deals are public league history. Pending proposals AND declined /
  // cancelled trades are private — visible only to the two involved clubs (+ commissioner),
  // where they carry full detail in the team Trade Tracker.
  const involvedOrAdmin = (t: { fromTeamId: number; toTeamId: number }) => admin || session === t.fromTeamId || session === t.toTeamId;
  const pending = enriched.filter((t) => t.status === "PENDING" && involvedOrAdmin(t));
  const IN_REVIEW = ["AWAITING_COMMISH", "MODIFY", "MODIFIED"];
  const inReview = enriched.filter((t) => IN_REVIEW.includes(t.status) && involvedOrAdmin(t));
  const history = enriched.filter((t) => t.status === "ACCEPTED" || t.status === "COMPLETED" || ((t.status === "DECLINED" || t.status === "CANCELLED") && involvedOrAdmin(t)));

  return (
    <div className="space-y-8 py-2">
      <PageHeader
        title="Trades"
        subtitle="Proposals and completed deals"
        right={session ? <Link href="/trades/build" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm">Propose a trade</Link> : undefined}
      />

      {commission && (
        <Link href="/trades/commish" className="flex items-center justify-between rounded-2xl border border-amber-700/50 bg-amber-950/25 px-5 py-3 hover:bg-amber-950/40 transition-colors">
          <span className="text-sm font-semibold text-amber-200">🕵️ Trade Commission — review rookie-GM trades</span>
          <span className="text-xs font-bold rounded-full px-3 py-1 bg-amber-500/20 text-amber-300">{commishQueue} awaiting →</span>
        </Link>
      )}

      {inReview.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> With the Commission
          </h2>
          <div className="grid gap-4">
            {inReview.map((t) => <TradeCard key={t.id} trade={t} action={null} admin={admin} />)}
          </div>
        </section>
      )}

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
  AWAITING_COMMISH: "bg-amber-500/20 text-amber-300",
  MODIFY: "bg-sky-500/20 text-sky-300",
  MODIFIED: "bg-fuchsia-500/20 text-fuchsia-300",
  REVERTED: "bg-slate-600/30 text-slate-400",
};

function TeamHead({ team }: { team?: { name: string; code: string | null; logoUrl: string | null; rookieGm?: boolean } }) {
  return (
    <div className="flex items-center gap-2">
      {team?.logoUrl ? <img src={team.logoUrl} alt="" className="w-8 h-8 object-contain" />
        : <div className="w-8 h-8 bg-slate-800 rounded-full grid place-items-center text-xs font-bold text-slate-500">{team?.code || "?"}</div>}
      <span className="text-sm font-medium hidden sm:inline">{team?.name || "Unknown"}{team?.rookieGm ? <span className="text-[10px] font-bold text-rose-400 ml-1" title="Rookie GM — trades need commission approval">(R)</span> : null}</span>
    </div>
  );
}

function AssetList({ team, labels, verb }: { team?: { name: string }; labels: AssetLabel[]; verb: "sends" | "received" }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-500 mb-1">{team?.name || "Team"} {verb}</p>
      {labels.length === 0 ? <p className="text-slate-600 text-sm">nothing</p> : (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l, i) => (
            <span key={i} className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-200 inline-flex items-center gap-1">
              {l.logoUrl && <img src={l.logoUrl} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
              {l.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TradeCard({ trade, action, admin }: {
  trade: {
    id: number; status: string; condition: string | null; createdAt: Date;
    fromTeam?: { name: string; code: string | null; logoUrl: string | null; rookieGm?: boolean };
    toTeam?: { name: string; code: string | null; logoUrl: string | null; rookieGm?: boolean };
    fromLabels: { text: string }[]; toLabels: { text: string }[];
  };
  action: "receiver" | "proposer" | null;
  admin?: boolean;
}) {
  return (
    <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg shadow-black/20 p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <TeamHead team={trade.fromTeam} />
          <span className="text-slate-600 text-lg">⇄</span>
          <TeamHead team={trade.toTeam} />
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLE[trade.status] ?? "bg-slate-700 text-slate-300"}`}>{trade.status}</span>
      </div>
      {/* fromTeam is always the club whose GM clicked "Propose a trade" — proposeTrade
          requires session === fromTeamId, so this is a reliable "who initiated it" signal. */}
      <p className="text-xs text-slate-500 mb-3">Proposed by <span className="text-slate-300 font-semibold">{trade.fromTeam?.name ?? "?"}</span></p>

      {/* "Receives" (and the swapped-side layout) only makes sense once a trade is
          actually done — a still-pending proposal hasn't given either club anything
          yet, so it keeps reading as "X sends" under its own name. */}
      {(() => {
        const done = trade.status === "ACCEPTED" || trade.status === "COMPLETED";
        return (
          <div className="bg-slate-950/50 rounded-lg p-3 mb-3 flex gap-4">
            <AssetList team={trade.fromTeam} labels={done ? trade.toLabels : trade.fromLabels} verb={done ? "received" : "sends"} />
            <AssetList team={trade.toTeam} labels={done ? trade.fromLabels : trade.toLabels} verb={done ? "received" : "sends"} />
          </div>
        );
      })()}

      {trade.condition && <p className="text-xs text-amber-300/80 mb-3">📎 {trade.condition}</p>}
      {trade.status === "AWAITING_COMMISH" && <p className="text-xs text-amber-300/80 mb-3">🕵️ Agreed by both GMs — awaiting commission approval (rookie-GM oversight).</p>}
      {trade.status === "MODIFY" && <p className="text-xs text-sky-300/90 mb-3">✏️ The commission asked to rebalance this deal — <Link href={`/trades/build?edit=${trade.id}`} className="underline font-semibold">edit &amp; resubmit →</Link></p>}
      {trade.status === "MODIFIED" && <p className="text-xs text-fuchsia-300/90 mb-3">✏️ Modified by the GM — back with the commission for a final Accept/Decline.</p>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-600">{trade.createdAt.toLocaleDateString("sk-SK", { day: "numeric", month: "long", year: "numeric" })}</p>
        {(action || admin) && <TradeActions tradeId={trade.id} role={action} admin={admin} pending={trade.status === "PENDING"} />}
      </div>
    </div>
  );
}
