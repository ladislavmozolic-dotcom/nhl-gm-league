import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import PlayerAvatar from "@/components/playerAvatar";
import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/sim/standings";
import { skaterTotals } from "@/lib/stats-server";
import { cleanName } from "@/lib/playerName";
import { money } from "@/lib/finance";
import NextSimCountdown from "@/components/home/NextSimCountdown";
import { getLeagueClock, defaultStatsPhase } from "@/lib/calendar-server";
import { fmtLeagueDate } from "@/lib/calendar";
import { PRE_SEASON } from "@/lib/phase";
import { getTeamSession } from "@/lib/auth";
import { activeAnnouncements } from "@/lib/announcements";
import CommissionerBanner, { type BannerItem } from "@/components/CommissionerBanner";
import { dailyDigest, latestDigestRound } from "@/lib/digest-server";
import { gmDashboard } from "@/lib/gm-dashboard-server";
import SeasonDashboard from "@/components/SeasonDashboard";
import { tradeBlockBoard } from "@/lib/trade-block-server";
import { activeWaivers } from "@/lib/waivers-server";
import { loadSiteConfig } from "@/lib/site-config";
import { renderMarkdown } from "@/lib/markdown";
import type { HomeBlock } from "@/app/admin/site-editor/actions";
import { getLang } from "@/lib/lang-server";
import { t as tt } from "@/lib/i18n";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

