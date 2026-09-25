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
  worstTeam: { code: string | null; name: string; slug: string | null; logo: string | null; w: number; l: number; otl: number; points: number; gf: number; ga: number } | null;
  powerRankings: PowerRow[];
  trades: { id: number; message: string; createdAt: string }[];
  injuries: { playerId: number | null; name: string; slug: string | null; team: string | null; teamLogo: string | null; part: string; severity: string; days: number }[];
} | null;

/** One row of the weekly power ranking. Transparent formula, shown on the page:
 *  score = 60 % season points-% + 40 % this-window points-% (+ goal diff/GP as a
 *  tiebreak). `move` = places gained vs. the same ranking one window earlier. */
export type PowerRow = {
  rank: number; move: number | null; teamId: number; code: string | null; name: string; slug: string | null; logo: string | null;
  seasonPct: number; weekPct: number; weekRec: string; seasonRec: string; gdPerGp: number; score: number;
};
const POWER_SEASON_W = 0.6;
const POWER_WEEK_W = 0.4;

type Rec2 = { gp: number; w: number; l: number; otl: number; points: number; gf: number; ga: number };
type GameLite = { homeTeamId: number; awayTeamId: number; homeGoals: number | null; awayGoals: number | null; endedIn: string | null; round: number | null };
function records(games: GameLite[]): Map<number, Rec2> {
  const m = new Map<number, Rec2>();
  const b = (id: number) => { let r = m.get(id); if (!r) { r = { gp: 0, w: 0, l: 0, otl: 0, points: 0, gf: 0, ga: 0 }; m.set(id, r); } return r; };
  for (const g of games) {
    const hg = g.homeGoals ?? 0, ag = g.awayGoals ?? 0, ot = g.endedIn !== "REG";
    const h = b(g.homeTeamId), a = b(g.awayTeamId);
    h.gp++; a.gp++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
    const [win, lose] = hg > ag ? [h, a] : [a, h];
    win.w++; win.points += 2;
    if (ot) { lose.otl++; lose.points++; } else lose.l++;
  }
  return m;
}
const pct = (r: Rec2 | undefined) => (r && r.gp ? r.points / (2 * r.gp) : 0);
const recStr = (r: Rec2 | undefined) => (r ? `${r.w}-${r.l}-${r.otl}` : "0-0-0");

