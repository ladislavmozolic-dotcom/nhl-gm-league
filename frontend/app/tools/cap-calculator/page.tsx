import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { liveCapHit } from "@/lib/finance";
import { regularSeasonDayProgress } from "@/lib/calendar-server";
import { PageHeader } from "@/components/ui";
import CapCalculator from "@/components/CapCalculator";

export const dynamic = "force-dynamic";

export default async function CapCalculatorPage() {
  const [settings, teams, dayProgress] = await Promise.all([
    loadSettings(),
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: { id: true, name: true, code: true, players: { where: { rosterType: "NHL" }, select: { capHit: true, contractYears: true } } },
      orderBy: { name: "asc" },
    }),
    regularSeasonDayProgress(),
  ]);
  // "day" is the league's own calendar clock — the same for every club, unlike
  // games played, which varies team to team.
  const teamData = teams.map((t) => ({
    name: t.name, code: t.code,
    capHit: t.players.reduce((s, p) => s + liveCapHit(p), 0),
    day: dayProgress.daysPlayed,
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Cap Space Calculator" subtitle="How pricey an addition can you afford? Unused cap banks each day of the regular season, so your spending room grows toward the deadline." />
      <CapCalculator ceiling={settings.salaryCapUpper} teams={teamData} daysTotal={dayProgress.daysTotal} />
    </div>
  );
}
