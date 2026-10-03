import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { Card, PageHeader, SectionTitle, StatTile } from "@/components/ui";
import Link from "next/link";
import YourProspectTracker from "@/components/YourProspectTracker";
import { worldTeamLevel } from "@/lib/world-team-level";
import { epProfileUrl } from "@/lib/playerName";
import { projectProspect } from "@/lib/prospect-projection";

export const dynamic = "force-dynamic";

// Per-league visual config
type LeagueStyle = { gradient: string; border: string; accent: string; icon: string; hover: string };
const LEAGUE_STYLES: Record<string, LeagueStyle> = {
  WHL:   { gradient: "from-orange-950/60 via-slate-900 to-slate-950", border: "border-orange-500/25", accent: "text-orange-300", hover: "hover:border-orange-400/50", icon: "🏒" },
  OHL:   { gradient: "from-amber-950/60 via-slate-900 to-slate-950", border: "border-amber-500/25", accent: "text-amber-300", hover: "hover:border-amber-400/50", icon: "🏒" },
  QMJHL: { gradient: "from-rose-950/60 via-slate-900 to-slate-950", border: "border-rose-500/25", accent: "text-rose-300", hover: "hover:border-rose-400/50", icon: "🏒" },
  AHL:   { gradient: "from-red-950/60 via-slate-900 to-slate-950", border: "border-red-500/25", accent: "text-red-300", hover: "hover:border-red-400/50", icon: "🥅" },
  NCAA:  { gradient: "from-blue-950/60 via-slate-900 to-slate-950", border: "border-blue-500/25", accent: "text-blue-300", hover: "hover:border-blue-400/50", icon: "🎓" },
  KHL:   { gradient: "from-sky-950/60 via-slate-900 to-slate-950", border: "border-sky-500/25", accent: "text-sky-300", hover: "hover:border-sky-400/50", icon: "⭐" },
};
const DEFAULT_STYLE: LeagueStyle = { gradient: "from-slate-900 via-slate-900 to-slate-950", border: "border-slate-700/60", accent: "text-sky-300", hover: "hover:border-sky-400/40", icon: "🌎" };

