import { prisma } from "@/lib/prisma";
import AddPlayerToTradeForm from "@/components/AddPlayerToTradeForm";

export default async function TradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const trades = await (prisma as any).trade.findMany();

  const trade = trades.find(
    (t: any) => String(t.id) === String(id)
  );

  if (!trade) {
    return <h1>Trade not found</h1>;
  }

  const assets = await (prisma as any).tradeAsset.findMany({
    where: {
      tradeId: trade.id,
    },
  });

  const fromTeam = await prisma.team.findUnique({
    where: {
      id: trade.fromTeamId,
    },
  });

  const toTeam = await prisma.team.findUnique({
    where: {
      id: trade.toTeamId,
    },
  });

  const fromPlayers = await prisma.player.findMany({
    where: {
      teamId: trade.fromTeamId,
    },
    orderBy: {
      name: "asc",
    },
  });

  const toPlayers = await prisma.player.findMany({
    where: {
      teamId: trade.toTeamId,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <main
      style={{
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "24px",
      }}
    >
      <h1>Trade #{trade.id}</h1>

      <p>
        <strong>Status:</strong> {trade.status}
      </p>

      <h2
        style={{
          marginTop: "30px",
        }}
      >
        Players Included In Trade
      </h2>

      {assets.length === 0 && (
        <p>No players added yet.</p>
      )}

      {assets.map((asset: any) => (
        <div
          key={asset.id}
          style={{
            padding: "8px",
            border: "1px solid #374151",
            marginBottom: "8px",
            borderRadius: "6px",
          }}
        >
          {asset.side} • {asset.assetType}
        </div>
      ))}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "40px",
          marginTop: "40px",
        }}
      >
        <div>
          <h2>{fromTeam?.name}</h2>

          <h3>Available Players</h3>

          <AddPlayerToTradeForm
            tradeId={trade.id}
            side="FROM"
            players={fromPlayers}
          />
        </div>

        <div>
          <h2>{toTeam?.name}</h2>

          <h3>Available Players</h3>

          <AddPlayerToTradeForm
            tradeId={trade.id}
            side="TO"
            players={toPlayers}
          />
        </div>
      </div>
    </main>
  );
}