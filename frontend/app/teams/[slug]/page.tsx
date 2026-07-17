import { teams } from "../../../data/teams";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const team = teams.find(
    (team) => team.slug === slug
  );

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