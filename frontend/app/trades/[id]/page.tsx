import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { money } from "@/lib/finance";
import { cleanName } from "@/lib/playerName";
import { PageHeader } from "@/components/ui";
import TradeActions from "@/components/TradeActions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  ACCEPTED: "bg-green-500/20 text-green-400",
  DECLINED: "bg-red-500/20 text-red-400",
  CANCELLED: "bg-slate-600/30 text-slate-400",
  COMPLETED: "bg-green-500/20 text-green-400",
  AWAITING_COMMISH: "bg-amber-500/20 text-amber-300",
  MODIFY: "bg-sky-500/20 text-sky-300",
  MODIFIED: "bg-fuchsia-500/20 text-fuchsia-300",
};
// Rookie-GM oversight statuses read as a raw enum otherwise ("AWAITING_COMMISH") —
// spell out what's actually happening for the GM looking at their own trade.
const STATUS_LABEL: Record<string, string> = {
  AWAITING_COMMISH: "Waiting for Trade Comish to approve / decline",
  MODIFY: "Sent back to you by the Trade Comish — rebalance and resubmit",
  MODIFIED: "Resubmitted — waiting for Trade Comish review",
};

function TeamHead({ team }: { team?: { name: string | null; code: string | null; logoUrl: string | null } | null }) {
  return (
    <div className="flex items-center gap-2">
      {team?.logoUrl ? <img src={team.logoUrl} alt="" className="w-9 h-9 object-contain" />
        : <div className="w-9 h-9 bg-slate-800 rounded-full grid place-items-center text-xs font-bold text-slate-500">{team?.code || "?"}</div>}
      <span className="font-semibold">{team?.name || "Unknown"}</span>
    </div>
  );
}

