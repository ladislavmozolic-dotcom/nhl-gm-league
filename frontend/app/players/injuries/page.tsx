import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import PlayerAvatar from "@/components/playerAvatar";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InjuriesPage() {
  const injured = await prisma.player.findMany({
    where: { injuryDaysLeft: { gt: 0 } },
    include: { team: { select: { code: true, slug: true, logoUrl: true, league: true } } },
    orderBy: { injuryDaysLeft: "desc" },
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Injury Report"
        subtitle={`${injured.length} player${injured.length === 1 ? "" : "s"} currently injured — league-wide (NHL + AHL)`}
      />

      {injured.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-emerald-400 text-lg font-semibold">No current injuries league-wide.</p>
            <p className="text-slate-500 text-sm mt-2">Every player is healthy and available.</p>
          </div>
        </Card>
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-medium px-4 py-3">Player</th>
                  <th className="text-left font-medium px-4 py-3">Team</th>
                  <th className="text-left font-medium px-4 py-3">Pos</th>
                  <th className="text-left font-medium px-4 py-3">Injury</th>
                  <th className="text-right font-medium px-4 py-3">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {injured.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar src={p.photoUrl} alt={p.name} size={32} />
                        <Link href={`/players/${p.slug}`} className="font-medium hover:text-blue-400 transition-colors">
                          {cleanName(p.name)}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.team ? (
                        <Link href={`/teams/${p.team.slug}`} className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                          {p.team.logoUrl && (
                            <img src={p.team.logoUrl} alt={p.team.code} className="w-5 h-5 object-contain" />
                          )}
                          <span className="font-medium">{p.team.code}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 uppercase tracking-wide">
                            {p.team.league}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{p.position}</td>
                    <td className="px-4 py-3 text-slate-300">{p.injuryDesc || "Injured"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-400">{p.injuryDaysLeft}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
