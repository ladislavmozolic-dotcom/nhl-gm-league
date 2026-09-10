import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { tradeSummaries } from "@/lib/trade-summary";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

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

  const TeamChip = ({ id }: { id: number }) => {
    const t = tById.get(id);
    return (
      <div className="flex items-center gap-1.5">
        {t?.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 object-contain" />}
        <span className="font-medium">{t?.code ?? t?.name ?? "?"}</span>
      </div>
    );
  };

  const fmtDate = (d: Date) => d.toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <Card title="Trades" accent="text-blue-400" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Trade</th>
                <th className="px-3 py-3 text-center font-medium w-28">Status</th>
                <th className="px-4 py-3 text-right font-medium w-32">Date</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                // fromTeam sent the "from" side assets, toTeam sent the "to" side —
                // reframe as this club's own gives/gets regardless of which side of
                // the Trade row it happens to be.
                const isFrom = t.fromTeamId === team.id;
                const s = summaries.get(t.id);
                const gives = isFrom ? s?.from : s?.to;
                const gets = isFrom ? s?.to : s?.from;
                return (
                  <tr key={t.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/trades/${t.id}`} className="block hover:text-blue-400 transition-colors">
                        <div className="flex items-center gap-2">
                          <TeamChip id={t.fromTeamId} />
                          <span className="text-slate-600">→</span>
                          <TeamChip id={t.toTeamId} />
                        </div>
                        {s && (
                          <p className="text-xs text-slate-500 mt-1">
                            <span className="text-slate-400">Gives:</span> {gives} <span className="text-slate-600">·</span> <span className="text-slate-400">Gets:</span> {gets}
                          </p>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-right text-slate-400 whitespace-nowrap">{fmtDate((t.status === "ACCEPTED" || t.status === "COMPLETED") ? (t.respondedAt ?? t.createdAt) : t.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
