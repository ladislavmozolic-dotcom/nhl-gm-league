// "Living League" — the nightly digest. For one sim day it auto-generates the
// storylines from that day's games + event stream: Game / Player / Upset of the
// Night, best goalie, biggest hit, injury report. All from OUR league's data.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";
import { computeStandings } from "./sim/standings";

export type DigestGame = { id: number; away: string; home: string; awaySlug: string | null; homeSlug: string | null; awayGoals: number; homeGoals: number; endedIn: string };
export type NightPlayer = { name: string; slug: string | null; team: string | null; teamSlug: string | null; line: string };
export type NightInjury = { name: string; slug: string | null; team: string | null; part: string; mechanism: string; severity: string; days: number; byName: string | null };
export type DailyDigest = {
  season: string; round: number; date: string | null; gameCount: number;
  scores: DigestGame[];
  gameOfNight: (DigestGame & { note: string }) | null;
  playerOfNight: NightPlayer | null;
  upset: (DigestGame & { note: string }) | null;
  bestGoalie: NightPlayer | null;
  biggestHit: { hitter: string; hitterSlug: string | null; victim: string; victimSlug: string | null; team: string | null; note: string } | null;
  injuries: NightInjury[];
};

export async function latestDigestRound(season: string): Promise<number> {
  const g = await prisma.game.findFirst({ where: { season, league: "NHL", status: "FINAL", seriesId: null }, orderBy: { round: "desc" }, select: { round: true } });
  return g?.round ?? 0;
}

export async function playedRounds(season: string): Promise<number[]> {
  const rows = await prisma.game.findMany({ where: { season, league: "NHL", status: "FINAL", seriesId: null }, distinct: ["round"], select: { round: true }, orderBy: { round: "asc" } });
  return rows.map((r) => r.round!).filter((r) => r != null);
}

