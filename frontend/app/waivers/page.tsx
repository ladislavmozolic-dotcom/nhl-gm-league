import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ClaimWaiverButton from "@/components/ClaimWaiverButton";

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
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "24px",
      }}
    >
      <h1>Waivers ({players.length})</h1>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          
<tr>
  <th>Name</th>
  <th>Team</th>
  <th>Pos</th>
  <th>OVR</th>
  <th>Action</th>
</tr>

        </thead>

        <tbody>
          {players.map((player: any) => (
            <tr key={player.id}>
              <td>
                <Link href={`/players/${player.slug}`}>{player.name}</Link>
              </td>

              <td>
                <Link href={`/teams/${player.team.slug}`}>{player.team.name}</Link>
              </td>

              <td>
                {player.positions || player.position}
              </td>

              <td>{player.overall ?? "-"}</td>
              
              <td>
                <ClaimWaiverButton
                  playerId={player.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
