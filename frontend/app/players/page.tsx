import Link from "next/link";
import { PrismaClient } from "@prisma/client";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
  }>;
}) {
  const prisma = new PrismaClient();

  const { search } = await searchParams;

  const players = await prisma.player.findMany({
    where: search
      ? {
          name: {
            contains: search,
            mode: "insensitive",
          },
        }
      : {},
    include: {
      team: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <main>
      <h1>Players ({players.length})</h1>

      <form>
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search player..."
        />

        <button type="submit">
          Search
        </button>
      </form>

      {players.map((player) => (
        <div key={player.id}>
          <h2>
            <Link href={`/players/${player.slug}`}>
              {player.name}
            </Link>
          </h2>

          <p>Position: {player.position}</p>

          <p>Team: {player.team.name}</p>

          <hr />
        </div>
      ))}
    </main>
  );
}