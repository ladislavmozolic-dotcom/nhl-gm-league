import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { loadSettings } from "@/lib/sim/settings";
import { leagueFanInterest } from "@/lib/fan-interest-server";
import { interestArrow, interestAccent, type ExpectationTier } from "@/lib/fan-interest";
import { CONTENTION_LABELS } from "@/lib/free-agency";

export const dynamic = "force-dynamic";

const tierAccent: Record<ExpectationTier, string> = {
  contender: "text-green-300",
  middle: "text-slate-300",
  rising: "text-sky-300",
  rebuild: "text-amber-300",
};

export default async function FanInterestBoardPage() {
  const settings = await loadSettings();
  const rows = await leagueFanInterest();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title="Fan Interest" subtitle="Performance and team direction — the pulse of every fanbase" />
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
                <th className="px-4 py-2 w-10">#</th>
                <th className="px-4 py-2">Club</th>
                <th className="px-2 py-2">Team direction</th>
                <th className="px-2 py-2 text-right">Interest</th>
                <th className="px-4 py-2 hidden sm:table-cell">Main reasons</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.teamId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-2 tabular-nums text-slate-500">{i + 1}</td>
                  <td className="px-4 py-2 font-semibold">{r.name}</td>
                  <td className={`px-2 py-2 text-[12px] font-semibold ${tierAccent[r.tier]}`}>{CONTENTION_LABELS[r.tier]}</td>
                  <td className="px-2 py-2 text-right">
                    <span className="tabular-nums font-bold">{r.interest}</span>
                    <span className={`ml-1.5 text-xs font-bold ${interestAccent(r.delta)}`}>{interestArrow(r.delta)}{r.delta !== 0 ? Math.abs(r.delta) : ""}</span>
                  </td>
                  <td className="px-4 py-2 text-[12px] text-slate-400 hidden sm:table-cell">{r.reasons.join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
