import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import PlayerAvatar from "@/components/playerAvatar";
import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/sim/standings";
import { skaterTotals } from "@/lib/stats-server";
import { cleanName, displayName } from "@/lib/playerName";
import { money } from "@/lib/finance";
import NextSimCountdown from "@/components/home/NextSimCountdown";
import { getLeagueClock, defaultStatsPhase } from "@/lib/calendar-server";
import { fmtLeagueDate, daysBetween } from "@/lib/calendar";
import { PRE_SEASON } from "@/lib/phase";
import { getTeamSession } from "@/lib/auth";
import { activeAnnouncements } from "@/lib/announcements";
import CommissionerBanner, { type BannerItem } from "@/components/CommissionerBanner";
import { dailyDigest, latestDigestRound } from "@/lib/digest-server";
import { gmDashboard } from "@/lib/gm-dashboard-server";
import SeasonDashboard from "@/components/SeasonDashboard";
import TradeDeadlineBanner from "@/components/TradeDeadlineBanner";
import { deadlineFeedAction } from "@/app/actions/trade-deadline-feed";
import { tradeBlockBoard } from "@/lib/trade-block-server";
import { activeWaivers } from "@/lib/waivers-server";
import { loadSiteConfig } from "@/lib/site-config";
import { renderMarkdown } from "@/lib/markdown";
import type { HomeBlock } from "@/app/admin/site-editor/actions";
import { getLang } from "@/lib/lang-server";
import { t as tt } from "@/lib/i18n";
import { articlePlainText, sanitizeArticleHtml } from "@/lib/news-html";
import { currentInjuries } from "@/lib/injuries-server";

export const dynamic = "force-dynamic";
const SEASON = "2026-27";

