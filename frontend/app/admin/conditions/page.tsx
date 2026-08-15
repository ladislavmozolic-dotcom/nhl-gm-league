import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ConditionActions from "@/components/ConditionActions";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminConditionsPage() {
  const [conditions, teams] = await Promise.all([
    prisma.tradeCondition.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    prisma.team.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = (id: number) => teams.find((t) => t.id === id)?.name ?? `#${id}`;
  const pending = conditions.filter((c) => c.status === "PENDING");

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Trade Conditions"
        subtitle={`Conditional future compensation from trades. Mark a condition fulfilled once its terms are met — the settlement is logged to the transaction feed. ${pending.length} pending.`}
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>}
      />

      {conditions.length === 0 ? (
        <Card><p className="text-center text-slate-500 py-8">No trade conditions recorded yet. They are created from trades that carry a condition.</p></Card>
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider bg-slate-800/30">
                  <th className="px-4 py-3 text-left font-medium">Condition</th>
                  <th className="px-3 py-3 text-left font-medium">From → To</th>
                  <th className="px-3 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Resolve</th>
                </tr>
              </thead>
              <tbody>
                {conditions.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                    <td className="px-4 py-3">{c.description}{c.tradeId && <Link href="/trades" className="text-slate-500 text-xs ml-2 hover:text-blue-400">#{c.tradeId}</Link>}</td>
                    <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{nameOf(c.fromTeamId)} → {nameOf(c.toTeamId)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.status === "FULFILLED" ? "bg-green-500/20 text-green-400" : c.status === "EXPIRED" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right"><ConditionActions id={c.id} status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
