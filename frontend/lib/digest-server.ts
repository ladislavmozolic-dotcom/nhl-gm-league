// "Living League" — the nightly digest. For one sim day it auto-generates the
// storylines from that day's games + event stream: Game / Player / Upset of the
// Night, best goalie, biggest hit, injury report. All from OUR league's data.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";
import { computeStandings } from "./sim/standings";
import { recordThresholds } from "./records-server";

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
  hottest: { code: string | null; slug: string | null; name: string; streakLen: number; last10: string } | null;
  coldest: { code: string | null; slug: string | null; name: string; streakLen: number; last10: string } | null;
  powerRanking: { rank: number; code: string | null; slug: string | null; points: number; gp: number; streakType: "W" | "L" | "OT" | null; streakLen: number }[];
  recordAlerts: string[]; // "LEAGUE RECORD" feats set/tied this night
  milestones: string[];   // career round-number milestones reached this night
};

export type TeamForm = {
  teamId: number; code: string | null; name: string; slug: string | null;
  points: number; gp: number; last10: string; // "7-2-1"
  streakType: "W" | "L" | "OT" | null; streakLen: number; // active streak
};

/** Per-team form up to and including `round`: active streak + last-10 record. */
export async function leagueForm(season: string, round: number, league = "NHL"): Promise<TeamForm[]> {
  const teams = await prisma.team.findMany({ where: { league }, select: { id: true, name: true, code: true, slug: true } });
  const games = await prisma.game.findMany({
    where: { season, league, status: "FINAL", seriesId: null, round: { lte: round } },
    select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, endedIn: true, round: true, id: true },
    orderBy: [{ round: "asc" }, { id: "asc" }],
  });
  // per-team chronological result list: "W" | "L" | "OT" (OT/SO loss)
  const seq = new Map<number, ("W" | "L" | "OT")[]>();
  const pts = new Map<number, number>();
  for (const t of teams) { seq.set(t.id, []); pts.set(t.id, 0); }
  for (const g of games) {
    const hg = g.homeGoals ?? 0, ag = g.awayGoals ?? 0;
    const homeWon = hg > ag;
    const otl = g.endedIn !== "REG";
    const home = seq.get(g.homeTeamId), away = seq.get(g.awayTeamId);
    if (home) { home.push(homeWon ? "W" : otl ? "OT" : "L"); pts.set(g.homeTeamId, (pts.get(g.homeTeamId) ?? 0) + (homeWon ? 2 : otl ? 1 : 0)); }
    if (away) { away.push(!homeWon ? "W" : otl ? "OT" : "L"); pts.set(g.awayTeamId, (pts.get(g.awayTeamId) ?? 0) + (!homeWon ? 2 : otl ? 1 : 0)); }
  }
  return teams.map((t) => {
    const s = seq.get(t.id) ?? [];
    const last10 = s.slice(-10);
    const w = last10.filter((r) => r === "W").length, l = last10.filter((r) => r === "L").length, o = last10.filter((r) => r === "OT").length;
    // active streak: walk from the end. A win streak breaks on any non-win;
    // a skid counts consecutive non-wins (regulation or OT losses).
    let streakType: "W" | "L" | "OT" | null = null, streakLen = 0;
    if (s.length) {
      const last = s[s.length - 1];
      if (last === "W") { streakType = "W"; for (let i = s.length - 1; i >= 0 && s[i] === "W"; i--) streakLen++; }
      else { streakType = "L"; for (let i = s.length - 1; i >= 0 && s[i] !== "W"; i--) streakLen++; }
    }
    return { teamId: t.id, code: t.code, name: t.name, slug: t.slug, points: pts.get(t.id) ?? 0, gp: s.length, last10: `${w}-${l}-${o}`, streakType, streakLen };
  });
}

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
    return { season, round, date: null, gameCount: 0, scores: [], gameOfNight: null, playerOfNight: null, upset: null, bestGoalie: null, biggestHit: null, injuries: [], hottest: null, coldest: null, powerRanking: [], recordAlerts: [], milestones: [] };
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

  // STREAKS + POWER RANKING — the league's shape up to this night.
  const form = await leagueForm(season, round);
  const hotCand = form.filter((f) => f.streakType === "W" && f.streakLen >= 3).sort((a, b) => b.streakLen - a.streakLen)[0];
  const coldCand = form.filter((f) => f.streakType === "L" && f.streakLen >= 3).sort((a, b) => b.streakLen - a.streakLen)[0];
  const hottest = hotCand ? { code: hotCand.code, slug: hotCand.slug, name: hotCand.name, streakLen: hotCand.streakLen, last10: hotCand.last10 } : null;
  const coldest = coldCand ? { code: coldCand.code, slug: coldCand.slug, name: coldCand.name, streakLen: coldCand.streakLen, last10: coldCand.last10 } : null;
  const powerRanking = [...form]
    .sort((a, b) => (b.points / Math.max(1, b.gp)) - (a.points / Math.max(1, a.gp)) || b.points - a.points)
    .slice(0, 5)
    .map((f, i) => ({ rank: i + 1, code: f.code, slug: f.slug, points: f.points, gp: f.gp, streakType: f.streakType, streakLen: f.streakLen }));

  // LEAGUE RECORD alerts — a feat this night that equals the all-time single-game
  // maximum (records include tonight's games, so equalling the max = holds/ties it).
  const recordAlerts: string[] = [];
  try {
    const thr = await recordThresholds();
    for (const s of skaters) {
      if (thr.points > 0 && s.points === thr.points) recordAlerts.push(`\u{1F4E2} ${cleanName(s.player.name)} tied the league record with ${s.points} points`);
      else if (thr.goals > 0 && s.goals === thr.goals) recordAlerts.push(`\u{1F4E2} ${cleanName(s.player.name)} tied the league record with ${s.goals} goals`);
    }
    for (const gl of goalies) {
      if (thr.saves > 0 && gl.saves === thr.saves) recordAlerts.push(`\u{1F4E2} ${cleanName(gl.player.name)} tied the league record with ${gl.saves} saves`);
    }
    for (const g of games) {
      const mx = Math.max(g.homeGoals ?? 0, g.awayGoals ?? 0);
      if (thr.teamGoals > 0 && mx === thr.teamGoals) {
        const t = (g.homeGoals ?? 0) >= (g.awayGoals ?? 0) ? g.homeTeam : g.awayTeam;
        recordAlerts.push(`\u{1F4E2} ${t.code ?? t.name} tied the league record with ${mx} goals in a game`);
      }
    }
  } catch { /* records unavailable — skip alerts */ }
  const uniqueAlerts = [...new Set(recordAlerts)].slice(0, 6);

  // CAREER MILESTONES — a player who crossed a round-number career total tonight.
  // Career-through = every FINAL NHL game in a prior season, or this season up to
  // this round; "before" = through minus tonight's line. A threshold that falls in
  // (before, through] was reached tonight.
  const milestones: string[] = [];
  const nightIds = [...new Set(skaters.map((s) => s.playerId))];
  if (nightIds.length) {
    const through = await prisma.playerGameStat.groupBy({
      by: ["playerId"],
      where: {
        playerId: { in: nightIds },
        game: { league: "NHL", status: "FINAL", seriesId: null, OR: [{ season: { lt: season } }, { season, round: { lte: round } }] },
      },
      _sum: { points: true, goals: true, assists: true }, _count: { _all: true },
    });
    const nightGain = new Map<number, { pts: number; g: number; a: number }>();
    for (const s of skaters) { const c = nightGain.get(s.playerId) ?? { pts: 0, g: 0, a: 0 }; c.pts += s.points; c.g += s.goals; c.a += s.assists; nightGain.set(s.playerId, c); }
    const nmById = new Map((await prisma.player.findMany({ where: { id: { in: nightIds } }, select: { id: true, name: true } })).map((p) => [p.id, cleanName(p.name)]));
    const crossed = (before: number, after: number, steps: number[]) => steps.find((t) => before < t && after >= t) ?? null;
    const PTS = [50, 100, 150, 200, 300, 400, 500, 750, 1000], GOALS = [25, 50, 100, 150, 200, 300, 400, 500], GP = [100, 200, 300, 500, 750, 1000];
    for (const t of through) {
      const gain = nightGain.get(t.playerId) ?? { pts: 0, g: 0, a: 0 };
      const nm = nmById.get(t.playerId) ?? "A player";
      const pTot = t._sum.points ?? 0, gTot = t._sum.goals ?? 0, gpTot = t._count._all;
      const mp = crossed(pTot - gain.pts, pTot, PTS); if (mp) milestones.push(`\u{1F31F} ${nm} reached ${mp} career points`);
      const mg = crossed(gTot - gain.g, gTot, GOALS); if (mg) milestones.push(`\u{1F3D2} ${nm} reached ${mg} career goals`);
      const mgp = crossed(gpTot - 1, gpTot, GP); if (mgp) milestones.push(`\u{1F4C6} ${nm} played career game #${mgp}`);
    }
  }
  const uniqueMilestones = [...new Set(milestones)].slice(0, 8);

  return { season, round, date: date ? date.toISOString() : null, gameCount: games.length, scores, gameOfNight, playerOfNight, upset, bestGoalie, biggestHit, injuries, hottest, coldest, powerRanking, recordAlerts: uniqueAlerts, milestones: uniqueMilestones };
}
