import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { Card, PageHeader, Pill, SectionTitle, StatTile } from "@/components/ui";
import Link from "next/link";
import YourProspectTracker from "@/components/YourProspectTracker";
import { worldTeamLevel } from "@/lib/world-team-level";
import { epPlayerSearchUrl } from "@/lib/playerName";

export const dynamic = "force-dynamic";

const leagueIcon = (region: string, code: string) => {
  if (code === "NCAA") return "🎓";
  if (code === "AHL") return "🏒";
  if (region === "Europe") return "🇪🇺";
  return "🌎";
};

export default async function AroundTheWorldPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; team?: string }>;
}) {
  const { view, team: teamParam } = await searchParams;
  const sessionTeamId = await getTeamSession();

  const [leagues, rosterMode, allStats, allTeams] = await Promise.all([
    prisma.worldLeague.findMany({
      where: { active: true },
      include: { _count: { select: { teams: true, stats: true } } },
      orderBy: [{ region: "asc" }, { name: "asc" }],
    }),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } }),
    prisma.worldPlayerSeasonStat.findMany({
      where: { isGoalie: false, season: "2026-27" },
      orderBy: [{ points: "desc" }, { gamesPlayed: "desc" }],
      take: 30,
      include: { player: { include: { currentTeam: true } }, league: true, team: true },
    }),
    prisma.team.findMany({
      where: { parentTeamId: null },
      select: { id: true, name: true, code: true, logoUrl: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeRosterMode = rosterMode?.rosterMode === "real" ? "real" : "profinhl";
  const requestedTeamId = teamParam ? Number.parseInt(teamParam, 10) : null;
  const targetTeam =
    allTeams.find((t) => t.id === requestedTeamId) ??
    allTeams.find((t) => t.id === sessionTeamId) ??
    allTeams.find((t) => t.id === 23) ??
    allTeams[0];

  const targetTeamId = targetTeam?.id ?? 23;

  const myProspects = await prisma.prospect.findMany({
    where: { teamId: targetTeamId, source: activeRosterMode },
    include: {
      worldPlayer: {
        include: {
          currentTeam: { include: { league: true } },
          stats: {
            where: { season: "2026-27" },
            orderBy: [{ points: "desc" }, { gamesPlayed: "desc" }, { syncedAt: "desc" }],
            take: 1,
            include: { league: true, team: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const withStats = myProspects.filter((p) => p.worldPlayer?.stats.length);
  const assigned = myProspects.filter((p) => p.worldPlayer?.currentTeamId || p.worldPlayer?.stats.length);
  const noData = leagues.length === 0;
  const leaders = allStats;

  const featuredCodes = ["WHL", "OHL", "QMJHL", "AHL", "NCAA"];
  const featuredLeagues = featuredCodes
    .map((code) => leagues.find((l) => l.code === code))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  const europeanLeagues = leagues.filter((l) => l.region === "Europe");
  const europeanStats = europeanLeagues.reduce((total, l) => total + l._count.stats, 0);

  return (
    <div className="space-y-6 py-2">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-950/80 via-slate-900 to-violet-950/50 p-6 sm:p-8 shadow-xl shadow-black/20">
        <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <div className="mb-3 inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">
            Global scouting hub
          </div>
          <PageHeader
            title="🌍 Around the World"
            subtitle="Follow your prospects across junior, collegiate, AHL and European hockey — all in one place."
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-700/80 bg-slate-900/50 px-3 py-1 text-xs text-slate-300">
              CHL (WHL · OHL · QMJHL)
            </span>
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-200">
              AHL & NCAA Division I
            </span>
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
              🇪🇺 European Leagues & KHL
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
              Daily Live Sync
            </span>
          </div>
        </div>
      </div>

      {/* High-level stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Tracked leagues"
          value={leagues.length}
          sub="Junior, college, AHL & Europe"
          color="text-sky-300"
        />
        <StatTile
          label="Imported stat lines"
          value={leagues.reduce((n, l) => n + l._count.stats, 0)}
          sub="Across all competitions"
          color="text-emerald-300"
        />
        <StatTile
          label={`${targetTeam?.code || "Team"} prospects`}
          value={myProspects.length}
          sub={`${assigned.length} assigned · ${withStats.length} with stats`}
          color="text-amber-300"
        />
        <StatTile label="Sync status" value="Active" sub="Daily live updates" color="text-violet-300" />
      </div>

      {/* Featured Leagues Grid */}
      <section>
        <SectionTitle count={featuredLeagues.length + (europeanLeagues.length ? 1 : 0)}>
          Choose a competition
        </SectionTitle>
        {noData ? (
          <Card>
            <div className="py-8 text-center">
              <p className="font-semibold text-slate-200">The world database is ready for its first import.</p>
              <p className="mt-2 text-sm text-slate-500">
                WHL, OHL, QMJHL, AHL, NCAA and European prospect tracking can be activated from the commissioner panel.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {featuredLeagues.map((l) => (
              <Link
                key={l.id}
                href={`/around-the-world/${l.code.toLowerCase()}`}
                className="block rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/30 border border-slate-700/70 p-5 shadow-lg shadow-black/20 hover:border-sky-400/50 hover:-translate-y-0.5 transition-all group"
              >
                <div className="flex justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {l.logoUrl ? (
                      <img src={l.logoUrl} alt="" className="w-11 h-11 object-contain" />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-400/10 text-2xl">
                        {leagueIcon(l.region, l.code)}
                      </span>
                    )}
                    <div>
                      <div className="text-lg font-black group-hover:text-sky-300">{l.name}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {l.country || l.region} · {l._count.teams} teams
                      </div>
                    </div>
                  </div>
                  <Pill tone={l._count.stats ? "green" : "slate"}>
                    {l.code === "NCAA"
                      ? `${l._count.teams} teams (pending)`
                      : l._count.stats
                      ? `${l._count.stats} stat lines`
                      : "Awaiting sync"}
                  </Pill>
                </div>
                <div className="mt-5 border-t border-slate-800 pt-3 text-xs font-bold text-sky-400">
                  Explore {l.code} →
                </div>
              </Link>
            ))}

            {europeanLeagues.length > 0 && (
              <Link
                href="/around-the-world/europe"
                className="block rounded-2xl bg-gradient-to-br from-violet-950/60 via-slate-900 to-slate-900 border border-violet-500/30 p-5 shadow-lg shadow-black/20 hover:border-violet-400/60 hover:-translate-y-0.5 transition-all group"
              >
                <div className="flex justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10 text-2xl">
                      🇪🇺
                    </span>
                    <div>
                      <div className="text-lg font-black group-hover:text-violet-300">European & Russian Hub</div>
                      <div className="mt-1 text-xs text-slate-400">Liiga, SHL, Czech, Slovak, KHL & MHL</div>
                    </div>
                  </div>
                  <Pill tone={europeanStats ? "green" : "slate"}>
                    {europeanStats ? `${europeanStats} stat lines` : "Awaiting sync"}
                  </Pill>
                </div>
                <div className="mt-5 border-t border-violet-500/20 pt-3 text-xs font-bold text-violet-300">
                  Explore Europe & Russia →
                </div>
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Prospect Pool Tracker Table */}
      <section>
        <YourProspectTracker
          prospects={myProspects.map((p) => {
            const w = p.worldPlayer;
            const s = w?.stats[0];
            const league = s?.league ?? w?.currentTeam?.league;
            const club = s?.team ?? w?.currentTeam;
            return {
              id: p.id,
              name: p.name,
              position: p.position ?? w?.position ?? null,
              epUrl: p.epUrl ?? w?.epUrl ?? epPlayerSearchUrl(p.name),
              club: club?.name ?? null,
              league: league?.name ?? null,
              leagueCode: league?.code ?? null,
              country: league?.country ?? null,
              level: league ? worldTeamLevel(league.name, club?.name ?? "") : null,
              teamLogoUrl: club?.logoUrl ?? null,
              season: s?.season ?? null,
              gamesPlayed: s?.gamesPlayed ?? null,
              goals: s?.goals ?? null,
              assists: s?.assists ?? null,
              points: s?.points ?? null,
              isGoalie: s?.isGoalie ?? p.position === "G",
              wins: s?.wins ?? null,
              savePercentage: s?.savePercentage ?? null,
            };
          })}
          teams={allTeams}
          currentTeamId={targetTeamId}
          currentTeamName={targetTeam?.name}
        />
      </section>

      {/* Top 30 World League Leaders */}
      {(view === "leaders" || leaders.length > 0) && (
        <section>
          <SectionTitle count={leaders.length} accent="text-sky-300">
            World League Leaders · Top 30 Skaters
          </SectionTitle>
          <Card bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-sm">
                <thead>
                  <tr className="bg-slate-800/30 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                    <th className="text-left px-4 py-3">Player</th>
                    <th className="text-left px-3 py-3">League</th>
                    <th className="text-left px-3 py-3">Club</th>
                    <th className="text-right px-4 py-3">GP</th>
                    <th className="text-right px-3 py-3">G</th>
                    <th className="text-right px-3 py-3">A</th>
                    <th className="text-right px-4 py-3">P</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {leaders.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/20">
                      <td className="px-4 py-3 font-semibold text-slate-100">{s.player.name}</td>
                      <td className="px-3 py-3 text-slate-400 font-mono text-xs">{s.league.code}</td>
                      <td className="px-3 py-3 text-slate-300">
                        {s.team?.name || s.player.currentTeam?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.gamesPlayed}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{s.goals}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{s.assists}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-black text-sky-300">
                        {s.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* Explanatory Info Card */}
      <Card title="How Around the World works" accent="text-slate-300">
        <div className="text-sm text-slate-400 space-y-2">
          <p>
            <b className="text-slate-200">CHL & AHL:</b> Direct league feeds (HockeyTech) provide live regular
            season skater and goalie statistics updated daily.
          </p>
          <p>
            <b className="text-slate-200">NCAA Division I:</b> All college rosters are tracked and mapped to your
            prospects. Stat rows remain in pre-season status until games begin.
          </p>
          <p>
            <b className="text-slate-200">Europe & Russia:</b> High-level senior and junior leagues (Liiga, SHL,
            KHL, MHL, Czech & Slovak Extraliga) track all league assets with official profile and league stats.
          </p>
        </div>
      </Card>
    </div>
  );
}

