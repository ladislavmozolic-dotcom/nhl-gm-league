import { prisma } from "@/lib/prisma";

export default async function TradingBlock() {
  const players = await prisma.player.findMany({
    where: {
      onTradeBlock: true,
    },
    include: {
      team: true,
    },
    take: 10,
  });

  return (
    <div className="card p-4">
      <h2 className="text-sm font-bold text-white mb-4">
        🔄 Trading Block
      </h2>

      {players.length === 0 ? (
        <p className="text-xs text-slate-400">
          No players currently available.
        </p>
      ) : (
        <div className="space-y-3">
          {players.map((player) => (
            <div
              key={player.id}
              className="border-b border-slate-700/30 pb-2"
            >
              <p className="text-sm text-white font-medium">
                {player.name}
              </p>

              <p className="text-xs text-slate-400">
                {player.team?.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}