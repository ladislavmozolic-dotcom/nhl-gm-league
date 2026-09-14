import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { liveCapHit, deadMoneyForYear, CURRENT_SEASON_START } from "@/lib/finance";
import { regularSeasonDayProgress, resolvePhaseThresholds } from "@/lib/calendar-server";
import { addDays } from "@/lib/calendar";
import { REGULAR_SEASON } from "@/lib/phase";
import { PageHeader, BackPill } from "@/components/ui";
import CapCalculator from "@/components/CapCalculator";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function CapCalculatorPage({ searchParams }: { searchParams: Promise<{ team?: string; from?: string }> }) {
  const { team: initialTeam, from } = await searchParams;
  const [settings, teams, dayProgress, { regularAt, playoffsAt }, games, buyouts] = await Promise.all([
    loadSettings(),
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: { id: true, name: true, code: true, logoUrl: true, players: { where: { rosterType: "NHL" }, select: { capHit: true, contractYears: true, retainedSalary: true } } },
      orderBy: { name: "asc" },
    }),
    regularSeasonDayProgress(),
    resolvePhaseThresholds(),
    prisma.game.findMany({
      where: { season: REGULAR_SEASON, league: "NHL", seriesId: null },
      select: { gameDate: true, homeTeamId: true, awayTeamId: true },
    }),
    // Real buyouts AND trade-retention dead cap (totalCost=0) both count
    // against the cap the same way — no need to split them here.
    prisma.buyout.findMany({ select: { teamId: true, perYear: true, startYear: true, years: true } }),
  ]);
  const buyoutsByTeam = new Map<number, typeof buyouts>();
  for (const b of buyouts) (buyoutsByTeam.get(b.teamId) ?? buyoutsByTeam.set(b.teamId, []).get(b.teamId)!).push(b);
  const teamData = teams.map((t) => ({
    name: t.name, code: t.code, logoUrl: t.logoUrl,
    // Net each player's cap hit of any retention someone ELSE pays (see
    // components/TeamCapView.tsx's identical "Actual Cap Hit" formula), then
    // add this club's own dead money from buyouts/retentions it carries.
    capHit: t.players.reduce((s, p) => s + Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)), 0)
      + deadMoneyForYear(buyoutsByTeam.get(t.id) ?? [], CURRENT_SEASON_START),
  }));
  // The last real day of the regular season is one before playoffsAt (which marks
  // the day AFTER the last scheduled game).
  const seasonEnd = addDays(playoffsAt, -1);

  // Per-club schedule for the calendar: teamCode -> gameDate -> that day's opponent.
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const schedule: Record<string, Record<string, { oppCode: string | null; oppName: string; oppLogo: string | null; home: boolean }>> = {};
  for (const g of games) {
    if (!g.gameDate) continue;
    const dateStr = iso(g.gameDate);
    const home = teamById.get(g.homeTeamId), away = teamById.get(g.awayTeamId);
    if (home?.code) (schedule[home.code] ??= {})[dateStr] = { oppCode: away?.code ?? null, oppName: away?.name ?? "?", oppLogo: away?.logoUrl ?? null, home: true };
    if (away?.code) (schedule[away.code] ??= {})[dateStr] = { oppCode: home?.code ?? null, oppName: home?.name ?? "?", oppLogo: home?.logoUrl ?? null, home: false };
  }

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Cap Space Calculator" subtitle="How pricey an addition can you afford? Unused cap banks each day of the regular season, so your spending room grows toward the deadline."
        right={from ? <BackPill href={`/teams/${from}/salary`}>Team Salary Cap</BackPill> : undefined} />
      <CapCalculator
        ceiling={settings.salaryCapUpper} teams={teamData}
        seasonStart={iso(regularAt)} seasonEnd={iso(seasonEnd)}
        daysTotal={dayProgress.daysTotal}
        defaultDate={iso(addDays(regularAt, dayProgress.daysPlayed))}
        schedule={schedule}
        initialTeam={initialTeam}
      />
    </div>
  );
}
