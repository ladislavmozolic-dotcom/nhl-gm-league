import Link from "next/link";
import StatsTabs from "@/components/StatsTabs";
import { PageHeader, Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { leagueStarLeaderboard } from "@/lib/star-power-server";
import { tierAccent } from "@/lib/star-power";

export const dynamic = "force-dynamic";

export default async function StarPowerPage() {
  const rows = await leagueStarLeaderboard(60);

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Statistics" subtitle="Star Power — business & media value" />
      <StatsTabs active="star-power" />
      <Card>
        <p className="text-sm text-slate-400">
          Star Power is a player&apos;s <b>business and media</b> value — it has <b>zero effect on the ice</b>.
          <InfoTip text="Computed automatically from on-ice talent, recent production, career legend status, trophy pedigree and rookie hype. It drives merchandise, jersey sales, fan interest, ticket demand and sponsor appeal — never gameplay. An ageing legend can still sell jerseys; a hyped rookie can rate high before he produces." />
          {" "}It powers merchandise, jersey sales, fan interest, ticket demand and sponsorships in the Detailed Finance system.
        </p>
      </Card>

      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-4 py-2 w-10">#</th>
                <th className="px-4 py-2">Player</th>
                <th className="px-2 py-2">Team</th>
                <th className="px-2 py-2">Tier</th>
                <th className="px-2 py-2 text-right">Star Power</th>
                <th className="px-4 py-2 hidden sm:table-cell">Main reasons</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.playerId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-2 tabular-nums text-slate-500">{i + 1}</td>
                  <td className="px-4 py-2">
                    <Link href={`/players/${r.playerId}`} className="font-semibold hover:text-blue-400">{r.name}</Link>
                    <span className="ml-1.5 text-[11px] text-slate-500">{r.position}</span>
                  </td>
                  <td className="px-2 py-2 text-slate-400">{r.teamCode ?? "—"}</td>
                  <td className={`px-2 py-2 font-semibold ${tierAccent(r.tier)}`}>{r.tier}</td>
                  <td className="px-2 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                        <div className="h-full bg-fuchsia-500/70" style={{ width: `${r.score}%` }} />
                      </div>
                      <span className="tabular-nums font-bold w-8 text-right">{r.score}</span>
                    </div>
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
