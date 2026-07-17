const players = {
  "connor-mcdavid": {
    name: "Connor McDavid",
    position: "C",
    team: "Edmonton Oilers",
  },

  "leon-draisaitl": {
    name: "Leon Draisaitl",
    position: "C",
    team: "Edmonton Oilers",
  },

  "auston-matthews": {
    name: "Auston Matthews",
    position: "C",
    team: "Toronto Maple Leafs",
  },
};

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const player =
    players[slug as keyof typeof players];

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