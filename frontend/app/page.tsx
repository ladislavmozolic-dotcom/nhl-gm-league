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

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20">
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
  let stars: { id?: number; slug?: string | null; name: string; photoUrl: string | null; teamCode: string; teamSlug?: string | null; logoUrl: string | null; g: number; a: number; pts: number; gameId: number }[] = [];
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

  const dateStr = (d: Date) => d.toLocaleDateString("sk-SK", { day: "numeric", month: "short" });

  // Next SCHEDULED game's date — the daily 20:30 trigger fires every real day even
  // on an off day (a no-op), so the "Next Game Sim" card needs the actual next date
  // with something to play, not just "the next trigger from now".
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

  const gon = digest?.gameOfNight;
  const gonAwayTeam = gon ? (gon.awaySlug ? teamBySlug.get(gon.awaySlug) : (gon.away ? teamByCode.get(gon.away) : null)) : null;
  const gonHomeTeam = gon ? (gon.homeSlug ? teamBySlug.get(gon.homeSlug) : (gon.home ? teamByCode.get(gon.home) : null)) : null;

  // Enrich digest players with photoUrl & logos
  const digestPlayerSlugs = [digest?.playerOfNight?.slug, digest?.bestGoalie?.slug].filter((s): s is string => !!s);
  const digestPlayerMap = digestPlayerSlugs.length
    ? new Map((await prisma.player.findMany({ where: { slug: { in: digestPlayerSlugs } }, select: { slug: true, photoUrl: true } })).map((p) => [p.slug, p.photoUrl]))
    : new Map<string, string | null>();
  const ponPhoto = digest?.playerOfNight?.slug ? digestPlayerMap.get(digest.playerOfNight.slug) ?? null : null;
  const bgPhoto = digest?.bestGoalie?.slug ? digestPlayerMap.get(digest.bestGoalie.slug) ?? null : null;
  const ponTeam = digest?.playerOfNight ? (digest.playerOfNight.teamSlug ? teamBySlug.get(digest.playerOfNight.teamSlug) : (digest.playerOfNight.team ? teamByCode.get(digest.playerOfNight.team) : null)) : null;
  const bgTeam = digest?.bestGoalie ? (digest.bestGoalie.teamSlug ? teamBySlug.get(digest.bestGoalie.teamSlug) : (digest.bestGoalie.team ? teamByCode.get(digest.bestGoalie.team) : null)) : null;

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

      {/* 1. TOP SCORES STRIP (if games were played on latest simulated day) */}
      {ticker.length > 0 && (
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
      )}

      {/* 2. MEDIA HUB HERO DECK (7 cols: Game of the Night & Tonight's Best / 5 cols: GM Cockpit & 3-Stars Podium) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 cols: Featured Matchup & Tonight's Best Storyline */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl border-2 border-indigo-500/40 bg-gradient-to-br from-[#10192e] via-[#0b1120] to-[#070b12] p-5 sm:p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

          {gon ? (
            <div className="relative z-10 flex flex-col h-full justify-between space-y-4">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    ZÁPAS KOLA · GAME OF THE NIGHT
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {lastDay?.gameDate ? dateStr(lastDay.gameDate) : "Posledná simulácia"} · {gon.endedIn !== "REG" ? `FINAL (${gon.endedIn})` : "FINAL"}
                  </span>
                </div>

                {/* Matchup Duel */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2 px-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                  {/* Away Team */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="rounded-2xl bg-slate-800/90 border border-slate-700/80 p-2 flex items-center justify-center shadow-xl shrink-0" style={{ width: 56, height: 56, minWidth: 56 }}>
                      {gonAwayTeam?.logoUrl ? (
                        <img src={gonAwayTeam.logoUrl} alt="" className="object-contain filter drop-shadow" style={{ width: 40, height: 40, maxWidth: 40, maxHeight: 40 }} />
                      ) : (
                        <span className="text-base font-black text-slate-300">{gon.away}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-black text-white truncate">{gonAwayTeam?.name ?? gon.away}</div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Hostia · {gon.away}</div>
                    </div>
                  </div>

                  {/* Center Score */}
                  <Link href={`/games/${gon.id}`} className="flex flex-col items-center justify-center px-5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 shadow-inner transition-colors group shrink-0">
                    <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight flex items-center gap-2">
                      <span className={gon.awayGoals > gon.homeGoals ? "text-amber-400" : "text-slate-200"}>{gon.awayGoals}</span>
                      <span className="text-slate-600 text-xl">:</span>
                      <span className={gon.homeGoals > gon.awayGoals ? "text-amber-400" : "text-slate-200"}>{gon.homeGoals}</span>
                    </div>
                    <div className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider mt-0.5 group-hover:text-amber-300 transition-colors">
                      {gon.endedIn !== "REG" ? gon.endedIn : "Konečný stav"} →
                    </div>
                  </Link>

                  {/* Home Team */}
                  <div className="flex items-center gap-3 flex-1 min-w-0 justify-end text-right">
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-black text-white truncate">{gonHomeTeam?.name ?? gon.home}</div>
                      <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Domáci · {gon.home}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-800/90 border border-slate-700/80 p-2 flex items-center justify-center shadow-xl shrink-0" style={{ width: 56, height: 56, minWidth: 56 }}>
                      {gonHomeTeam?.logoUrl ? (
                        <img src={gonHomeTeam.logoUrl} alt="" className="object-contain filter drop-shadow" style={{ width: 40, height: 40, maxWidth: 40, maxHeight: 40 }} />
                      ) : (
                        <span className="text-base font-black text-slate-300">{gon.home}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tonight's Best Stories Row (Player of Night, Best Goalie, etc.) */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <span>🌙</span> {T("home.tonightsBest")}
                  </span>
                  <Link href="/league/digest" className="text-[11px] text-slate-400 hover:text-sky-400 font-semibold transition-colors">
                    Ligový digest →
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Player of Night Card */}
                  {digest?.playerOfNight ? (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 transition-colors">
                      <div className="relative shrink-0">
                        <PlayerAvatar src={ponPhoto} alt={digest.playerOfNight.name} size={42} />
                        {ponTeam?.logoUrl && (
                          <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 p-0.5" style={{ width: 18, height: 18, minWidth: 18 }}>
                            <img src={ponTeam.logoUrl} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                          <span>⭐</span> Hráč noci
                        </div>
                        <div className="text-xs font-bold text-white truncate">
                          {digest.playerOfNight.slug ? (
                            <Link href={`/players/${digest.playerOfNight.slug}`} className="hover:text-sky-300 transition-colors">{digest.playerOfNight.name}</Link>
                          ) : digest.playerOfNight.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono font-medium truncate">
                          {digest.playerOfNight.line}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/70 text-xs text-slate-500">
                      Hráč noci po ďalšej simulácii.
                    </div>
                  )}

                  {/* Best Goalie Card */}
                  {digest?.bestGoalie ? (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 transition-colors">
                      <div className="relative shrink-0">
                        <PlayerAvatar src={bgPhoto} alt={digest.bestGoalie.name} size={42} />
                        {bgTeam?.logoUrl && (
                          <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 p-0.5" style={{ width: 18, height: 18, minWidth: 18 }}>
                            <img src={bgTeam.logoUrl} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                          <span>🧤</span> Brankár noci
                        </div>
                        <div className="text-xs font-bold text-white truncate">
                          {digest.bestGoalie.slug ? (
                            <Link href={`/players/${digest.bestGoalie.slug}`} className="hover:text-sky-300 transition-colors">{digest.bestGoalie.name}</Link>
                          ) : digest.bestGoalie.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono font-medium truncate">
                          {digest.bestGoalie.line}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-slate-900/50 border border-slate-800/70 text-xs text-slate-500">
                      Brankár noci po ďalšej simulácii.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase tracking-widest">
                  uNHL LEAGUE CENTRAL · SEZÓNA {activeSeason}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-2">Vitajte v uNHL Fantasy GM League</h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
                  Aktuálna fáza ligy: <strong className="text-slate-200">{clock.phaseLabel}</strong> ({fmtLeagueDate(clock.date)}). Denné zápasy sa simulujú automaticky o 20:30.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-4 text-xs font-semibold">
                  <Link href="/schedule" className="px-3.5 py-1.5 rounded-xl bg-sky-500 text-white hover:bg-sky-400 transition-colors shadow-md shadow-sky-500/20">
                    Rozpis zápasov →
                  </Link>
                  <Link href="/standings" className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors">
                    Tabuľka ligy
                  </Link>
                  <Link href="/stats/leaders" className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors">
                    Lídri štatistík
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 5 cols: GM Cockpit & 3-Stars Podium */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
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

          {/* 3D Visual Podium: 3 Stars of the Day */}
          <div className="rounded-3xl border border-slate-800 bg-[#0b1120] p-4 sm:p-5 shadow-2xl flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>⭐</span> {T("home.threeStars")} · HVIEZDY DŇA
              </span>
              <Link href="/players/three-stars" className="text-[11px] text-slate-400 hover:text-sky-400 font-semibold transition-colors">
                {T("ui.viewAll")} →
              </Link>
            </div>

            {stars.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Po ďalšej simulácii.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 pt-2 items-end">
                {/* 2nd Star (Silver) */}
                {stars[1] ? (
                  <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/30 mb-2">
                      2. HVIEZDA
                    </span>
                    <div className="relative mb-1.5">
                      <PlayerAvatar src={stars[1].photoUrl} alt={stars[1].name} size={48} />
                      {stars[1].logoUrl && (
                        <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 p-0.5" style={{ width: 18, height: 18, minWidth: 18 }}>
                          <img src={stars[1].logoUrl} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white truncate max-w-full">
                      {stars[1].slug ? <Link href={`/players/${stars[1].slug}`} className="hover:text-sky-300">{stars[1].name}</Link> : stars[1].name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{stars[1].teamCode}</div>
                    <div className="mt-1 font-mono font-black text-xs text-slate-200">{stars[1].pts} PTS</div>
                    <div className="text-[9px] text-slate-500 font-mono">{stars[1].g}G + {stars[1].a}A</div>
                  </div>
                ) : <div />}

                {/* 1st Star (Gold Podium - Higher & Highlighted) */}
                {stars[0] ? (
                  <div className="flex flex-col items-center text-center p-2.5 rounded-2xl bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-slate-900 border-2 border-amber-500/50 shadow-xl shadow-amber-500/10">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 mb-2">
                      👑 1. ZLATO
                    </span>
                    <div className="relative mb-1.5">
                      <div className="rounded-full ring-2 ring-amber-400/80 p-0.5">
                        <PlayerAvatar src={stars[0].photoUrl} alt={stars[0].name} size={54} />
                      </div>
                      {stars[0].logoUrl && (
                        <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 p-0.5" style={{ width: 20, height: 20, minWidth: 20 }}>
                          <img src={stars[0].logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-black text-amber-200 truncate max-w-full">
                      {stars[0].slug ? <Link href={`/players/${stars[0].slug}`} className="hover:text-amber-100">{stars[0].name}</Link> : stars[0].name}
                    </div>
                    <div className="text-[10px] text-amber-400/80 font-mono">{stars[0].teamCode}</div>
                    <div className="mt-1 font-mono font-black text-sm text-amber-300">{stars[0].pts} PTS</div>
                    <div className="text-[10px] text-amber-400/70 font-mono">{stars[0].g}G + {stars[0].a}A</div>
                  </div>
                ) : <div />}

                {/* 3rd Star (Bronze) */}
                {stars[2] ? (
                  <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-colors">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-700/20 text-amber-400 border border-amber-700/30 mb-2">
                      3. BRONZ
                    </span>
                    <div className="relative mb-1.5">
                      <PlayerAvatar src={stars[2].photoUrl} alt={stars[2].name} size={48} />
                      {stars[2].logoUrl && (
                        <span className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 p-0.5" style={{ width: 18, height: 18, minWidth: 18 }}>
                          <img src={stars[2].logoUrl} alt="" className="object-contain" style={{ width: 12, height: 12, maxWidth: 12, maxHeight: 12 }} />
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white truncate max-w-full">
                      {stars[2].slug ? <Link href={`/players/${stars[2].slug}`} className="hover:text-sky-300">{stars[2].name}</Link> : stars[2].name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{stars[2].teamCode}</div>
                    <div className="mt-1 font-mono font-black text-xs text-amber-400/90">{stars[2].pts} PTS</div>
                    <div className="text-[9px] text-slate-500 font-mono">{stars[2].g}G + {stars[2].a}A</div>
                  </div>
                ) : <div />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. PULSE STATS ROW (4 Compact Cards: Recent Trades, Waiver Wire, Injuries, Highlights) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Recent Trades */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <span>🔁</span> Posledné výmeny
              </span>
              <Link href="/trades" className="text-xs text-slate-400 hover:text-sky-400 transition-colors font-semibold">
                {T("ui.viewAll")} →
              </Link>
            </div>
            {recentTrades.length ? (
              <ul className="space-y-2">
                {recentTrades.map((t) => (
                  <li key={t.id} className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/70 hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-100 mb-1">
                      {t.from ? (
                        <span className="flex items-center gap-1 min-w-0" title={t.from.name}>
                          {t.from.logoUrl && (
                            <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 20, height: 20, minWidth: 20 }}>
                              <img src={t.from.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                            </span>
                          )}
                          <span className="truncate">{t.from.code}</span>
                        </span>
                      ) : <span className="text-sky-400">•</span>}
                      {t.to && (
                        <>
                          <span className="text-slate-500 text-xs font-bold">⇄</span>
                          <span className="flex items-center gap-1 min-w-0" title={t.to.name}>
                            {t.to.logoUrl && (
                              <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 20, height: 20, minWidth: 20 }}>
                                <img src={t.to.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />
                              </span>
                            )}
                            <span className="truncate">{t.to.code}</span>
                          </span>
                        </>
                      )}
                      <span className="ml-auto text-slate-500 text-[10px] font-mono tabular-nums">{fmtDate(t.createdAt)}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] truncate leading-tight">
                      {t.fromAssets && t.toAssets ? `${t.fromAssets} ⇄ ${t.toAssets}` : t.message}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 py-3 text-center">Zatiaľ žiadne uskutočnené výmeny.</p>
            )}
          </div>
        </div>

        {/* Card 2: Waiver Wire */}
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

        {/* Card 3: Health & Discipline */}
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
                      Stop {left}z
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

        {/* Card 4: Night Highlights & Upset */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
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

      {/* 4. MAIN CONTENT (8 cols / 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / 8 cols: Announcements, Articles, Trade Block */}
        <div className="lg:col-span-8 space-y-6">
          <CommissionerBanner items={bannerItems} signedIn={me != null} />

          {/* Articles Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <span>📰</span> {T("home.latestArticle")}
              </h2>
              <Link href="/news/create" className="text-xs bg-sky-500 hover:bg-sky-400 text-white font-bold px-3 py-1.5 rounded-xl shadow-md shadow-sky-500/20 transition-colors">
                + {T("home.addArticle")}
              </Link>
            </div>

            {articlesRaw.length === 0 ? (
              <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
                {T("home.noNews")}
              </div>
            ) : (
              <div className="space-y-4">
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
                          ? "border-sky-500/30 bg-gradient-to-br from-[#10192e] via-[#0b1120] to-[#070b12] p-5 shadow-2xl"
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
                        {isFeatured && (
                          <span className="ml-auto px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 text-[10px] font-black uppercase tracking-wider">
                            HLAVNÁ SPRÁVA
                          </span>
                        )}
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
                        <span className="flex items-center gap-1">👍 {a._count.reactions}</span>
                        <span className="flex items-center gap-1">💬 {a._count.comments}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Trade Block & Birthdays */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title={T("home.tradeBlock")} href="/trade-block" accent="text-amber-400" viewLabel={T("ui.viewAll")}>
              {tbListed.length ? (
                <div className="space-y-1.5 text-xs">
                  {tbListed.slice(0, 6).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 p-1 rounded-lg hover:bg-slate-800/30 transition-colors">
                      {p.slug ? <Link href={`/players/${p.slug}`} className="font-semibold text-slate-200 truncate hover:text-sky-300">{p.name}</Link> : <span className="font-semibold text-slate-200 truncate">{p.name}</span>}
                      <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[10px]">
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-bold">{p.position}</span>
                        <span>{p.teamCode}</span>
                      </div>
                    </div>
                  ))}
                  {tbListed.length > 6 && <Link href="/trade-block" className="block text-center text-[11px] text-sky-400 hover:underline pt-1">+ ďalších {tbListed.length - 6} hráčov →</Link>}
                </div>
              ) : <p className="text-xs text-slate-500 py-2">{T("home.noTradeBlock")}</p>}
            </Card>

            <Card title={T("home.birthdays")} accent="text-pink-400">
              <BirthdaysList />
            </Card>
          </div>
        </div>

        {/* Right / 4 cols: Standings Tabs, Scoring Leaders, Free Agents, Quick Links */}
        <div className="lg:col-span-4 space-y-6">
          {/* Tabbed Standings */}
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
              {topScorers.map((s, i) => {
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
