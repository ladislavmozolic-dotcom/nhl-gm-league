// Weekly league newsletter — a 7-round (≈one week) recap: team of the week, top
// scorer, best goalie, a surprise, and the trade of the week. Computed on demand for
// the latest 7 rounds; also auto-posted to human GMs' Messages when a week completes.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";
import { computeStandings } from "./sim/standings";

const SEASON = "2026-27";
const WEEK = 7;

export type StarRow = { rank: number; id: number; name: string; slug: string | null; team: string | null; teamLogo: string | null; line: string; isGoalie: boolean };
export type WeeklyDigest = {
  weekNo: number; roundFrom: number; roundTo: number; games: number; span: number;
  teamOfWeek: { code: string | null; name: string; slug: string | null; logo: string | null; w: number; l: number; otl: number; points: number; gf: number; ga: number } | null;
  topScorer: { id: number; name: string; slug: string | null; team: string | null; teamLogo: string | null; g: number; a: number; pts: number; gp: number } | null;
  bestGoalie: { id: number; name: string; slug: string | null; team: string | null; teamLogo: string | null; gp: number; svPct: number; record: string } | null;
  stars: StarRow[];
  gmOfPeriod: { rank: number; gm: string; ai: boolean; team: string; code: string | null; slug: string | null; logo: string | null; w: number; l: number; otl: number; points: number }[];
  surprise: { code: string | null; name: string; slug: string | null; logo: string | null; w: number; l: number; otl: number; overallRank: number } | null;
  tradeOfWeek: string | null;
} | null;

async function windowFor(span: number, round?: number) {
  const agg = await prisma.game.aggregate({ where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null }, _max: { round: true } });
  const to = round ?? agg._max.round;
  if (to == null) return null;
  return { from: Math.max(0, to - (span - 1)), to, weekNo: Math.floor(to / span) + 1 };
}

