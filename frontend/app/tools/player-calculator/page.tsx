import Link from "next/link";
import { redirect } from "next/navigation";
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
import PlayerProgressView from "@/components/PlayerProgressView";
import { getPlayerProgressData } from "@/lib/player-progress-server";
import { rookieCalculatorRows } from "@/lib/edge-params-server";
import { DEFAULT_ROOKIE_TUNING } from "@/lib/edge-params";

export const dynamic = "force-dynamic";

export default async function PlayerCalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; view?: string }>;
}) {
  const { team: teamSlug, view } = await searchParams;

  if (view === "progress") {
    const admin = await isAdmin();
    if (!admin) {
      redirect("/tools/player-calculator");
    }
    const progressData = await getPlayerProgressData();
    return (
      <div className="space-y-6 py-2">
        <PageHeader
          title="Player Rating Progress Watch"
          subtitle="Admin monitor odozvy hráčov a posunov v parametroch po prepočte kalkulátora"
          right={
            <Link
              href="/tools/player-calculator"
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white whitespace-nowrap transition-colors"
            >
              ← Live Calculator
            </Link>
          }
        />
        <PlayerProgressView data={progressData} />
      </div>
    );
  }

  if (view === "rookies") {
    const [rookies, admin, canManage, rookieLiveConfig] = await Promise.all([
      rookieCalculatorRows(),
      isAdmin(),
      canManageLiveCalculator(),
      getLiveCalculatorConfig(),
    ]);
    return (
      <div className="space-y-6 py-2">
        <PageHeader
          title="Rookie Calculator"
          subtitle="Prospects who have already played real games and do not have their own rating yet"
          right={<Link href="/tools/player-calculator" className="text-sm text-blue-400 hover:text-blue-300">← Live Calculator</Link>}
        />
        <RookieCalculatorPanel
          rookies={rookies}
          isAdmin={admin}
          canManage={canManage}
          liveConfig={rookieLiveConfig}
        />
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
    name: "All league teams (All Teams)",
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
        subtitle="A complete overview and live recalculation of skater and goalie parameters (NextGen V10 model: MoneyPuck, NHL API, EDGE and AHL)"
        right={
          <div className="flex items-center gap-2">
            {admin && (
              <Link
                href="/tools/player-calculator?view=progress"
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 hover:text-emerald-200 whitespace-nowrap transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>📈</span>
                <span>Progres hráčov (Admin)</span>
              </Link>
            )}
            <Link
              href="/tools/player-calculator?view=rookies"
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white whitespace-nowrap"
            >
              🧒 Rookie Calculator
            </Link>
          </div>
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
