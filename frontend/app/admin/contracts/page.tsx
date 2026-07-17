import Link from "next/link";
import { PrismaClient } from "@prisma/client";

export default async function AdminContractsPage() {
  const prisma = new PrismaClient();

  const players = await prisma.player.findMany({
    include: {
      team: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <main>
      <h1>Contract Management</h1>

      <p>Total Players: {players.length}</p>

      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Team</th>
            <th>Cap Hit</th>
            <th>Years</th>
            <th>Expiry</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td>{player.name}</td>

              <td>{player.team.name}</td>

              <td>
                {(player as any).capHit
                  ? `$${(player as any).capHit.toFixed(2)}M`
                  : "-"}
              </td>

              <td>
                {(player as any).contractYears ?? "-"}
              </td>

              <td>
                {(player as any).contractExpiry ?? "-"}
              </td>

              <td>
                <Link href={`/admin/contracts/${player.slug}`}>Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
