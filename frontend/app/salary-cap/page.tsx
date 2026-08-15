import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { teamCapCentral, money } from "@/lib/finance";
import { computeStandings } from "@/lib/sim/standings";
import CapCentralTable, { type CapRow } from "@/components/CapCentralTable";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function SalaryCapPage() {
  const [teams, settings, standings, schedule] = await Promise.all([
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: {
        id: true, name: true, slug: true, logoUrl: true, retainsBuyouts: true,
        players: { where: { rosterType: "NHL" }, select: { capHit: true } },
      },
    }),
    loadSettings(),
    computeStandings(SEASON, "NHL"),
    prisma.game.findMany({ where: { season: SEASON, league: "NHL", seriesId: null }, select: { homeTeamId: true, awayTeamId: true } }),
  ]);
  const gpById = new Map(standings.map((s) => [s.teamId, s.gp]));
  // gamesTotal per team from the actual schedule (auto-adapts to 82/84…)
  const gamesTotalById = new Map<number, number>();
  for (const g of schedule) { for (const id of [g.homeTeamId, g.awayTeamId]) gamesTotalById.set(id, (gamesTotalById.get(id) ?? 0) + 1); }

  const rows: CapRow[] = teams.map((t) => {
    const gp = gpById.get(t.id) ?? 0;
    const gamesTotal = gamesTotalById.get(t.id) || 82;
    const c = teamCapCentral(t.players, t.retainsBuyouts, { salaryCapUpper: settings.salaryCapUpper, salaryCapLower: settings.salaryCapLower }, { gamesPlayed: gp, gamesTotal });
    return { id: t.id, name: t.name, slug: t.slug, logoUrl: t.logoUrl, gp, gamesTotal, ...c };
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Cap Central"
        subtitle={`${SEASON} · ▲ Upper limit ${money(settings.salaryCapUpper)} · ▼ Lower limit ${money(settings.salaryCapLower)} · click a column to sort`}
      />
      <CapCentralTable rows={rows} />
    </div>
  );
}