export async function dailyDigest(season: string, round: number): Promise<DailyDigest> {
  const games = await prisma.game.findMany({
    where: { season, league: "NHL", status: "FINAL", seriesId: null, round },
    include: { homeTeam: { select: { name: true, code: true, slug: true } }, awayTeam: { select: { name: true, code: true, slug: true } } },
    orderBy: { id: "asc" },
  });
  const date = games.find((g) => g.gameDate)?.gameDate ?? null;
  const gids = games.map((g) => g.id);

  const scores: DigestGame[] = games.map((g) => ({
    id: g.id, away: g.awayTeam.code ?? g.awayTeam.name, home: g.homeTeam.code ?? g.homeTeam.name,
    awaySlug: g.awayTeam.slug, homeSlug: g.homeTeam.slug,
    awayGoals: g.awayGoals ?? 0, homeGoals: g.homeGoals ?? 0, endedIn: g.endedIn ?? "REG",
  }));

  if (games.length === 0) {
    return { season, round, date: null, gameCount: 0, scores: [], gameOfNight: null, playerOfNight: null, upset: null, bestGoalie: null, biggestHit: null, injuries: [] };
  }

  // team strength proxy = season points (for the upset)
  const standings = await computeStandings(season, "NHL").catch(() => []);
  const pts = new Map<number, number>(standings.map((s: { teamId: number; points: number }) => [s.teamId, s.points]));

  // GAME OF THE NIGHT: reward a close, high-scoring, OT / upset game.
  const goScore = (g: typeof games[number]) => {
    const total = (g.homeGoals ?? 0) + (g.awayGoals ?? 0);
    const margin = Math.abs((g.homeGoals ?? 0) - (g.awayGoals ?? 0));
    const ot = g.endedIn !== "REG" ? 3 : 0;
    const gap = (pts.get(g.awayTeamId) ?? 0) - (pts.get(g.homeTeamId) ?? 0);
    const winnerAway = (g.awayGoals ?? 0) > (g.homeGoals ?? 0);
    const upset = ((winnerAway && gap < -8) || (!winnerAway && gap > 8)) ? 2 : 0;
    return total + (6 - margin) + ot + upset;
  };
  const gotn = [...games].sort((a, b) => goScore(b) - goScore(a))[0];
  const dg = (g: typeof games[number]): DigestGame => scores.find((s) => s.id === g.id)!;
  const gameOfNight = { ...dg(gotn), note: gotn.endedIn !== "REG" ? `${gotn.endedIn} thriller` : "the game of the night" };

  // UPSET OF THE NIGHT: biggest points-gap the winner overcame.
  let upset: (DigestGame & { note: string }) | null = null;
  let bestUpsetGap = 8; // needs a real gap
  for (const g of games) {
    const winnerAway = (g.awayGoals ?? 0) > (g.homeGoals ?? 0);
    const winnerId = winnerAway ? g.awayTeamId : g.homeTeamId, loserId = winnerAway ? g.homeTeamId : g.awayTeamId;
    const gap = (pts.get(loserId) ?? 0) - (pts.get(winnerId) ?? 0);
    if (gap > bestUpsetGap) { bestUpsetGap = gap; upset = { ...dg(g), note: `${winnerAway ? g.awayTeam.code : g.homeTeam.code} shocked a much stronger ${winnerAway ? g.homeTeam.code : g.awayTeam.code}` }; }
  }

  // PLAYER OF THE NIGHT: top skater by points, then goals, that day.
  const skaters = await prisma.playerGameStat.findMany({ where: { gameId: { in: gids } }, include: { player: { select: { name: true, slug: true } } } });
  const teamOf = new Map<number, { code: string | null; slug: string }>();
  for (const g of games) { teamOf.set(g.homeTeamId, { code: g.homeTeam.code, slug: g.homeTeam.slug }); teamOf.set(g.awayTeamId, { code: g.awayTeam.code, slug: g.awayTeam.slug }); }
  const topSk = [...skaters].sort((a, b) => b.points - a.points || b.goals - a.goals || b.shots - a.shots)[0];
  const playerOfNight: NightPlayer | null = topSk ? {
    name: cleanName(topSk.player.name), slug: topSk.player.slug, team: teamOf.get(topSk.teamId)?.code ?? null, teamSlug: teamOf.get(topSk.teamId)?.slug ?? null,
    line: `${topSk.goals}G ${topSk.assists}A${topSk.points ? ` — ${topSk.points} point${topSk.points === 1 ? "" : "s"}` : ""}`,
  } : null;

  // BEST GOALIE: top GSAx (xga - GA) among starters with a real workload.
  const goalies = await prisma.goalieGameStat.findMany({ where: { gameId: { in: gids }, started: true, shotsAgainst: { gte: 15 } }, include: { player: { select: { name: true, slug: true } } } });
  const bg = [...goalies].sort((a, b) => (b.xga - b.goalsAgainst) - (a.xga - a.goalsAgainst))[0];
  const bestGoalie: NightPlayer | null = bg ? {
    name: cleanName(bg.player.name), slug: bg.player.slug, team: teamOf.get(bg.teamId)?.code ?? null, teamSlug: teamOf.get(bg.teamId)?.slug ?? null,
    line: `${bg.saves}/${bg.shotsAgainst} · ${((bg.saves / Math.max(1, bg.shotsAgainst)) * 100).toFixed(1)}% · ${(bg.xga - bg.goalsAgainst >= 0 ? "+" : "")}${(bg.xga - bg.goalsAgainst).toFixed(1)} GSAx`,
  } : null;

  // INJURIES + BIGGEST HIT (a hit that hurt someone — the most days lost).
  const injEvents = await prisma.gameEvent.findMany({ where: { gameId: { in: gids }, type: "INJURY" }, orderBy: { id: "asc" } });
  const injIds = [...new Set(injEvents.flatMap((e) => [e.playerId, e.targetId]).filter((x): x is number => x != null))];
  const injPlayers = injIds.length ? await prisma.player.findMany({ where: { id: { in: injIds } }, select: { id: true, name: true, slug: true } }) : [];
  const nm = new Map(injPlayers.map((p) => [p.id, cleanName(p.name)]));
  const sl = new Map(injPlayers.map((p) => [p.id, p.slug]));
  const injuries: NightInjury[] = injEvents.map((e) => {
    const m = (e.meta ?? {}) as { part?: string; mechanism?: string; severity?: string; days?: number };
    return { name: e.playerId != null ? (nm.get(e.playerId) ?? "—") : "—", slug: e.playerId != null ? (sl.get(e.playerId) ?? null) : null, team: e.teamId != null ? (teamOf.get(e.teamId)?.code ?? null) : null, part: m.part ?? "Injury", mechanism: m.mechanism ?? "—", severity: m.severity ?? "—", days: m.days ?? 0, byName: e.targetId != null ? (nm.get(e.targetId) ?? null) : null };
  });
  const hitInj = injEvents.filter((e) => (e.meta as { mechanism?: string })?.mechanism === "Hit" && e.targetId != null)
    .sort((a, b) => (((b.meta as { days?: number })?.days ?? 0) - ((a.meta as { days?: number })?.days ?? 0)))[0];
  const biggestHit = hitInj ? {
    hitter: hitInj.targetId != null ? (nm.get(hitInj.targetId) ?? "—") : "—", hitterSlug: hitInj.targetId != null ? (sl.get(hitInj.targetId) ?? null) : null,
    victim: hitInj.playerId != null ? (nm.get(hitInj.playerId) ?? "—") : "—", victimSlug: hitInj.playerId != null ? (sl.get(hitInj.playerId) ?? null) : null,
    team: null, note: `left ${hitInj.playerId != null ? nm.get(hitInj.playerId) : "a player"} with a ${(hitInj.meta as { part?: string })?.part ?? "injury"}`,
  } : null;

  return { season, round, date: date ? date.toISOString() : null, gameCount: games.length, scores, gameOfNight, playerOfNight, upset, bestGoalie, biggestHit, injuries };
}