export async function weeklyDigest(round?: number, span: number = WEEK): Promise<WeeklyDigest> {
  const win = await windowFor(span, round);
  if (!win) return null;
  const { from, to, weekNo } = win;
  const games = await prisma.game.findMany({
    where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null, round: { gte: from, lte: to } },
    select: { id: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, endedIn: true },
  });
  if (!games.length) return { weekNo, roundFrom: from, roundTo: to, games: 0, span, teamOfWeek: null, topScorer: null, bestGoalie: null, stars: [], gmOfPeriod: [], surprise: null, tradeOfWeek: null };
  const winIds = games.map((g) => g.id);

  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true, name: true, slug: true, logoUrl: true, gm: true, gmNickname: true, passwordHash: true } });
  const tm = new Map(teams.map((t) => [t.id, t]));

  // team week records
  type Rec = { w: number; l: number; otl: number; points: number; gf: number; ga: number };
  const rec = new Map<number, Rec>();
  const bump = (id: number) => { let r = rec.get(id); if (!r) { r = { w: 0, l: 0, otl: 0, points: 0, gf: 0, ga: 0 }; rec.set(id, r); } return r; };
  for (const g of games) {
    const hg = g.homeGoals ?? 0, ag = g.awayGoals ?? 0, otl = g.endedIn !== "REG";
    const h = bump(g.homeTeamId), a = bump(g.awayTeamId);
    h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    if (hg > ag) { h.w++; h.points += 2; if (otl) { a.otl++; a.points++; } else a.l++; }
    else { a.w++; a.points += 2; if (otl) { h.otl++; h.points++; } else h.l++; }
  }
  const ranked = [...rec.entries()].map(([id, r]) => ({ id, ...r })).sort((x, y) => y.points - x.points || (y.gf - y.ga) - (x.gf - x.ga));
  const tow = ranked[0];
  const teamOfWeek = tow ? { code: tm.get(tow.id)?.code ?? null, name: tm.get(tow.id)?.name ?? "?", slug: tm.get(tow.id)?.slug ?? null, logo: tm.get(tow.id)?.logoUrl ?? null, w: tow.w, l: tow.l, otl: tow.otl, points: tow.points, gf: tow.gf, ga: tow.ga } : null;
  const gmOfPeriod = ranked.slice(0, 3).map((r, i) => { const t = tm.get(r.id); const ai = !t?.passwordHash; return { rank: i + 1, gm: ai ? "AI GM" : (t?.gmNickname || t?.gm || "GM"), ai, team: t?.name ?? "?", code: t?.code ?? null, slug: t?.slug ?? null, logo: t?.logoUrl ?? null, w: r.w, l: r.l, otl: r.otl, points: r.points }; });

  // top scorer
  const sk = await prisma.playerGameStat.groupBy({ by: ["playerId"], where: { gameId: { in: winIds } }, _sum: { goals: true, assists: true, points: true }, _count: { _all: true } });
  const topRow = sk.sort((a, b) => (b._sum.points ?? 0) - (a._sum.points ?? 0))[0];
  let topScorer: NonNullable<WeeklyDigest>["topScorer"] = null;
  if (topRow && (topRow._sum.points ?? 0) > 0) {
    const pl = await prisma.player.findUnique({ where: { id: topRow.playerId }, select: { name: true, slug: true, team: { select: { code: true, logoUrl: true } } } });
    topScorer = { id: topRow.playerId, name: cleanName(pl?.name ?? "?"), slug: pl?.slug ?? null, team: pl?.team?.code ?? null, teamLogo: pl?.team?.logoUrl ?? null, g: topRow._sum.goals ?? 0, a: topRow._sum.assists ?? 0, pts: topRow._sum.points ?? 0, gp: topRow._count._all };
  }

  // best goalie (min 2 starts)
  const gk = await prisma.goalieGameStat.groupBy({ by: ["playerId"], where: { gameId: { in: winIds }, started: true }, _sum: { saves: true, shotsAgainst: true }, _count: { _all: true } });
  const gkRows = gk.filter((r) => r._count._all >= 2 && (r._sum.shotsAgainst ?? 0) > 0).map((r) => ({ id: r.playerId, gp: r._count._all, sv: r._sum.saves ?? 0, sa: r._sum.shotsAgainst ?? 0, svPct: (r._sum.saves ?? 0) / (r._sum.shotsAgainst ?? 1) }));
  const bg = gkRows.sort((a, b) => b.svPct - a.svPct)[0];
  let bestGoalie: NonNullable<WeeklyDigest>["bestGoalie"] = null;
  if (bg) {
    const pl = await prisma.player.findUnique({ where: { id: bg.id }, select: { name: true, slug: true, team: { select: { code: true, logoUrl: true } } } });
    // W-L record in the window
    const dec = await prisma.goalieGameStat.groupBy({ by: ["decision"], where: { gameId: { in: winIds }, playerId: bg.id } });
    const wins = dec.find((d) => d.decision === "W") ? await prisma.goalieGameStat.count({ where: { gameId: { in: winIds }, playerId: bg.id, decision: "W" } }) : 0;
    const losses = await prisma.goalieGameStat.count({ where: { gameId: { in: winIds }, playerId: bg.id, decision: { in: ["L", "OTL"] } } });
    bestGoalie = { id: bg.id, name: cleanName(pl?.name ?? "?"), slug: pl?.slug ?? null, team: pl?.team?.code ?? null, teamLogo: pl?.team?.logoUrl ?? null, gp: bg.gp, svPct: bg.svPct, record: `${wins}-${losses}` };
  }

  // ---- 3 Stars of the week: top scorers by points; an elite goalie week takes the 3rd star ----
  const topSk = sk.filter((r) => (r._sum.points ?? 0) > 0).sort((a, b) => (b._sum.points ?? 0) - (a._sum.points ?? 0)).slice(0, 3);
  const skMeta = new Map((await prisma.player.findMany({ where: { id: { in: topSk.map((r) => r.playerId) } }, select: { id: true, name: true, slug: true, team: { select: { code: true, logoUrl: true } } } })).map((p) => [p.id, p]));
  const stars: StarRow[] = topSk.map((r, i) => {
    const m = skMeta.get(r.playerId);
    return { rank: i + 1, id: r.playerId, name: cleanName(m?.name ?? "?"), slug: m?.slug ?? null, team: m?.team?.code ?? null, teamLogo: m?.team?.logoUrl ?? null, line: `${r._sum.points ?? 0} pts · ${r._sum.goals ?? 0}G ${r._sum.assists ?? 0}A`, isGoalie: false };
  });
  const eliteGoalie = bestGoalie && bestGoalie.svPct >= 0.935 && bestGoalie.gp >= 2;
  if (eliteGoalie && bestGoalie) {
    const gStar: StarRow = { rank: 3, id: bestGoalie.id, name: bestGoalie.name, slug: bestGoalie.slug, team: bestGoalie.team, teamLogo: bestGoalie.teamLogo, line: `${bestGoalie.svPct.toFixed(3).replace(/^0/, "")} SV% · ${bestGoalie.record} · ${bestGoalie.gp} GP`, isGoalie: true };
    if (stars.length >= 3) stars[2] = gStar; else stars.push(gStar);
    stars.forEach((s, i) => (s.rank = i + 1));
  }

  // surprise: a bottom-half (overall) club with a strong week
  const standings = await computeStandings(SEASON, "NHL");
  const overallRank = new Map(standings.map((s, i) => [s.teamId, i + 1]));
  const half = Math.ceil(standings.length / 2);
  const surpriseRow = ranked.filter((r) => (overallRank.get(r.id) ?? 0) > half && r.w >= r.l + r.otl + 1).sort((a, b) => b.points - a.points)[0];
  const surprise = surpriseRow ? { code: tm.get(surpriseRow.id)?.code ?? null, name: tm.get(surpriseRow.id)?.name ?? "?", slug: tm.get(surpriseRow.id)?.slug ?? null, logo: tm.get(surpriseRow.id)?.logoUrl ?? null, w: surpriseRow.w, l: surpriseRow.l, otl: surpriseRow.otl, overallRank: overallRank.get(surpriseRow.id) ?? 0 } : null;

  // trade of the week — the latest completed deal
  const tr = await prisma.transaction.findFirst({ where: { type: "TRADE", message: { contains: "traded" } }, orderBy: { createdAt: "desc" }, select: { message: true } });

  return { weekNo, roundFrom: from, roundTo: to, games: games.length, span, teamOfWeek, topScorer, bestGoalie, stars, gmOfPeriod, surprise, tradeOfWeek: tr?.message ?? null };
}

