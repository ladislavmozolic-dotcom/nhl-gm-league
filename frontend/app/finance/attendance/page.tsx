import { PageHeader, Card } from "@/components/ui";
import InfoTip from "@/components/InfoTip";
import { getTeamSession, canManageTeam } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { leagueAttendance, teamAttendance } from "@/lib/attendance-server";
import PricingControl from "@/components/PricingControl";

export const dynamic = "force-dynamic";

const N = (n: number) => n.toLocaleString("en-US");

export default async function AttendanceBoardPage() {
  const settings = await loadSettings();
  const rows = await leagueAttendance();

  // the logged-in club's own attendance + pricing control
  const sessionId = await getTeamSession();
  const myTeam = sessionId ? await prisma.team.findUnique({ where: { id: sessionId }, select: { id: true, league: true, isAffiliate: true } }) : null;
  const mine = myTeam && myTeam.league === "NHL" && !myTeam.isAffiliate && (await canManageTeam(myTeam.id)) ? await teamAttendance(myTeam.id) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
      <PageHeader title="Attendance & Pricing" subtitle="Who fills the building — and what you charge for it" />
      {settings.financeMode !== "detailed" && (
        <Card><p className="text-sm text-amber-400/80">Part of the <b>Detailed Finance</b> system — switch it on in engine settings. Live preview below.</p></Card>
      )}

      {mine && (
        <Card title="Your building" accent="text-sky-300">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr] gap-5">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums">{Math.round(mine.pct * 100)}%</span>
                <span className="text-slate-500">avg capacity</span>
              </div>
              <div className="text-[12px] text-slate-500 mt-1">{N(mine.avg)} / {N(mine.capacity)} · League rank #{mine.rank}</div>
              <div className="text-[12px] text-slate-500">Last season {Math.round(mine.prevPct * 100)}% → <span className={mine.pct >= mine.prevPct ? "text-emerald-400" : "text-rose-400"}>{Math.round(mine.pct * 100)}%</span></div>
            </div>
            <PricingControl att={mine} />
          </div>
        </Card>
      )}

      <Card>
        <p className="text-sm text-slate-400">Average attendance for every club — the crowd each home game draws off Fan Interest and pricing.<InfoTip text="Each home game's crowd comes from Fan Interest plus the specific matchup's pull (rivalry, a visiting star, the stakes), nudged by ticket pricing. Season-ticket holders are a near-guaranteed floor." /></p>
      </Card>
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="px-4 py-2 w-10">#</th>
                <th className="px-4 py-2">Club</th>
                <th className="px-2 py-2">Pricing</th>
                <th className="px-2 py-2 text-right">Avg</th>
                <th className="px-2 py-2 text-right">% cap</th>
                <th className="px-2 py-2 text-right hidden sm:table-cell">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.teamId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-2 tabular-nums text-slate-500">{r.rank}</td>
                  <td className="px-4 py-2 font-semibold">{r.name}</td>
                  <td className="px-2 py-2 text-[12px] text-slate-400">{r.pricing[0] + r.pricing.slice(1).toLowerCase()}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{N(r.avg)}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold">{Math.round(r.pct * 100)}%</td>
                  <td className={`px-2 py-2 text-right tabular-nums hidden sm:table-cell ${r.pct >= r.prevPct ? "text-emerald-400" : "text-rose-400"}`}>{r.pct >= r.prevPct ? "+" : ""}{Math.round((r.pct - r.prevPct) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
