import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { computeStandings } from "@/lib/sim/standings";
import { PageHeader } from "@/components/ui";
import CapCalculator from "@/components/CapCalculator";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function CapCalculatorPage() {
  const [settings, teams, standings, schedule] = await Promise.all([
    loadSettings(),
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: { id: true, name: true, code: true, players: { where: { rosterType: "NHL" }, select: { capHit: true } } },
      orderBy: { name: "asc" },
    }),
    computeStandings(SEASON, "NHL"),
    prisma.game.findMany({ where: { season: SEASON, league: "NHL", seriesId: null }, select: { homeTeamId: true, awayTeamId: true } }),
  ]);
  const gpById = new Map(standings.map((s) => [s.teamId, s.gp]));
  const totById = new Map<number, number>();
  for (const g of schedule) for (const id of [g.homeTeamId, g.awayTeamId]) totById.set(id, (totById.get(id) ?? 0) + 1);
  const gamesTotal = Math.max(82, ...[...totById.values()]); // season length from the schedule (82/84…)
  const teamData = teams.map((t) => ({
    name: t.name, code: t.code,
    capHit: t.players.reduce((s, p) => s + (p.capHit ?? 0), 0),
    gp: gpById.get(t.id) ?? 0,
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Cap Space Calculator" subtitle="How pricey an addition can you afford? Unused cap banks each game, so your spending room grows toward the deadline." />
      <CapCalculator ceiling={settings.salaryCapUpper} teams={teamData} gamesTotal={gamesTotal} />
    </div>
  );
}
