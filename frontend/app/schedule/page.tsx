import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { liveMatchesActive } from "@/lib/live-server";
import DaySimControls from "@/components/DaySimControls";
import { PRE_SEASON } from "@/lib/phase";
import { getLang } from "@/lib/lang-server";
import { getLeagueDate } from "@/lib/calendar-server";
import { t } from "@/lib/i18n";
import ScheduleView, { type ScheduleGameItem, type ScheduleTeamOption } from "@/components/ScheduleView";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string }>;
}) {
  const { league: leagueParam } = await searchParams;
  const league = leagueParam === "AHL" ? "AHL" : "NHL";
  const otherLeague = league === "AHL" ? "NHL" : "AHL";

  const [games, admin, leagueCfg, allTeams, lang, leagueDate] = await Promise.all([
    prisma.game.findMany({
      where: { season: SEASON, league, seriesId: null },
      orderBy: [{ round: "asc" }, { gameDate: "asc" }, { id: "asc" }],
      include: {
        homeTeam: { select: { code: true, name: true, logoUrl: true } },
        awayTeam: { select: { code: true, name: true, logoUrl: true } },
      },
    }),
    isAdmin(),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { preseasonPublic: true } }),
    prisma.team.findMany({
      where: { league },
      select: { code: true, name: true, logoUrl: true },
      orderBy: { name: "asc" },
    }),
    getLang(),
    getLeagueDate(),
  ]);

  const played = games.filter((g) => g.status === "FINAL").length;

  // Global game number for the REGULAR season only
  const numById = new Map(games.map((g, i) => [g.id, i + 1]));

  // Pre-season games
  const preGames =
    admin || leagueCfg?.preseasonPublic
      ? await prisma.game.findMany({
          where: { season: PRE_SEASON, league },
          orderBy: [{ round: "asc" }, { id: "asc" }],
          include: {
            homeTeam: { select: { code: true, name: true, logoUrl: true } },
            awayTeam: { select: { code: true, name: true, logoUrl: true } },
          },
        })
      : [];

  const rawAllGames = [
    ...preGames.map((g) => ({ ...g, isPre: true as const })),
    ...games.map((g) => ({ ...g, isPre: false as const })),
  ].sort((a, b) => (a.gameDate?.getTime() ?? 0) - (b.gameDate?.getTime() ?? 0));

  // Determine current active game / day
  // 1. First check if any game matches the current leagueDate
  // 2. Otherwise find the first not-yet-played game
  // 3. Fallback to last played game or first game
  const leagueDateIso = leagueDate ? leagueDate.toISOString().slice(0, 10) : null;
  const gameOnLeagueDate = leagueDateIso
    ? rawAllGames.find((g) => g.gameDate && g.gameDate.toISOString().slice(0, 10) === leagueDateIso)
    : null;

  const firstUnplayed = rawAllGames.find((g) => g.status !== "FINAL");
  const lastPlayed = [...rawAllGames].reverse().find((g) => g.status === "FINAL");

  const activeGame = gameOnLeagueDate ?? firstUnplayed ?? lastPlayed ?? rawAllGames[0];
  const currentId = activeGame?.id ?? null;
  const currentMonthKey = activeGame?.gameDate
    ? `${activeGame.gameDate.getUTCFullYear()}-${String(activeGame.gameDate.getUTCMonth() + 1).padStart(2, "0")}`
    : null;

  // Serialize games for client component
  const serializedGames: ScheduleGameItem[] = rawAllGames.map((g) => ({
    id: g.id,
    league: g.league,
    season: g.season,
    status: g.status,
    gameDate: g.gameDate ? g.gameDate.toISOString() : null,
    round: g.round,
    homeGoals: g.homeGoals,
    awayGoals: g.awayGoals,
    endedIn: g.endedIn,
    eventKind: g.eventKind ?? null,
    eventTitle: g.eventTitle ?? null,
    eventVenue: g.eventVenue ?? null,
    isPre: g.isPre,
    gameNumber: numById.get(g.id),
    homeTeam: {
      code: g.homeTeam.code,
      name: g.homeTeam.name,
      logoUrl: g.homeTeam.logoUrl,
    },
    awayTeam: {
      code: g.awayTeam.code,
      name: g.awayTeam.name,
      logoUrl: g.awayTeam.logoUrl,
    },
  }));

  const teamOptions: ScheduleTeamOption[] = allTeams.map((t) => ({
    code: t.code ?? "",
    name: t.name,
    logoUrl: t.logoUrl,
  }));

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title={`${league} ${t(lang, "schedule.title")}`}
        subtitle={`${SEASON} • ${games.length} ${t(lang, "schedule.gamesCount")} • ${played} ${t(lang, "schedule.statPlayed").toLowerCase()}`}
        right={
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/schedule${league === "AHL" ? "" : "?league=AHL"}`}
              className="px-3.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors shadow-sm"
            >
              🏒 {otherLeague}
            </Link>
            <Link
              href="/playoffs"
              className="px-3.5 py-1.5 rounded-xl border border-amber-600/40 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 text-xs font-bold transition-colors shadow-sm"
            >
              🏆 {t(lang, "ui.playoffs")}
            </Link>
          </div>
        }
      />

      {admin && (
        <div className="sticky top-14 z-30 -mx-4 px-4 py-2 bg-[#0a1628]/95 backdrop-blur-md border-b border-slate-800/50 shadow-md">
          <DaySimControls liveEnabled={await liveMatchesActive()} />
        </div>
      )}

      <ScheduleView
        games={serializedGames}
        teams={teamOptions}
        league={league}
        season={SEASON}
        currentId={currentId}
        initialMonth={currentMonthKey}
        lang={lang}
      />
    </div>
  );
}
