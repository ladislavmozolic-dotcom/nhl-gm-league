// Special events on the real NHL calendar — the outdoor games (Heritage Classic,
// Winter Classic, Stadium Series) and the neutral-site Global Series. A special
// game is an ordinary schedule row tagged with eventKind/title/venue/capacity:
// the sim plays it normally, the crowd is the venue's (not the home arena's), and
// both clubs earn event income on top (settings: specialHomeBonus / specialAwayBonus /
// globalSeriesBonus — paid via computeRewards, so it's idempotent).
import { prisma } from "./prisma";
import { REGULAR_SEASON } from "./phase";
import { kindOf, isOutdoor, type EventKind } from "./special-games-shared";
export { EVENT_KINDS, kindOf, type EventKind } from "./special-games-shared";


/** The real 2026-27 NHL special events (NHL.com schedule release). Capacities are
 *  the venues' configured hockey crowds (approximate where not yet announced). */
export const REAL_2026_27: { date: string; home: string; away: string; kind: EventKind; title: string; venue: string; capacity: number }[] = [
  { date: "2026-10-25", home: "WPG", away: "MTL", kind: "HERITAGE", title: "2026 Tim Hortons NHL Heritage Classic", venue: "Princess Auto Stadium, Winnipeg", capacity: 32343 },
  { date: "2026-11-12", home: "SEA", away: "CAR", kind: "GLOBAL", title: "NHL Global Series Finland", venue: "Veikkaus Arena, Helsinki", capacity: 13349 },
  { date: "2026-11-14", home: "CAR", away: "SEA", kind: "GLOBAL", title: "NHL Global Series Finland", venue: "Veikkaus Arena, Helsinki", capacity: 13349 },
  { date: "2026-12-18", home: "OTT", away: "CHI", kind: "GLOBAL", title: "NHL Global Series Germany", venue: "PSD Bank Dome, Düsseldorf", capacity: 13205 },
  { date: "2026-12-20", home: "CHI", away: "OTT", kind: "GLOBAL", title: "NHL Global Series Germany", venue: "PSD Bank Dome, Düsseldorf", capacity: 13205 },
  { date: "2026-12-31", home: "UTA", away: "COL", kind: "WINTER", title: "2027 Discover NHL Winter Classic", venue: "Rice-Eccles Stadium, Salt Lake City", capacity: 51444 },
  { date: "2027-02-20", home: "DAL", away: "VGK", kind: "STADIUM", title: "2027 Navy Federal Credit Union NHL Stadium Series", venue: "AT&T Stadium, Arlington", capacity: 70000 },
];

/** Tag the real events onto the matching schedule rows (date + home + away). Idempotent. */
export async function applyRealSpecialGames(season = REGULAR_SEASON): Promise<{ tagged: number; missing: string[] }> {
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true } });
  const idOf = new Map(teams.map((t) => [t.code, t.id]));
  let tagged = 0;
  const missing: string[] = [];
  for (const e of REAL_2026_27) {
    const from = new Date(`${e.date}T00:00:00Z`), to = new Date(from.getTime() + 86400000);
    const g = await prisma.game.findFirst({ where: { season, league: "NHL", homeTeamId: idOf.get(e.home) ?? -1, awayTeamId: idOf.get(e.away) ?? -1, gameDate: { gte: from, lt: to } }, select: { id: true } });
    if (!g) { missing.push(`${e.date} ${e.away}@${e.home}`); continue; }
    await prisma.game.update({ where: { id: g.id }, data: { eventKind: e.kind, eventTitle: e.title, eventVenue: e.venue, eventCapacity: e.capacity } });
    tagged++;
  }
  return { tagged, missing };
}

