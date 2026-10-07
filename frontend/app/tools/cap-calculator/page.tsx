import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { liveCapHit, deadMoneyForYear, CURRENT_SEASON_START } from "@/lib/finance";
import { regularSeasonDayProgress, resolvePhaseThresholds, getLeagueDate } from "@/lib/calendar-server";
import { addDays } from "@/lib/calendar";
import { REGULAR_SEASON } from "@/lib/phase";
import { PageHeader, BackPill } from "@/components/ui";
import CapCalculator from "@/components/CapCalculator";
import { getLang } from "@/lib/lang-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function CapCalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; from?: string }>;
}) {
  const { team: initialTeam, from } = await searchParams;
  const [settings, teams, dayProgress, { regularAt, playoffsAt }, games, buyouts, lang, leagueDate] = await Promise.all([
    loadSettings(),
    prisma.team.findMany({
      where: { league: "NHL", isAffiliate: false },
      select: {
        id: true,
        name: true,
        code: true,
        logoUrl: true,
        players: {
          where: { rosterType: "NHL" },
          select: { capHit: true, contractYears: true, retainedSalary: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    regularSeasonDayProgress(),
    resolvePhaseThresholds(),
    prisma.game.findMany({
      where: { season: REGULAR_SEASON, league: "NHL", seriesId: null },
      select: { gameDate: true, homeTeamId: true, awayTeamId: true },
    }),
    prisma.buyout.findMany({
      select: { teamId: true, perYear: true, startYear: true, years: true },
    }),
    getLang(),
    getLeagueDate(),
  ]);

  const buyoutsByTeam = new Map<number, typeof buyouts>();
  for (const b of buyouts) {
    (buyoutsByTeam.get(b.teamId) ?? buyoutsByTeam.set(b.teamId, []).get(b.teamId)!).push(b);
  }

  const teamData = teams.map((t) => ({
    name: t.name,
    code: t.code,
    logoUrl: t.logoUrl,
    capHit:
      t.players.reduce((s, p) => s + Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)), 0) +
      deadMoneyForYear(buyoutsByTeam.get(t.id) ?? [], CURRENT_SEASON_START),
  }));

  const seasonEnd = addDays(playoffsAt, -1);

  // Per-club schedule for the calendar
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const schedule: Record<
    string,
    Record<string, { oppCode: string | null; oppName: string; oppLogo: string | null; home: boolean }>
  > = {};

  for (const g of games) {
    if (!g.gameDate) continue;
    const dateStr = iso(g.gameDate);
    const home = teamById.get(g.homeTeamId);
    const away = teamById.get(g.awayTeamId);
    if (home?.code) {
      (schedule[home.code] ??= {})[dateStr] = {
        oppCode: away?.code ?? null,
        oppName: away?.name ?? "?",
        oppLogo: away?.logoUrl ?? null,
        home: true,
      };
    }
    if (away?.code) {
      (schedule[away.code] ??= {})[dateStr] = {
        oppCode: home?.code ?? null,
        oppName: home?.name ?? "?",
        oppLogo: home?.logoUrl ?? null,
        home: false,
      };
    }
  }

  // Determine current active date
  const defaultCurrentDate = leagueDate
    ? iso(leagueDate)
    : iso(addDays(regularAt, dayProgress.daysPlayed));

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={t(lang, "capCalc.title")}
        subtitle={t(lang, "capCalc.subtitle")}
        right={
          from ? (
            <BackPill href={`/teams/${from}/salary`}>
              {t(lang, "capCalc.backToSalary")}
            </BackPill>
          ) : undefined
        }
      />
      <CapCalculator
        ceiling={settings.salaryCapUpper}
        teams={teamData}
        seasonStart={iso(regularAt)}
        seasonEnd={iso(seasonEnd)}
        daysTotal={dayProgress.daysTotal}
        defaultDate={defaultCurrentDate}
        schedule={schedule}
        initialTeam={initialTeam}
        lang={lang}
      />
    </div>
  );
}
