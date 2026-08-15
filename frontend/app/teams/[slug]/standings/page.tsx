import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { computeStandings } from "@/lib/sim/standings";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function TeamStandingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, league: true } });
  if (!team) notFound();

  const [standings, teams] = await Promise.all([
    computeStandings(SEASON, team.league).catch(() => []),
    prisma.team.findMany({ select: { id: true, logoUrl: true, slug: true } }),
  ]);
  const logoById = new Map(teams.map((t) => [t.id, t]));

  if (standings.length === 0) {
    return <Card><p className="text-slate-500 text-center py-8">No standings yet this season.</p></Card>;
  }

  return (
    <div className="space-y-4">
      <Card title={`${team.league} Standings`} accent="text-blue-400" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider bg-slate-800/30">
                <th className="px-3 py-3 text-left font-medium w-8">#</th>
                <th className="px-3 py-3 text-left font-medium">Team</th>
                {["GP", "W", "L", "OTL", "PTS", "GF", "GA", "DIFF"].map((h) => <th key={h} className="px-3 py-3 text-right font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {standings.map((s: any, i: number) => {
                const t = logoById.get(s.teamId);
                const me = s.teamId === team.id;
                return (
                  <tr key={s.teamId} className={`border-b border-slate-800/40 last:border-0 transition-colors ${me ? "bg-blue-500/10" : "hover:bg-slate-800/30"}`}>
                    <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/teams/${t?.slug ?? ""}`} className="flex items-center gap-2 hover:text-blue-400">
                        {t?.logoUrl && <img src={t.logoUrl} alt="" className="w-5 h-5 object-contain" />}
                        <span className={me ? "font-bold text-white" : ""}>{s.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{s.gp}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.w}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.l}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.otl}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold">{s.points}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{s.gf}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{s.ga}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${s.diff > 0 ? "text-green-400" : s.diff < 0 ? "text-red-400" : "text-slate-400"}`}>{s.diff > 0 ? `+${s.diff}` : s.diff}</td>
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
