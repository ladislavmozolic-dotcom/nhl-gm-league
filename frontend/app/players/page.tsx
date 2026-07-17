import { PrismaClient } from "@prisma/client";

export default async function PlayersPage() {
  const prisma = new PrismaClient();

  const players = await prisma.player.findMany({
    include: {
      team: true,
    },
  });

  return (
    <main>
      <h1>Players</h1>

      {players.map((player) => (
        <div key={player.id}>
          <h2>{player.name}</h2>
          <p>Position: {player.position}</p>
          <p>Team: {player.team.name}</p>
        </div>
      ))}
    </main>
  );
}