function Card({ title, children, href, accent, viewLabel = "view →" }: { title?: string; children: React.ReactNode; href?: string; accent?: string; viewLabel?: string }) {
  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
          <h2 className={`text-xs font-black uppercase tracking-wider ${accent ?? "text-slate-200"}`}>{title}</h2>
          {href && <Link href={href} className="text-xs text-slate-400 hover:text-sky-400 font-semibold transition-colors">{viewLabel}</Link>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">{label}</p>
      <p className={`text-2xl font-black ${color ?? "text-slate-100"} leading-none`}>{value}</p>
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
    prisma.team.findMany({ select: { id: true, name: true, code: true, logoUrl: true, gm: true, gmNickname: true, gmFirstName: true, gmLastName: true, slug: true } }),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const teamByCode = new Map(teams.map((t) => [t.code ?? t.name, t]));
  const teamBySlug = new Map(teams.map((t) => [t.slug, t]));
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
  // Tonight's Best — the nightly digest for the "Around the League" box.
  const digest = await dailyDigest(activeSeason);

  // Trade Block — who's available around the league (flat list for the home card)
  const tbBoard = await tradeBlockBoard();
  const tbListed = tbBoard.flatMap((t) => t.players);

  // Waiver Wire — who's currently exposed, so it's on-screen without a click
  const waivers = await activeWaivers();

  // League Health & Discipline — active injuries, current suspensions and a
  // short return-to-play feed live directly below the waiver wire.
  const [homeInjuries, homeSuspensions, injuryReturns] = await Promise.all([
    currentInjuries({ league: "NHL" }),
    prisma.suspension.findMany({
      where: { season: SEASON, kind: "SUSPENSION", status: "ACTIVE" },
      orderBy: { createdAt: "desc" }, take: 6,
      select: { id: true, playerId: true, playerName: true, teamId: true, incident: true, games: true, gamesServed: true, createdAt: true },
    }),
    prisma.transaction.findMany({
      where: { type: "INJURY_RETURN" }, orderBy: { createdAt: "desc" }, take: 5,
      select: { id: true, playerId: true, teamId: true, message: true, createdAt: true },
    }),
  ]);
  const activeHomeSuspensions = homeSuspensions.filter((s) => s.games > s.gamesServed);
  const healthPlayerIds = [...new Set([...activeHomeSuspensions.map((s) => s.playerId), ...injuryReturns.map((r) => r.playerId).filter((id): id is number => id != null)])];
  const healthPlayers = new Map((await prisma.player.findMany({ where: { id: { in: healthPlayerIds } }, select: { id: true, name: true, slug: true } })).map((p) => [p.id, p]));

  // Trade Tracker — only COMPLETED deals (the accepted-trade message reads "X traded
  // … to Y for …"); excludes proposed/declined/revoked noise. Latest 3.
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
    let fromAssets: string | null = null, toAssets: string | null = null;
    if (fromTeam && toTeam && toIdx >= 0) {
      let fromClean = displayName(tr.message.slice(fromTeam.name.length, toIdx).replace(/^\s*traded\s*/, "").trim());
      let toClean = displayName(afterTo.slice(toTeam.name.length).replace(/^\s*for\s*/, "").replace(/\.\s*$/, "").trim());
      if (fromClean.toLowerCase() === "assets") fromClean = "future considerations";
      if (toClean.toLowerCase() === "assets") toClean = "future considerations";
      fromAssets = fromClean;
      toAssets = toClean;
    }
    return {
      ...tr,
      from: fromTeam ? { name: titleCase(fromTeam.name), code: fromTeam.code ?? titleCase(fromTeam.name), logoUrl: fromTeam.logoUrl, slug: fromTeam.slug } : null,
      to: toTeam ? { name: titleCase(toTeam.name), code: toTeam.code ?? titleCase(toTeam.name), logoUrl: toTeam.logoUrl, slug: toTeam.slug } : null,
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
  let stars: { id?: number; slug?: string | null; name: string; teamCode: string; teamSlug?: string | null; logoUrl: string | null; g: number; a: number; pts: number; gameId: number }[] = [];
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
      select: { playerId: true, gameId: true, goals: true, assists: true, points: true },
    });
    dayGoals = stats.reduce((t, s) => t + s.goals, 0);
    dayPoints = stats.reduce((t, s) => t + s.points, 0);
    const notable = stats.filter((s) => s.goals >= 3 || s.points >= 4).sort((a, b) => b.points - a.points).slice(0, 8);
    const top3 = [...stats].sort((a, b) => b.points - a.points || b.goals - a.goals).slice(0, 3);
    const need = [...new Set([...notable, ...top3].map((s) => s.playerId))];
    if (need.length) {
      const pById = new Map((await prisma.player.findMany({ where: { id: { in: need } }, select: { id: true, name: true, slug: true, team: { select: { code: true, slug: true, logoUrl: true } } } })).map((p) => [p.id, p]));
      highlights = notable.map((n) => {
        const p = pById.get(n.playerId);
        const nm = cleanName(p?.name ?? "Player"); const tc = p?.team?.code ?? "";
        if (n.goals >= 3) return `🎩 ${nm} (${tc}) — ${n.goals}-goal ${n.goals >= 4 ? "night" : "hat trick"} (${n.points} pts)`;
        return `🔥 ${nm} (${tc}) — ${n.goals}G ${n.assists}A, ${n.points} points`;
      });
      stars = top3.map((s) => {
        const p = pById.get(s.playerId);
        return { id: s.playerId, slug: p?.slug ?? null, name: cleanName(p?.name ?? "Player"), teamCode: p?.team?.code ?? "", teamSlug: p?.team?.slug ?? null, logoUrl: p?.team?.logoUrl ?? null, g: s.goals, a: s.assists, pts: s.points, gameId: s.gameId };
      });
    }
  }

  const dateStr = (d: Date) => d.toLocaleDateString("sk-SK", { day: "numeric", month: "short" });

  const nextGame = await prisma.game.findFirst({
    where: { status: "SCHEDULED", seriesId: null, league: "NHL", gameDate: { not: null } },
    orderBy: { gameDate: "asc" },
    select: { gameDate: true },
  });

  const clock = await getLeagueClock();
  const lang = await getLang();
  const T = (k: string) => tt(lang, k);
  const homeBlocks = ((await loadSiteConfig()).homeBlocks as HomeBlock[] | null ?? []).filter((b) => b.visible && (b.title?.trim() || b.body?.trim()));

  // Next game for the logged in GM
  const myTeam = me != null ? teamById.get(me) ?? null : null;
  const myNextGame = me != null
    ? await prisma.game.findFirst({
        where: {
          season: activeSeason,
          status: "SCHEDULED",
          seriesId: null,
          gameDate: { not: null },
          OR: [{ homeTeamId: me }, { awayTeamId: me }],
        },
        orderBy: { gameDate: "asc" },
        select: {
          id: true,
          gameDate: true,
          homeTeamId: true,
          awayTeamId: true,
          homeTeam: { select: { id: true, name: true, code: true, logoUrl: true, slug: true } },
          awayTeam: { select: { id: true, name: true, code: true, logoUrl: true, slug: true } },
        },
      })
    : null;

  let myNextGameWhen: string | null = null;
  let myNextOpponent: { name: string; code: string | null; logoUrl: string | null; slug: string } | null = null;
  let isMyGameHome = false;
  if (myNextGame && myNextGame.gameDate) {
    isMyGameHome = myNextGame.homeTeamId === me;
    myNextOpponent = isMyGameHome ? myNextGame.awayTeam : myNextGame.homeTeam;
    const gDate = new Date(myNextGame.gameDate);
    const diff = daysBetween(clock.date, gDate);
    const weekday = gDate.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const dayMonth = `${gDate.getUTCDate()}.${gDate.getUTCMonth() + 1}.`;
    const dateFormatted = `${weekday}, ${dayMonth}`;
    if (diff === 0) {
      myNextGameWhen = `Today · ${dateFormatted}`;
    } else if (diff === 1) {
      myNextGameWhen = `Tomorrow · ${dateFormatted}`;
    } else if (diff > 1 && diff <= 5) {
      myNextGameWhen = `In ${diff}d · ${dateFormatted}`;
    } else {
      myNextGameWhen = dateFormatted;
    }
  }

  const deadlineFeed = await deadlineFeedAction().catch(() => null);

  return (
    <div className="py-2">
      {deadlineFeed?.isDeadlineDay && <div className="mb-6"><TradeDeadlineBanner initial={deadlineFeed} variant="feed" /></div>}
      {homeBlocks.length > 0 && (
        <div className="space-y-4 mb-6">
          {homeBlocks.map((b) => (
            <div key={b.id} className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 shadow-xl">
              {b.title?.trim() && <h2 className="text-lg font-bold mb-2 text-white">{b.title}</h2>}
              {b.body?.trim() && <div className="text-slate-300 text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(b.body) }} />}
            </div>
          ))}
        </div>
      )}
      {dash && <SeasonDashboard data={dash} />}

      {/* 1. TOP STAT ROW (4 Sleeker Boxes) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Box 1: Next Sim & GM Game */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <NextSimCountdown
              frenzyAt={cfg?.frenzyAutoOpenAt?.toISOString() ?? null}
              frenzyOpen={clock.frenzyOpen} frenzyRound={clock.frenzyRound} frenzyDay={clock.frenzyDay}
              frenzyRoundStartedAt={clock.frenzyRoundStartedAt}
              frenzyStage={clock.frenzyStage}
              nextGameDate={nextGame?.gameDate?.toISOString() ?? null}
            />
            <p className="text-xs text-slate-500 mt-2 font-mono">{fmtLeagueDate(clock.date)} · <span className="text-slate-400 font-sans">{clock.phaseLabel}</span></p>
          </div>

          <div className="border-t border-slate-800/80 pt-3.5 mt-3.5">
            {me != null ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {T("home.yourNextGame")}
                  </p>
                  {myTeam && (
                    <Link
                      href={`/teams/${myTeam.slug}/lines`}
                      className="text-[11px] text-slate-400 hover:text-sky-400 transition-colors font-semibold"
                    >
                      {T("home.editLines")} →
                    </Link>
                  )}
                </div>
                {myNextGame && myNextOpponent ? (
                  <Link
                    href={`/games/${myNextGame.id}`}
                    className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {myNextOpponent.logoUrl ? (
                        <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 30, height: 30, minWidth: 30 }}>
                          <img src={myNextOpponent.logoUrl} alt="" className="object-contain" style={{ width: 22, height: 22, maxWidth: 22, maxHeight: 22 }} />
                        </span>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                          {myNextOpponent.code?.slice(0, 3) ?? "?"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 group-hover:text-white transition-colors truncate">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isMyGameHome ? "bg-blue-900/50 text-blue-300 border border-blue-700/50" : "bg-amber-900/50 text-amber-300 border border-amber-700/50"}`}>
                            {isMyGameHome ? "VS" : "@"}
                          </span>
                          <span className="truncate">{myNextOpponent.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1.5">
                          <span className="text-sky-400 font-semibold">{myNextGameWhen}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 group-hover:text-sky-400 transition-colors shrink-0">
                      →
                    </span>
                  </Link>
                ) : (
                  <p className="text-xs text-slate-500 py-1">{T("home.noNextGame")}</p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span>🏒</span>
                    {T("home.yourNextGame")}
                  </p>
                  <Link href="/login" className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors font-bold">
                    {T("ui.gmLogin")} →
                  </Link>
                </div>
                <p className="text-xs text-slate-500">
                  {T("home.loginPrompt")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Box 2: 3 Stars of the Day */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
              <p className="text-xs uppercase tracking-wide text-amber-400 font-black flex items-center gap-1.5">
                <span>⭐</span> {T("home.threeStars")}
              </p>
              <Link href="/players/three-stars" className="text-xs text-slate-400 hover:text-sky-400 transition-colors font-semibold">
                {T("ui.viewAll")} →
              </Link>
            </div>
            {stars.length === 0 ? <p className="text-sm text-slate-500 py-4 text-center">After the next sim.</p> : (
              <div className="space-y-2">
                {stars.map((s, i) => {
                  const starCount = 3 - i;
                  const starColor = i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : "text-amber-500/80";
                  return (
                    <div key={i} className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className={`shrink-0 w-7 flex items-center justify-center gap-0.5 text-xs font-black ${starColor}`} title={`${i + 1}. star`}>
                          {Array.from({ length: starCount }, (_, j) => <span key={j}>★</span>)}
                        </span>
                        {s.logoUrl && (
                          <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 20, height: 20, minWidth: 20 }}>
                            <img src={s.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-100 truncate">
                            {s.slug ? <Link href={`/players/${s.slug}`} className="hover:text-sky-300 transition-colors">{s.name}</Link> : s.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {s.teamCode}
                          </div>
                        </div>
                      </div>
                      <Link href={`/games/${s.gameId}`} className="text-right shrink-0 group/pts">
                        <div className="text-xs font-black text-amber-300 font-mono group-hover/pts:text-sky-400 transition-colors">
                          {s.pts} <span className="text-[9px] font-semibold text-slate-400 uppercase">PTS</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {s.g}G + {s.a}A
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Box 3: Tonight's Best */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
              <p className="text-xs uppercase tracking-wide text-indigo-400 font-black flex items-center gap-1.5">
                <span>🌙</span> {T("home.tonightsBest")}
              </p>
              <Link href="/league/digest" className="text-xs text-slate-400 hover:text-sky-400 transition-colors font-semibold">
                {T("ui.viewAll")} →
              </Link>
            </div>
            {digest && digest.gameCount > 0 && (digest.gameOfNight || digest.playerOfNight || digest.bestGoalie) ? (
              <div className="space-y-2">
                {/* 1. Game of the Night */}
                {digest.gameOfNight && (() => {
                  const gon = digest.gameOfNight;
                  const aTeam = gon.awaySlug ? teamBySlug.get(gon.awaySlug) : (gon.away ? teamByCode.get(gon.away) : null);
                  const hTeam = gon.homeSlug ? teamBySlug.get(gon.homeSlug) : (gon.home ? teamByCode.get(gon.home) : null);
                  return (
                    <Link
                      href={`/games/${gon.id}`}
                      className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="text-xs font-black shrink-0 w-6 text-center text-amber-400" title="Game of the Night">
                          🌟
                        </span>
                        <div className="flex items-center -space-x-1 shrink-0">
                          {aTeam?.logoUrl && (
                            <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0 z-10" style={{ width: 20, height: 20, minWidth: 20 }}>
                              <img src={aTeam.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                            </span>
                          )}
                          {hTeam?.logoUrl && (
                            <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 20, height: 20, minWidth: 20 }}>
                              <img src={hTeam.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-100 truncate group-hover:text-sky-400 transition-colors">
                            {gon.away} <span className="text-slate-500 font-normal">@</span> {gon.home}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            Game of the Night
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-amber-300 font-mono">
                          {gon.awayGoals} : {gon.homeGoals}
                        </div>
                        <div className="text-[9px] text-slate-400 uppercase font-semibold font-mono">
                          {gon.endedIn !== "REG" ? gon.endedIn : "FINAL"}
                        </div>
                      </div>
                    </Link>
                  );
                })()}

                {/* 2. Player of the Night */}
                {digest.playerOfNight && (() => {
                  const pon = digest.playerOfNight;
                  const pTeam = pon.teamSlug ? teamBySlug.get(pon.teamSlug) : (pon.team ? teamByCode.get(pon.team) : null);
                  return (
                    <div className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="text-xs font-black shrink-0 w-6 text-center text-sky-400" title="Player of the Night">
                          ⭐
                        </span>
                        {pTeam?.logoUrl && (
                          <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 20, height: 20, minWidth: 20 }}>
                            <img src={pTeam.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-100 truncate">
                            {pon.slug ? <Link href={`/players/${pon.slug}`} className="hover:text-sky-300 transition-colors">{pon.name}</Link> : pon.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {pon.team ?? "Player of the Night"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-sky-300 font-mono">
                          {pon.points != null ? `${pon.points} PTS` : pon.line}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {pon.goals != null && pon.assists != null ? `${pon.goals}G + ${pon.assists}A` : "Top Performer"}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 3. Goalie of the Night */}
                {digest.bestGoalie && (() => {
                  const bg = digest.bestGoalie;
                  const gTeam = bg.teamSlug ? teamBySlug.get(bg.teamSlug) : (bg.team ? teamByCode.get(bg.team) : null);
                  return (
                    <div className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="text-xs font-black shrink-0 w-6 text-center text-emerald-400" title="Goalie of the Night">
                          🧤
                        </span>
                        {gTeam?.logoUrl && (
                          <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 20, height: 20, minWidth: 20 }}>
                            <img src={gTeam.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-100 truncate">
                            {bg.slug ? <Link href={`/players/${bg.slug}`} className="hover:text-sky-300 transition-colors">{bg.name}</Link> : bg.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {bg.team ?? "Best Goalie"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-emerald-300 font-mono">
                          {bg.svPct != null ? `${bg.svPct.toFixed(1)}%` : bg.line}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {bg.saves != null && bg.shotsAgainst != null ? `${bg.saves}/${bg.shotsAgainst} SVS` : "Top Goalie"}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">After the next sim.</p>
            )}
          </div>
        </div>

        {/* Box 4: Recent Trades */}
        <Link href="/trades" className="block bg-[#0b1120] border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-sky-500/40 transition-colors">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
            <p className="text-xs uppercase tracking-wide text-sky-400 font-black flex items-center gap-1.5">
              <span>🔁</span> Recent Trades
            </p>
            <span className="text-xs text-slate-400 hover:text-sky-400 font-semibold">{T("ui.viewAll")} →</span>
          </div>
          {recentTrades.length ? (
            <ul className="space-y-2">
              {recentTrades.map((t) => (
                <li key={t.id} className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/70">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                    {t.from ? (
                      <span className="flex items-center gap-1 min-w-0" title={t.from.name}>
                        {t.from.logoUrl && (
                          <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 18, height: 18, minWidth: 18 }}>
                            <img src={t.from.logoUrl} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                          </span>
                        )}
                        <span className="truncate">{t.from.code}</span>
                      </span>
                    ) : <span className="text-sky-400">•</span>}
                    {t.to && (
                      <>
                        <span className="text-slate-500 shrink-0 text-xs font-bold">⇄</span>
                        <span className="flex items-center gap-1 min-w-0" title={t.to.name}>
                          {t.to.logoUrl && (
                            <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 18, height: 18, minWidth: 18 }}>
                              <img src={t.to.logoUrl} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                            </span>
                          )}
                          <span className="truncate">{t.to.code}</span>
                        </span>
                      </>
                    )}
                    <span className="ml-auto shrink-0 text-slate-500 text-[10px] font-mono tabular-nums">{fmtDate(t.createdAt)}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-1 line-clamp-2 leading-snug">
                    {t.fromAssets && t.toAssets
                      ? <>traded <span className="text-slate-300 font-semibold">{t.fromAssets}</span> for <span className="text-slate-300 font-semibold">{t.toAssets}</span></>
                      : t.message}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 py-3 text-center">No trades yet — completed deals show up here.</p>
          )}
        </Link>
      </div>

      {/* 2. MAIN 3 COLUMNS (Left 3 / Center 6 / Right 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <Card title={isPreseason ? `${T("home.scoringLeaders")} (Pre-season)` : T("home.scoringLeaders")} href="/stats/leaders" accent="text-sky-400" viewLabel={T("ui.viewAll")}>
            <div className="space-y-2">
              {topScorers.map((s, i) => {
                const meta = scorerMeta.get(s.playerId);
                return (
                  <div key={s.playerId} className="flex items-center gap-2.5 text-xs p-1 rounded-lg hover:bg-slate-800/30 transition-colors">
                    <span className="w-4 text-center font-mono font-bold text-slate-500 text-[11px]">{i + 1}</span>
                    <PlayerAvatar src={meta?.photoUrl ?? null} alt={s.name} size={26} />
                    <span className="flex-1 truncate">
                      <PlayerLink slug={meta?.slug ?? undefined} id={s.playerId} name={s.name} clean={false} />
                      <span className="text-slate-500 font-mono text-[10px] ml-1.5">{s.teamCode}</span>
                    </span>
                    <span className="font-mono font-black text-white text-xs">{s.points} B</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title={T("home.tradeBlock")} href="/trade-block" accent="text-amber-400" viewLabel={T("ui.viewAll")}>
            {tbListed.length ? (
              <div className="space-y-1.5 text-xs">
                {tbListed.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-1 rounded-lg hover:bg-slate-800/30 transition-colors">
                    {p.slug ? <Link href={`/players/${p.slug}`} className="font-semibold text-slate-200 truncate hover:text-sky-300">{p.name}</Link> : <span className="font-semibold text-slate-200 truncate">{p.name}</span>}
                    <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[10px] shrink-0">
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-bold">{p.position}</span>
                      <span>{p.teamCode}</span>
                    </div>
                  </div>
                ))}
                {tbListed.length > 8 && <Link href="/trade-block" className="block text-center text-[11px] text-sky-400 hover:underline pt-1">+ ďalších {tbListed.length - 8} hráčov →</Link>}
              </div>
            ) : <p className="text-xs text-slate-500 py-2">{T("home.noTradeBlock")}</p>}
          </Card>

          <Card title={T("home.waiverWire")} href="/waivers" accent="text-teal-400" viewLabel={T("ui.viewAll")}>
            {waivers.length ? (
              <div className="space-y-1.5 text-xs">
                {waivers.slice(0, 8).map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                    <span className="font-semibold text-slate-200 truncate">
                      {w.playerSlug ? <Link href={`/players/${w.playerSlug}`} className="hover:text-teal-300 transition-colors">{w.playerName}</Link> : w.playerName}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 font-bold">{w.position}</span>
                      <span>{w.fromCode}</span>
                    </div>
                  </div>
                ))}
                {waivers.length > 8 && <Link href="/waivers" className="block text-center text-[11px] text-sky-400 hover:underline pt-1">+ ďalších {waivers.length - 8} hráčov →</Link>}
              </div>
            ) : <p className="text-xs text-slate-500 py-2">{T("home.noWaivers")}</p>}
          </Card>

          <Card title={`Health & Discipline (${homeInjuries.length + activeHomeSuspensions.length})`} href="/players/injuries" accent="text-rose-400" viewLabel="Prehľad →">
            <div className="space-y-2 text-xs">
              {homeInjuries.slice(0, 4).map((injury) => (
                <div key={`injury-${injury.playerId}`} className="flex gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-2">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-xs">🏥</span>
                  {injury.teamLogo && (
                    <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 22, height: 22, minWidth: 22 }}>
                      <img src={injury.teamLogo} alt="" className="object-contain" style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 leading-tight">
                    {injury.slug ? <Link href={`/players/${injury.slug}`} className="font-bold text-slate-100 hover:text-rose-300">{injury.name}</Link> : <span className="font-bold text-slate-100">{injury.name}</span>}
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">{injury.desc}</p>
                    <p className="mt-1 text-[10px] font-bold text-rose-300 font-mono">Out · {injury.daysLeft === 1 ? "1 deň" : injury.daysLeft < 7 ? `${injury.daysLeft}d` : `${Math.ceil(injury.daysLeft / 7)}t`} zostáva</p>
                  </div>
                </div>
              ))}

              {activeHomeSuspensions.slice(0, 3).map((suspension) => {
                const player = healthPlayers.get(suspension.playerId);
                const team = suspension.teamId != null ? teamById.get(suspension.teamId) : null;
                const left = suspension.games - suspension.gamesServed;
                return (
                  <div key={`suspension-${suspension.id}`} className="flex gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-xs">🚫</span>
                    {team?.logoUrl && (
                      <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 22, height: 22, minWidth: 22 }}>
                        <img src={team.logoUrl} alt="" className="object-contain" style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1 leading-tight">
                      {player?.slug ? <Link href={`/players/${player.slug}`} className="font-bold text-slate-100 hover:text-amber-300">{suspension.playerName}</Link> : <span className="font-bold text-slate-100">{suspension.playerName}</span>}
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{suspension.incident}</p>
                      <p className="mt-1 text-[10px] font-bold text-amber-300 font-mono">Stop {left}z</p>
                    </div>
                  </div>
                );
              })}

              {!homeInjuries.length && !activeHomeSuspensions.length && <p className="py-1 text-xs text-slate-500 text-center">Žiadne aktívne zranenia ani tresty.</p>}
              {(homeInjuries.length > 4 || activeHomeSuspensions.length > 3) && <Link href="/players/injuries" className="block pt-0.5 text-xs text-rose-300 hover:underline">Zobraziť kompletný zoznam →</Link>}
            </div>
          </Card>

          <Card title={T("home.birthdays")} accent="text-pink-400">
            <BirthdaysList />
          </Card>
        </div>

        {/* CENTER COLUMN (6 cols) — News & Announcements */}
        <div className="lg:col-span-6 space-y-4">
          <CommissionerBanner items={bannerItems} signedIn={me != null} />
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span>📰</span> {T("home.latestArticle")}
            </h2>
            <Link href="/news/create" className="text-xs bg-sky-500 hover:bg-sky-400 text-white px-3 py-1.5 rounded-xl font-bold shadow-md shadow-sky-500/20 transition-colors">
              + {T("home.addArticle")}
            </Link>
          </div>

          {articlesRaw.length === 0 && (
            <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-8 text-center text-slate-500 shadow-xl">{T("home.noNews")}</div>
          )}

          {articlesRaw.map((a, idx) => {
            const author = teamById.get(a.authorTeamId);
            const safeBodyHtml = sanitizeArticleHtml(a.bodyHtml);
            const cutAt = safeBodyHtml.search(/<hr[^>]*\bclass="[^"]*\barticle-cut\b/i);
            const rawPreview = cutAt >= 0 ? safeBodyHtml.slice(0, cutAt) : safeBodyHtml;
            const text = articlePlainText(rawPreview);
            const hasMore = cutAt >= 0 || text.length > 500;
            const preview = cutAt >= 0 ? text : text.slice(0, 500);
            const isFeatured = idx === 0;

            return (
              <article
                key={a.id}
                className={`rounded-2xl border transition-all ${
                  isFeatured
                    ? "border-sky-500/30 bg-[#0b1120] p-5 shadow-2xl"
                    : "border-slate-800 bg-[#0b1120] p-4 hover:border-slate-700 shadow-xl"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  {author?.logoUrl ? (
                    <span className="inline-flex items-center justify-center rounded-xl bg-slate-800/90 border border-slate-700/60 p-1 shrink-0" style={{ width: 38, height: 38, minWidth: 38 }}>
                      <img src={author.logoUrl} alt="" className="object-contain" style={{ width: 28, height: 28, maxWidth: 28, maxHeight: 28 }} />
                    </span>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-slate-800 grid place-items-center font-bold text-sm text-slate-300">
                      {author?.name?.[0] ?? "?"}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-black text-slate-100">
                      {author?.gmNickname || [author?.gmFirstName, author?.gmLastName].filter(Boolean).join(" ").trim() || author?.gm || author?.name || "GM"}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {author?.name} · {a.createdAt.toLocaleDateString("sk-SK")}
                    </p>
                  </div>
                </div>

                <Link href={`/news/${a.id}`}>
                  <h3 className={`font-black mb-2 hover:text-sky-300 transition-colors ${isFeatured ? "text-lg text-white" : "text-base text-slate-100"}`}>
                    {a.title}
                  </h3>
                </Link>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
                  {preview}{hasMore ? "…" : ""}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  <Link href={`/news/${a.id}`} className="text-sky-400 hover:text-sky-300 font-bold transition-colors">
                    Čítať celý článok →
                  </Link>
                  <span className="flex items-center gap-1 font-mono">👍 {a._count.reactions}</span>
                  <span className="flex items-center gap-1 font-mono">💬 {a._count.comments}</span>
                </div>
              </article>
            );
          })}
        </div>

        {/* RIGHT COLUMN (3 cols) — Standings, Free Agents, Quick Links */}
        <div className="lg:col-span-3 space-y-6">
          <Card title={isPreseason ? `${T("menu.standings")} (Pre-season)` : T("menu.standings")} href="/standings" accent="text-sky-400" viewLabel={T("ui.viewAll")}>
            <div className="space-y-4">
              <MiniStandings title={T("home.eastern")} color="text-sky-400" rows={east} />
              <MiniStandings title={T("home.western")} color="text-rose-400" rows={west} />
            </div>
          </Card>

          <Card title={T("home.freeAgents")} href="/free-agents" accent="text-emerald-400" viewLabel={T("ui.viewAll")}>
            {faTop.length ? (
              <div className="space-y-1.5 text-xs">
                {faTop.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-1 rounded-lg hover:bg-slate-800/30 transition-colors">
                    <span className="truncate">
                      <PlayerLink slug={p.slug} id={p.id} name={p.name} />
                      <span className="text-slate-500 text-[10px] font-mono ml-1">{p.position}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-300">{p.overall ?? "—"}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-slate-500 py-2">Žiadni voľní hráči.</p>}
          </Card>

          <Card title={T("home.quickLinks")}>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              {[[T("menu.scores"), "/scores"], [T("menu.standings"), "/standings"], [T("menu.trades"), "/trades"], [T("menu.stats"), "/stats/leaders"], [T("ui.playoffs"), "/playoffs"], [T("ui.allRosters"), "/tools/all-rosters"]].map(([l, h]) => (
                <Link key={h} href={h} className="px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-center text-slate-300 hover:text-white transition-colors">
                  {l}
                </Link>
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
      <p className={`text-[11px] font-black uppercase tracking-wider ${color} mb-1.5 flex items-center gap-1.5`}>
        <span>🏒</span> {title}
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] text-slate-500 border-b border-slate-800/80 font-mono">
            <th className="text-left font-bold pb-1 uppercase">Tím</th>
            {["GP", "W", "L", "OTL", "PTS"].map((h) => <th key={h} className="text-right font-bold pb-1 pl-1.5 uppercase">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={t.teamId} className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="py-1.5 pr-1">
                {t.slug ? (
                  <Link href={`/teams/${t.slug}`} className="flex items-center gap-1.5 hover:text-sky-300 transition-colors">
                    <span className="text-slate-500 font-mono text-[10px] w-3.5 text-right shrink-0">{i + 1}</span>
                    {t.logoUrl && (
                      <span className="inline-flex items-center justify-center rounded bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 18, height: 18, minWidth: 18 }}>
                        <img src={t.logoUrl} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                      </span>
                    )}
                    <span className="font-bold text-slate-200 truncate">{t.code ?? t.name}</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-mono text-[10px] w-3.5 text-right shrink-0">{i + 1}</span>
                    {t.logoUrl && (
                      <span className="inline-flex items-center justify-center rounded bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 18, height: 18, minWidth: 18 }}>
                        <img src={t.logoUrl} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                      </span>
                    )}
                    <span className="font-bold text-slate-200 truncate">{t.code ?? t.name}</span>
                  </div>
                )}
              </td>
              <td className="py-1.5 text-right font-mono text-slate-400 pl-1.5">{t.gp}</td>
              <td className="py-1.5 text-right font-mono text-slate-300 pl-1.5">{t.w}</td>
              <td className="py-1.5 text-right font-mono text-slate-400 pl-1.5">{t.l}</td>
              <td className="py-1.5 text-right font-mono text-slate-500 pl-1.5">{t.otl}</td>
              <td className="py-1.5 text-right font-mono font-black text-amber-300 pl-1.5">{t.points}</td>
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
  if (born.length === 0) return <p className="text-xs text-slate-500 py-2">No birthdays today.</p>;
  return (
    <div className="space-y-1.5 text-xs">
      {born.slice(0, 8).map((p) => {
        const birthYear = Number((p.birthDate ?? "").slice(0, 4));
        const age = birthYear > 1900 ? today.getFullYear() - birthYear : null;
        return (
          <div key={p.id} className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-800/30 transition-colors">
            <span>🎂</span>
            <span className="flex-1 truncate"><PlayerLink id={p.id} name={p.name} />{age != null && <span className="text-slate-500 font-mono text-[10px]"> · {age} y/o</span>}</span>
            <span className="text-slate-500 font-mono text-[10px]">{p.team?.code}</span>
          </div>
        );
      })}
    </div>
  );
}
