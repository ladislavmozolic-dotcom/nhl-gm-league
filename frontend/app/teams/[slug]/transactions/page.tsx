import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";
import { TX_WHERE } from "@/app/transactions/page";

export const dynamic = "force-dynamic";

// Team-scoped transactions — the completed moves from the league feed that involve
// THIS club (signings, trades, waivers, call-ups). Same "no in-progress noise" filter.
export default async function TeamTransactionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true, code: true, logoUrl: true } });
  if (!team) notFound();

  const recent = await prisma.transaction.findMany({ where: TX_WHERE, orderBy: { createdAt: "desc" }, take: 400 });
  const codeRe = team.code ? new RegExp(`\\b${team.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`) : null;
  const mine = recent.filter((t) => (team.name && t.message.includes(team.name)) || (codeRe && codeRe.test(t.message))).slice(0, 80);

  return (
    <div className="space-y-5">
      <PageHeader title={`${team.name} — Transactions`} subtitle="Completed moves involving this club — signings, trades, waivers, call-ups" />
      {mine.length === 0 ? (
        <Card><p className="text-slate-500 text-center py-8">No transactions for this club yet.</p></Card>
      ) : (
        <div className="space-y-2.5">
          {mine.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${tx.type === "TRADE" ? "bg-green-500" : tx.type === "SIGNING" ? "bg-blue-500" : tx.type === "WAIVER" || tx.type === "CLAIM" ? "bg-yellow-500" : "bg-slate-500"}`} />
              {team.logoUrl && <img src={team.logoUrl} alt="" className="w-7 h-7 object-contain shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{tx.message}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{tx.type}</p>
              </div>
              <p className="text-xs text-slate-500 shrink-0">{tx.createdAt.toLocaleDateString("sk-SK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
