import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { teamCapCentral, deadMoneyForYear, CURRENT_SEASON_START, money } from "@/lib/finance";
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
        id: true, name: true, slug: true, logoUrl: true,
        players: { where: { rosterType: "NHL" }, select: { capHit: true, retainedSalary: true } },
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

  // Each player's own Cap Hit is net of any retention someone else pays (matching
  // the team Finance page), so Total Salaries here is the sum of those same net
  // numbers. Buyouts and Dead Cap are this club's own dead money — kept apart
  // since a retention isn't a buyout — and both still add into the cap hit.
  const rows: CapRow[] = await Promise.all(teams.map(async (t) => {
    const gp = gpById.get(t.id) ?? 0;
    const gamesTotal = gamesTotalById.get(t.id) || 82;
    const buyoutRows = await prisma.buyout.findMany({ where: { teamId: t.id }, select: { perYear: true, years: true, startYear: true, totalCost: true } });
    const buyouts = deadMoneyForYear(buyoutRows.filter((b) => b.totalCost > 0), CURRENT_SEASON_START);
    const deadCap = deadMoneyForYear(buyoutRows.filter((b) => b.totalCost === 0), CURRENT_SEASON_START);
    const netPlayers = t.players.map((p) => ({ capHit: Math.max(0, (p.capHit ?? 0) - (p.retainedSalary ?? 0)) }));
    const { totalSalaries, capHit, capSpace, underFloorBy, projCapHit, projCapSpace, count } =
      teamCapCentral(netPlayers, buyouts + deadCap, { salaryCapUpper: settings.salaryCapUpper, salaryCapLower: settings.salaryCapLower }, { gamesPlayed: gp, gamesTotal });
    return { id: t.id, name: t.name, slug: t.slug, logoUrl: t.logoUrl, gp, gamesTotal, count, totalSalaries, buyouts, deadCap, capHit, capSpace, underFloorBy, projCapHit, projCapSpace };
  }));

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
