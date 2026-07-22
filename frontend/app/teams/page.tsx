import TeamCard from "@/components/TeamCard";
import { prisma } from "@/lib/prisma";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return (
    <main>
      <h1>Teams ({teams.length})</h1>

      {teams.map((team) => (
        <TeamCard
          key={team.id}
          slug={team.slug}
          name={team.name}
          gm={team.gm}
          arena={team.arena}
        />
      ))}
    </main>
  );
}