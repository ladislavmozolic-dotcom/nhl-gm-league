import { PageHeader, Card, RankBadge, Meter, Pill, TeamCell } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { loadSettings } from "@/lib/sim/settings";
import { leagueSponsors } from "@/lib/sponsorship-server";
import { sponsorMax } from "@/lib/sponsorship";
import { teamLogoMap } from "@/lib/team-logos";
import FinanceNav from "@/components/FinanceNav";

export const dynamic = "force-dynamic";

const M = (n: number) => `$${(n / 1e6).toFixed(1)}M`;

export default async function SponsorshipPage() {
  const [settings, board, logos] = await Promise.all([loadSettings(), leagueSponsors(), teamLogoMap()]);
  const signedCount = board.filter((r) => r.deal).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title="Sponsorship" subtitle="League-wide sponsorship deals" />
      <FinanceNav current="sponsorship" />
      {settings.financeMode !== "detailed" && (
        <Card><p className="text-sm text-amber-400/80">Part of the <b>Detailed Finance</b> system — switch it on in engine settings. Sign your own deal in your club&apos;s Finance → Dashboard.</p></Card>
      )}

      <Card>
        <p className="text-sm text-slate-400">
          <b className="text-slate-200">{signedCount}</b> of <b className="text-slate-200">{board.length}</b> clubs have signed a sponsor — the rest are sitting on real money left on the table.
          <InfoTip text="A club only earns sponsor revenue once its GM picks one of three offers in Finance → Dashboard; nothing is auto-signed, including for AI-run clubs with no human GM, so an 'Open' club simply hasn't chosen yet. Once signed, the AAV (plus any earned bonuses) flows straight into that club's real bank balance through the season — this isn't a cosmetic preview." />
        </p>
      </Card>

      <Card bodyClassName="p-0">
        <div className="px-4 py-2 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">League sponsorships</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <th className="px-4 py-2.5 w-8">#</th><th className="px-2 py-2.5">Club</th><th className="px-2 py-2.5 w-32">Brand</th><th className="px-2 py-2.5 text-right">AAV</th><th className="px-2 py-2.5 text-right">Term</th><th className="px-3 py-2.5 hidden sm:table-cell">Status</th>
            </tr></thead>
            <tbody>
              {board.map((r, i) => {
                const d = r.deal;
                return (
                  <tr key={r.teamId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2.5"><RankBadge rank={i + 1} /></td>
                    <td className="px-2 py-2.5"><TeamCell logoUrl={logos.get(r.teamId)} name={r.name} /></td>
                    <td className="px-2 py-2.5"><Meter pct={r.brandStrength * 100} tone={d ? "emerald" : "slate"} /></td>
                    <td className="px-2 py-2.5 text-right tabular-nums font-semibold">{d ? M(d.aav) : "—"}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-slate-400">{d ? `${d.years}y` : "—"}</td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      {d ? <Pill tone="emerald">Signed · up to {M(sponsorMax(d))}</Pill> : <Pill tone="slate">Open</Pill>}
                    </td>
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
