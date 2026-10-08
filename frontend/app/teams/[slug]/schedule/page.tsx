import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { PRE_SEASON } from "@/lib/phase";
import { getLang } from "@/lib/lang-server";
import { getLeagueDate } from "@/lib/calendar-server";
import TeamScheduleCalendar, {
  type TeamScheduleGame,
} from "@/components/TeamScheduleCalendar";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

async function loadTeamGames(season: string, league: string, teamId: number) {
  return prisma.game.findMany({
    where: {
      season,
      league,
      seriesId: null,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
    },
    orderBy: [{ gameDate: "asc" }, { round: "asc" }, { id: "asc" }],
    include: {
      homeTeam: { select: { code: true, logoUrl: true, name: true, slug: true } },
      awayTeam: { select: { code: true, logoUrl: true, name: true, slug: true } },
    },
  });
}

function serializeGames(games: Awaited<ReturnType<typeof loadTeamGames>>): TeamScheduleGame[] {
  return games.map((g) => ({
    id: g.id,
    season: g.season,
    league: g.league,
    round: g.round,
    gameDate: g.gameDate ? g.gameDate.toISOString() : null,
    status: g.status,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    homeGoals: g.homeGoals,
    awayGoals: g.awayGoals,
    winnerTeamId: g.winnerTeamId,
    endedIn: g.endedIn,
    eventKind: g.eventKind ?? null,
    eventTitle: g.eventTitle ?? null,
    eventVenue: g.eventVenue ?? null,
    homeTeam: {
      code: g.homeTeam.code,
      name: g.homeTeam.name,
      slug: g.homeTeam.slug,
      logoUrl: g.homeTeam.logoUrl,
    },
    awayTeam: {
      code: g.awayTeam.code,
      name: g.awayTeam.name,
      slug: g.awayTeam.slug,
      logoUrl: g.awayTeam.logoUrl,
    },
  }));
}

export default async function TeamSchedulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    select: { id: true, name: true, code: true, slug: true, logoUrl: true, league: true },
  });
  if (!team) notFound();

  const [games, admin, leagueCfg, lang, leagueDate] = await Promise.all([
    loadTeamGames(SEASON, team.league, team.id),
    isAdmin(),
    prisma.leagueConfig.findUnique({
      where: { id: 1 },
      select: { preseasonPublic: true },
    }),
    getLang(),
    getLeagueDate(),
  ]);

  const showPre = admin || !!leagueCfg?.preseasonPublic;
  const preGames = showPre
    ? await loadTeamGames(PRE_SEASON, team.league, team.id)
    : [];

  const serializedGames = serializeGames(games);
  const serializedPreGames = serializeGames(preGames);

  return (
    <div className="space-y-6">
      <TeamScheduleCalendar
        team={team}
        games={serializedGames}
        preGames={serializedPreGames}
        leagueDateIso={leagueDate ? leagueDate.toISOString() : null}
        lang={lang}
      />
    </div>
  );
}

