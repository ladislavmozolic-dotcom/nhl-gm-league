import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { loadSettings } from "@/lib/sim/settings";
import { leagueMerch, topJerseys } from "@/lib/merchandise-server";

export const dynamic = "force-dynamic";

const M = (n: number) => `$${(n / 1e6).toFixed(1)}M`;
const N = (n: number) => n.toLocaleString("en-US");

export default async function MerchandisePage() {
  const [settings, merch, jerseys] = await Promise.all([loadSettings(), leagueMerch(), topJerseys(30)]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title="Merchandise" subtitle="Jerseys, apparel & the league's best-sellers" />
      {settings.financeMode !== "detailed" && (
        <Card><p className="text-sm text-amber-400/80">Part of the <b>Detailed Finance</b> system — switch it on in engine settings. Live preview below.</p></Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card bodyClassName="p-0">
          <div className="px-4 py-2 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">Club merch revenue<InfoTip text="Jersey revenue is the sum of the club's players' individual sales (driven by Star Power); apparel and other goods scale with Fan Interest." /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-4 py-2 w-8">#</th><th className="px-3 py-2">Club</th>
                <th className="px-2 py-2 text-right">Total</th><th className="px-2 py-2 text-right hidden sm:table-cell">Jerseys</th><th className="px-3 py-2 hidden md:table-cell">Top seller</th>
              </tr></thead>
              <tbody>
                {merch.map((r, i) => (
                  <tr key={r.teamId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2 tabular-nums text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">{M(r.total)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-400 hidden sm:table-cell">{M(r.jerseys)}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-400 hidden md:table-cell">{r.topJersey ?? "—"}</td>
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
                <th className="px-4 py-2 w-8">#</th><th className="px-3 py-2">Player</th><th className="px-2 py-2">Team</th><th className="px-2 py-2 text-right">Units</th>
              </tr></thead>
              <tbody>
                {jerseys.map((r, i) => (
                  <tr key={r.playerId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2 tabular-nums text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2"><Link href={`/players/${r.playerId}`} className="font-semibold hover:text-blue-400">{r.name}</Link><span className="ml-1.5 text-[11px] text-slate-500">{r.position}</span></td>
                    <td className="px-2 py-2 text-slate-400">{r.teamCode ?? "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">{N(r.units)}</td>
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