export async function setSpecialGame(gameId: number, d: { kind: EventKind | null; title?: string; venue?: string; capacity?: number | null }) {
  if (!d.kind) return prisma.game.update({ where: { id: gameId }, data: { eventKind: null, eventTitle: null, eventVenue: null, eventCapacity: null } });
  return prisma.game.update({ where: { id: gameId }, data: { eventKind: d.kind, eventTitle: d.title?.trim() || kindOf(d.kind)!.label, eventVenue: d.venue?.trim() || null, eventCapacity: d.capacity && d.capacity > 0 ? Math.round(d.capacity) : null } });
}

export async function specialGames(season = REGULAR_SEASON) {
  return prisma.game.findMany({
    where: { season, eventKind: { not: null } },
    orderBy: { gameDate: "asc" },
    select: {
      id: true, gameDate: true, status: true, homeGoals: true, awayGoals: true, endedIn: true, attendance: true,
      eventKind: true, eventTitle: true, eventVenue: true, eventCapacity: true,
      homeTeam: { select: { id: true, code: true, name: true, logoUrl: true, slug: true } },
      awayTeam: { select: { id: true, code: true, name: true, logoUrl: true, slug: true } },
    },
  });
}

/** Event income per NHL club for the season's PLAYED special games. */
export function specialEventIncome(games: { homeTeamId: number; awayTeamId: number; eventKind: string | null }[], s: { specialHomeBonus: number; specialAwayBonus: number; globalSeriesBonus: number }): Map<number, number> {
  const out = new Map<number, number>();
  const add = (id: number, v: number) => { if (v) out.set(id, (out.get(id) ?? 0) + v); };
  for (const g of games) {
    if (g.eventKind === "GLOBAL") { add(g.homeTeamId, s.globalSeriesBonus); add(g.awayTeamId, s.globalSeriesBonus); }
    else if (isOutdoor(g.eventKind)) { add(g.homeTeamId, s.specialHomeBonus); add(g.awayTeamId, s.specialAwayBonus); }
  }
  return out;
}

export type KeyDate = { at: Date; icon: string; title: string; detail?: string; href?: string; timed: boolean };

/** The season's key dates for the League Calendar — special events, All-Star
 *  Weekend, the trade deadline and the last day of the regular season. */
export async function leagueKeyDates(season = REGULAR_SEASON): Promise<KeyDate[]> {
  const [events, allStar, cfg, last] = await Promise.all([
    specialGames(season),
    prisma.allStarEvent.findFirst({ where: { season }, orderBy: { id: "desc" }, select: { title: true, eventAt: true, votingOpensAt: true, votingClosesAt: true } }),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { tradeDeadlineAt: true } }),
    prisma.game.findFirst({ where: { season, league: "NHL", seriesId: null }, orderBy: { gameDate: "desc" }, select: { gameDate: true } }),
  ]);
  const out: KeyDate[] = events.filter((g) => g.gameDate).map((g) => ({
    at: g.gameDate!, icon: kindOf(g.eventKind)?.icon ?? "⭐", title: g.eventTitle ?? kindOf(g.eventKind)?.label ?? "Special event",
    detail: `${g.awayTeam.code} @ ${g.homeTeam.code}${g.eventVenue ? ` · ${g.eventVenue}` : ""}`, href: `/games/${g.id}`, timed: false,
  }));
  if (allStar) {
    if (allStar.votingOpensAt) out.push({ at: allStar.votingOpensAt, icon: "🗳️", title: "All-Star nominations open", detail: "Every GM nominates 3 F · 2 D · 1 G", href: "/all-star", timed: true });
    out.push({ at: allStar.eventAt, icon: "⭐", title: allStar.title, detail: "Skills Competition + 3-on-3 tournament", href: "/all-star", timed: true });
  }
  if (cfg?.tradeDeadlineAt) out.push({ at: cfg.tradeDeadlineAt, icon: "⏰", title: "NHL Trade Deadline", detail: "Trades freeze until each club's season is over", href: "/trades/deadline", timed: true });
  if (last?.gameDate) out.push({ at: last.gameDate, icon: "🏁", title: "Final day of the regular season", detail: "Playoffs start after it", timed: false });
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
