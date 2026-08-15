import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ClaimWaiverButton from "@/components/ClaimWaiverButton";
import { PageHeader, Card } from "@/components/ui";

export default async function WaiversPage() {
  const players = await prisma.player.findMany({
    where: {
      waiverStatus: "ON_WAIVERS",
    },
    include: {
      team: true,
    },
    orderBy: {
      overall: "desc",
    },
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Waivers" subtitle={`${players.length} player${players.length === 1 ? "" : "s"} on waivers`} />

      {players.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-slate-500">No players on waivers right now.</div>
        </Card>
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Team</th>
                  <th className="px-4 py-3 text-center font-medium">Pos</th>
                  <th className="px-4 py-3 text-center font-medium">OVR</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player: any) => (
                  <tr key={player.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/players/${player.slug}`} className="hover:text-blue-400 transition-colors">{player.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      <Link href={`/teams/${player.team.slug}`} className="hover:text-blue-400 transition-colors">{player.team.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-400">{player.positions || player.position}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${(player.overall ?? 0) >= 80 ? "text-green-400" : (player.overall ?? 0) >= 70 ? "text-blue-400" : (player.overall ?? 0) >= 60 ? "text-yellow-400" : "text-slate-400"}`}>{player.overall ?? "-"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ClaimWaiverButton playerId={player.id} />
                    </td>
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
