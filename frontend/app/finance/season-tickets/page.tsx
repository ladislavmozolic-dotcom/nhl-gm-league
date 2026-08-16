import { PageHeader, Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { loadSettings } from "@/lib/sim/settings";
import { leagueSeasonTickets } from "@/lib/season-tickets-server";

export const dynamic = "force-dynamic";

const N = (n: number) => n.toLocaleString("en-US");

export default async function SeasonTicketsBoardPage() {
  const settings = await loadSettings();
  const rows = await leagueSeasonTickets();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title="Season Tickets" subtitle="Preseason campaign — every club's season-ticket base" />
      {settings.financeMode !== "detailed" && (
        <Card><p className="text-sm text-amber-400/80">Part of the <b>Detailed Finance</b> system — switch it on in engine settings. Live preview below.</p></Card>
      )}
      <Card>
        <p className="text-sm text-slate-400">Season tickets sold vs each club&apos;s cap, with renewal rate and any waiting list.<InfoTip text="Driven by Fan Interest relative to last season: a club that overachieves and adds stars sells more and renews higher; the very best sell out and build a waiting list." /></p>
      </Card>
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-4 py-2 w-10">#</th>
                <th className="px-4 py-2">Club</th>
                <th className="px-2 py-2 text-right">Sold</th>
                <th className="px-2 py-2 text-right">% cap</th>
                <th className="px-2 py-2 text-right">Change</th>
                <th className="px-2 py-2 text-right">Renewal</th>
                <th className="px-2 py-2 text-right hidden sm:table-cell">Waiting</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.teamId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-2 tabular-nums text-slate-500">{i + 1}</td>
                  <td className="px-4 py-2 font-semibold">{r.name}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{N(r.sold)}<span className="text-slate-600"> / {N(r.sthCap)}</span></td>
                  <td className="px-2 py-2 text-right tabular-nums">{Math.round((r.sold / r.sthCap) * 100)}%</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${r.changePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right tabular-nums">{Math.round(r.renewalRate * 100)}%</td>
                  <td className="px-2 py-2 text-right tabular-nums hidden sm:table-cell">{r.waitingList > 0 ? N(r.waitingList) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
