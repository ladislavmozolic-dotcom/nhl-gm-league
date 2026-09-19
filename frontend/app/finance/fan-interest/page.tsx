import { PageHeader, Card, RankBadge, Meter, Pill, TeamCell } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { loadSettings } from "@/lib/sim/settings";
import { leagueFanInterest } from "@/lib/fan-interest-server";
import { teamLogoMap } from "@/lib/team-logos";
import { interestArrow, interestAccent, type ExpectationTier } from "@/lib/fan-interest";
import { CONTENTION_LABELS } from "@/lib/free-agency";
import FinanceNav from "@/components/FinanceNav";

export const dynamic = "force-dynamic";

const tierPill: Record<ExpectationTier, "green" | "slate" | "sky" | "amber"> = {
  contender: "green",
  middle: "slate",
  rising: "sky",
  rebuild: "amber",
};

export default async function FanInterestBoardPage() {
  const [settings, rows, logos] = await Promise.all([loadSettings(), leagueFanInterest(), teamLogoMap()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title="Fan Interest" subtitle="Performance and team direction — the pulse of every fanbase" />
      <FinanceNav current="fan-interest" />
      {settings.financeMode !== "detailed" && (
        <Card><p className="text-sm text-amber-400/80">This league runs the <b>base</b> finance system. The Fan Interest board remains available as a live league overview.</p></Card>
      )}
      <Card>
        <p className="text-sm text-slate-400">Every club&apos;s Fan Interest (0–100) with its swing against the neutral baseline for its team direction.<InfoTip text="Team direction uses the same contender, middle, rising and rebuild calculation as Free Agents. The same result affects clubs differently: a contender that underperforms falls, while a rebuilder that overachieves climbs. Recent form, streaks and marquee star power also affect the score." /></p>
      </Card>
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-4 py-2.5 w-10">#</th>
                <th className="px-2 py-2.5">Club</th>
                <th className="px-2 py-2.5">Team direction</th>
                <th className="px-2 py-2.5 w-40">Interest</th>
                <th className="px-4 py-2.5 hidden sm:table-cell">Main reasons</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.teamId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-2.5"><RankBadge rank={i + 1} /></td>
                  <td className="px-2 py-2.5"><TeamCell logoUrl={logos.get(r.teamId)} name={r.name} /></td>
                  <td className="px-2 py-2.5"><Pill tone={tierPill[r.tier]}>{CONTENTION_LABELS[r.tier]}</Pill></td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="tabular-nums font-bold">{r.interest}</span>
                      <span className={`text-xs font-bold ${interestAccent(r.delta)}`}>{interestArrow(r.delta)}{r.delta !== 0 ? Math.abs(r.delta) : ""}</span>
                    </div>
                    <Meter pct={r.interest} tone="fuchsia" className="mt-1" />
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-400 hidden sm:table-cell">{r.reasons.join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
