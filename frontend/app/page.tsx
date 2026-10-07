import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import PlayerAvatar from "@/components/playerAvatar";
import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/sim/standings";
import { skaterTotals } from "@/lib/stats-server";
import { cleanName, displayName } from "@/lib/playerName";
import NextSimCountdown from "@/components/home/NextSimCountdown";
import { getLeagueClock, defaultStatsPhase } from "@/lib/calendar-server";
import { fmtLeagueDate, daysBetween } from "@/lib/calendar";
import { PRE_SEASON } from "@/lib/phase";
import { getTeamSession } from "@/lib/auth";
import { activeAnnouncements } from "@/lib/announcements";
import CommissionerBanner, { type BannerItem } from "@/components/CommissionerBanner";
import { dailyDigest } from "@/lib/digest-server";
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
import HomeStandingsTabs from "@/components/home/HomeStandingsTabs";

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

export default async function HomePage() {
  const statsPhase = await defaultStatsPhase();
  const isPreseason = statsPhase === "pre";
  const activeSeason = isPreseason ? PRE_SEASON : SEASON;

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

  // commissioner announcements + this GM's unread state
  const [me, announcements] = await Promise.all([getTeamSession(), activeAnnouncements()]);
  const readIds = me != null
    ? new Set((await prisma.announcementRead.findMany({ where: { teamId: me }, select: { announcementId: true } })).map((r) => r.announcementId))
    : new Set<number>();
  const fmtDate = (d: Date) => `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
  const bannerItems: BannerItem[] = announcements.map((a) => ({
    id: a.id, body: a.body, linkUrl: a.linkUrl, linkLabel: a.linkLabel, date: fmtDate(a.createdAt), unread: me != null && !readIds.has(a.id),
  }));

  // Tonight's Best digest
  const digest = await dailyDigest(activeSeason);

  // Trade Block
  const tbBoard = await tradeBlockBoard();
  const tbListed = tbBoard.flatMap((t) => t.players);

  // Waiver Wire
  const waivers = await activeWaivers();

  // League Health & Discipline
  const [homeInjuries, homeSuspensions] = await Promise.all([
    currentInjuries({ league: "NHL" }),
    prisma.suspension.findMany({
      where: { season: SEASON, kind: "SUSPENSION", status: "ACTIVE" },
      orderBy: { createdAt: "desc" }, take: 6,
      select: { id: true, playerId: true, playerName: true, teamId: true, incident: true, games: true, gamesServed: true, createdAt: true },
    }),
  ]);
  const activeHomeSuspensions = homeSuspensions.filter((s) => s.games > s.gamesServed);

  // Completed trades (Latest 3)
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

  // GM dashboard
  const dash = me != null ? await gmDashboard(me).catch(() => null) : null;

  const topScorers = [...leaders].sort((a, b) => b.points - a.points).slice(0, 6);
  const scorerMeta = new Map((await prisma.player.findMany({
    where: { id: { in: topScorers.map((s) => s.playerId) } },
    select: { id: true, photoUrl: true, slug: true },
  })).map((p) => [p.id, p]));
  const enrich = (arr: typeof standings) => arr.map((t) => ({ ...t, code: t.code, logoUrl: teamById.get(t.teamId)?.logoUrl ?? null, slug: teamById.get(t.teamId)?.slug ?? null }));
  const east = enrich(standings.filter((s) => s.conference?.toLowerCase().includes("eastern")));
  const west = enrich(standings.filter((s) => s.conference?.toLowerCase().includes("western")));

  // latest simulated day -> scoreboard ticker + highlights + 3 stars
  const lastDay = await prisma.game.findFirst({ where: { season: activeSeason, status: "FINAL", seriesId: null, gameDate: { not: null } }, orderBy: { gameDate: "desc" }, select: { gameDate: true } });
  let ticker: { id: number; league: string; hg: number | null; ag: number | null; home: any; away: any }[] = [];
  let highlights: string[] = [];
  let stars: { id?: number; slug?: string | null; name: string; photoUrl: string | null; teamCode: string; teamSlug?: string | null; logoUrl: string | null; g: number; a: number; pts: number; gameId: number }[] = [];

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
    const notable = stats.filter((s) => s.goals >= 3 || s.points >= 4).sort((a, b) => b.points - a.points).slice(0, 8);
    const top3 = [...stats].sort((a, b) => b.points - a.points || b.goals - a.goals).slice(0, 3);
    const need = [...new Set([...notable, ...top3].map((s) => s.playerId))];
    if (need.length) {
      const pById = new Map((await prisma.player.findMany({ where: { id: { in: need } }, select: { id: true, name: true, photoUrl: true, slug: true, team: { select: { code: true, slug: true, logoUrl: true } } } })).map((p) => [p.id, p]));
      highlights = notable.map((n) => {
        const p = pById.get(n.playerId);
        const nm = cleanName(p?.name ?? "Player"); const tc = p?.team?.code ?? "";
        if (n.goals >= 3) return `🎩 ${nm} (${tc}) — ${n.goals}-goal ${n.goals >= 4 ? "night" : "hat trick"} (${n.points} pts)`;
        return `🔥 ${nm} (${tc}) — ${n.goals}G ${n.assists}A, ${n.points} points`;
      });
      stars = top3.map((s) => {
        const p = pById.get(s.playerId);
        return { id: s.playerId, slug: p?.slug ?? null, name: cleanName(p?.name ?? "Player"), photoUrl: p?.photoUrl ?? null, teamCode: p?.team?.code ?? "", teamSlug: p?.team?.slug ?? null, logoUrl: p?.team?.logoUrl ?? null, g: s.goals, a: s.assists, pts: s.points, gameId: s.gameId };
      });
    }
  }

  // Fallback upcoming games if ticker has no final games
  const upcomingTicker = ticker.length === 0
    ? await prisma.game.findMany({
        where: { season: activeSeason, status: "SCHEDULED", seriesId: null, gameDate: { not: null } },
        take: 8,
        orderBy: { gameDate: "asc" },
        select: { id: true, league: true, gameDate: true, homeTeam: { select: { code: true, logoUrl: true } }, awayTeam: { select: { code: true, logoUrl: true } } },
      })
    : [];

  // Populate podium stars (fallback to top scorers if less than 3)
  const podiumStars = [...stars];
  if (podiumStars.length < 3 && topScorers.length > 0) {
    for (const s of topScorers) {
      if (podiumStars.length >= 3) break;
      if (!podiumStars.some((p) => p.id === s.playerId)) {
        const meta = scorerMeta.get(s.playerId);
        const team = teams.find((t) => t.code === s.teamCode);
        podiumStars.push({
          id: s.playerId,
          slug: meta?.slug ?? null,
          name: cleanName(s.name),
          photoUrl: meta?.photoUrl ?? null,
          teamCode: s.teamCode ?? "",
          teamSlug: team?.slug ?? null,
          logoUrl: team?.logoUrl ?? null,
          g: s.goals,
          a: s.assists,
          pts: s.points,
          gameId: 0,
        });
      }
    }
  }

  // Next scheduled game
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

  // Featured and secondary articles
  const featuredArticle = articlesRaw.length > 0 ? articlesRaw[0] : null;
  const secondaryArticles = articlesRaw.length > 1 ? articlesRaw.slice(1, 5) : [];
  const featuredAuthor = featuredArticle ? teamById.get(featuredArticle.authorTeamId) : null;
  const featuredAuthorName = featuredAuthor
    ? (featuredAuthor.gmNickname || [featuredAuthor.gmFirstName, featuredAuthor.gmLastName].filter(Boolean).join(" ").trim() || featuredAuthor.gm || featuredAuthor.name || "GM")
    : "uNHL Media Central · Connor McDavid (EDM)";
  const featuredDate = featuredArticle ? fmtDate(featuredArticle.createdAt) : "Dnes · 14. Kolo";
  let featuredArticlePreview = "";
  if (featuredArticle) {
    const safeBodyHtml = sanitizeArticleHtml(featuredArticle.bodyHtml);
    const cutAt = safeBodyHtml.search(/<hr[^>]*\bclass="[^"]*\barticle-cut\b/i);
    const rawPreview = cutAt >= 0 ? safeBodyHtml.slice(0, cutAt) : safeBodyHtml;
    featuredArticlePreview = articlePlainText(rawPreview);
  }

  return (
    <div className="py-2 space-y-6">
      {deadlineFeed?.isDeadlineDay && <TradeDeadlineBanner initial={deadlineFeed} variant="feed" />}

      {homeBlocks.length > 0 && (
        <div className="space-y-4">
          {homeBlocks.map((b) => (
            <div key={b.id} className="bg-[#0b1120] border border-slate-800 rounded-2xl p-5 shadow-xl">
              {b.title?.trim() && <h2 className="text-lg font-bold mb-2 text-white">{b.title}</h2>}
              {b.body?.trim() && <div className="text-slate-300 text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(b.body) }} />}
            </div>
          ))}
        </div>
      )}

      {dash && <SeasonDashboard data={dash} />}

      {/* 1. TOP SCORES TICKER STRIP */}
      {ticker.length > 0 ? (
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-2.5 shadow-xl flex items-center gap-3 overflow-x-auto custom-scroll">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Výsledky dňa ({ticker.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {ticker.map((g) => (
              <Link
                key={g.id}
                href={`/games/${g.id}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/70 hover:border-slate-700 transition-colors shrink-0 group"
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300 group-hover:text-white">
                  {g.away?.logoUrl && (
                    <span className="inline-flex items-center justify-center rounded bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 20, height: 20, minWidth: 20 }}>
                      <img src={g.away.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                    </span>
                  )}
                  <span>{g.away?.code}</span>
                  <span className={`font-mono font-bold ${(g.ag ?? 0) > (g.hg ?? 0) ? "text-amber-400" : "text-slate-400"}`}>{g.ag}</span>
                </span>
                <span className="text-slate-600 text-xs font-mono">:</span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300 group-hover:text-white">
                  <span className={`font-mono font-bold ${(g.hg ?? 0) > (g.ag ?? 0) ? "text-amber-400" : "text-slate-400"}`}>{g.hg}</span>
                  <span>{g.home?.code}</span>
                  {g.home?.logoUrl && (
                    <span className="inline-flex items-center justify-center rounded bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 20, height: 20, minWidth: 20 }}>
                      <img src={g.home.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : upcomingTicker.length > 0 ? (
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-2.5 shadow-xl flex items-center gap-3 overflow-x-auto custom-scroll">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Zápasy ({upcomingTicker.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {upcomingTicker.map((g) => (
              <Link
                key={g.id}
                href={`/games/${g.id}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/70 hover:border-slate-700 transition-colors shrink-0 group"
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300 group-hover:text-white">
                  {g.awayTeam?.logoUrl && (
                    <span className="inline-flex items-center justify-center rounded bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 20, height: 20, minWidth: 20 }}>
                      <img src={g.awayTeam.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                    </span>
                  )}
                  <span>{g.awayTeam?.code}</span>
                </span>
                <span className="text-slate-500 text-xs font-mono font-bold">vs</span>
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300 group-hover:text-white">
                  <span>{g.homeTeam?.code}</span>
                  {g.homeTeam?.logoUrl && (
                    <span className="inline-flex items-center justify-center rounded bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 20, height: 20, minWidth: 20 }}>
                      <img src={g.homeTeam.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* 2. MEDIA HUB 3-COLUMN MAIN GRID (Matches home_media_hub mockup exactly) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* COLUMN 1: LEFT (lg:col-span-4) -> 3-STARS PODIUM & LIVE TRADE TICKER */}
        <div className="lg:col-span-4 order-2 lg:order-1 flex flex-col gap-5">
          {/* 3D Visual Podium: 3 Stars of the Night */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-sm">⭐</span>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-100">
                  3 Hviezdy dňa · Three Stars
                </h2>
              </div>
              <Link href="/players/three-stars" className="text-[11px] text-slate-400 hover:text-sky-400 font-semibold transition-colors">
                {T("ui.viewAll")} →
              </Link>
            </div>

            {podiumStars.length >= 3 ? (
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5 items-end pt-2 pb-1">
                {/* 2nd Star (Silver) */}
                <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-900/80 border border-slate-700/60 shadow-lg">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-400/30 mb-2">
                    🥈 2. HVIEZDA
                  </span>
                  <div className="relative mb-1.5">
                    <PlayerAvatar src={podiumStars[1].photoUrl} alt={podiumStars[1].name} size={46} />
                    {podiumStars[1].logoUrl && (
                      <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 p-0.5" style={{ width: 18, height: 18, minWidth: 18 }}>
                        <img src={podiumStars[1].logoUrl} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-white truncate max-w-full">
                    {podiumStars[1].slug ? (
                      <Link href={`/players/${podiumStars[1].slug}`} className="hover:text-sky-300 transition-colors">
                        {podiumStars[1].name}
                      </Link>
                    ) : podiumStars[1].name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{podiumStars[1].teamCode}</div>
                  <div className="mt-1 font-mono font-black text-xs text-slate-200">{podiumStars[1].pts} PTS</div>
                  <div className="text-[9px] text-slate-500 font-mono">{podiumStars[1].g}G + {podiumStars[1].a}A</div>
                </div>

                {/* 1st Star (Gold - Elevated, gold glowing ring, larger avatar) */}
                <div className="flex flex-col items-center text-center p-2.5 rounded-2xl bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-slate-900 border-2 border-amber-500/60 shadow-xl shadow-amber-500/15 -translate-y-2">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-2">
                    👑 1. ZLATO
                  </span>
                  <div className="relative mb-1.5">
                    <div className="rounded-full ring-2 ring-amber-400 shadow-md shadow-amber-500/30 p-0.5">
                      <PlayerAvatar src={podiumStars[0].photoUrl} alt={podiumStars[0].name} size={54} />
                    </div>
                    {podiumStars[0].logoUrl && (
                      <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 p-0.5" style={{ width: 20, height: 20, minWidth: 20 }}>
                        <img src={podiumStars[0].logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-black text-amber-200 truncate max-w-full">
                    {podiumStars[0].slug ? (
                      <Link href={`/players/${podiumStars[0].slug}`} className="hover:text-amber-100 transition-colors">
                        {podiumStars[0].name}
                      </Link>
                    ) : podiumStars[0].name}
                  </div>
                  <div className="text-[10px] text-amber-400/80 font-mono">{podiumStars[0].teamCode}</div>
                  <div className="mt-1 font-mono font-black text-sm text-amber-300">{podiumStars[0].pts} PTS</div>
                  <div className="text-[10px] text-amber-400/70 font-mono">{podiumStars[0].g}G + {podiumStars[0].a}A</div>
                </div>

                {/* 3rd Star (Bronze) */}
                <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-900/80 border border-slate-700/60 shadow-lg">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/30 mb-2">
                    🥉 3. BRONZ
                  </span>
                  <div className="relative mb-1.5">
                    <PlayerAvatar src={podiumStars[2].photoUrl} alt={podiumStars[2].name} size={46} />
                    {podiumStars[2].logoUrl && (
                      <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 p-0.5" style={{ width: 18, height: 18, minWidth: 18 }}>
                        <img src={podiumStars[2].logoUrl} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-white truncate max-w-full">
                    {podiumStars[2].slug ? (
                      <Link href={`/players/${podiumStars[2].slug}`} className="hover:text-sky-300 transition-colors">
                        {podiumStars[2].name}
                      </Link>
                    ) : podiumStars[2].name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{podiumStars[2].teamCode}</div>
                  <div className="mt-1 font-mono font-black text-xs text-amber-400/90">{podiumStars[2].pts} PTS</div>
                  <div className="text-[9px] text-slate-500 font-mono">{podiumStars[2].g}G + {podiumStars[2].a}A</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-6 text-center">Hviezdy dňa po ďalšej simulácii.</p>
            )}
          </div>

          {/* Live Trade Ticker */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sky-400 text-xs font-bold">🔁</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-sky-400">
                    Live Trade Ticker
                  </h3>
                </div>
                <Link href="/trades" className="text-[11px] text-slate-400 hover:text-sky-400 font-semibold transition-colors">
                  Trh →
                </Link>
              </div>

              {recentTrades.length ? (
                <ul className="space-y-2">
                  {recentTrades.map((t) => (
                    <li key={t.id} className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800/70 hover:border-slate-700 transition-colors">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-100 mb-1.5">
                        <div className="flex items-center gap-2">
                          {t.from && (
                            <span className="flex items-center gap-1.5">
                              {t.from.logoUrl && (
                                <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 22, height: 22, minWidth: 22 }}>
                                  <img src={t.from.logoUrl} alt="" className="object-contain" style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }} />
                                </span>
                              )}
                              <span className="font-black text-slate-200">{t.from.code}</span>
                            </span>
                          )}
                          <span className="text-slate-500 font-bold">⇄</span>
                          {t.to && (
                            <span className="flex items-center gap-1.5">
                              {t.to.logoUrl && (
                                <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 22, height: 22, minWidth: 22 }}>
                                  <img src={t.to.logoUrl} alt="" className="object-contain" style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }} />
                                </span>
                              )}
                              <span className="font-black text-slate-200">{t.to.code}</span>
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[10px] font-mono tabular-nums">{fmtDate(t.createdAt)}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] truncate leading-tight">
                        {t.fromAssets && t.toAssets ? `${t.fromAssets} ⇄ ${t.toAssets}` : t.message}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center">
                  <p className="text-xs text-slate-400 mb-2.5">Trh výmen je otvorený. Zatiaľ žiadne uskutočnené trejdy.</p>
                  <Link href="/trades" className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-bold transition-colors">
                    Preskúmať ponuky na trhu →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2: MIDDLE (lg:col-span-5) -> FEATURED HEADLINE STORY WITH COVER PHOTO */}
        <div className="lg:col-span-5 order-1 lg:order-2 flex flex-col gap-5">
          {/* Main Story Box */}
          <div className="rounded-3xl border border-sky-500/30 bg-gradient-to-b from-[#10192e] via-[#0b1120] to-[#070b12] p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
            <div>
              {/* Cover Photo */}
              <div className="relative rounded-2xl overflow-hidden mb-4 border border-slate-800/80 shadow-lg group">
                <img
                  src="/images/featured-hockey.jpg"
                  alt="NHL Game Action"
                  className="w-full h-56 sm:h-64 object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b1120] via-transparent to-transparent opacity-90" />
                <div className="absolute top-3 left-3">
                  <span className="px-3 py-1 rounded-full bg-cyan-500/20 backdrop-blur-md text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 shadow-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    FEATURED HEADLINE STORY
                  </span>
                </div>
              </div>

              {/* Headline & Body Text */}
              {featuredArticle ? (
                <>
                  <Link href={`/news/${featuredArticle.id}`}>
                    <h2 className="text-xl sm:text-2xl font-black text-white hover:text-sky-300 transition-colors leading-tight mb-2.5">
                      {featuredArticle.title}
                    </h2>
                  </Link>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4 line-clamp-3">
                    {featuredArticlePreview}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl sm:text-2xl font-black text-white leading-tight mb-2.5">
                    McDAVID DOMINATES WEEK 14! FANTASY LEADERBOARDS SHAKE UP!
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                    Dominantná noc v lige priniesla nové rekordy a zmeny na čele tabuliek produktivity. Manažéri hlásia zvýšenú aktivitu na prestupovom trhu a blížiace sa kľúčové zápasy sezóny {activeSeason}.
                  </p>
                </>
              )}
            </div>

            {/* Author Footer Row */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                {featuredAuthor?.logoUrl ? (
                  <span className="inline-flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700/60 p-1 shrink-0" style={{ width: 32, height: 32, minWidth: 32 }}>
                    <img src={featuredAuthor.logoUrl} alt="" className="object-contain" style={{ width: 22, height: 22, maxWidth: 22, maxHeight: 22 }} />
                  </span>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 font-black text-xs flex items-center justify-center shrink-0">
                    GM
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-white text-xs truncate">
                    {featuredAuthorName}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {featuredDate}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-400 shrink-0 font-mono text-xs">
                <span className="flex items-center gap-1 hover:text-amber-400 transition-colors">
                  🔥 {featuredArticle?._count?.reactions ?? 24}
                </span>
                <span className="flex items-center gap-1 hover:text-sky-400 transition-colors">
                  💬 {featuredArticle?._count?.comments ?? 8}
                </span>
                {featuredArticle && (
                  <Link href={`/news/${featuredArticle.id}`} className="text-sky-400 hover:text-sky-300 font-bold ml-1 transition-colors">
                    Čítať →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Secondary News / League Articles Feed */}
          <div className="bg-[#0b1120] border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <span>📰</span> Ďalšie správy z ligy
              </h3>
              <Link href="/news/create" className="text-xs bg-sky-500 hover:bg-sky-400 text-white font-bold px-3 py-1 rounded-xl shadow-md shadow-sky-500/20 transition-colors">
                + {T("home.addArticle")}
              </Link>
            </div>

            {secondaryArticles.length > 0 ? (
              <div className="space-y-3">
                {secondaryArticles.map((a) => {
                  const auth = teamById.get(a.authorTeamId);
                  return (
                    <Link
                      key={a.id}
                      href={`/news/${a.id}`}
                      className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/70 hover:border-slate-700 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors line-clamp-1 mb-1">
                          {a.title}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span>{auth?.name ?? "GM"}</span>
                          <span>·</span>
                          <span>{fmtDate(a.createdAt)}</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 group-hover:text-sky-400 transition-colors shrink-0">→</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400 flex items-center justify-between">
                <span>Zatiaľ žiadne ďalšie novinky. Napíšte prvý ligový článok!</span>
                <Link href="/news/create" className="text-sky-400 font-bold hover:underline shrink-0 ml-2">Pridať →</Link>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: RIGHT (lg:col-span-3) -> STANDINGS & GM COCKPIT */}
        <div className="lg:col-span-3 order-3 lg:order-3 flex flex-col gap-5">
          {/* GM Cockpit: Next Match & Sim Countdown */}
          <div className="rounded-3xl border border-slate-800 bg-[#0b1120] p-4 sm:p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-2.5 border-b border-slate-800/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {T("home.yourNextGame")}
              </span>
              {myTeam && (
                <Link href={`/teams/${myTeam.slug}/lines`} className="text-[11px] text-slate-400 hover:text-sky-400 font-semibold transition-colors">
                  {T("home.editLines")} →
                </Link>
              )}
            </div>

            {myNextGame && myNextOpponent ? (
              <Link
                href={`/games/${myNextGame.id}`}
                className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="rounded-xl bg-slate-800/90 border border-slate-700/70 p-1 flex items-center justify-center shrink-0" style={{ width: 42, height: 42, minWidth: 42 }}>
                    {myNextOpponent.logoUrl ? (
                      <img src={myNextOpponent.logoUrl} alt="" className="object-contain" style={{ width: 30, height: 30, maxWidth: 30, maxHeight: 30 }} />
                    ) : (
                      <span className="text-xs font-black text-slate-400">{myNextOpponent.code?.slice(0, 3) ?? "?"}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 group-hover:text-white transition-colors truncate">
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${isMyGameHome ? "bg-blue-900/50 text-blue-300 border border-blue-700/50" : "bg-amber-900/50 text-amber-300 border border-amber-700/50"}`}>
                        {isMyGameHome ? "DOMA" : "VONKU"}
                      </span>
                      <span className="truncate">{myNextOpponent.name}</span>
                    </div>
                    <div className="text-[11px] text-sky-400 font-semibold mt-0.5 truncate">
                      {myNextGameWhen}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-slate-500 group-hover:text-sky-400 transition-colors shrink-0">→</span>
              </Link>
            ) : me != null ? (
              <div className="p-2.5 rounded-2xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400">
                Žiadny naplánovaný zápas. Skontrolujte <Link href={`/teams/${myTeam?.slug ?? ""}/schedule`} className="text-sky-400 underline">rozpis tímu</Link>.
              </div>
            ) : (
              <div className="p-2.5 rounded-2xl bg-slate-900/50 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-300">{T("ui.gmLogin")}</span>
                  <Link href="/login" className="text-xs text-sky-400 font-bold hover:underline">Prihlásiť sa →</Link>
                </div>
                <p className="text-[11px] text-slate-500">{T("home.loginPrompt")}</p>
              </div>
            )}

            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <NextSimCountdown
                frenzyAt={cfg?.frenzyAutoOpenAt?.toISOString() ?? null}
                frenzyOpen={clock.frenzyOpen} frenzyRound={clock.frenzyRound} frenzyDay={clock.frenzyDay}
                frenzyRoundStartedAt={clock.frenzyRoundStartedAt}
                frenzyStage={clock.frenzyStage}
                nextGameDate={nextGame?.gameDate?.toISOString() ?? null}
              />
              <span className="text-[11px] text-slate-500 font-mono shrink-0">{fmtLeagueDate(clock.date)}</span>
            </div>
          </div>

          {/* Standings Tabs */}
          <HomeStandingsTabs
            east={east}
            west={west}
            labels={{
              eastern: T("home.eastern") || "Východ",
              western: T("home.western") || "Západ",
              standings: isPreseason ? `${T("menu.standings")} (Pre-season)` : T("menu.standings"),
              viewAll: T("ui.viewAll") || "Zobraziť",
            }}
          />

          {/* Scoring Leaders */}
          <Card title={isPreseason ? `${T("home.scoringLeaders")} (Pre-season)` : T("home.scoringLeaders")} href="/stats/leaders" accent="text-sky-400" viewLabel={T("ui.viewAll")}>
            <div className="space-y-2">
              {topScorers.slice(0, 5).map((s, i) => {
                const meta = scorerMeta.get(s.playerId);
                return (
                  <div key={s.playerId} className="flex items-center gap-2.5 text-xs p-1 rounded-lg hover:bg-slate-800/30 transition-colors">
                    <span className="w-4 text-center font-mono font-bold text-slate-500 text-[11px]">{i + 1}</span>
                    <PlayerAvatar src={meta?.photoUrl ?? null} alt={s.name} size={28} />
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
        </div>
      </div>

      {/* 3. COMMISSIONER ANNOUNCEMENTS BANNER */}
      <CommissionerBanner items={bannerItems} signedIn={me != null} />

      {/* 4. PULSE ROW: 4 COMPACT CARDS (Waivers, Injuries, Trade Block, Quick Links & Birthdays) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Waiver Wire */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                <span>📋</span> {T("home.waiverWire")}
              </span>
              <Link href="/waivers" className="text-xs text-slate-400 hover:text-sky-400 transition-colors font-semibold">
                {T("ui.viewAll")} →
              </Link>
            </div>
            {waivers.length ? (
              <div className="space-y-1.5 text-xs">
                {waivers.slice(0, 4).map((w) => (
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
                {waivers.length > 4 && (
                  <Link href="/waivers" className="block text-center text-[11px] text-sky-400 hover:underline pt-1">
                    + ďalších {waivers.length - 4} hráčov →
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3 text-center">{T("home.noWaivers")}</p>
            )}
          </div>
        </div>

        {/* Card 2: Health & Discipline */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <span>🏥</span> Maródka & Disciplinárka
              </span>
              <Link href="/players/injuries" className="text-xs text-slate-400 hover:text-sky-400 transition-colors font-semibold">
                Prehľad →
              </Link>
            </div>
            <div className="space-y-1.5 text-xs">
              {homeInjuries.slice(0, 2).map((injury) => (
                <div key={`injury-${injury.playerId}`} className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-rose-500/[0.06] border border-rose-500/20">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {injury.teamLogo && (
                      <span className="inline-flex items-center justify-center rounded bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 18, height: 18, minWidth: 18 }}>
                        <img src={injury.teamLogo} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                      </span>
                    )}
                    <span className="font-semibold text-slate-200 truncate">{injury.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-rose-300 font-mono shrink-0">
                    {injury.daysLeft === 1 ? "1 deň" : injury.daysLeft < 7 ? `${injury.daysLeft}d` : `${Math.ceil(injury.daysLeft / 7)}t`}
                  </span>
                </div>
              ))}

              {activeHomeSuspensions.slice(0, 2).map((suspension) => {
                const team = suspension.teamId != null ? teamById.get(suspension.teamId) : null;
                const left = suspension.games - suspension.gamesServed;
                return (
                  <div key={`suspension-${suspension.id}`} className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {team?.logoUrl && (
                        <span className="inline-flex items-center justify-center rounded bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 18, height: 18, minWidth: 18 }}>
                          <img src={team.logoUrl} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                        </span>
                      )}
                      <span className="font-semibold text-slate-200 truncate">{suspension.playerName}</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-300 font-mono shrink-0">
                      Stop ${left}z
                    </span>
                  </div>
                );
              })}

              {!homeInjuries.length && !activeHomeSuspensions.length && (
                <p className="text-xs text-slate-500 py-3 text-center">Žiadne aktívne zranenia ani tresty.</p>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Trade Block Board */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>🏷️</span> {T("home.tradeBlock")}
              </span>
              <Link href="/trade-block" className="text-xs text-slate-400 hover:text-sky-400 transition-colors font-semibold">
                {T("ui.viewAll")} →
              </Link>
            </div>
            {tbListed.length ? (
              <div className="space-y-1.5 text-xs">
                {tbListed.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                    <span className="font-semibold text-slate-200 truncate">
                      {p.slug ? <Link href={`/players/${p.slug}`} className="hover:text-amber-300 transition-colors">{p.name}</Link> : p.name}
                    </span>
                    <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[10px] shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">{p.position}</span>
                      <span>{p.teamCode}</span>
                    </div>
                  </div>
                ))}
                {tbListed.length > 4 && (
                  <Link href="/trade-block" className="block text-center text-[11px] text-sky-400 hover:underline pt-1">
                    + ďalších {tbListed.length - 4} hráčov →
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3 text-center">{T("home.noTradeBlock")}</p>
            )}
          </div>
        </div>

        {/* Card 4: Night Highlights / League Pulse */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <span>⚡</span> {highlights.length ? "Momenty dňa" : digest?.upset ? "Prekvapenie kola" : "Ligový pulz"}
              </span>
              <Link href="/league/digest" className="text-xs text-slate-400 hover:text-sky-400 transition-colors font-semibold">
                Digest →
              </Link>
            </div>
            {highlights.length > 0 ? (
              <div className="space-y-1.5 text-xs">
                {highlights.slice(0, 3).map((h, i) => (
                  <div key={i} className="p-1.5 rounded-xl bg-slate-900/60 border border-slate-800/60 text-slate-300 leading-snug">
                    {h}
                  </div>
                ))}
              </div>
            ) : digest?.upset ? (
              <div className="p-2 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs">
                <div className="font-bold text-purple-300 mb-1">😱 {digest.upset.note}</div>
                <div className="text-slate-300 font-mono">
                  {digest.upset.away} {digest.upset.awayGoals} : {digest.upset.homeGoals} {digest.upset.home}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3 text-center">Ligové štatistiky a highlighty po simulácii.</p>
            )}
          </div>
        </div>
      </div>

      {/* 5. BOTTOM ROW: FREE AGENTS, BIRTHDAYS & QUICK LINKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Free Agents */}
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

        {/* Birthdays */}
        <Card title={T("home.birthdays")} accent="text-pink-400">
          <BirthdaysList />
        </Card>

        {/* Quick Links */}
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
  );
}

async function BirthdaysList() {
  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const players = await prisma.player.findMany({ where: { birthDate: { not: null } }, select: { id: true, name: true, birthDate: true, team: { select: { code: true } } } });
  const born = players.filter((p) => p.birthDate?.endsWith(`-${mmdd}`) || p.birthDate?.includes(`-${mmdd}`));
  if (born.length === 0) return <p className="text-sm text-slate-500">No birthdays today.</p>;
  return (
    <div className="space-y-2">
      {born.slice(0, 8).map((p) => {
        const birthYear = Number((p.birthDate ?? "").slice(0, 4));
        const age = birthYear > 1900 ? today.getFullYear() - birthYear : null;
        return (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <span>🎂</span>
            <span className="flex-1 truncate"><PlayerLink id={p.id} name={p.name} />{age != null && <span className="text-slate-500"> · ${age} y/o</span>}</span>
            <span className="text-slate-500 text-xs">{p.team?.code}</span>
          </div>
        );
      })}
    </div>
  );
}
