import Link from "next/link";
import { prisma } from "../../../lib/prisma";

export default async function AhlTeamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const team = await prisma.team.findUnique({
    where: {
      slug,
    },
    include: {
      parentTeam: true,
      players: {
        orderBy: {
          name: "asc",
        },
      },
    },
  });

  if (!team) {
    return <h1>AHL Team not found</h1>;
  }

  return (
    <main>
      <h1>{team.name}</h1>

      <p>
        NHL Affiliate:{" "}
        {team.parentTeam ? (
          <Link href={`/teams/${team.parentTeam.slug}`}>
            {team.parentTeam.name}
          </Link>
        ) : (
          "None"
        )}
      </p>

      <h2>Roster ({team.players.length})</h2>

      <ul>
        {team.players.map((player) => (
          <li key={player.id}>
            <Link href={`/players/${player.slug}`}>
              {player.number ? `#${player.number} ` : ""}
              {player.name}
            </Link>{" "}
            ({player.position})
          </li>
        ))}
      </ul>
    </main>
  );
}