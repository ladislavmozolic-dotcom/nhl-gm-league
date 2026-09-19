import { PageHeader, Card, RankBadge, Meter, Pill, TeamCell } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { loadSettings } from "@/lib/sim/settings";
import { leagueAttendance } from "@/lib/attendance-server";
import { teamLogoMap } from "@/lib/team-logos";
import FinanceNav from "@/components/FinanceNav";

export const dynamic = "force-dynamic";

const N = (n: number) => n.toLocaleString("en-US");
const pricingPill = { LOW: "slate", STANDARD: "sky", PREMIUM: "amber" } as const;

export default async function AttendanceBoardPage() {
  const [settings, rows, logos] = await Promise.all([loadSettings(), leagueAttendance(), teamLogoMap()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title="Attendance & Pricing" subtitle="Who fills the building — league-wide" />
      <FinanceNav current="attendance" />
      {settings.financeMode !== "detailed" && (
        <Card><p className="text-sm text-amber-400/80">Part of the <b>Detailed Finance</b> system — switch it on in engine settings. Live preview below. Set your own pricing in your club&apos;s Finance → Dashboard.</p></Card>
      )}

      <Card>
        <p className="text-sm text-slate-400">Average attendance for every club — the crowd each home game draws off Fan Interest and pricing.<InfoTip text="Each home game's crowd comes from Fan Interest plus the specific matchup's pull (rivalry, a visiting star, the stakes), nudged by ticket pricing. Season-ticket holders are a near-guaranteed floor." /></p>
      </Card>
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-4 py-2.5 w-10">#</th>
                <th className="px-2 py-2.5">Club</th>
                <th className="px-2 py-2.5">Pricing</th>
                <th className="px-2 py-2.5 w-36">Avg / capacity</th>
                <th className="px-2 py-2.5 text-right hidden sm:table-cell">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.teamId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-2.5"><RankBadge rank={r.rank} /></td>
                  <td className="px-2 py-2.5"><TeamCell logoUrl={logos.get(r.teamId)} name={r.name} /></td>
                  <td className="px-2 py-2.5"><Pill tone={pricingPill[r.pricing]}>{r.pricing[0] + r.pricing.slice(1).toLowerCase()}</Pill></td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-baseline justify-between gap-1 tabular-nums text-[12px]">
                      <span className="font-semibold">{N(r.avg)}</span>
                      <span className="text-slate-500">{Math.round(r.pct * 100)}%</span>
                    </div>
                    <Meter pct={r.pct * 100} tone="sky" className="mt-1" />
                  </td>
                  <td className={`px-2 py-2.5 text-right tabular-nums hidden sm:table-cell ${r.pct >= r.prevPct ? "text-emerald-400" : "text-rose-400"}`}>{r.pct >= r.prevPct ? "+" : ""}{Math.round((r.pct - r.prevPct) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
