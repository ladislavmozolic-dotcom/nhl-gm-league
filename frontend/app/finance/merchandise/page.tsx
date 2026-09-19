import Link from "next/link";
import { PageHeader, Card, RankBadge, Meter, TeamCell } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { loadSettings } from "@/lib/sim/settings";
import { leagueMerch, topJerseys } from "@/lib/merchandise-server";
import { teamLogoMap } from "@/lib/team-logos";
import FinanceNav from "@/components/FinanceNav";

export const dynamic = "force-dynamic";

const M = (n: number) => `$${(n / 1e6).toFixed(1)}M`;
const N = (n: number) => n.toLocaleString("en-US");

export default async function MerchandisePage() {
  const [settings, merch, jerseys, logos] = await Promise.all([loadSettings(), leagueMerch(), topJerseys(30), teamLogoMap()]);
  const maxTotal = Math.max(1, ...merch.map((r) => r.total));
  const maxUnits = Math.max(1, ...jerseys.map((r) => r.units));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title="Merchandise" subtitle="Jerseys, apparel & the league's best-sellers" />
      <FinanceNav current="merchandise" />
      {settings.financeMode !== "detailed" && (
        <Card><p className="text-sm text-amber-400/80">Part of the <b>Detailed Finance</b> system — switch it on in engine settings. Live preview below.</p></Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card bodyClassName="p-0">
          <div className="px-4 py-2 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">Club merch revenue<InfoTip text="Jersey revenue is the sum of the club's players' individual sales (driven by Star Power); apparel and other goods scale with Fan Interest." /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-4 py-2.5 w-8">#</th><th className="px-2 py-2.5">Club</th>
                <th className="px-2 py-2.5 w-32">Total</th><th className="px-2 py-2.5 text-right hidden sm:table-cell">Jerseys</th><th className="px-3 py-2.5 hidden md:table-cell">Top seller</th>
              </tr></thead>
              <tbody>
                {merch.map((r, i) => (
                  <tr key={r.teamId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2.5"><RankBadge rank={i + 1} /></td>
                    <td className="px-2 py-2.5"><TeamCell logoUrl={logos.get(r.teamId)} name={r.name} /></td>
                    <td className="px-2 py-2.5">
                      <div className="tabular-nums text-[12px] font-semibold">{M(r.total)}</div>
                      <Meter pct={(r.total / maxTotal) * 100} tone="amber" className="mt-1" />
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-400 hidden sm:table-cell">{M(r.jerseys)}</td>
                    <td className="px-3 py-2.5 text-[12px] text-slate-400 hidden md:table-cell">{r.topJersey ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card bodyClassName="p-0">
          <div className="px-4 py-2 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">Top selling jerseys<InfoTip text="League-wide jersey unit sales. Driven by each player's Star Power — a superstar moves far more units than a depth player, whatever the club." /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-4 py-2.5 w-8">#</th><th className="px-3 py-2.5">Player</th><th className="px-2 py-2.5">Team</th><th className="px-2 py-2.5 w-28 text-right">Units</th>
              </tr></thead>
              <tbody>
                {jerseys.map((r, i) => (
                  <tr key={r.playerId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2.5"><RankBadge rank={i + 1} /></td>
                    <td className="px-3 py-2.5"><Link href={`/players/${r.playerId}`} className="font-semibold hover:text-blue-400">{r.name}</Link><span className="ml-1.5 text-[11px] text-slate-500">{r.position}</span></td>
                    <td className="px-2 py-2.5 text-slate-400">{r.teamCode ?? "—"}</td>
                    <td className="px-2 py-2.5">
                      <div className="text-right tabular-nums font-semibold text-[12px]">{N(r.units)}</div>
                      <Meter pct={(r.units / maxUnits) * 100} tone="fuchsia" className="mt-1" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
