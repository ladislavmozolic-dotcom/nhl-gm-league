import { players } from "../../../data/players";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const player = players.find(
    (player) => player.slug === slug
  );

  if (!player) {
    return <h1>Player not found</h1>;
  }

  return (
    <main>
      <h1>{player.name}</h1>

      <p>Position: {player.position}</p>

      <p>Team: {player.team}</p>
    </main>
  );
}