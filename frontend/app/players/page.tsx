import PlayerCard from "../../components/PlayerCard";

export default function PlayersPage() {
  return (
    <main>
      <h1>Players</h1>

      <PlayerCard name="Connor McDavid" />
      <PlayerCard name="Leon Draisaitl" />
      <PlayerCard name="Auston Matthews" />
    </main>
  );
}