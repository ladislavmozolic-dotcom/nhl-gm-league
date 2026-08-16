import { PageHeader, Card } from "@/components/ui";
import { loadSettings } from "@/lib/sim/settings";
import { leagueSponsors } from "@/lib/sponsorship-server";

export const dynamic = "force-dynamic";

const M = (n: number) => `$${(n / 1e6).toFixed(1)}M`;

export default async function SponsorshipPage() {
  const [settings, board] = await Promise.all([loadSettings(), leagueSponsors()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title="Sponsorship" subtitle="League-wide sponsorship deals" />
      {settings.financeMode !== "detailed" && (
        <Card><p className="text-sm text-amber-400/80">Part of the <b>Detailed Finance</b> system — switch it on in engine settings. Sign your own deal in your club&apos;s Finance → Dashboard.</p></Card>
      )}

      <Card bodyClassName="p-0">
        <div className="px-4 py-2 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">League sponsorships</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <th className="px-4 py-2 w-8">#</th><th className="px-3 py-2">Club</th><th className="px-2 py-2 text-right">AAV</th><th className="px-2 py-2 text-right">Term</th><th className="px-3 py-2 hidden sm:table-cell">Status</th>
            </tr></thead>
            <tbody>
              {board.map((r, i) => {
                const d = r.deal;
                return (
                  <tr key={r.teamId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2 tabular-nums text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{d ? M(d.aav) : "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{d ? `${d.years}y` : "—"}</td>
                    <td className="px-3 py-2 text-[12px] hidden sm:table-cell">{d ? <span className="text-emerald-400">Signed</span> : <span className="text-slate-500">Open</span>}</td>
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