/** Auto-post the weekly recap to human GMs' Messages + a public news line, once per
 *  completed 7-round week. Called from the day-advance. Guarded by LeagueConfig. */
export async function postWeeklyIfDue(currentRound: number): Promise<boolean> {
  if (currentRound < WEEK) return false;
  const weekNo = Math.floor(currentRound / WEEK);
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { lastWeeklyWeek: true } }).catch(() => null);
  if ((cfg?.lastWeeklyWeek ?? 0) >= weekNo) return false; // already posted this week
  const d = await weeklyDigest(weekNo * WEEK - 1);
  if (!d || d.games === 0) return false;

  const line = [
    d.teamOfWeek ? `🏆 Team of the Week: ${d.teamOfWeek.name} (${d.teamOfWeek.w}-${d.teamOfWeek.l}-${d.teamOfWeek.otl})` : null,
    d.topScorer ? `🌟 ${d.topScorer.name} — ${d.topScorer.pts} pts (${d.topScorer.g}G ${d.topScorer.a}A)` : null,
    d.bestGoalie ? `🧤 ${d.bestGoalie.name} — ${(d.bestGoalie.svPct).toFixed(3).replace(/^0/, "")} SV%` : null,
    d.surprise ? `😮 Surprise: ${d.surprise.name} went ${d.surprise.w}-${d.surprise.l}-${d.surprise.otl}` : null,
  ].filter(Boolean).join(" · ");
  const body = `📰 Week ${d.weekNo} recap — ${line}.`;
  // retire the previous weekly banner, post the new one (shows on every GM's home)
  await prisma.commissionerAnnouncement.updateMany({ where: { active: true, body: { startsWith: "📰 Week " } }, data: { active: false } }).catch(() => {});
  await prisma.commissionerAnnouncement.create({ data: { body, linkUrl: "/league/weekly", linkLabel: "Read the full newsletter", active: true } }).catch(() => {});
  await prisma.transaction.create({ data: { type: "NEWS", message: `${body} Full newsletter → /league/weekly` } }).catch(() => {});
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { lastWeeklyWeek: weekNo } }).catch(() => {});
  return true;
}
