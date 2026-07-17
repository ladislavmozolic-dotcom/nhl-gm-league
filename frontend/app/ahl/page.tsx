import Link from "next/link";
import { prisma } from "../../lib/prisma";

export default async function AhlTeamsPage() {
  const teams = await prisma.team.findMany({
    where: {
      league: "AHL",
    },
    orderBy: {
      name: "asc",
    },
    include: {
      parentTeam: true,
    },
  });

  return (
    <main>
      <h1>AHL Teams ({teams.length})</h1>

      {teams.map((team) => (
        <div key={team.id}>
          <h2>
            <Link href={`/ahl/${team.slug}`}>
              {team.name}
            </Link>
          </h2>

          <p>
            NHL Affiliate:{" "}
            {team.parentTeam?.name ?? "None"}
          </p>

          <hr />
        </div>
      ))}
    </main>
  );
}