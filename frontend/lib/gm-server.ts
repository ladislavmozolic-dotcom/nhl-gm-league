// GM Profile — a general manager's career history, not just an account. Career &
// playoff record, championships, awards, trades, and earned achievements. Keyed by
// team (one GM per club); it deepens as the league plays more seasons.

import { prisma } from "./prisma";
import { franchiseHistory } from "./career-server";
import { draftSourceFilter } from "./prospect-dev-server";
import { cleanName } from "./playerName";

export type Achievement = { key: string; icon: string; label: string; desc: string; earned: boolean };
export type DraftPickRow = { name: string; position: string; year: number; round: number; overallPick: number; ov: number; potential: number; playerSlug: string | null; status: string | null; overall: number | null };
export type DraftRecord = { picks: number; hits: number; stars: number; list: DraftPickRow[] };
export type GmProfile = {
  teamId: number; teamName: string; teamSlug: string | null; teamCode: string | null; logoUrl: string | null;
  gmName: string; since: string | null; rookieGm: boolean;
  seasons: number; record: { w: number; l: number; otl: number; points: number; pointsPct: number };
  playoff: { gp: number; w: number; l: number; seriesWon: number; seriesLost: number; appearances: number };
  championships: string[]; finals: string[]; presidents: string[];
  awards: number; tradesCompleted: number; draft: DraftRecord; longestWinStreak: number;
  achievements: Achievement[];
};

// A franchise's draft record from its own-league selections (DraftProspect). Links
// to the developed Player via playerId when set → "hit" = a pick now in the NHL.
export async function franchiseDraftRecord(teamId: number): Promise<DraftRecord> {
  // this league's OWN drafts only (2026 onward, matching the active roster world —
  // profinhl picks are source null/"profinhl", the real-NHL import is source "real").
  const src = await draftSourceFilter();
  const picks = await prisma.draftProspect.findMany({
    where: { draftedByTeamId: teamId, overallPick: { not: null }, draftYear: { gte: 2026 }, ...src },
    select: { name: true, position: true, draftYear: true, overallPick: true, ov: true, potential: true },
    orderBy: [{ draftYear: "desc" }, { overallPick: "asc" }],
  });
  let hits = 0, stars = 0;
  const list: DraftPickRow[] = picks.map((p) => {
    // a "hit" = a prospect whose developed OV reaches NHL-calibre; star = 85+
    const ov = p.ov ?? 0;
    if (ov >= 78) hits++;
    if (ov >= 85) stars++;
    return { name: p.name, position: p.position, year: p.draftYear, round: Math.max(1, Math.ceil((p.overallPick ?? 1) / 32)), overallPick: p.overallPick ?? 0, ov, potential: p.potential, playerSlug: null, status: null, overall: ov };
  });
  return { picks: picks.length, hits, stars, list };
}

