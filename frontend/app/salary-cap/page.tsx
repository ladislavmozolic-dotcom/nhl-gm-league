import { capPenaltyMap, capFloorPenaltyMap } from "@/lib/cap-penalty";
import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { teamCapCentral, deadMoneyForYear, CURRENT_SEASON_START, money, liveCapHit, ltirRelief } from "@/lib/finance";
import { computeStandings } from "@/lib/sim/standings";
import { regularSeasonDayProgress } from "@/lib/calendar-server";
import CapCentralTable, { type CapRow } from "@/components/CapCentralTable";
import { PageHeader } from "@/components/ui";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function SalaryCapPage() {
  const [teams, settings, standings, schedule, dayProgress, lang] = await Promise.all([
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: {
        id: true, name: true, slug: true, logoUrl: true, code: true, division: true, conference: true,
        players: { where: { rosterType: "NHL" }, select: { capHit: true, retainedSalary: true, contractYears: true, injuryDaysLeft: true, condition: true, isGoalie: true } },
      },
      orderBy: { name: "asc" },
    }),
    loadSettings(),
    computeStandings(SEASON, "NHL"),
    prisma.game.findMany({ where: { season: SEASON, league: "NHL", seriesId: null }, select: { homeTeamId: true, awayTeamId: true } }),
    regularSeasonDayProgress(),
    getLang(),
  ]);

  const gpById = new Map(standings.map((s) => [s.teamId, s.gp]));
  const gamesTotalById = new Map<number, number>();
  for (const g of schedule) {
    for (const id of [g.homeTeamId, g.awayTeamId]) gamesTotalById.set(id, (gamesTotalById.get(id) ?? 0) + 1);
  }
  const { daysPlayed, daysTotal } = dayProgress;

  const [penalties, floorPenalties] = await Promise.all([
    capPenaltyMap(CURRENT_SEASON_START),
    capFloorPenaltyMap(CURRENT_SEASON_START),
  ]);

  const rows: CapRow[] = await Promise.all(teams.map(async (t) => {
    const gp = gpById.get(t.id) ?? 0;
    const gamesTotal = gamesTotalById.get(t.id) || 82;
    const buyoutRows = await prisma.buyout.findMany({
      where: { teamId: t.id },
      select: { perYear: true, years: true, startYear: true, totalCost: true },
    });
    const buyouts = deadMoneyForYear(buyoutRows.filter((b) => b.totalCost > 0), CURRENT_SEASON_START);
    const deadCap = deadMoneyForYear(buyoutRows.filter((b) => b.totalCost === 0), CURRENT_SEASON_START);
    const netPlayers = t.players.map((p) => ({ capHit: Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)) }));
    const ltirRoster = t.players.map((p) => ({ ...p, capHit: Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)) }));
    const ltir = ltirRelief(ltirRoster);

    const { totalSalaries, capHit, capSpace, underFloorBy, projCapHit, projCapSpace, count } =
      teamCapCentral(
        netPlayers,
        buyouts + deadCap,
        {
          salaryCapUpper: settings.salaryCapUpper - (penalties.get(t.id) ?? 0),
          salaryCapLower: settings.salaryCapLower + (floorPenalties.get(t.id) ?? 0),
        },
        { daysPlayed, daysTotal }
      );

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      logoUrl: t.logoUrl,
      code: t.code,
      division: t.division,
      conference: t.conference,
      gp,
      gamesTotal,
      count,
      totalSalaries,
      buyouts,
      deadCap,
      capHit,
      capSpace,
      underFloorBy,
      projCapHit,
      projCapSpace,
      ltir,
    };
  }));

  const isSk = lang === "cs";

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-2 px-3 sm:px-6">
      <PageHeader
        title={isSk ? "Cap Central — Platový strop ligy" : "Cap Central — NHL Salary Cap"}
        subtitle={
          isSk
            ? `Sezóna ${SEASON} · ▲ Strop ${money(settings.salaryCapUpper)} · ▼ Podlaha ${money(settings.salaryCapLower)} · Deň ${daysPlayed} z ${daysTotal}`
            : `Season ${SEASON} · ▲ Upper Limit ${money(settings.salaryCapUpper)} · ▼ Lower Limit ${money(settings.salaryCapLower)} · Day ${daysPlayed} of ${daysTotal}`
        }
      />
      <CapCentralTable
        rows={rows}
        capUpper={settings.salaryCapUpper}
        capLower={settings.salaryCapLower}
        lang={lang}
      />
    </div>
  );
}
