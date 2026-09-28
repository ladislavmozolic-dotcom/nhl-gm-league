import Link from "next/link";
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
import RookieCalculatorPanel from "@/components/RookieCalculatorPanel";
import { rookieCalculatorRows } from "@/lib/edge-params-server";

export const dynamic = "force-dynamic";

export default async function PlayerCalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; view?: string }>;
}) {
  const { team: teamSlug, view } = await searchParams;

  if (view === "rookies") {
    const [rookies, admin, rookieLiveConfig] = await Promise.all([rookieCalculatorRows(), isAdmin(), getLiveCalculatorConfig()]);
    return (
      <div className="space-y-6 py-2">
        <PageHeader
          title="Rookie Calculator"
          subtitle="Prospekti, ktorí už odohrali reálne zápasy a zatiaľ nemajú vlastný rating"
          right={<Link href="/tools/player-calculator" className="text-sm text-blue-400 hover:text-blue-300">← Live Calculator</Link>}
        />
        <RookieCalculatorPanel rookies={rookies} isAdmin={admin} penaltyBands={rookieLiveConfig.weights.rookie?.penaltyBands ?? []} />
      </div>
    );
  }

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

  const ALL_TEAM = {
    id: 0,
    slug: "all",
    code: "ALL",
    name: "Všetky tímy ligy (All Teams)",
    logoUrl: null,
    conference: null,
    division: null,
    affiliateTeams: [],
  };

  const isAll = teamSlug === "all" || !teamSlug;
  const selectedTeam = isAll ? ALL_TEAM : (teams.find((t) => t.slug === teamSlug) ?? ALL_TEAM);

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
        right={
          <Link href="/tools/player-calculator?view=rookies"
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white whitespace-nowrap">
            🧒 Rookie Calculator
          </Link>
        }
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
