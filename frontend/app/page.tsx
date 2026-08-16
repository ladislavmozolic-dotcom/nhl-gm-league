import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/sim/standings";
import { skaterTotals } from "@/lib/stats-server";
import { cleanName } from "@/lib/playerName";
import { money } from "@/lib/finance";
import NextSimCountdown from "@/components/home/NextSimCountdown";
import { getLeagueClock } from "@/lib/calendar-server";
import { fmtLeagueDate } from "@/lib/calendar";
import { getTeamSession } from "@/lib/auth";
import { activeAnnouncements } from "@/lib/announcements";
import CommissionerBanner, { type BannerItem } from "@/components/CommissionerBanner";
import { dailyDigest, latestDigestRound } from "@/lib/digest-server";
import { gmDashboard } from "@/lib/gm-dashboard-server";
import SeasonDashboard from "@/components/SeasonDashboard";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

function Card({ title, children, href, accent }: { title?: string; children: React.ReactNode; href?: string; accent?: string }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-800/30">
          <h2 className={`text-sm font-bold uppercase tracking-wide ${accent ?? "text-slate-200"}`}>{title}</h2>
          {href && <Link href={href} className="text-xs text-slate-400 hover:text-blue-400">view →</Link>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20">
      <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">{label}</p>
      <p className={`text-2xl font-black ${color ?? "text-white"} leading-none`}>{value}</p>
      {sub && <p className="text-sm text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default async function HomePage() {
  const [standings, leaders, faCount, faTop, articlesRaw, teams] = await Promise.all([
    computeStandings(SEASON, "NHL"),
    skaterTotals(SEASON, "NHL"),
    prisma.player.count({ where: { rosterType: { notIn: ["NHL", "AHL", "RETIRED", "PROSPECT", "RELEASED"] } } }),
    prisma.player.findMany({ where: { rosterType: { notIn: ["NHL", "AHL", "RETIRED", "PROSPECT", "RELEASED"] } }, select: { id: true, name: true, position: true, overall: true, slug: true }, orderBy: { overall: "desc" }, take: 6 }),
    prisma.newsArticle.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { _count: { select: { comments: true, reactions: true } } } }),
    prisma.team.findMany({ select: { id: true, name: true, logoUrl: true, gm: true, slug: true } }),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const leader = standings[0];

  // commissioner announcements + this GM's unread state (their "DM" inbox)
  const [me, announcements] = await Promise.all([getTeamSession(), activeAnnouncements()]);
  const readIds = me != null
    ? new Set((await prisma.announcementRead.findMany({ where: { teamId: me }, select: { announcementId: true } })).map((r) => r.announcementId))
    : new Set<number>();
  const fmtDate = (d: Date) => `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`; // deterministic (no locale) → no hydration drift
  const bannerItems: BannerItem[] = announcements.map((a) => ({
    id: a.id, body: a.body, linkUrl: a.linkUrl, linkLabel: a.linkLabel, date: fmtDate(a.createdAt), unread: me != null && !readIds.has(a.id),
  }));
  // Tonight's Best — the nightly digest for the "Around the League" box
  const digestRound = await latestDigestRound(SEASON);
  const digest = digestRound ? await dailyDigest(SEASON, digestRound) : null;

  // GM command center — full-screen on first load of a session (for a logged-in GM)
  const dash = me != null ? await gmDashboard(me).catch(() => null) : null;

  const leaderTeam = leader ? teamById.get(leader.teamId) : null;
  const topScorers = [...leaders].sort((a, b) => b.points - a.points).slice(0, 6);
  const enrich = (arr: typeof standings) => arr.map((t) => ({ ...t, code: t.code, logoUrl: teamById.get(t.teamId)?.logoUrl ?? null, slug: teamById.get(t.teamId)?.slug ?? null }));
  const east = enrich(standings.filter((s) => s.conference?.toLowerCase().includes("eastern")));
  const west = enrich(standings.filter((s) => s.conference?.toLowerCase().includes("western")));

  // latest simulated day → scoreboard ticker + highlights
  const lastDay = await prisma.game.findFirst({ where: { season: SEASON, status: "FINAL", seriesId: null, gameDate: { not: null } }, orderBy: { gameDate: "desc" }, select: { gameDate: true } });
  let ticker: { id: number; league: string; hg: number | null; ag: number | null; home: any; away: any }[] = [];
  let highlights: string[] = [];
  let stars: { name: string; teamCode: string; logoUrl: string | null; g: number; a: number; pts: number }[] = [];
  let dayGoals = 0, dayPoints = 0;
  if (lastDay?.gameDate) {
    const d = lastDay.gameDate;
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    const games = await prisma.game.findMany({
      where: { season: SEASON, status: "FINAL", seriesId: null, gameDate: { gte: start, lte: end } },
      select: { id: true, league: true, homeGoals: true, awayGoals: true, homeTeam: { select: { code: true, logoUrl: true } }, awayTeam: { select: { code: true, logoUrl: true } } },
      orderBy: { id: "asc" },
    });
    ticker = games.map((g) => ({ id: g.id, league: g.league, hg: g.homeGoals, ag: g.awayGoals, home: g.homeTeam, away: g.awayTeam }));

    const stats = await prisma.playerGameStat.findMany({
      where: { game: { gameDate: { gte: start, lte: end }, status: "FINAL", season: SEASON, league: "NHL" } },
      select: { playerId: true, goals: true, assists: true, points: true },
    });
    dayGoals = stats.reduce((t, s) => t + s.goals, 0);
    dayPoints = stats.reduce((t, s) => t + s.points, 0);
    const notable = stats.filter((s) => s.goals >= 3 || s.points >= 4).sort((a, b) => b.points - a.points).slice(0, 8);
    const top3 = [...stats].sort((a, b) => b.points - a.points || b.goals - a.goals).slice(0, 3);
    const need = [...new Set([...notable, ...top3].map((s) => s.playerId))];
    if (need.length) {
      const pById = new Map((await prisma.player.findMany({ where: { id: { in: need } }, select: { id: true, name: true, team: { select: { code: true, logoUrl: true } } } })).map((p) => [p.id, p]));
      highlights = notable.map((n) => {
        const p = pById.get(n.playerId);
        const nm = cleanName(p?.name ?? "Player"); const tc = p?.team?.code ?? "";
        if (n.goals >= 3) return `🎩 ${nm} (${tc}) — ${n.goals}-goal ${n.goals >= 4 ? "night" : "hat trick"} (${n.points} pts)`;
        return `🔥 ${nm} (${tc}) — ${n.goals}G ${n.assists}A, ${n.points} points`;
      });
      stars = top3.map((s) => {
        const p = pById.get(s.playerId);
        return { name: cleanName(p?.name ?? "Player"), teamCode: p?.team?.code ?? "", logoUrl: p?.team?.logoUrl ?? null, g: s.goals, a: s.assists, pts: s.points };
      });
    }
  }

  const dateStr = (d: Date) => d.toLocaleDateString("sk-SK", { day: "numeric", month: "short" });

  const clock = await getLeagueClock();

  return (
    <div className="py-2">
      {dash && <SeasonDashboard data={dash} />}
      {/* Stat row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Next Simulation</p>
          <NextSimCountdown />
          <p className="text-xs text-slate-500 mt-2">{fmtLeagueDate(clock.date)} · <span className="text-slate-400">{clock.phaseLabel}</span></p>
        </div>

        {/* 3 Stars of the Day */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">3 Stars of the Day</p>
          {stars.length === 0 ? <p className="text-sm text-slate-500">After the next sim.</p> : (
            <div className="space-y-1.5">
              {stars.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-amber-400 text-xs">{"★".repeat(3 - i)}</span>
                  {s.logoUrl && <img src={s.logoUrl} alt="" className="w-4 h-4 object-contain" />}
                  <span className="flex-1 truncate font-medium">{s.name}</span>
                  <span className="text-slate-400 tabular-nums text-xs">{s.g}-{s.a}-{s.pts}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* League Leader — logo only */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20 flex flex-col">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">League Leader</p>
          <div className="flex items-center gap-3 flex-1">
            {leaderTeam?.logoUrl ? <img src={leaderTeam.logoUrl} alt={leader?.name ?? ""} title={leader?.name ?? ""} className="w-14 h-14 object-contain" />
              : <span className="text-lg font-black text-white">{leader?.name ?? "—"}</span>}
            <div>
              <p className="text-2xl font-black text-white leading-none">{leader?.points ?? 0}</p>
              <p className="text-xs text-slate-400 mt-0.5">points</p>
            </div>
          </div>
        </div>

        {/* Tonight's Best — the story of the night, straight from our league */}
        <Link href="/league/digest" className="block bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20 hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wide text-amber-400">🌙 Tonight&apos;s Best</p>
            <span className="text-xs text-slate-400">the story of the night →</span>
          </div>
          {digest && digest.gameCount > 0 ? (
            <div className="space-y-1.5 text-sm">
              {digest.gameOfNight && (
                <p className="text-slate-200"><span className="text-amber-400">🌟</span> {digest.gameOfNight.away} {digest.gameOfNight.awayGoals}–{digest.gameOfNight.homeGoals} {digest.gameOfNight.home}{digest.gameOfNight.endedIn !== "REG" ? <span className="text-amber-400"> ({digest.gameOfNight.endedIn})</span> : ""} <span className="text-slate-500">· Game of the Night</span></p>
              )}
              {digest.playerOfNight && (
                <p className="text-slate-200"><span className="text-sky-400">⭐</span> {digest.playerOfNight.name} <span className="text-slate-500">({digest.playerOfNight.team})</span> — {digest.playerOfNight.line}</p>
              )}
              {digest.bestGoalie && (
                <p className="text-slate-200 truncate"><span className="text-emerald-400">🧤</span> {digest.bestGoalie.name} <span className="text-slate-500">({digest.bestGoalie.team})</span> — {digest.bestGoalie.line}</p>
              )}
              {!digest.gameOfNight && !digest.playerOfNight && !digest.bestGoalie && (
                <p className="text-slate-500">Highlights appear here after each simulation.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">The night&apos;s best — Game &amp; Player of the Night, upsets, biggest hits — appear here after each simulation.</p>
          )}
        </Link>
      </div>

      {/* 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-3 space-y-6">
          <Card title="Scoring Leaders" href="/stats/leaders" accent="text-blue-400">
            <div className="space-y-2">
              {topScorers.map((s, i) => (
                <div key={s.playerId} className="flex items-center gap-2 text-sm">
                  <span className="w-4 text-slate-500 text-xs">{i + 1}</span>
                  <span className="flex-1 truncate">{s.name} <span className="text-slate-500 text-xs">{s.teamCode}</span></span>
                  <span className="font-bold tabular-nums">{s.points}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Highlights" href="/league/digest" accent="text-amber-400">
            {highlights.length ? (
              <ul className="space-y-2 text-sm text-slate-300">{highlights.slice(0, 5).map((h, i) => <li key={i}>{h}</li>)}</ul>
            ) : <p className="text-sm text-slate-500">Hat tricks and big nights appear here after each simulation.</p>}
          </Card>

          <Card title="Today's Birthdays" accent="text-pink-400">
            <BirthdaysList />
          </Card>
        </div>

        {/* CENTER — News */}
        <div className="lg:col-span-6 space-y-4">
          <CommissionerBanner items={bannerItems} signedIn={me != null} />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Latest Article</h2>
            <Link href="/news/create" className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium">+ Add Article</Link>
          </div>
          {articlesRaw.length === 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">No news yet. Sign in as a GM and write the first article.</div>
          )}
          {articlesRaw.map((a) => {
            const author = teamById.get(a.authorTeamId);
            const preview = a.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
            return (
              <article key={a.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-slate-600 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  {author?.logoUrl ? <img src={author.logoUrl} alt="" className="w-9 h-9 object-contain" />
                    : <div className="w-9 h-9 rounded-full bg-slate-700 grid place-items-center font-bold text-sm">{author?.name?.[0] ?? "?"}</div>}
                  <div>
                    <p className="text-sm font-bold">{author?.gm || author?.name || "GM"}</p>
                    <p className="text-xs text-slate-500">{author?.name} · {a.createdAt.toLocaleDateString("sk-SK")}</p>
                  </div>
                </div>
                <Link href={`/news/${a.id}`}><h3 className="text-lg font-bold mb-2 hover:text-blue-400">{a.title}</h3></Link>
                <p className="text-sm text-slate-300 leading-relaxed">{preview}{preview.length >= 200 ? "…" : ""}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                  <Link href={`/news/${a.id}`} className="text-blue-400 hover:text-blue-300">Read more →</Link>
                  <span>👍 {a._count.reactions}</span>
                  <span>💬 {a._count.comments}</span>
                </div>
              </article>
            );
          })}
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-3 space-y-6">
          <Card title="Standings" href="/standings" accent="text-blue-400">
            <div className="space-y-4">
              <MiniStandings title="Eastern" color="text-blue-400" rows={east} />
              <MiniStandings title="Western" color="text-red-400" rows={west} />
            </div>
          </Card>

          <Card title="Free Agents" href="/free-agents" accent="text-green-400">
            {faTop.length ? (
              <div className="space-y-2">
                {faTop.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{cleanName(p.name)} <span className="text-slate-500 text-xs">{p.position}</span></span>
                    <span className="text-slate-400 tabular-nums">{p.overall ?? "—"}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">No unsigned players right now.</p>}
          </Card>

          <Card title="Quick Links">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[["Scores", "/scores"], ["Standings", "/standings"], ["Trades", "/trades"], ["Stats", "/stats/leaders"], ["Playoffs", "/playoffs"], ["All Rosters", "/tools/all-rosters"]].map(([l, h]) => (
                <Link key={h} href={h} className="px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-center text-slate-300">{l}</Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStandings({ title, color, rows }: {
  title: string; color: string;
  rows: { teamId: number; name: string; code: string | null; logoUrl: string | null; slug: string | null; gp: number; w: number; l: number; otl: number; points: number }[];
}) {
  return (
    <div>
      <p className={`text-[11px] font-bold uppercase tracking-wider ${color} mb-1.5`}>{title}</p>
      <table className="w-full text-xs">
        <thead><tr className="text-[10px] text-slate-500">
          <th className="text-left font-medium pb-1">Team</th>
          {["GP", "W", "L", "OTL", "PTS"].map((h) => <th key={h} className="text-right font-medium pb-1 pl-2">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.teamId} className="border-t border-slate-800/50">
              <td className="py-1 pr-1">
                {t.slug ? (
                  <Link href={`/teams/${t.slug}`} className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                    <span className="text-slate-500 w-3 text-right">{i + 1}</span>
                    {t.logoUrl && <img src={t.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
                    <span className="font-semibold tabular-nums">{t.code ?? t.name}</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 w-3 text-right">{i + 1}</span>
                    {t.logoUrl && <img src={t.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
                    <span className="font-semibold tabular-nums">{t.code ?? t.name}</span>
                  </div>
                )}
              </td>
              <td className="py-1 text-right tabular-nums text-slate-400 pl-2">{t.gp}</td>
              <td className="py-1 text-right tabular-nums pl-2">{t.w}</td>
              <td className="py-1 text-right tabular-nums pl-2">{t.l}</td>
              <td className="py-1 text-right tabular-nums pl-2">{t.otl}</td>
              <td className="py-1 text-right tabular-nums font-bold pl-2">{t.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function BirthdaysList() {
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  // birthDate is a free-form string; match players whose stored date contains today's MM-DD
  const players = await prisma.player.findMany({ where: { birthDate: { not: null } }, select: { id: true, name: true, birthDate: true, team: { select: { code: true } } } });
  // birthDate is ISO "YYYY-MM-DD" — match the trailing "-MM-DD" so month & day both align
  const born = players.filter((p) => p.birthDate?.endsWith(`-${mmdd}`) || p.birthDate?.includes(`-${mmdd}`));
  if (born.length === 0) return <p className="text-sm text-slate-500">No birthdays today.</p>;
  return (
    <div className="space-y-2">
      {born.slice(0, 8).map((p) => (
        <div key={p.id} className="flex items-center gap-2 text-sm">
          <span>🎂</span><span className="flex-1 truncate">{cleanName(p.name)}</span>
          <span className="text-slate-500 text-xs">{p.team?.code}</span>
        </div>
      ))}
    </div>
  );
}
