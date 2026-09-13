import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { liveCapHit } from "@/lib/finance";
import { regularSeasonDayProgress, resolvePhaseThresholds } from "@/lib/calendar-server";
import { addDays } from "@/lib/calendar";
import { PageHeader } from "@/components/ui";
import CapCalculator from "@/components/CapCalculator";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function CapCalculatorPage() {
  const [settings, teams, dayProgress, { regularAt, playoffsAt }] = await Promise.all([
    loadSettings(),
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: { id: true, name: true, code: true, players: { where: { rosterType: "NHL" }, select: { capHit: true, contractYears: true } } },
      orderBy: { name: "asc" },
    }),
    regularSeasonDayProgress(),
    resolvePhaseThresholds(),
  ]);
  const teamData = teams.map((t) => ({
    name: t.name, code: t.code,
    capHit: t.players.reduce((s, p) => s + liveCapHit(p), 0),
  }));
  // The last real day of the regular season is one before playoffsAt (which marks
  // the day AFTER the last scheduled game).
  const seasonEnd = addDays(playoffsAt, -1);

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Cap Space Calculator" subtitle="How pricey an addition can you afford? Unused cap banks each day of the regular season, so your spending room grows toward the deadline." />
      <CapCalculator
        ceiling={settings.salaryCapUpper} teams={teamData}
        seasonStart={iso(regularAt)} seasonEnd={iso(seasonEnd)}
        daysTotal={dayProgress.daysTotal}
        defaultDate={iso(addDays(regularAt, dayProgress.daysPlayed))}
      />
    </div>
  );
}