export async function gmProfile(slug: string): Promise<GmProfile | null> {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, code: true, logoUrl: true, league: true, gm: true, gmNickname: true, gmFirstName: true, gmLastName: true, rookieGm: true } });
  if (!team) return null;
  const gmName = team.gmNickname || [team.gmFirstName, team.gmLastName].filter(Boolean).join(" ").trim() || team.gm || "General Manager";
  const league = team.league ?? "NHL";

  const [fh, playoffGames, series, awards, tradesCompleted, draft] = await Promise.all([
    franchiseHistory(team.id, league),
    prisma.game.findMany({ where: { league, status: "FINAL", seriesId: { not: null }, OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] }, select: { homeTeamId: true, homeGoals: true, awayGoals: true, season: true } }),
    prisma.playoffSeries.findMany({ where: { league, OR: [{ highSeedTeamId: team.id }, { lowSeedTeamId: team.id }] }, select: { winnerTeamId: true, status: true } }),
    prisma.seasonAward.count({ where: { teamId: team.id } }),
    prisma.trade.count({ where: { status: "ACCEPTED", OR: [{ fromTeamId: team.id }, { toTeamId: team.id }] } }),
    franchiseDraftRecord(team.id),
  ]);

  // career record
  const at = fh.allTime;
  const record = { w: at.wins, l: at.losses, otl: at.otl, points: at.points, pointsPct: at.gp ? (at.wins * 2 + at.otl) / (at.gp * 2) : 0 };

  // playoff record
  let pgp = 0, pw = 0, pl = 0;
  const poSeasons = new Set<string>();
  for (const g of playoffGames) {
    pgp++; poSeasons.add(g.season);
    const my = g.homeTeamId === team.id ? (g.homeGoals ?? 0) : (g.awayGoals ?? 0);
    const opp = g.homeTeamId === team.id ? (g.awayGoals ?? 0) : (g.homeGoals ?? 0);
    if (my > opp) pw++; else pl++;
  }
  const seriesWon = series.filter((s) => s.status === "DONE" && s.winnerTeamId === team.id).length;
  const seriesLost = series.filter((s) => s.status === "DONE" && s.winnerTeamId != null && s.winnerTeamId !== team.id).length;
  const playoff = { gp: pgp, w: pw, l: pl, seriesWon, seriesLost, appearances: poSeasons.size };

  // longest single-season win streak across the franchise
  const longestWinStreak = await franchiseLongestStreak(team.id, league);

  const champs = fh.championships.length;
  const madePlayoffs = playoff.appearances > 0;
  const strong = record.pointsPct >= 0.55;
  const achievements: Achievement[] = [
    { key: "champion", icon: "🏆", label: "Champion", desc: "Won a league championship", earned: champs >= 1 },
    { key: "dynasty", icon: "👑", label: "Dynasty", desc: "Won 2+ championships", earned: champs >= 2 },
    { key: "presidents", icon: "🥇", label: "President's Trophy", desc: "Best regular-season record", earned: fh.presidents.length >= 1 },
    { key: "streak10", icon: "🔥", label: "Heater", desc: "A 10-game winning streak", earned: longestWinStreak >= 10 },
    { key: "playoffs", icon: "🎟️", label: "Contender", desc: "Reached the playoffs", earned: madePlayoffs },
    { key: "capwizard", icon: "💰", label: "Cap Wizard", desc: "A .550+ season without going over the cap", earned: strong },
    { key: "draftmaster", icon: "🎯", label: "Draft Master", desc: "Developed 3+ draft picks into NHL players", earned: draft.hits >= 3 },
  ];

  return {
    teamId: team.id, teamName: team.name, teamSlug: team.slug, teamCode: team.code, logoUrl: team.logoUrl,
    gmName, since: fh.seasons[0]?.season ?? null, rookieGm: team.rookieGm,
    seasons: at.seasons, record, playoff,
    championships: fh.championships, finals: fh.finals, presidents: fh.presidents,
    awards, tradesCompleted, draft, longestWinStreak, achievements,
  };
}

async function franchiseLongestStreak(teamId: number, league: string): Promise<number> {
  const games = await prisma.game.findMany({ where: { league, status: "FINAL", seriesId: null, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] }, select: { homeTeamId: true, homeGoals: true, awayGoals: true, season: true, round: true, id: true }, orderBy: [{ season: "asc" }, { round: "asc" }, { id: "asc" }] });
  let cur = 0, mx = 0;
  for (const g of games) {
    const won = g.homeTeamId === teamId ? (g.homeGoals ?? 0) > (g.awayGoals ?? 0) : (g.awayGoals ?? 0) > (g.homeGoals ?? 0);
    if (won) { cur++; mx = Math.max(mx, cur); } else cur = 0;
  }
  return mx;
}

// ---------------------------------------------------------------------------
// Extended career: season-by-season, trade record (UNHL Intelligence grades),
// biggest free-agent signings and extensions.
// ---------------------------------------------------------------------------

const GRADE_PTS: Record<string, number> = { "A+": 4.3, A: 4, "B+": 3.3, B: 3, C: 2, D: 1, F: 0 };
const letterOf = (avg: number) => avg >= 4.15 ? "A+" : avg >= 3.65 ? "A" : avg >= 3.15 ? "B+" : avg >= 2.5 ? "B" : avg >= 1.5 ? "C" : avg >= 0.5 ? "D" : "F";

export type GmTradeRow = { id: number; at: Date | null; partner: string; partnerSlug: string | null; gave: string[]; got: string[]; grade: string; verdict: string };
export type GmSigningRow = { playerId: number; name: string; slug: string | null; position: string | null; salary: number; years: number; at: Date; overallNow: number | null; stillHere: boolean };
export type GmCareerExtras = {
  seasons: { season: string; gp: number; w: number; l: number; otl: number; points: number; finish: number | null; playoffResult: string | null }[];
  trades: { count: number; graded: number; avgGrade: string | null; wins: number; losses: number; best: GmTradeRow | null; worst: GmTradeRow | null; list: GmTradeRow[] };
  signings: { count: number; total: number; top: GmSigningRow[] };
  extensions: { count: number; top: { name: string; slug: string | null; salary: number; years: number; at: Date }[] };
};

