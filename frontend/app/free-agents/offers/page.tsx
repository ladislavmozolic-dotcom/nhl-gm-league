import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import PlayerLink from "@/components/PlayerLink";
import { money } from "@/lib/finance";
import { getAllActiveOffersAction } from "@/app/free-agents/actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending", COUNTERED: "Countered", SHORTLISTED: "Shortlisted", ACCEPTED: "Accepted",
};

export default async function AllOffersPage() {
  const r = await getAllActiveOffersAction();

  return (
    <div className="space-y-6 py-2 max-w-4xl">
      <PageHeader
        title="All Active Offers"
        subtitle="Every free agent currently carrying at least one standing offer — commissioner / co-commissioner view."
        right={<Link href="/free-agents" className="text-sm text-slate-400 hover:text-blue-400">← Free Agent Frenzy</Link>}
      />

      {!r.ok ? (
        <Card><p className="text-sm text-rose-400">🔒 {r.error}</p></Card>
      ) : r.players.length === 0 ? (
        <Card><p className="text-sm text-slate-500">Nobody has an active offer right now.</p></Card>
      ) : (
        <Card bodyClassName="p-0">
          <div className="divide-y divide-slate-800/60">
            {r.players.map((p) => (
              <div key={p.playerId} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <PlayerLink name={p.name} slug={p.slug} id={p.playerId} className="font-semibold text-white" />
                  <span className="text-xs text-slate-500">{p.position}</span>
                  <span className="text-xs text-slate-600 ml-auto">{p.offers.length} offer{p.offers.length === 1 ? "" : "s"}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 uppercase tracking-wide">
                        <th className="text-left font-medium py-1 pr-3">Team</th>
                        <th className="text-right font-medium py-1 pr-3">Salary</th>
                        <th className="text-center font-medium py-1 pr-3">Years</th>
                        {!p.isGoalie && <th className="text-center font-medium py-1 pr-3">Line</th>}
                        {!p.isGoalie && <th className="text-center font-medium py-1 pr-3">PP/PK</th>}
                        <th className="text-center font-medium py-1 pr-3">Round</th>
                        <th className="text-center font-medium py-1 pr-3">Status</th>
                        <th className="text-right font-medium py-1">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.offers.map((o, i) => (
                        <tr key={i} className="border-t border-slate-800/40">
                          <td className="py-1.5 pr-3 font-semibold text-slate-200">{o.teamCode}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums text-emerald-400">{money(o.salary)}</td>
                          <td className="py-1.5 pr-3 text-center text-slate-400">{o.years}</td>
                          {!p.isGoalie && <td className="py-1.5 pr-3 text-center text-slate-400">{o.line}</td>}
                          {!p.isGoalie && <td className="py-1.5 pr-3 text-center text-slate-400">{o.pp ? "PP" : ""}{o.pp && o.pk ? "/" : ""}{o.pk ? "PK" : ""}{!o.pp && !o.pk ? "—" : ""}</td>}
                          <td className="py-1.5 pr-3 text-center text-slate-400">{o.round || "—"}</td>
                          <td className="py-1.5 pr-3 text-center text-slate-400">{STATUS_LABEL[o.status] ?? o.status}</td>
                          <td className="py-1.5 text-right text-slate-500">{new Date(o.updatedAt).toLocaleString("sk-SK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <p className="text-xs text-slate-500 px-1">Sorted by each player's highest offer. Blind bidding still applies to a co-commissioner: the commissioner's own bids never show here.</p>
    </div>
  );
}
