import { prisma } from "@/lib/prisma";

export default async function HotPlayers() {
  const players = await prisma.player.findMany({
    where: {
      overall: {
        not: null,
      },
    },
    include: {
      team: true,
    },
    orderBy: {
      overall: "desc",
    },
    take: 5,
  });

  return (
    <div className="card p-4">
      <h2 className="text-sm font-bold text-white mb-4">
        🔥 Hot Players
      </h2>

      <div className="space-y-3">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between border-b border-slate-700/30 pb-2"
          >
            <div>
              <p className="text-sm font-medium text-white">
                {player.name}
              </p>

              <p className="text-xs text-slate-400">
                {player.team?.name}
              </p>
            </div>

            <div className="text-orange-400 font-bold">
              {player.overall}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}