export async function gmCareerExtras(teamId: number): Promise<GmCareerExtras> {
  const { gradeTradeCached } = await import("./gm-awards");
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { code: true, league: true } });
  const fh = await franchiseHistory(teamId, team?.league ?? "NHL");

  // trades — grade from THIS club's side of each deal
  const trades = await prisma.trade.findMany({ where: { status: "ACCEPTED", OR: [{ fromTeamId: teamId }, { toTeamId: teamId }] }, orderBy: [{ respondedAt: "desc" }, { id: "desc" }], select: { id: true, respondedAt: true, fromTeamId: true, toTeamId: true } });
  const partners = await prisma.team.findMany({ where: { id: { in: [...new Set(trades.flatMap((t) => [t.fromTeamId, t.toTeamId]))] } }, select: { id: true, name: true, slug: true } });
  const pBy = new Map(partners.map((p) => [p.id, p]));
  const rows: GmTradeRow[] = [];
  for (const t of trades) {
    const g = await gradeTradeCached(t.id);
    if (!g) continue;
    const mine = t.fromTeamId === teamId;
    const partner = pBy.get(mine ? t.toTeamId : t.fromTeamId);
    rows.push({ id: t.id, at: t.respondedAt, partner: partner?.name ?? "?", partnerSlug: partner?.slug ?? null,
      gave: mine ? g.fromGives : g.toGives, got: mine ? g.toGives : g.fromGives, grade: mine ? g.fromGrade : g.toGrade, verdict: g.verdict });
  }
  const pts = rows.map((r) => GRADE_PTS[r.grade] ?? 2);
  const avg = pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null;
  const sorted = [...rows].sort((a, b) => (GRADE_PTS[b.grade] ?? 2) - (GRADE_PTS[a.grade] ?? 2));

  // free-agent signings (accepted offers) and extensions
  const offers = await prisma.faOffer.findMany({ where: { teamId, status: "ACCEPTED" }, orderBy: { salary: "desc" }, select: { playerId: true, salary: true, years: true, updatedAt: true } });
  const pl = await prisma.player.findMany({ where: { id: { in: offers.map((o) => o.playerId) } }, select: { id: true, name: true, slug: true, position: true, overall: true, teamId: true, team: { select: { parentTeamId: true } } } });
  const plBy = new Map(pl.map((p) => [p.id, p]));
  const top: GmSigningRow[] = offers.slice(0, 8).map((o) => {
    const p = plBy.get(o.playerId);
    return { playerId: o.playerId, name: cleanName(p?.name ?? "?"), slug: p?.slug ?? null, position: p?.position ?? null, salary: o.salary, years: o.years, at: o.updatedAt, overallNow: p?.overall ?? null, stillHere: !!p && (p.teamId === teamId || p.team?.parentTeamId === teamId) };
  });
  const ext = team?.code ? await prisma.signingLog.findMany({ where: { kind: "EXTEND", reverted: false, teamCode: team.code }, orderBy: { salary: "desc" }, select: { playerId: true, playerName: true, salary: true, years: true, createdAt: true } }) : [];
  const extSlugs = new Map((await prisma.player.findMany({ where: { id: { in: ext.map((e) => e.playerId) } }, select: { id: true, slug: true } })).map((p) => [p.id, p.slug]));

  return {
    seasons: fh.seasons.map((s) => ({ season: s.season, gp: s.gp, w: s.wins, l: s.losses, otl: s.otl, points: s.points, finish: s.finish ?? null, playoffResult: s.playoffResult ?? null })).reverse(),
    trades: { count: trades.length, graded: rows.length, avgGrade: avg == null ? null : letterOf(avg), wins: pts.filter((p) => p >= 3.3).length, losses: pts.filter((p) => p <= 2).length, best: sorted[0] ?? null, worst: sorted.length > 1 ? sorted[sorted.length - 1] : null, list: rows.slice(0, 15) },
    signings: { count: offers.length, total: offers.reduce((t, o) => t + o.salary * o.years, 0), top },
    extensions: { count: ext.length, top: ext.slice(0, 6).map((e) => ({ name: cleanName(e.playerName), slug: extSlugs.get(e.playerId) ?? null, salary: e.salary, years: e.years, at: e.createdAt })) },
  };
}
