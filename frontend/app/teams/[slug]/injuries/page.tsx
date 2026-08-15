import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cleanName } from "@/lib/playerName";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function TeamInjuriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();

  const injured = await prisma.player.findMany({
    where: { teamId: team.id, injuryDaysLeft: { gt: 0 } },
    orderBy: { injuryDaysLeft: "desc" },
    select: { id: true, name: true, slug: true, position: true, injuryDaysLeft: true, injuryDesc: true },
  });

  if (injured.length === 0) {
    return (
      <div className="space-y-6">
        <Card title="Injuries" accent="text-green-400">
          <p className="text-green-400/80 text-center py-8">No current injuries.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card title="Injuries" accent="text-red-400" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/30 border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">Player</th>
                <th className="px-3 py-3 text-center font-medium w-14">Pos</th>
                <th className="px-3 py-3 text-center font-medium w-24">Days Left</th>
                <th className="px-4 py-3 text-left font-medium">Injury</th>
              </tr>
            </thead>
            <tbody>
              {injured.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/players/${p.slug}`} className="font-medium hover:text-blue-400 transition-colors">
                      {cleanName(p.name)}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-center text-slate-400">{p.position}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-bold text-red-400 tabular-nums">{p.injuryDaysLeft}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{p.injuryDesc || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
