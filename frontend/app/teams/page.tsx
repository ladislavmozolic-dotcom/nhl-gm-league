import TeamCard from "../../components/TeamCard";

const teams = [
  "Edmonton Oilers",
  "Toronto Maple Leafs",
  "Boston Bruins",
  "Anaheim Ducks",
];

export default function TeamsPage() {
  return (
    <main>
      <h1>Teams</h1>

      {teams.map((team) => (
        <TeamCard
          key={team}
          name={team}
        />
      ))}
    </main>
  );
}