import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { worldTeamLevel } from "@/lib/world-team-level";
import { WORLD_LEAGUE_CATALOG } from "@/lib/world-catalog";
import { epProfileUrl } from "@/lib/playerName";
import { BackPill, Card, PageHeader, StatTile } from "@/components/ui";
import WorldLeagueStats from "@/components/WorldLeagueStats";
import WorldCompetitionNav from "@/components/WorldCompetitionNav";
import { getTeamSession } from "@/lib/auth";
import { worldScoutingMeta, draftYearForSeason } from "@/lib/world-scouting";

export const dynamic = "force-dynamic";

export default async function EuropeProspectsPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const { season: requestedSeason } = await searchParams;
  const leagues = await prisma.worldLeague.findMany({ where: { active: true, region: "Europe" }, include: { teams: { orderBy: { name: "asc" } }, _count: { select: { stats: true } } }, orderBy: [{ country: "asc" }, { name: "asc" }] });
  const seasons = await prisma.worldPlayerSeasonStat.findMany({ where: { league: { region: "Europe", active: true } }, distinct: ["season"], select: { season: true }, orderBy: { season: "desc" } });
  const defaultSeason = seasons.find((s) => s.season === "2026-27")?.season ?? "2026-27";
  const season = requestedSeason ? (seasons.find((s) => s.season === requestedSeason)?.season ?? requestedSeason) : defaultSeason;
  const stats = season ? await prisma.worldPlayerSeasonStat.findMany({ where: { season, league: { region: "Europe", active: true } }, include: { player: true, league: true, team: true }, orderBy: [{ points: "desc" }, { gamesPlayed: "desc" }] }) : [];
  const teamId = await getTeamSession();
  const { year: draftYear, meta } = await worldScoutingMeta(stats.map((s) => s.player), teamId, draftYearForSeason(season));
  const visibleStats = stats.filter((s) => { const state = meta.get(s.playerId); return state?.rights || state?.draftable; });
  const importedLeagueCodes = new Set(stats.map((s) => s.league.code));
  const teamCounts = new Map<number, number>();
  visibleStats.forEach((s) => { if (s.teamId) teamCounts.set(s.teamId, (teamCounts.get(s.teamId) ?? 0) + 1); });
  const syncedAt = stats.reduce<Date | null>((latest, s) => !latest || s.syncedAt > latest ? s.syncedAt : latest, null);
  const skaters = visibleStats.filter((s) => !s.isGoalie).length;

  return <div className="space-y-6 py-2">
    <BackPill href="/around-the-world">Around the World</BackPill>
    <PageHeader title="🇪🇺 European Prospects" subtitle="One table for prospects across European competitions, with country, league and team age category." />

    <WorldCompetitionNav activeCode="EUROPE" />

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatTile label="Prospect stat lines" value={visibleStats.length} sub={season || "No season yet"} color="text-violet-300" />
      <StatTile label="Skaters" value={skaters} color="text-emerald-300" />
      <StatTile label="Goalies" value={visibleStats.length - skaters} color="text-sky-300" />
      <StatTile label="Last sync" value={syncedAt ? syncedAt.toLocaleDateString("sk-SK", { timeZone: "Europe/Bratislava" }) : "—"} color="text-amber-300" />
    </div>

    <Card title="European competitions">
      <div className="flex flex-wrap gap-2">
        {WORLD_LEAGUE_CATALOG.filter((league) => league.region === "Europe").map((league) => (
          <span
            key={league.code}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              importedLeagueCodes.has(league.code)
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-slate-700 bg-slate-800/40 text-slate-500"
            }`}
            title={importedLeagueCodes.has(league.code) ? "Imported" : "Awaiting source import"}
          >
            {league.logoUrl && (
              <img src={league.logoUrl} alt="" className="h-3.5 w-3.5 object-contain shrink-0" />
            )}
            <span>{league.country} · {league.name}</span>
            {!importedLeagueCodes.has(league.code) && " (awaiting data)"}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Only competitions with imported prospect data appear in the statistics below. U20/U18 labels are shown when the competition or team identifies that age group.
      </p>
    </Card>

    {season ? <>
      {seasons.length > 1 && <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-400">Season:</span>{seasons.map((item) => <Link key={item.season} href={`/around-the-world/europe?season=${encodeURIComponent(item.season)}`} className={`rounded-lg px-3 py-1.5 border ${season === item.season ? "border-violet-500/40 bg-violet-500/15 text-violet-300" : "border-slate-800 text-slate-400 hover:text-white"}`}>{item.season}</Link>)}</div>}
      <WorldLeagueStats leagueCode="EUROPE" season={season} draftYear={draftYear} canSave={teamId != null} stats={visibleStats.map((s) => ({
        id: s.id, worldPlayerId: s.playerId, playerName: s.player.name, position: s.player.position, epUrl: s.player.epUrl ?? epProfileUrl(s.player.name),
        birthDate: s.player.birthDate, age: meta.get(s.playerId)?.age ?? null, rights: meta.get(s.playerId)?.rights ?? null,
        draftable: meta.get(s.playerId)?.draftable ?? false, saved: meta.get(s.playerId)?.saved ?? false,
        teamId: s.teamId, teamName: s.team?.name ?? "—", teamLogoUrl: s.team?.logoUrl ?? null,
        leagueCode: s.league.code, leagueName: s.league.name, country: s.league.country ?? s.league.region,
        level: worldTeamLevel(s.league.name, s.team?.name ?? ""),
        isGoalie: s.isGoalie, gamesPlayed: s.gamesPlayed, goals: s.goals, assists: s.assists,
        points: s.points, plusMinus: s.plusMinus, penaltyMinutes: s.penaltyMinutes,
        wins: s.wins, losses: s.losses, overtimeLosses: s.overtimeLosses,
        savePercentage: s.savePercentage, goalsAgainstAverage: s.goalsAgainstAverage, shutouts: s.shutouts,
      }))} teams={leagues.flatMap((league) => league.teams.map((team) => ({
        id: team.id, name: team.name, logoUrl: team.logoUrl, players: teamCounts.get(team.id) ?? 0,
        country: league.country ?? league.region, leagueCode: league.code, level: worldTeamLevel(league.name, team.name),
      })))} />
    </> : <Card><div className="py-10 text-center text-sm text-slate-400">European prospect statistics have not been imported yet.</div></Card>}
  </div>;
}
