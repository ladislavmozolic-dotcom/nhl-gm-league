import PlayerCard from "../../components/PlayerCard";
import { players } from "../../data/players";

export default function PlayersPage() {
  return (
    <main>
      <h1>Players</h1>

      {players.map((player) => (
        <PlayerCard
          key={player.slug}
          name={player.name}
        />
      ))}
    </main>
  );
}