function getStyle(code: string) { return LEAGUE_STYLES[code] ?? DEFAULT_STYLE; }

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
            orderBy: [{ season: "desc" }, { gamesPlayed: "desc" }, { syncedAt: "desc" }],
            include: { league: true, team: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const withStats = myProspects.filter((p) => p.worldPlayer?.stats.length).length;
  const assigned = myProspects.filter((p) => p.worldPlayer?.currentTeamId || p.worldPlayer?.stats.length).length;
  const noData = leagues.length === 0;
  const leaders = allStats;

  const featuredCodes = ["WHL", "OHL", "QMJHL", "AHL", "NCAA", "KHL"];
  const featuredLeagues = featuredCodes
    .map((code) => leagues.find((l) => l.code === code))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  const europeanLeagues = leagues.filter((l) => l.region === "Europe");
  const europeanStats = europeanLeagues.reduce((total, l) => total + l._count.stats, 0);

  const totalStats = leagues.reduce((n, l) => n + l._count.stats, 0);

  return (
    <div className="space-y-6 py-2">
      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-3xl border border-sky-500/15 bg-gradient-to-br from-sky-950/70 via-slate-900 to-violet-950/40 p-7 sm:p-10 shadow-2xl shadow-black/30">
        <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-sky-500/8 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-violet-500/8 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-96 rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="relative">
          <div className="mb-4 inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-sky-300">
            🌍 Global Scouting Hub
          </div>
          <PageHeader
            title="Around the World"
            subtitle="Follow your prospects across junior, collegiate, AHL and European hockey — all in one place."
          />
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { label: "CHL · WHL · OHL · QMJHL", color: "border-orange-500/30 bg-orange-500/10 text-orange-200" },
              { label: "AHL & NCAA Division I", color: "border-sky-500/30 bg-sky-500/10 text-sky-200" },
              { label: "🇪🇺 Liiga · SHL · KHL · MHL · Czech · Slovak", color: "border-violet-500/30 bg-violet-500/10 text-violet-200" },
              { label: "⚡ Daily Live Sync", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" },
            ].map((b) => (
              <span key={b.label} className={`rounded-full border px-3 py-1 text-xs font-semibold ${b.color}`}>{b.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stat Tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Tracked leagues" value={leagues.length} sub="Junior, college, AHL & Europe" color="text-sky-300" />
        <StatTile label="Stat lines" value={totalStats} sub="2026-27 season" color="text-emerald-300" />
        <StatTile
          label={`${targetTeam?.code || "Team"} prospects`}
          value={myProspects.length}
          sub={`${assigned} assigned · ${withStats} with stats`}
          color="text-amber-300"
        />
        <StatTile label="Sync status" value="Active" sub="Daily live updates" color="text-violet-300" />
      </div>

      {/* ── League Cards ── */}
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
            {featuredLeagues.map((l) => {
              const s = getStyle(l.code);
              return (
                <Link
                  key={l.id}
                  href={`/around-the-world/${l.code.toLowerCase()}`}
                  className={`group relative overflow-hidden block rounded-2xl bg-gradient-to-br ${s.gradient} border ${s.border} p-5 shadow-lg shadow-black/20 ${s.hover} hover:-translate-y-0.5 transition-all duration-200`}
                >
                  {/* Glow orb */}
                  <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full opacity-30 blur-2xl bg-current" />
                  <div className="relative flex justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {l.logoUrl ? (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 p-1.5 shadow-inner">
                          <img src={l.logoUrl} alt="" className="h-full w-full object-contain drop-shadow" />
                        </div>
                      ) : (
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-2xl shadow-inner">
                          {s.icon}
                        </span>
                      )}
                      <div>
                        <div className={`text-base font-black tracking-tight group-hover:${s.accent}`}>{l.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {l.country || l.region} · {l._count.teams} teams
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {l._count.stats > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          {l._count.stats}
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-700 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-500">
                          {l.code === "NCAA" ? `${l._count.teams} teams` : "Awaiting"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`mt-4 border-t border-white/5 pt-3 text-xs font-black ${s.accent} flex items-center gap-1`}>
                    Explore {l.code} <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </div>
                </Link>
              );
            })}

            {/* European Hub card */}
            {europeanLeagues.length > 0 && (
              <Link
                href="/around-the-world/europe"
                className="group relative overflow-hidden block rounded-2xl bg-gradient-to-br from-violet-950/60 via-slate-900 to-slate-950 border border-violet-500/25 p-5 shadow-lg shadow-black/20 hover:border-violet-400/50 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-violet-500/20 blur-2xl" />
                <div className="relative flex justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 p-1.5 shadow-inner">
                      <img src="/images/leagues/europe.svg" alt="" className="h-full w-full object-contain drop-shadow" />
                    </div>
                    <div>
                      <div className="text-base font-black tracking-tight group-hover:text-violet-300">European &amp; Russian Hub</div>
                      <div className="mt-1 text-xs text-slate-500">Liiga · SHL · KHL · MHL · Czech · Slovak</div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {europeanStats > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {europeanStats}
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-700 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-500">Awaiting</span>
                    )}
                  </div>
                </div>
                <div className="mt-4 border-t border-violet-500/10 pt-3 text-xs font-black text-violet-300 flex items-center gap-1">
                  Explore Europe &amp; Russia <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                </div>
              </Link>
            )}
          </div>
        )}
      </section>

      {/* ── Prospect Tracker ── */}
      <section>
        <YourProspectTracker
          prospects={myProspects.map((p) => {
            const w = p.worldPlayer;
            const s = w?.stats.find((item) => item.season === "2026-27") ?? w?.stats[0];
            const previous = s ? w?.stats.find((item) => item.id !== s.id && item.isGoalie === s.isGoalie) : null;
            const league = s?.league ?? w?.currentTeam?.league;
            const club = s?.team ?? w?.currentTeam;
            const pointsPerGame = s && !s.isGoalie && s.gamesPlayed ? s.points / s.gamesPlayed : null;
            const previousPointsPerGame = previous && !previous.isGoalie && previous.gamesPlayed ? previous.points / previous.gamesPlayed : null;
            const trend = pointsPerGame == null || previousPointsPerGame == null ? "First tracked season" : pointsPerGame > previousPointsPerGame + 0.15 ? "Trending up" : pointsPerGame < previousPointsPerGame - 0.15 ? "Cooling off" : "Steady";
            const role = (p.position ?? w?.position ?? "").toUpperCase() === "G" ? "Goaltender" : (p.position ?? w?.position ?? "").toUpperCase().includes("D") ? "Defensive prospect" : pointsPerGame != null && pointsPerGame >= 1 ? "Offensive driver" : "Forward prospect";
            const alert = !w ? "Needs real-world match" : !s ? "Roster linked — awaiting stats" : s.gamesPlayed === 0 ? "Awaiting season debut" : pointsPerGame != null && pointsPerGame >= 1 ? "Strong offensive start" : "Live season tracking";
            const projection = projectProspect({
              position: p.position ?? w?.position,
              draftYear: p.draftYear,
              overallPick: p.overallPick,
              birthDate: w?.birthDate,
              stats: w?.stats,
            });
            return {
              id: p.id,
              name: p.name,
              position: p.position ?? w?.position ?? null,
              epUrl: p.epUrl ?? w?.epUrl ?? epProfileUrl(p.name),
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
              developmentLevel: league ? worldTeamLevel(league.name, club?.name ?? "") : null,
              developmentRole: role,
              developmentTrend: trend,
              developmentAlert: alert,
              projection,
            };
          })}
          teams={allTeams}
          currentTeamId={targetTeamId}
          currentTeamName={targetTeam?.name}
        />
      </section>

      {/* ── World Leaders Table ── */}
      {(view === "leaders" || leaders.length > 0) && (
        <section>
          <SectionTitle count={leaders.length} accent="text-sky-300">
            World League Leaders · Top 30 Skaters 2026-27
          </SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-900 to-slate-950 shadow-xl shadow-black/20">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/30 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <th className="w-10 px-4 py-3 text-center">#</th>
                    <th className="px-4 py-3 text-left">Player</th>
                    <th className="px-3 py-3 text-left">League</th>
                    <th className="px-3 py-3 text-left">Club</th>
                    <th className="px-4 py-3 text-right">GP</th>
                    <th className="px-3 py-3 text-right">G</th>
                    <th className="px-3 py-3 text-right">A</th>
                    <th className="px-4 py-3 text-right">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {leaders.map((s, i) => (
                    <tr key={s.id} className="group hover:bg-sky-500/[0.04] transition-colors">
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${
                          i === 0 ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40" :
                          i === 1 ? "bg-slate-400/20 text-slate-300 ring-1 ring-slate-400/30" :
                          i === 2 ? "bg-orange-700/20 text-orange-400 ring-1 ring-orange-500/30" :
                          "text-slate-600"
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-100 group-hover:text-white">
                        <a
                          href={s.player.epUrl || epProfileUrl(s.player.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-sky-300 hover:underline transition-colors inline-flex items-center gap-1 group/leadname"
                          title="Open EliteProspects profile"
                        >
                          <span>{s.player.name}</span>
                          <span className="text-[10px] text-sky-400/60 group-hover/leadname:text-sky-300">↗</span>
                        </a>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md border border-slate-700/80 bg-slate-800/60 px-2 py-0.5 text-[10px] font-bold text-slate-300 font-mono">
                          {s.league.code}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-400 text-xs">
                        {s.team?.name || s.player.currentTeam?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-400">{s.gamesPlayed}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-bold text-emerald-400">{s.goals}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-bold text-sky-400">{s.assists}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="inline-flex h-7 w-9 items-center justify-center rounded-lg bg-sky-500/15 text-sm font-black text-sky-200">
                          {s.points}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── How it works ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-700/40 bg-slate-900/60 p-5">
        <div className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">How Around the World works</div>
        <div className="grid sm:grid-cols-3 gap-4 text-sm text-slate-400">
          <div>
            <div className="mb-1 font-bold text-slate-200">🏒 CHL &amp; AHL</div>
            <p className="text-xs leading-relaxed">Direct HockeyTech league feeds — live regular season skater and goalie statistics updated daily.</p>
          </div>
          <div>
            <div className="mb-1 font-bold text-slate-200">🎓 NCAA Division I</div>
            <p className="text-xs leading-relaxed">All college rosters tracked and mapped to prospects. Stat rows in pre-season status until games begin.</p>
          </div>
          <div>
            <div className="mb-1 font-bold text-slate-200">🇪🇺 Europe &amp; Russia</div>
            <p className="text-xs leading-relaxed">Liiga, SHL, KHL, MHL, Czech &amp; Slovak Extraliga with EP scraper fallback for league data via official profiles.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
