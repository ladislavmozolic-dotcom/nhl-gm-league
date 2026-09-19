import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import {
  projectAllSkaters,
  LAST_WEIGHT,
  CUR_WEIGHT,
  ACTIVATE_AT_GP,
} from "@/lib/param-projection";
import PlayerCalculatorView from "@/components/PlayerCalculatorView";

export const dynamic = "force-dynamic";

export default async function PlayerCalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamSlug } = await searchParams;

  // Load all NHL teams along with their AHL affiliate
  const teams = await prisma.team.findMany({
    where: { league: "NHL" },
    select: {
      id: true,
      slug: true,
      code: true,
      name: true,
      logoUrl: true,
      conference: true,
      division: true,
      affiliateTeams: {
        select: {
          id: true,
          slug: true,
          code: true,
          name: true,
          logoUrl: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const selectedTeam = teams.find((t) => t.slug === teamSlug) ?? teams[0];

  // Fetch all skaters projected data
  const { rows: allSkaters, active } = await projectAllSkaters();

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Player Calculator"
        subtitle="Kompletný prehľad a prepočet parametrov korčuliarov podľa reálnej formy (20 % minulá + 80 % táto sezóna)"
      />

      <PlayerCalculatorView
        teams={teams}
        selectedTeam={selectedTeam}
        allSkaters={allSkaters}
        active={active}
        lastWeight={LAST_WEIGHT}
        curWeight={CUR_WEIGHT}
        activateAtGp={ACTIVATE_AT_GP}
      />
    </div>
  );
}
