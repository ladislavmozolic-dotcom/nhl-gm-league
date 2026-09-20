import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import {
  projectAllSkaters,
  projectAllGoalies,
  LAST_WEIGHT,
  CUR_WEIGHT,
  ACTIVATE_AT_GP,
} from "@/lib/param-projection";
import { getLiveCalculatorConfig } from "@/lib/live-calculator-config";
import { isAdmin } from "@/lib/auth";
import { canManageLiveCalculator } from "@/lib/live-calculator-actions";
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

  // Fetch all skaters & goalies projected data, live config, admin rights and calculator manager rights
  const [
    { rows: allSkaters, active },
    { rows: allGoalies },
    liveConfig,
    admin,
    canManage,
  ] = await Promise.all([
    projectAllSkaters(),
    projectAllGoalies(),
    getLiveCalculatorConfig(),
    isAdmin(),
    canManageLiveCalculator(),
  ]);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Live Player Calculator"
        subtitle="Kompletný prehľad a živý prepočet parametrov korčuliarov a brankárov (NextGen V10 model: MoneyPuck, NHL API, EDGE a AHL)"
      />

      <PlayerCalculatorView
        teams={teams}
        selectedTeam={selectedTeam}
        allSkaters={allSkaters}
        allGoalies={allGoalies}
        active={active}
        lastWeight={liveConfig.previousWeight}
        curWeight={liveConfig.latestWeight}
        activateAtGp={liveConfig.nhlGpLatestMin || ACTIVATE_AT_GP}
        liveConfig={liveConfig}
        isAdmin={admin}
        canManage={canManage}
      />
    </div>
  );
}
