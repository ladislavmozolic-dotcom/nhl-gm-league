import TeamCard from "../../components/TeamCard";
import { prisma } from "../../lib/prisma";

export default async function TeamsPage() {
  const teams = await prisma.team.findMany();

  return (
    <main>
      <h1>Teams</h1>

      {teams.map((team) => (
        <TeamCard
          key={team.id}
          name={team.name}
          gm={team.gm}
          arena={team.arena}
        />
      ))}
    </main>
  );
}