import { prisma } from "../../../lib/prisma";

export default async function TeamDetailPage({
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
      players: true,
    },
  });

  if (!team) {
    return <h1>Team not found</h1>;
  }

  return (
    <main>
      <h1>{team.name}</h1>

      <p>GM: {team.gm}</p>

      <p>Arena: {team.arena}</p>

      <h2>Players</h2>

      <ul>
        {team.players.map((player) => (
          <li key={player.id}>
            {player.name} ({player.position})
          </li>
        ))}
      </ul>
    </main>
  );
}