function Card({ title, children, href, accent, viewLabel = "view →" }: { title?: string; children: React.ReactNode; href?: string; accent?: string; viewLabel?: string }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-800/30">
          <h2 className={`text-sm font-bold uppercase tracking-wide ${accent ?? "text-slate-200"}`}>{title}</h2>
          {href && <Link href={href} className="text-xs text-slate-400 hover:text-blue-400">{viewLabel}</Link>}
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
  // Pre-season fully takes over the scoreboard/standings/leaders sections of the
  // home page for the duration of that phase — SEASON itself stays the regular-
  // season string for systems not (yet) pre-season-aware (digest, finance).
  const statsPhase = await defaultStatsPhase();
  const isPreseason = statsPhase === "pre";
  const activeSeason = isPreseason ? PRE_SEASON : SEASON;
  // free-agent filter mirrors /free-agents: skaters, and realOnly hidden in ProfiNHL mode
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 } });
  const faWhere = { rosterType: { notIn: ["NHL", "AHL", "RETIRED", "PROSPECT", "RELEASED", "NONROSTER"] }, isGoalie: false, ...(cfg?.rosterMode === "real" ? {} : { realOnly: false }) };
  const [standings, leaders, faCount, faTop, articlesRaw, teams] = await Promise.all([
    computeStandings(activeSeason, "NHL"),
    skaterTotals(activeSeason, "NHL"),
    prisma.player.count({ where: faWhere }),
    prisma.player.findMany({ where: faWhere, select: { id: true, name: true, position: true, overall: true, slug: true }, orderBy: { overall: "desc" }, take: 6 }),
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

  // Trade Block — who's available around the league (flat list for the home card)
  const tbBoard = await tradeBlockBoard();
  const tbListed = tbBoard.flatMap((t) => t.players);

  // Waiver Wire — who's currently exposed, so it's on-screen without a click
  const waivers = await activeWaivers();

  // Trade Tracker — only COMPLETED deals (the accepted-trade message reads "X traded
  // … to Y for …"); excludes proposed/declined/revoked noise. Latest 3.
  // The message is our own fixed template ("<fromTeam.name> traded … to <toTeam.name>
  // for …"), not user input — Transaction has no team FK, so pull the two logos back
  // out by matching each team's full name against that known shape rather than
  // adding a schema column just for this.
  const recentTradesRaw = await prisma.transaction.findMany({
    where: { type: "TRADE", message: { contains: "traded" } }, orderBy: { createdAt: "desc" }, take: 3,
    select: { id: true, message: true, createdAt: true },
  });
  const titleCase = (s: string) => s.replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase());
  const recentTrades = recentTradesRaw.map((tr) => {
    const fromTeam = teams.find((t) => tr.message.startsWith(`${t.name} traded`)) ?? null;
    const toIdx = tr.message.indexOf(" to ");
    const afterTo = toIdx >= 0 ? tr.message.slice(toIdx + 4) : "";
    const toTeam = teams.find((t) => afterTo.startsWith(t.name)) ?? null;
    // Pull the assets each side gave up out of the fixed template too, so the
    // team names/logos can sit as their own row and the players/picks read as
    // a quieter detail line underneath instead of one long run-on sentence.
    let fromAssets: string | null = null, toAssets: string | null = null;
    if (fromTeam && toTeam && toIdx >= 0) {
      fromAssets = tr.message.slice(fromTeam.name.length, toIdx).replace(/^\s*traded\s*/, "").trim();
      toAssets = afterTo.slice(toTeam.name.length).replace(/^\s*for\s*/, "").replace(/\.\s*$/, "").trim();
    }
    return {
      ...tr,
      from: fromTeam ? { name: titleCase(fromTeam.name), logoUrl: fromTeam.logoUrl, slug: fromTeam.slug } : null,
      to: toTeam ? { name: titleCase(toTeam.name), logoUrl: toTeam.logoUrl, slug: toTeam.slug } : null,
      fromAssets, toAssets,
    };
  });

  // GM command center — full-screen on first load of a session (for a logged-in GM)
  const dash = me != null ? await gmDashboard(me).catch(() => null) : null;

  const topScorers = [...leaders].sort((a, b) => b.points - a.points).slice(0, 6);
  const scorerMeta = new Map((await prisma.player.findMany({
    where: { id: { in: topScorers.map((s) => s.playerId) } },
    select: { id: true, photoUrl: true, slug: true },
  })).map((p) => [p.id, p]));
  const enrich = (arr: typeof standings) => arr.map((t) => ({ ...t, code: t.code, logoUrl: teamById.get(t.teamId)?.logoUrl ?? null, slug: teamById.get(t.teamId)?.slug ?? null }));
  const east = enrich(standings.filter((s) => s.conference?.toLowerCase().includes("eastern")));
  const west = enrich(standings.filter((s) => s.conference?.toLowerCase().includes("western")));

  // latest simulated day → scoreboard ticker + highlights
  const lastDay = await prisma.game.findFirst({ where: { season: activeSeason, status: "FINAL", seriesId: null, gameDate: { not: null } }, orderBy: { gameDate: "desc" }, select: { gameDate: true } });
  let ticker: { id: number; league: string; hg: number | null; ag: number | null; home: any; away: any }[] = [];
  let highlights: string[] = [];
  let stars: { name: string; teamCode: string; logoUrl: string | null; g: number; a: number; pts: number }[] = [];
  let dayGoals = 0, dayPoints = 0;
  if (lastDay?.gameDate) {
    const d = lastDay.gameDate;
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    const games = await prisma.game.findMany({
      where: { season: activeSeason, status: "FINAL", seriesId: null, gameDate: { gte: start, lte: end } },
      select: { id: true, league: true, homeGoals: true, awayGoals: true, homeTeam: { select: { code: true, logoUrl: true } }, awayTeam: { select: { code: true, logoUrl: true } } },
      orderBy: { id: "asc" },
    });
    ticker = games.map((g) => ({ id: g.id, league: g.league, hg: g.homeGoals, ag: g.awayGoals, home: g.homeTeam, away: g.awayTeam }));

    const stats = await prisma.playerGameStat.findMany({
      where: { game: { gameDate: { gte: start, lte: end }, status: "FINAL", season: activeSeason, league: "NHL" } },
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
  const lang = await getLang();
  const T = (k: string) => tt(lang, k);
  const homeBlocks = ((await loadSiteConfig()).homeBlocks as HomeBlock[] | null ?? []).filter((b) => b.visible && (b.title?.trim() || b.body?.trim()));

  return (
    <div className="py-2">
      {homeBlocks.length > 0 && (
        <div className="space-y-4 mb-6">
          {homeBlocks.map((b) => (
            <div key={b.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20">
              {b.title?.trim() && <h2 className="text-lg font-bold mb-2">{b.title}</h2>}
              {b.body?.trim() && <div className="text-slate-300 text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(b.body) }} />}
            </div>
          ))}
        </div>
      )}
      {dash && <SeasonDashboard data={dash} />}
      {/* Stat row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20">
          {!(cfg?.frenzyAutoOpenAt && cfg.frenzyAutoOpenAt.getTime() > Date.now()) && !clock.frenzyOpen && (
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">{T("home.nextSim")}</p>
          )}
          <NextSimCountdown
            frenzyAt={cfg?.frenzyAutoOpenAt?.toISOString() ?? null}
            frenzyOpen={clock.frenzyOpen} frenzyRound={clock.frenzyRound} frenzyDay={clock.frenzyDay}
          />
          <p className="text-xs text-slate-500 mt-2">{fmtLeagueDate(clock.date)} · <span className="text-slate-400">{clock.phaseLabel}</span></p>
        </div>

        {/* 3 Stars of the Day */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20">
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">{T("home.threeStars")}</p>
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

        {/* Trade Tracker — the latest completed deals around the league */}
        <Link href="/trades" className="block bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20 hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wide text-blue-400">🔁 Trade Tracker</p>
            <span className="text-xs text-slate-400">{T("ui.viewAll")}</span>
          </div>
          {recentTrades.length ? (
            <ul className="space-y-2.5">
              {recentTrades.map((t) => (
                <li key={t.id}>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                    {t.from ? (
                      <span className="flex items-center gap-1.5 min-w-0">
                        {t.from.logoUrl && <img src={t.from.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
                        <span className="truncate">{t.from.name}</span>
                      </span>
                    ) : <span className="text-blue-400">•</span>}
                    {t.to && (
                      <>
                        <span className="text-slate-500 shrink-0 text-xs">⇄</span>
                        <span className="flex items-center gap-1.5 min-w-0">
                          {t.to.logoUrl && <img src={t.to.logoUrl} alt="" className="w-4 h-4 object-contain shrink-0" />}
                          <span className="truncate">{t.to.name}</span>
                        </span>
                      </>
                    )}
                    <span className="ml-auto shrink-0 text-slate-500 text-[11px] font-normal tabular-nums">{fmtDate(t.createdAt)}</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">
                    {t.fromAssets && t.toAssets
                      ? <>traded <span className="text-slate-300">{t.fromAssets}</span> for <span className="text-slate-300">{t.toAssets}</span></>
                      : t.message}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No trades yet — completed deals show up here.</p>
          )}
        </Link>

        {/* Tonight's Best — the story of the night, straight from our league */}
        <Link href="/league/digest" className="block bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20 hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wide text-amber-400">🌙 {T("home.tonightsBest")}</p>
            <span className="text-xs text-slate-400">{T("home.storyOfNight")}</span>
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
          <Card title={isPreseason ? `${T("home.scoringLeaders")} (Pre-season)` : T("home.scoringLeaders")} href="/stats/leaders" accent="text-blue-400" viewLabel={T("ui.viewAll")}>
            <div className="space-y-2">
              {topScorers.map((s, i) => {
                const meta = scorerMeta.get(s.playerId);
                return (
                  <div key={s.playerId} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-slate-500 text-xs">{i + 1}</span>
                    <PlayerAvatar src={meta?.photoUrl ?? null} alt={s.name} size={26} />
                    <span className="flex-1 truncate">
                      <PlayerLink slug={meta?.slug ?? undefined} id={s.playerId} name={s.name} clean={false} />
                      {" "}<span className="text-slate-500 text-xs">{s.teamCode}</span>
                    </span>
                    <span className="font-bold tabular-nums">{s.points}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title={T("home.tradeBlock")} href="/trade-block" accent="text-amber-400" viewLabel={T("ui.viewAll")}>
            {tbListed.length ? (
              <div className="space-y-1.5 text-sm">
                {tbListed.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    {p.slug ? <Link href={`/players/${p.slug}`} className="flex-1 truncate hover:text-blue-400">{p.name}</Link> : <span className="flex-1 truncate">{p.name}</span>}
                    <span className="text-slate-500 text-xs">{p.position}</span>
                    <span className="text-slate-500 text-xs">{p.teamCode}</span>
                  </div>
                ))}
                {tbListed.length > 8 && <Link href="/trade-block" className="block text-xs text-blue-400 hover:underline pt-1">+ {tbListed.length - 8} more →</Link>}
              </div>
            ) : <p className="text-sm text-slate-500">{T("home.noTradeBlock")}</p>}
          </Card>

          <Card title={T("home.waiverWire")} href="/waivers" accent="text-sky-400" viewLabel={T("ui.viewAll")}>
            {waivers.length ? (
              <div className="space-y-1.5 text-sm">
                {waivers.slice(0, 8).map((w) => (
                  <div key={w.id} className="flex items-center gap-2">
                    {w.playerSlug ? <Link href={`/players/${w.playerSlug}`} className="flex-1 truncate hover:text-blue-400">{w.playerName}</Link> : <span className="flex-1 truncate">{w.playerName}</span>}
                    <span className="text-slate-500 text-xs">{w.position}</span>
                    <span className="text-slate-500 text-xs">{w.fromCode}</span>
                  </div>
                ))}
                {waivers.length > 8 && <Link href="/waivers" className="block text-xs text-blue-400 hover:underline pt-1">+ {waivers.length - 8} more →</Link>}
              </div>
            ) : <p className="text-sm text-slate-500">{T("home.noWaivers")}</p>}
          </Card>

          <Card title={T("home.birthdays")} accent="text-pink-400">
            <BirthdaysList />
          </Card>
        </div>

        {/* CENTER — News */}
        <div className="lg:col-span-6 space-y-4">
          <CommissionerBanner items={bannerItems} signedIn={me != null} />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{T("home.latestArticle")}</h2>
            <Link href="/news/create" className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium">{T("home.addArticle")}</Link>
          </div>
          {articlesRaw.length === 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">{T("home.noNews")}</div>
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
          <Card title={isPreseason ? `${T("menu.standings")} (Pre-season)` : T("menu.standings")} href="/standings" accent="text-blue-400" viewLabel={T("ui.viewAll")}>
            <div className="space-y-4">
              <MiniStandings title={T("home.eastern")} color="text-blue-400" rows={east} />
              <MiniStandings title={T("home.western")} color="text-red-400" rows={west} />
            </div>
          </Card>

          <Card title={T("home.freeAgents")} href="/free-agents" accent="text-green-400" viewLabel={T("ui.viewAll")}>
            {faTop.length ? (
              <div className="space-y-2">
                {faTop.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate"><PlayerLink slug={p.slug} id={p.id} name={p.name} /> <span className="text-slate-500 text-xs">{p.position}</span></span>
                    <span className="text-slate-400 tabular-nums">{p.overall ?? "—"}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500">No unsigned players right now.</p>}
          </Card>

          <Card title={T("home.quickLinks")}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[[T("menu.scores"), "/scores"], [T("menu.standings"), "/standings"], [T("menu.trades"), "/trades"], [T("menu.stats"), "/stats/leaders"], [T("ui.playoffs"), "/playoffs"], [T("ui.allRosters"), "/tools/all-rosters"]].map(([l, h]) => (
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
      {born.slice(0, 8).map((p) => {
        const birthYear = Number((p.birthDate ?? "").slice(0, 4));
        const age = birthYear > 1900 ? today.getFullYear() - birthYear : null; // turns this age today
        return (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <span>🎂</span>
            <span className="flex-1 truncate"><PlayerLink id={p.id} name={p.name} />{age != null && <span className="text-slate-500"> · {age} y/o</span>}</span>
            <span className="text-slate-500 text-xs">{p.team?.code}</span>
          </div>
        );
      })}
    </div>
  );
}
