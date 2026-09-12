import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { tradeSummaries } from "@/lib/trade-summary";
import ClickableCard from "@/components/ClickableCard";
import TradeAssetChips from "@/components/TradeAssetChips";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ACCEPTED"
      ? "bg-green-500/15 text-green-400 border-green-500/20"
      : status === "PENDING"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
      : "bg-slate-700/40 text-slate-400 border-slate-600/30";
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
      {status}
    </span>
  );
}

export default async function TeamTradesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  const trades = await prisma.trade.findMany({
    where: { OR: [{ fromTeamId: team.id }, { toTeamId: team.id }] },
    orderBy: { createdAt: "desc" },
  });

  const teamIds = [...new Set(trades.flatMap((t) => [t.fromTeamId, t.toTeamId]))];
  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, name: true, code: true, logoUrl: true },
  });
  const tById = new Map(teams.map((t) => [t.id, t]));
  const summaries = await tradeSummaries(trades.map((t) => t.id));

  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <Card title="Trades" accent="text-blue-400">
          <p className="text-slate-500 text-center py-8">No trades yet.</p>
        </Card>
      </div>
    );
  }

  const TeamMark = ({ id, big = false }: { id: number; big?: boolean }) => {
    const t = tById.get(id);
    return (
      <div className="flex items-center gap-2">
        {t?.logoUrl && (
          <img src={t.logoUrl} alt="" className={big ? "w-10 h-10 object-contain drop-shadow" : "w-6 h-6 object-contain"} />
        )}
        <span className={big ? "font-black text-lg tracking-tight" : "font-semibold text-sm"}>{t?.code ?? t?.name ?? "?"}</span>
      </div>
    );
  };

  const fmtDate = (d: Date) => d.toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-slate-200">Trade Tracker</h1>
      <div className="space-y-4">
        {trades.map((t) => {
          // fromTeam sent the "from" side assets, toTeam sent the "to" side —
          // reframe as this club's own gives/gets regardless of which side of
          // the Trade row it happens to be.
          const isFrom = t.fromTeamId === team.id;
          const s = summaries.get(t.id);
          const gives = (isFrom ? s?.from : s?.to) ?? [];
          const gets = (isFrom ? s?.to : s?.from) ?? [];
          const otherTeamId = isFrom ? t.toTeamId : t.fromTeamId;
          return (
            <ClickableCard key={t.id} href={`/trades/${t.id}`}
              className="block rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg shadow-black/20 overflow-hidden hover:border-blue-500/40 hover:shadow-blue-500/5 transition-colors cursor-pointer">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-800/40 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <TeamMark id={team.id} big />
                  <span className="text-slate-500 text-xl">⇄</span>
                  <TeamMark id={otherTeamId} big />
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={t.status} />
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {fmtDate((t.status === "ACCEPTED" || t.status === "COMPLETED") ? (t.respondedAt ?? t.createdAt) : t.createdAt)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-400 mb-2">You Get</div>
                  <TradeAssetChips items={gets} kind="get" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-2">You Give</div>
                  <TradeAssetChips items={gives} kind="give" />
                </div>
              </div>
            </ClickableCard>
          );
        })}
      </div>
    </div>
  );
}
