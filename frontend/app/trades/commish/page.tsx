import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isCommission, getTeamSession } from "@/lib/auth";
import { cleanName } from "@/lib/playerName";
import { PageHeader, Card } from "@/components/ui";
import CommishTradeActions from "@/components/CommishTradeActions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { txt: string; cls: string }> = {
  PENDING: { txt: "Proposed — awaiting the other GM", cls: "bg-yellow-500/20 text-yellow-400" },
  AWAITING_COMMISH: { txt: "Awaiting review", cls: "bg-amber-500/20 text-amber-300" },
  MODIFY: { txt: "With GM (modifying)", cls: "bg-sky-500/20 text-sky-300" },
  MODIFIED: { txt: "Modified — re-review", cls: "bg-fuchsia-500/20 text-fuchsia-300" },
};

/** Readable asset lists for one trade, split by side. */
async function summarize(tradeId: number) {
  const assets = await prisma.tradeAsset.findMany({ where: { tradeId } });
  const pids = assets.filter((a) => a.assetType === "PLAYER" && a.playerId).map((a) => a.playerId!) as number[];
  const prids = assets.filter((a) => a.assetType === "PROSPECT" && a.prospectId).map((a) => a.prospectId!) as number[];
  const pkids = assets.filter((a) => a.assetType === "PICK" && a.draftPickId).map((a) => a.draftPickId!) as number[];
  const [players, prospects, picks] = await Promise.all([
    pids.length ? prisma.player.findMany({ where: { id: { in: pids } }, select: { id: true, name: true } }) : [],
    prids.length ? prisma.prospect.findMany({ where: { id: { in: prids } }, select: { id: true, name: true } }) : [],
    pkids.length ? prisma.draftPick.findMany({ where: { id: { in: pkids } }, select: { id: true, year: true, round: true, ownerLogoId: true } }) : [],
  ]);
  const pN = new Map(players.map((p) => [p.id, cleanName(p.name)]));
  const prN = new Map(prospects.map((p) => [p.id, cleanName(p.name)]));
  // ownerLogoId = the pick's ORIGINAL team — a compact text list, so just append the
  // code rather than a logo (matching /trades and /trades/[id], which show the logo).
  const origTeams = picks.length
    ? await prisma.team.findMany({ where: { profinhlLogoId: { in: picks.map((p) => p.ownerLogoId).filter((x): x is number => x != null) } }, select: { profinhlLogoId: true, code: true } })
    : [];
  const codeByLogoId = new Map(origTeams.map((t) => [t.profinhlLogoId, t.code]));
  const pkN = new Map(picks.map((p) => [p.id, `${p.year} R${p.round}${codeByLogoId.get(p.ownerLogoId) ? ` (${codeByLogoId.get(p.ownerLogoId)})` : ""}`]));
  const side = (s: "FROM" | "TO") => assets.filter((a) => a.side === s).map((a) =>
    a.assetType === "PLAYER" ? pN.get(a.playerId!) ?? "player"
    : a.assetType === "PROSPECT" ? prN.get(a.prospectId!) ?? "prospect"
    : a.assetType === "PICK" ? pkN.get(a.draftPickId!) ?? "pick"
    : a.assetType === "CASH" ? `$${((a.cashAmount ?? 0) / 1e6).toFixed(2)}M` : "asset");
  return { from: side("FROM"), to: side("TO") };
}

type TeamMini = { id: number; name: string; code: string | null; rookieGm: boolean };
type Row = { t: { id: number; status: string; fromTeamId: number; toTeamId: number; condition: string | null; commishNote: string | null }; sum: { from: string[]; to: string[] } };

