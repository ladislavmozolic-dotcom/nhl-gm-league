import TeamCard from "../../components/TeamCard";
import { teams } from "../../data/teams";

export default function TeamsPage() {
  return (
    <main>
      <h1>Teams</h1>

      {teams.map((team) => (
        <TeamCard
          key={team.slug}
          name={team.name}
        />
      ))}
    </main>
  );
}