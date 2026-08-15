// GM Profile — a general manager's career history, not just an account. Career &
// playoff record, championships, awards, trades, and earned achievements. Keyed by
// team (one GM per club); it deepens as the league plays more seasons.

import { prisma } from "./prisma";
import { franchiseHistory } from "./career-server";

export type Achievement = { key: string; icon: string; label: string; desc: string; earned: boolean };
export type DraftPickRow = { name: string; position: string; year: number; round: number; overallPick: number; ov: number; potential: number; playerSlug: string | null; status: string | null; overall: number | null };
export type DraftRecord = { picks: number; hits: number; stars: number; list: DraftPickRow[] };
export type GmProfile = {
  teamId: number; teamName: string; teamSlug: string | null; teamCode: string | null; logoUrl: string | null;
  gmName: string; since: string | null;
  seasons: number; record: { w: number; l: number; otl: number; points: number; pointsPct: number };
  playoff: { gp: number; w: number; l: number; seriesWon: number; seriesLost: number; appearances: number };
  championships: string[]; finals: string[]; presidents: string[];
  awards: number; tradesCompleted: number; draft: DraftRecord; longestWinStreak: number;
  achievements: Achievement[];
};

// A franchise's draft record from its own-league selections (DraftProspect). Links
// to the developed Player via playerId when set → "hit" = a pick now in the NHL.
export async function franchiseDraftRecord(teamId: number): Promise<DraftRecord> {
  // this league's own drafts only (2026 onward); earlier years are imported real
  // NHL draft history, not this GM's selections.
  const picks = await prisma.draftProspect.findMany({
    where: { draftedByTeamId: teamId, overallPick: { not: null }, draftYear: { gte: 2026 } },
    select: { name: true, position: true, draftYear: true, overallPick: true, ov: true, potential: true, playerId: true },
    orderBy: [{ draftYear: "desc" }, { overallPick: "asc" }],
  });
  const linkedIds = picks.map((p) => p.playerId).filter((x): x is number => x != null);
  const players = linkedIds.length ? await prisma.player.findMany({ where: { id: { in: linkedIds } }, select: { id: true, slug: true, rosterType: true, overall: true } }) : [];
  const pById = new Map(players.map((p) => [p.id, p]));
  let hits = 0, stars = 0;
  const list: DraftPickRow[] = picks.map((p) => {
    const pl = p.playerId != null ? pById.get(p.playerId) : undefined;
    if (pl?.rosterType === "NHL") hits++;
    if (pl && (pl.overall ?? 0) >= 85) stars++;
    return { name: p.name, position: p.position, year: p.draftYear, round: Math.max(1, Math.ceil((p.overallPick ?? 1) / 32)), overallPick: p.overallPick ?? 0, ov: p.ov, potential: p.potential, playerSlug: pl?.slug ?? null, status: pl?.rosterType ?? null, overall: pl?.overall ?? null };
  });
  return { picks: picks.length, hits, stars, list };
}

export async function gmProfile(slug: string): Promise<GmProfile | null> {
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, code: true, logoUrl: true, league: true, gm: true, gmNickname: true, gmFirstName: true, gmLastName: true } });
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
    gmName, since: fh.seasons[0]?.season ?? null,
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