/** Rank every club as of round `to`, with `from..to` as "this window". */
function powerOrder(all: GameLite[], from: number, to: number, teamIds: number[]) {
  const season = records(all.filter((g) => (g.round ?? 0) <= to));
  const week = records(all.filter((g) => (g.round ?? 0) >= from && (g.round ?? 0) <= to));
  return teamIds.map((id) => {
    const sr = season.get(id), wr = week.get(id);
    const gd = sr && sr.gp ? (sr.gf - sr.ga) / sr.gp : 0;
    const score = POWER_SEASON_W * pct(sr) + POWER_WEEK_W * pct(wr);
    return { id, sr, wr, gd, score };
  }).filter((r) => (r.sr?.gp ?? 0) > 0).sort((a, b) => b.score - a.score || b.gd - a.gd);
}

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
    select: { id: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, endedIn: true, gameDate: true },
  });
  if (!games.length) return { weekNo, roundFrom: from, roundTo: to, games: 0, span, teamOfWeek: null, topScorer: null, bestGoalie: null, stars: [], gmOfPeriod: [], surprise: null, tradeOfWeek: null, worstTeam: null, powerRankings: [], trades: [], injuries: [] };
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

  // worst club of the window — the mirror of Team of the Week
  const wr = ranked[ranked.length - 1];
  const worstTeam = wr && ranked.length > 1 ? { code: tm.get(wr.id)?.code ?? null, name: tm.get(wr.id)?.name ?? "?", slug: tm.get(wr.id)?.slug ?? null, logo: tm.get(wr.id)?.logoUrl ?? null, w: wr.w, l: wr.l, otl: wr.otl, points: wr.points, gf: wr.gf, ga: wr.ga } : null;

  // power rankings — every NHL club, with movement vs. one window earlier
  const seasonGames: GameLite[] = await prisma.game.findMany({
    where: { season: SEASON, league: "NHL", status: "FINAL", seriesId: null, round: { lte: to } },
    select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, endedIn: true, round: true },
  });
  const ids = teams.map((t) => t.id);
  const now = powerOrder(seasonGames, from, to, ids);
  const prevRank = from > 0 ? new Map(powerOrder(seasonGames, Math.max(0, from - span), from - 1, ids).map((r, i) => [r.id, i + 1])) : null;
  const powerRankings: PowerRow[] = now.map((r, i) => {
    const t = tm.get(r.id);
    const before = prevRank?.get(r.id);
    return {
      rank: i + 1, move: before != null ? before - (i + 1) : null, teamId: r.id, code: t?.code ?? null, name: t?.name ?? "?", slug: t?.slug ?? null, logo: t?.logoUrl ?? null,
      seasonPct: pct(r.sr), weekPct: pct(r.wr), weekRec: recStr(r.wr), seasonRec: recStr(r.sr), gdPerGp: r.gd, score: r.score,
    };
  });

  // every trade + every new injury inside the window (by game date; trades by real timestamp)
  const dates = games.map((g) => g.gameDate?.getTime()).filter((x): x is number => x != null);
  const dFrom = dates.length ? new Date(Math.min(...dates)) : new Date(Date.now() - span * 86400000);
  const dTo = dates.length ? new Date(Math.max(...dates) + 86400000) : new Date();
  const tradeRows = await prisma.transaction.findMany({
    where: { type: "TRADE", message: { contains: "traded" }, createdAt: { gte: dFrom, lt: dTo } },
    orderBy: { createdAt: "desc" }, take: 30, select: { id: true, message: true, createdAt: true },
  });
  const trades = tradeRows.map((t) => ({ id: t.id, message: t.message, createdAt: t.createdAt.toISOString() }));

  const injEv = await prisma.gameEvent.findMany({ where: { type: "INJURY", gameId: { in: winIds } }, select: { playerId: true, teamId: true, meta: true }, orderBy: { id: "asc" } });
  const injP = new Map((await prisma.player.findMany({ where: { id: { in: injEv.map((e) => e.playerId).filter((x): x is number => x != null) } }, select: { id: true, name: true, slug: true } })).map((p) => [p.id, p]));
  const injuries = injEv.map((e) => {
    const m = (e.meta ?? {}) as { part?: string; severity?: string; days?: number };
    const p = e.playerId != null ? injP.get(e.playerId) : undefined;
    const t = e.teamId != null ? tm.get(e.teamId) : undefined;
    return { playerId: e.playerId, name: p ? cleanName(p.name) : "—", slug: p?.slug ?? null, team: t?.code ?? null, teamLogo: t?.logoUrl ?? null, part: m.part ?? "Injury", severity: m.severity ?? "—", days: m.days ?? 0 };
  }).sort((a, b) => b.days - a.days);

  return { weekNo, roundFrom: from, roundTo: to, games: games.length, span, teamOfWeek, topScorer, bestGoalie, stars, gmOfPeriod, surprise, tradeOfWeek: tr?.message ?? null, worstTeam, powerRankings, trades, injuries };
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
  await publishWeeklyArticle(d).catch((e) => console.error("[weekly] article failed", e));
  await postToDiscord(d).catch((e) => console.error("[weekly] discord failed", e));
  await prisma.leagueConfig.update({ where: { id: 1 }, data: { lastWeeklyWeek: weekNo } }).catch(() => {});
  return true;
}

const esc = (v: string | number) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const arrow = (m: number | null) => (m == null || m === 0 ? "" : m > 0 ? ` ▲${m}` : ` ▼${-m}`);

/** The "UNHL Recap" News article — authored by the commissioner's club so it
 *  sits in the normal News feed (home page + /news) with reactions/comments. */
