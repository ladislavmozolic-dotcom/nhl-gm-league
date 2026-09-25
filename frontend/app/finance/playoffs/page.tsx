import { PageHeader, Card, RankBadge, TeamCell } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { loadSettings } from "@/lib/sim/settings";
import { leagueDetailedFinance } from "@/lib/detailed-finance-server";
import { playoffGameRevenue, playoffMerchBoost, playoffRoundLabel } from "@/lib/sponsorship";
import { financeTuningFrom } from "@/lib/finance-tuning";
import { teamLogoMap } from "@/lib/team-logos";
import { prisma } from "@/lib/prisma";
import FinanceNav from "@/components/FinanceNav";

export const dynamic = "force-dynamic";

const M = (n: number) => `$${(n / 1e6).toFixed(2)}M`;
const ROUNDS = [1, 2, 3, 4];

// Playoff Revenue — what a playoff run is worth. Earned columns come from the
// same leagueDetailedFinance() that feeds every club's bank, so this page can
// never disagree with the Finance Dashboard. The projection shows what ONE home
// game in each round would gross at the club's current attendance.
export default async function PlayoffRevenuePage() {
  const [settings, fin, logos, teams] = await Promise.all([
    loadSettings(), leagueDetailedFinance(), teamLogoMap(),
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, name: true } }),
  ]);
  const tuning = financeTuningFrom(settings as unknown as Record<string, unknown>);
  const rows = teams.map((t) => ({ id: t.id, name: t.name, f: fin.get(t.id) })).filter((r) => r.f?.playoff);
  const earned = rows.map((r) => ({ ...r, total: (r.f!.playoff!.gate + r.f!.playoff!.merch + r.f!.playoff!.sponsorBonus) }))
    .sort((a, b) => b.total - a.total || (b.f!.playoff!.deepestRound - a.f!.playoff!.deepestRound));
  const anyPlayoffs = earned.some((r) => r.f!.playoff!.deepestRound > 0);
  const projection = [...rows].sort((a, b) => playoffGameRevenue(4, b.f!.playoff!.attendancePct, b.f!.playoff!.capacity, tuning) - playoffGameRevenue(4, a.f!.playoff!.attendancePct, a.f!.playoff!.capacity, tuning));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
      <PageHeader title="Playoff Revenue" subtitle="What a playoff run is worth — gates, merchandise and sponsor bonuses" />
      <FinanceNav current="playoffs" />
      {settings.financeMode !== "detailed" && (
        <Card><p className="text-sm text-amber-400/80">Part of the <b>Detailed Finance</b> system — switch it on in engine settings. Shown here as a live preview.</p></Card>
      )}

      <Card>
        <p className="text-sm text-slate-400">
          Every home playoff game is priced at <b className="text-slate-200">${tuning.playoffSeatBase} + ${tuning.playoffSeatPerRound} × round</b> per seat, filled at the club&apos;s current attendance.
          A playoff run also lifts merchandise by <b className="text-slate-200">{tuning.playoffMerchPerRoundPct}% per round</b> reached, and triggers any sponsor milestone bonuses.
          <InfoTip text="All three numbers are commissioner-tunable in Admin ▸ Simulation ▸ Finance ▸ Detailed-finance revenue constants." />
        </p>
      </Card>

      <Card bodyClassName="p-0">
        <div className="px-4 py-2 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">Earned this postseason</div>
        {!anyPlayoffs ? (
          <p className="px-4 py-4 text-sm text-slate-500">The playoffs haven&apos;t started yet — this table fills in game by game once they do.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-4 py-2.5 w-8">#</th><th className="px-2 py-2.5">Club</th><th className="px-2 py-2.5">Reached</th>
                <th className="px-2 py-2.5 text-right">Home games</th><th className="px-2 py-2.5 text-right">Gates</th><th className="px-2 py-2.5 text-right">Merch</th>
                <th className="px-2 py-2.5 text-right">Sponsor bonus</th><th className="px-3 py-2.5 text-right">Total</th>
              </tr></thead>
              <tbody>
                {earned.filter((r) => r.f!.playoff!.deepestRound > 0).map((r, i) => {
                  const p = r.f!.playoff!;
                  return (
                    <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-2.5"><RankBadge rank={i + 1} /></td>
                      <td className="px-2 py-2.5"><TeamCell logoUrl={logos.get(r.id)} name={r.name} /></td>
                      <td className="px-2 py-2.5 text-slate-400">{playoffRoundLabel(p.deepestRound)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{p.homeGames}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{M(p.gate)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{M(p.merch)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{p.sponsorBonus ? M(p.sponsorBonus) : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-400">{M(r.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card bodyClassName="p-0">
        <div className="px-4 py-2 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
          Projection — one home game, by round<InfoTip text="Gate for a single home playoff game at the club's current attendance and arena size. Merchandise uplift per round is shown in the last column." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <th className="px-4 py-2.5">Club</th><th className="px-2 py-2.5 text-right">Arena</th><th className="px-2 py-2.5 text-right">Att.</th>
              {ROUNDS.map((r) => <th key={r} className="px-2 py-2.5 text-right">{playoffRoundLabel(r)}</th>)}
            </tr></thead>
            <tbody>
              {projection.map((r) => {
                const p = r.f!.playoff!;
                return (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2"><TeamCell logoUrl={logos.get(r.id)} name={r.name} /></td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-400">{p.capacity.toLocaleString("en-US")}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-400">{Math.round(p.attendancePct * 100)}%</td>
                    {ROUNDS.map((rd) => <td key={rd} className="px-2 py-2 text-right tabular-nums">{M(playoffGameRevenue(rd, p.attendancePct, p.capacity, tuning))}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-800">Merchandise uplift: {ROUNDS.map((r) => `${playoffRoundLabel(r)} +${Math.round((playoffMerchBoost(r, tuning) - 1) * 100)}%`).join(" · ")}</p>
      </Card>
    </div>
  );
}
