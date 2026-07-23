import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function TradeBlockPage() {
  const players = await prisma.player.findMany({
    where: {
  onTradeBlock: true,
    },
    include: {
      team: true,
    },
    orderBy: {
      overall: "desc",
    },
  });

  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "24px",
        color: "white",
      }}
    >
      <h1>Trade Block</h1>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px" }}>
              Name
            </th>

            <th style={{ textAlign: "left", padding: "8px" }}>
              Team
            </th>

            <th style={{ textAlign: "left", padding: "8px" }}>
              Pos
            </th>

            <th style={{ textAlign: "left", padding: "8px" }}>
              OVR
            </th>
          </tr>
        </thead>

        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td style={{ padding: "8px" }}>
                <Link href={`/players/${player.id}`}>
                  {player.name}
                </Link>
              </td>

              <td style={{ padding: "8px" }}>
                <Link href={`/teams/${player.team.slug}`}>
                  {player.team.name}
                </Link>
              </td>

              <td style={{ padding: "8px" }}>
                {player.positions || player.position}
              </td>

              <td
                style={{
                  padding: "8px",
                  color:
                    (player.overall ?? 0) >= 80
                      ? "#22c55e"
                      : (player.overall ?? 0) >= 70
                      ? "#eab308"
                      : "#ef4444",
                  fontWeight: "bold",
                }}
              >
                {player.overall ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}