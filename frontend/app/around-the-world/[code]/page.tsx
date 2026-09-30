import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BackPill, Card, PageHeader, StatTile } from "@/components/ui";
import WorldLeagueStats from "@/components/WorldLeagueStats";
import { epProfileUrl } from "@/lib/playerName";
import { getTeamSession } from "@/lib/auth";
import { worldScoutingMeta } from "@/lib/world-scouting";

export const dynamic = "force-dynamic";

export default async function WorldLeaguePage({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const [{ code }, { season: requestedSeason }] = await Promise.all([params, searchParams]);
  const league = await prisma.worldLeague.findUnique({ where: { code: code.toUpperCase() }, include: { teams: { orderBy: { name: "asc" } } } });
  if (!league?.active) notFound();

  const [seasons, otherLeagues] = await Promise.all([
    prisma.worldPlayerSeasonStat.findMany({ where: { leagueId: league.id }, distinct: ["season"], select: { season: true }, orderBy: { season: "desc" } }),
    prisma.worldLeague.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const defaultSeason = seasons.find((s) => s.season === "2026-27")?.season ?? "2026-27";
  const season = requestedSeason ? (seasons.find((s) => s.season === requestedSeason)?.season ?? requestedSeason) : defaultSeason;
  const stats = season ? await prisma.worldPlayerSeasonStat.findMany({
    where: { leagueId: league.id, season },
    include: { player: true, team: true },
    orderBy: [{ points: "desc" }, { gamesPlayed: "desc" }],
  }) : [];
  const teamId = await getTeamSession();
  const { year: draftYear, meta } = await worldScoutingMeta(stats.map((s) => s.player), teamId);
  const visibleStats = stats;
  const syncedAt = stats.reduce<Date | null>((latest, s) => !latest || s.syncedAt > latest ? s.syncedAt : latest, null);
  const skaters = visibleStats.filter((s) => !s.isGoalie);
  const goalies = visibleStats.filter((s) => s.isGoalie);
  const teamCounts = new Map<number, number>();
  visibleStats.forEach((s) => { if (s.teamId) teamCounts.set(s.teamId, (teamCounts.get(s.teamId) ?? 0) + 1); });

  return <div className="space-y-6 py-2">
    <BackPill href="/around-the-world">Around the World</BackPill>
    <PageHeader title={<span className="inline-flex items-center gap-3">{league.logoUrl && <img src={league.logoUrl} alt="" className="w-12 h-12 object-contain" />}{league.name}</span>} subtitle={`${league.country || league.region} · Real-world prospect statistics`} />

    <nav className="flex flex-wrap gap-2" aria-label="World leagues">
      {otherLeagues.map((item) => <Link key={item.code} href={`/around-the-world/${item.code.toLowerCase()}`} className={`rounded-lg px-3 py-1.5 text-sm font-semibold border transition-colors ${item.code === league.code ? "bg-sky-500/15 text-sky-300 border-sky-500/40" : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white hover:border-slate-600"}`}>{item.code}</Link>)}
    </nav>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatTile label="Teams" value={league.teams.length} color="text-sky-300" />
      <StatTile label="Skaters" value={skaters.length} sub={season || "No season yet"} color="text-emerald-300" />
      <StatTile label="Goalies" value={goalies.length} sub={season || "No season yet"} color="text-violet-300" />
      <StatTile label="Last sync" value={syncedAt ? syncedAt.toLocaleDateString("sk-SK", { timeZone: "Europe/Bratislava" }) : "—"} sub="Source data snapshot" color="text-amber-300" />
    </div>

    {season ? <>
      {seasons.length > 1 && <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-400">Season:</span>{seasons.map((item) => <Link key={item.season} href={`/around-the-world/${league.code.toLowerCase()}?season=${encodeURIComponent(item.season)}`} className={`rounded-lg px-3 py-1.5 border ${season === item.season ? "border-sky-500/40 bg-sky-500/15 text-sky-300" : "border-slate-800 text-slate-400 hover:text-white"}`}>{item.season}</Link>)}</div>}
      <WorldLeagueStats season={season} leagueCode={league.code} draftYear={draftYear} canSave={teamId != null} stats={visibleStats.map((s) => ({
        id: s.id, worldPlayerId: s.playerId, playerName: s.player.name, position: s.player.position, epUrl: s.player.epUrl ?? epProfileUrl(s.player.name),
        birthDate: s.player.birthDate, age: meta.get(s.playerId)?.age ?? null, rights: meta.get(s.playerId)?.rights ?? null,
        draftable: meta.get(s.playerId)?.draftable ?? false, saved: meta.get(s.playerId)?.saved ?? false,
        teamId: s.teamId, teamName: s.team?.name ?? "—", teamLogoUrl: s.team?.logoUrl ?? null,
        isGoalie: s.isGoalie, gamesPlayed: s.gamesPlayed, goals: s.goals, assists: s.assists,
        points: s.points, plusMinus: s.plusMinus, penaltyMinutes: s.penaltyMinutes,
        wins: s.wins, losses: s.losses, overtimeLosses: s.overtimeLosses,
        savePercentage: s.savePercentage, goalsAgainstAverage: s.goalsAgainstAverage, shutouts: s.shutouts,
      }))} teams={league.teams.map((t) => ({ id: t.id, name: t.name, logoUrl: t.logoUrl, players: teamCounts.get(t.id) ?? 0 }))} />
    </> : <Card><div className="py-10 text-center"><p className="text-lg font-semibold">No imported statistics yet</p><p className="mt-2 text-sm text-slate-400">This league is prepared, but its first data sync has not been completed.</p></div></Card>}
  </div>;
}