function TradeCard({ t, sum, teams, myTeamId, actionable }: { t: Row["t"]; sum: Row["sum"]; teams: Map<number, TeamMini>; myTeamId: number | null; actionable: boolean }) {
  const from = teams.get(t.fromTeamId), to = teams.get(t.toTeamId);
  const badge = (x?: { rookieGm: boolean }) => (x?.rookieGm ? <span className="text-[10px] font-bold text-rose-400 ml-1">(R)</span> : null);
  const st = STATUS_LABEL[t.status] ?? { txt: t.status, cls: "bg-slate-700 text-slate-300" };
  const conflicted = myTeamId === t.fromTeamId || myTeamId === t.toTeamId;
  return (
    <Card key={t.id}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">Trade #{t.id} · Proposed by <span className="text-slate-300 font-semibold">{from?.name ?? "?"}</span></span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.cls}`}>{st.txt}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <div className="font-bold text-sm mb-1">{from?.name}{badge(from)} <span className="text-slate-500 font-normal">gives →</span></div>
          <ul className="text-sm text-slate-300 space-y-0.5">{sum.from.length ? sum.from.map((x, i) => <li key={i}>• {x}</li>) : <li className="text-slate-600">nothing</li>}</ul>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
          <div className="font-bold text-sm mb-1">{to?.name}{badge(to)} <span className="text-slate-500 font-normal">gives →</span></div>
          <ul className="text-sm text-slate-300 space-y-0.5">{sum.to.length ? sum.to.map((x, i) => <li key={i}>• {x}</li>) : <li className="text-slate-600">nothing</li>}</ul>
        </div>
      </div>
      {t.condition && <p className="text-xs text-slate-400 mt-2">Condition: {t.condition}</p>}
      {t.commishNote && <p className="text-xs text-amber-300 mt-2">✏️ Your note: {t.commishNote}</p>}
      {actionable && (
        <div className="mt-3">
          {conflicted ? (
            <p className="text-xs text-slate-500 italic">You're a club on this trade — a different Trade Comish member has to review it.</p>
          ) : (
            <CommishTradeActions tradeId={t.id} status={t.status} />
          )}
        </div>
      )}
    </Card>
  );
}

export default async function CommishTradesPage() {
  if (!(await isCommission())) redirect("/trades");
  const myTeamId = await getTeamSession();

  const [actionableTrades, pendingTrades] = await Promise.all([
    prisma.trade.findMany({ where: { status: { in: ["AWAITING_COMMISH", "MODIFY", "MODIFIED"] } }, orderBy: { createdAt: "desc" } }),
    // Visibility-only: a rookie-GM proposal the other club hasn't responded to yet.
    // Nothing to approve until they accept — this is early awareness, not a queue.
    prisma.trade.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" } }),
  ]);
  const teamIds = [...new Set([...actionableTrades, ...pendingTrades].flatMap((t) => [t.fromTeamId, t.toTeamId]))];
  const teams = new Map((await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true, code: true, rookieGm: true } })).map((t) => [t.id, t]));
  const rookiePending = pendingTrades.filter((t) => teams.get(t.fromTeamId)?.rookieGm || teams.get(t.toTeamId)?.rookieGm);

  const actionableRows = await Promise.all(actionableTrades.map(async (t) => ({ t, sum: await summarize(t.id) })));
  const pendingRows = await Promise.all(rookiePending.map(async (t) => ({ t, sum: await summarize(t.id) })));

  return (
    <div className="space-y-5 py-2">
      <PageHeader title="Trade Commission" subtitle="Rookie-GM trades awaiting commission review. Accept executes the deal · Decline kills it · Modify sends it back to the GM to rebalance." />
      {actionableRows.length === 0 ? (
        <Card><p className="text-center text-slate-500 py-10 text-sm">No trades awaiting review. 🎉</p></Card>
      ) : actionableRows.map(({ t, sum }) => (
        <TradeCard key={t.id} t={t} sum={sum} teams={teams} myTeamId={myTeamId} actionable />
      ))}

      {pendingRows.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Proposed — not yet actionable</h2>
          <p className="text-xs text-slate-500 -mt-2">A rookie GM is involved, but the other club hasn't accepted yet. Shown for early visibility only — nothing to review until they respond.</p>
          {pendingRows.map(({ t, sum }) => (
            <TradeCard key={t.id} t={t} sum={sum} teams={teams} myTeamId={myTeamId} actionable={false} />
          ))}
        </div>
      )}
    </div>
  );
}
