import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import { isAdmin } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { previewLeagueElc } from "@/app/free-agents/actions";
import { cleanName } from "@/lib/playerName";
import ElcApplyButton from "@/components/ElcApplyButton";
import ElcApplyAllButton from "@/components/ElcApplyAllButton";

export const dynamic = "force-dynamic";
const M = (n: number) => `$${(n / 1e6).toFixed(2)}M`;

export default async function ElcAdminPage() {
  const admin = await isAdmin();
  if (!admin) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="Entry-Level Contracts" subtitle="Rookie ELC auto-assignment" />
        <Card><p className="text-sm text-slate-500">Sign in as a league admin to review and assign entry-level contracts.</p></Card>
      </div>
    );
  }
  const list = await previewLeagueElc();

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Entry-Level Contracts" subtitle="Auto-computed rookie deals — review, then assign (July 1)"
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>} />

      <Card title="How the ELC is computed" accent="text-slate-200">
        <ul className="text-sm text-slate-300 space-y-1 list-disc pl-5">
          <li>Flat base <b>$900k</b> + a performance bonus from last real season (min. <b>10 GP</b> to sign, <b>40 GP</b> / 15 goalie for a bonus).</li>
          <li>Term by age: 18-21 → 3yr · 22-23 → 2yr · 24+ → 1yr. All ELCs are two-way.</li>
          <li>Forward = PPG bonus · Defense = higher of PPG / DF-rating bonus · Goalie = SV% bonus.</li>
        </ul>
      </Card>

      <Card title={`Rookie class (${list.length})`} accent="text-green-400">
        {list.length > 0 && <div className="mb-3"><ElcApplyAllButton count={list.length} /></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 820 }}>
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="px-3 py-2 text-left">Player</th><th className="px-2 py-2">Team</th><th className="px-2 py-2">Age</th><th className="px-2 py-2">Pos</th>
                <th className="px-2 py-2">Last season</th><th className="px-3 py-2 text-right">Current</th>
                <th className="px-3 py-2 text-right">Base</th><th className="px-3 py-2 text-right">Bonus</th><th className="px-3 py-2 text-right">ELC Cap Hit</th><th className="px-2 py-2">Term</th><th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                  <td className="px-3 py-1.5 font-medium"><PlayerLink id={r.id} name={r.name} /></td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{r.teamCode}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.age}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">{r.pos}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400 tabular-nums">
                    {r.pos === "G" ? (r.svPct ? `${(r.svPct * 100).toFixed(1)} SV%` : `${r.gp} GP`) : `${r.gp} GP · ${r.ppg?.toFixed(2)} PPG`}
                    {!r.bonusEligible && <span className="text-amber-400/70"> · base only</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{r.currentCapHit ? M(r.currentCapHit) : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">{M(r.base)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">{r.bonus ? M(r.bonus) : "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-bold text-green-400">{M(r.capHit)}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{r.years}yr</td>
                  <td className="px-2 py-1.5 text-right"><ElcApplyButton playerId={r.id} /></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">No entry-level-age players with enough games to sign.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
