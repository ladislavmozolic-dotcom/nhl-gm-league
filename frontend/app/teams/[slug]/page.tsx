const teams = {
  "edmonton-oilers": {
    name: "Edmonton Oilers",
    gm: "Ladislav Mozolic",
    arena: "Rogers Place",
  },

  "toronto-maple-leafs": {
    name: "Toronto Maple Leafs",
    gm: "Unknown",
    arena: "Scotiabank Arena",
  },

  "boston-bruins": {
    name: "Boston Bruins",
    gm: "Unknown",
    arena: "TD Garden",
  },
};

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const team =
    teams[slug as keyof typeof teams];

  if (!team) {
    return <h1>Team not found</h1>;
  }

  return (
    <main>
      <h1>{team.name}</h1>

      <p>GM: {team.gm}</p>

      <p>Arena: {team.arena}</p>
    </main>
  );
}