export default async function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tradeId = Number(id);
  const [session, admin] = await Promise.all([getTeamSession(), isAdmin()]);
  const trade = Number.isFinite(tradeId) ? await prisma.trade.findUnique({ where: { id: tradeId } }) : null;
  if (!trade) {
    return (
      <div className="py-10 text-center">
        <p className="text-slate-400">Trade not found.</p>
        <Link href="/trades" className="text-blue-400 hover:text-blue-300 text-sm">← all trades</Link>
      </div>
    );
  }

  // a PENDING proposal is private — only the two clubs + commissioner may view it
  const involved = session === trade.fromTeamId || session === trade.toTeamId;
  if (trade.status === "PENDING" && !involved && !admin) {
    return (
      <div className="py-10 text-center space-y-2">
        <p className="text-slate-400">This trade proposal is private — only the clubs involved can see it until it&apos;s completed.</p>
        <Link href="/trades" className="text-blue-400 hover:text-blue-300 text-sm">← all trades</Link>
      </div>
    );
  }

  const [fromTeam, toTeam, assets] = await Promise.all([
    prisma.team.findUnique({ where: { id: trade.fromTeamId }, select: { name: true, code: true, logoUrl: true } }),
    prisma.team.findUnique({ where: { id: trade.toTeamId }, select: { name: true, code: true, logoUrl: true } }),
    prisma.tradeAsset.findMany({ where: { tradeId: trade.id } }),
  ]);

  const [players, prospects, picks] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: assets.filter((a) => a.playerId).map((a) => a.playerId!) } }, select: { id: true, name: true } }),
    prisma.prospect.findMany({ where: { id: { in: assets.filter((a) => a.prospectId).map((a) => a.prospectId!) } }, select: { id: true, name: true } }),
    prisma.draftPick.findMany({ where: { id: { in: assets.filter((a) => a.draftPickId).map((a) => a.draftPickId!) } }, select: { id: true, year: true, round: true, ownerLogoId: true } }),
  ]);
  const pName = new Map(players.map((p) => [p.id, p.name]));
  const proName = new Map(prospects.map((p) => [p.id, p.name]));
  // A pick's ownerLogoId is the ORIGINAL team it belongs to — not necessarily who
  // currently holds it (it may already have changed hands once via an earlier trade).
  // "2027 R3" alone doesn't say whose pick it is, so show that team's logo alongside.
  const origTeams = picks.length
    ? await prisma.team.findMany({ where: { profinhlLogoId: { in: picks.map((p) => p.ownerLogoId).filter((x): x is number => x != null) } }, select: { profinhlLogoId: true, code: true, name: true, logoUrl: true } })
    : [];
  const teamByLogoId = new Map(origTeams.map((t) => [t.profinhlLogoId, t]));
  const pickInfo = new Map(picks.map((p) => [p.id, { label: `${p.year} R${p.round}`, origTeam: teamByLogoId.get(p.ownerLogoId) ?? null }]));
  type Item = { text: string; logoUrl?: string | null };
  const labelsFor = (side: "FROM" | "TO"): Item[] =>
    assets.filter((a) => a.side === side).map((a): Item => {
      if (a.assetType === "PLAYER") return { text: `${cleanName(pName.get(a.playerId ?? -1) ?? "Player")}${a.retentionPct ? ` (${a.retentionPct}% ret.)` : ""}` };
      if (a.assetType === "PROSPECT") return { text: `⭐ ${cleanName(proName.get(a.prospectId ?? -1) ?? "Prospect")}` };
      if (a.assetType === "PICK") {
        const info = pickInfo.get(a.draftPickId ?? -1);
        const orig = info?.origTeam;
        return { text: `🎫 ${info?.label ?? "Pick"}${orig ? ` (${orig.code ?? orig.name})` : ""}`, logoUrl: orig?.logoUrl };
      }
      if (a.assetType === "CASH") return { text: `💵 ${money(a.cashAmount ?? 0)}` };
      return { text: a.assetType };
    });
  const fromLabels = labelsFor("FROM"), toLabels = labelsFor("TO");
  const role = session === trade.toTeamId ? "receiver" : session === trade.fromTeamId ? "proposer" : null;

  const done = trade.status === "ACCEPTED" || trade.status === "COMPLETED";
  const Side = ({ team, labels, verb }: { team?: { name: string | null } | null; labels: Item[]; verb: "sends" | "received" }) => (
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-500 mb-1.5">{team?.name || "Team"} {verb}</p>
      {labels.length === 0 ? <p className="text-slate-600 text-sm">nothing</p> : (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((l, i) => (
            <span key={i} className="text-sm bg-slate-800 px-2.5 py-1 rounded text-slate-100 inline-flex items-center gap-1.5">
              {l.logoUrl && <img src={l.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
              {l.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5 py-2 max-w-3xl mx-auto">
      <PageHeader title={`Trade #${trade.id}`} subtitle="Trade proposal" right={<Link href="/trades" className="text-sm text-slate-400 hover:text-blue-400">← all trades</Link>} />

      <div className="bg-slate-900/70 rounded-2xl border border-slate-800 shadow-lg shadow-black/20 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <TeamHead team={fromTeam} />
            <span className="text-slate-600 text-lg">⇄</span>
            <TeamHead team={toTeam} />
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLE[trade.status] ?? "bg-slate-700 text-slate-300"}`}>{STATUS_LABEL[trade.status] ?? trade.status}</span>
        </div>

        <div className="bg-slate-950/50 rounded-lg p-4 mb-3 flex gap-4 flex-col sm:flex-row">
          {/* "Receives" (and the swapped-side layout) only once the trade is actually
              ACCEPTED — a still-pending proposal hasn't given either club anything
              yet, so it keeps reading as "X sends" under its own name. */}
          <Side team={fromTeam} labels={done ? toLabels : fromLabels} verb={done ? "received" : "sends"} />
          <span className="hidden sm:block text-slate-700 self-center">⇄</span>
          <Side team={toTeam} labels={done ? fromLabels : toLabels} verb={done ? "received" : "sends"} />
        </div>

        {trade.condition && <p className="text-xs text-amber-300/80 mb-3">📎 {trade.condition}</p>}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-600">{trade.createdAt.toLocaleDateString("sk-SK", { day: "numeric", month: "long", year: "numeric" })}</p>
          {(role || admin) && <TradeActions tradeId={trade.id} role={role} admin={admin} pending={trade.status === "PENDING"} />}
        </div>
        {!role && !admin && trade.status === "PENDING" && (
          <p className="text-xs text-slate-500 mt-3">Sign in as {toTeam?.name ?? "the receiving club"} to accept or decline this proposal.</p>
        )}
      </div>
    </div>
  );
}