async function publishWeeklyArticle(d: NonNullable<WeeklyDigest>): Promise<void> {
  const author = await prisma.team.findFirst({ where: { isAdmin: true }, orderBy: { id: "asc" }, select: { id: true } });
  if (!author) return;
  const title = `📰 UNHL Recap — Week ${d.weekNo}`;
  if (await prisma.newsArticle.findFirst({ where: { title }, select: { id: true } })) return; // idempotent

  const pl = (name: string, slug: string | null) => (slug ? `<a href="/players/${esc(slug)}">${esc(name)}</a>` : esc(name));
  const tl = (name: string, slug: string | null) => (slug ? `<a href="/teams/${esc(slug)}">${esc(name)}</a>` : esc(name));
  const parts: string[] = [];
  parts.push(`<p><i>${d.games} games · rounds ${d.roundFrom + 1}–${d.roundTo + 1}</i></p>`);
  parts.push(`<h2>📊 Power Rankings</h2><ol>${d.powerRankings.slice(0, 10).map((r) => `<li><b>${tl(r.name, r.slug)}</b>${arrow(r.move)} — week ${esc(r.weekRec)}, season ${esc(r.seasonRec)}</li>`).join("")}</ol>`);
  parts.push(`<p><i>Score = 60 % season points-% + 40 % this week's points-%. Full table on the <a href="/league/weekly?tab=power">Weekly Report</a>.</i></p>`);
  if (d.teamOfWeek) parts.push(`<h2>🏆 Team of the Week</h2><p><b>${tl(d.teamOfWeek.name, d.teamOfWeek.slug)}</b> went ${d.teamOfWeek.w}-${d.teamOfWeek.l}-${d.teamOfWeek.otl} (${d.teamOfWeek.gf}-${d.teamOfWeek.ga} in goals).</p>`);
  if (d.worstTeam) parts.push(`<h2>📉 Rough Week</h2><p><b>${tl(d.worstTeam.name, d.worstTeam.slug)}</b> — ${d.worstTeam.w}-${d.worstTeam.l}-${d.worstTeam.otl}, ${d.worstTeam.gf}-${d.worstTeam.ga} in goals.</p>`);
  if (d.stars.length) parts.push(`<h2>⭐ Three Stars</h2><ol>${d.stars.map((x) => `<li>${pl(x.name, x.slug)} (${esc(x.team ?? "—")}) — ${esc(x.line)}</li>`).join("")}</ol>`);
  if (d.bestGoalie) parts.push(`<h2>🧤 Goalie of the Week</h2><p>${pl(d.bestGoalie.name, d.bestGoalie.slug)} (${esc(d.bestGoalie.team ?? "—")}) — ${esc(d.bestGoalie.svPct.toFixed(3).replace(/^0/, ""))} SV%, ${esc(d.bestGoalie.record)}.</p>`);
  if (d.surprise) parts.push(`<h2>😮 Surprise</h2><p>${tl(d.surprise.name, d.surprise.slug)} went ${d.surprise.w}-${d.surprise.l}-${d.surprise.otl} despite sitting ${d.surprise.overallRank}th overall.</p>`);
  parts.push(`<h2>🔁 Trades</h2>${d.trades.length ? `<ul>${d.trades.map((t) => `<li>${esc(t.message)}</li>`).join("")}</ul>` : "<p>No trades this week.</p>"}`);
  parts.push(`<h2>🏥 Injuries</h2>${d.injuries.length ? `<ul>${d.injuries.slice(0, 12).map((i) => `<li>${pl(i.name, i.slug)} (${esc(i.team ?? "—")}) — ${esc(i.part)}, ${esc(i.severity)}${i.days ? `, ~${i.days} days` : ""}</li>`).join("")}</ul>${d.injuries.length > 12 ? `<p>+ ${d.injuries.length - 12} more on the <a href="/players/injuries">Injury Report</a>.</p>` : ""}` : "<p>A clean bill of health — no new injuries.</p>"}`);
  await prisma.newsArticle.create({ data: { authorTeamId: author.id, title, bodyHtml: parts.join("") } });
}

/** Optional: mirror a short recap into a Discord channel. Off unless the server's
 *  .env sets DISCORD_WEBHOOK_URL (kept out of the DB on purpose — it's a secret). */
async function postToDiscord(d: NonNullable<WeeklyDigest>): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  const lines = [
    `**📰 UNHL Recap — Week ${d.weekNo}**`,
    `**Power Rankings:** ${d.powerRankings.slice(0, 5).map((r) => `${r.rank}. ${r.code ?? r.name}${arrow(r.move)}`).join(" · ")}`,
    d.teamOfWeek ? `🏆 ${d.teamOfWeek.name} (${d.teamOfWeek.w}-${d.teamOfWeek.l}-${d.teamOfWeek.otl})` : null,
    d.worstTeam ? `📉 ${d.worstTeam.name} (${d.worstTeam.w}-${d.worstTeam.l}-${d.worstTeam.otl})` : null,
    d.topScorer ? `🌟 ${d.topScorer.name} — ${d.topScorer.pts} pts` : null,
    `🔁 ${d.trades.length} trade(s) · 🏥 ${d.injuries.length} new injur${d.injuries.length === 1 ? "y" : "ies"}`,
    `https://unhl.eu/league/weekly`,
  ].filter(Boolean).join("\n");
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: lines.slice(0, 1900) }) });
}
