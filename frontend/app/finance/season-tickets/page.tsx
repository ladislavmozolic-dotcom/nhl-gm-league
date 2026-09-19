import { PageHeader, Card, RankBadge, Meter, TeamCell } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { loadSettings } from "@/lib/sim/settings";
import { leagueSeasonTickets } from "@/lib/season-tickets-server";
import { teamLogoMap } from "@/lib/team-logos";
import FinanceNav from "@/components/FinanceNav";

export const dynamic = "force-dynamic";

const N = (n: number) => n.toLocaleString("en-US");

export default async function SeasonTicketsBoardPage() {
  const [settings, rows, logos] = await Promise.all([loadSettings(), leagueSeasonTickets(), teamLogoMap()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title="Season Tickets" subtitle="Preseason campaign — every club's season-ticket base" />
      <FinanceNav current="season-tickets" />
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
                <th className="px-4 py-2.5 w-10">#</th>
                <th className="px-2 py-2.5">Club</th>
                <th className="px-2 py-2.5 w-36">Sold</th>
                <th className="px-2 py-2.5 text-right">Change</th>
                <th className="px-2 py-2.5 w-28">Renewal</th>
                <th className="px-2 py-2.5 text-right hidden sm:table-cell">Waiting</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pctCap = Math.round((r.sold / r.sthCap) * 100);
                return (
                  <tr key={r.teamId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2.5"><RankBadge rank={i + 1} /></td>
                    <td className="px-2 py-2.5"><TeamCell logoUrl={logos.get(r.teamId)} name={r.name} /></td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-baseline justify-between gap-2 tabular-nums text-[12px] whitespace-nowrap">
                        <span className="font-semibold">{N(r.sold)}<span className="text-slate-600"> / {N(r.sthCap)}</span></span>
                        <span className="text-slate-500 shrink-0">{pctCap}%</span>
                      </div>
                      <Meter pct={pctCap} tone="blue" className="mt-1" />
                    </td>
                    <td className={`px-2 py-2.5 text-right tabular-nums font-semibold ${r.changePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(1)}%</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-baseline justify-between gap-1 tabular-nums text-[12px]">
                        <span className="text-slate-400">Renewal</span>
                        <span className="font-semibold">{Math.round(r.renewalRate * 100)}%</span>
                      </div>
                      <Meter pct={r.renewalRate * 100} tone="emerald" className="mt-1" />
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums hidden sm:table-cell">{r.waitingList > 0 ? N(r.waitingList) : "—"}</td>
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
