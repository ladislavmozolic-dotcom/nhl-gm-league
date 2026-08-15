// Hall of Fame — a résumé score from a player's LEAGUE career (career production,
// hardware, cups, longevity, peak). Retired players above the bar are inducted;
// active players are ranked on a "Hall of Fame Watch" so you can see who's tracking.
// Careers accumulate through the durable archive ([[career-server]]), so the Hall
// fills in as the league plays on and today's stars age out.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";
import { ACTIVE_SEASON } from "./career-server";

export const HOF_THRESHOLD = 320; // résumé score needed for induction

const AWARD_WEIGHT: Record<string, number> = {
  Hart: 60, "Ted Lindsay": 40, "Art Ross": 40, "Rocket Richard": 30, Norris: 45,
  Vezina: 60, Selke: 25, "Lady Byng": 10, "Conn Smythe": 50, Calder: 15,
  "Jack Adams": 0, "GM of the Year": 0, Presidents: 0,
};

export type Resume = {
  playerId: number; name: string; slug: string | null; position: string; isGoalie: boolean;
  retired: boolean; retiredSeason: string | null; hofSeason: string | null; teamCode: string | null; teamSlug: string | null;
  seasons: number; gp: number; goals: number; assists: number; points: number; peakPoints: number; // skater
  wins: number; shutouts: number; svPct: number; // goalie
  cups: number; awards: { category: string; count: number }[]; awardCount: number;
  score: number;
};

// Batch résumé for a set of players (default: all NHL + retired). Career = archived
// per-season rows for finished seasons + the live ACTIVE season, so it's always fresh.
export async function computeResumes(where?: { retiredOnly?: boolean }): Promise<Resume[]> {
  const players = await prisma.player.findMany({
    where: where?.retiredOnly ? { rosterType: "RETIRED" } : { rosterType: { in: ["NHL", "AHL", "RETIRED"] } },
    select: { id: true, name: true, slug: true, position: true, rosterType: true, retiredSeason: true, hofSeason: true, teamId: true, team: { select: { code: true, name: true, slug: true } } },
  });
  const ids = players.map((p) => p.id);
  if (!ids.length) return [];
  const idSet = new Set(ids);

  // archived skater seasons (finished seasons only; active comes from live)
  const archSk = await prisma.playerSeasonStat.findMany({ where: { playerId: { in: ids }, isPlayoff: false, season: { not: ACTIVE_SEASON } }, select: { playerId: true, season: true, teamId: true, gp: true, goals: true, assists: true, points: true } });
  const archGl = await prisma.goalieSeasonStat.findMany({ where: { playerId: { in: ids }, isPlayoff: false, season: { not: ACTIVE_SEASON } }, select: { playerId: true, season: true, teamId: true, gp: true, wins: true, shutouts: true, shotsAgainst: true, saves: true } });

  // live active season (regular season)
  const liveGameIds = (await prisma.game.findMany({ where: { season: ACTIVE_SEASON, league: "NHL", status: "FINAL", seriesId: null }, select: { id: true } })).map((g) => g.id);
  const liveSk = liveGameIds.length ? await prisma.playerGameStat.groupBy({ by: ["playerId", "teamId"], where: { playerId: { in: ids }, gameId: { in: liveGameIds } }, _sum: { goals: true, assists: true, points: true }, _count: { _all: true } }) : [];
  const liveGlRows = liveGameIds.length ? await prisma.goalieGameStat.findMany({ where: { playerId: { in: ids }, started: true, gameId: { in: liveGameIds } }, select: { playerId: true, teamId: true, decision: true, goalsAgainst: true, shotsAgainst: true, saves: true } }) : [];

  // awards per player
  const awards = await prisma.seasonAward.findMany({ where: { OR: [{ playerId: { in: ids } }] }, select: { playerId: true, category: true, season: true, teamId: true } });

  // cup champions per season → the roster that season (approx: had a season-stat row for the champion team)
  const champs = await prisma.seasonRecord.findMany({ where: { championTeamId: { not: null } }, select: { season: true, championTeamId: true } });

  type Acc = { seasons: Set<string>; gp: number; g: number; a: number; p: number; peak: number; wins: number; so: number; sa: number; sv: number; cups: number; awardCats: Map<string, number>; teamThisSeason: Map<string, number> };
  const acc = new Map<number, Acc>();
  const mk = (id: number) => { let x = acc.get(id); if (!x) { x = { seasons: new Set(), gp: 0, g: 0, a: 0, p: 0, peak: 0, wins: 0, so: 0, sa: 0, sv: 0, cups: 0, awardCats: new Map(), teamThisSeason: new Map() }; acc.set(id, x); } return x; };

  for (const r of archSk) { if (!idSet.has(r.playerId)) continue; const x = mk(r.playerId); x.seasons.add(r.season); x.gp += r.gp; x.g += r.goals; x.a += r.assists; x.p += r.points; x.peak = Math.max(x.peak, r.points); x.teamThisSeason.set(r.season, r.teamId); }
  for (const r of archGl) { if (!idSet.has(r.playerId)) continue; const x = mk(r.playerId); x.seasons.add(r.season); x.gp += r.gp; x.wins += r.wins; x.so += r.shutouts; x.sa += r.shotsAgainst; x.sv += r.saves; x.teamThisSeason.set(r.season, r.teamId); }
  for (const r of liveSk) { const x = mk(r.playerId); x.seasons.add(ACTIVE_SEASON); x.gp += r._count._all; x.g += r._sum.goals ?? 0; x.a += r._sum.assists ?? 0; x.p += r._sum.points ?? 0; x.peak = Math.max(x.peak, r._sum.points ?? 0); x.teamThisSeason.set(ACTIVE_SEASON, r.teamId); }
  const glLive = new Map<number, { teamId: number }>();
  for (const r of liveGlRows) { const x = mk(r.playerId); x.seasons.add(ACTIVE_SEASON); x.sa += r.shotsAgainst; x.sv += r.saves; if (r.decision === "W") x.wins++; if (r.goalsAgainst === 0) x.so++; glLive.set(r.playerId, { teamId: r.teamId }); x.teamThisSeason.set(ACTIVE_SEASON, r.teamId); }
  // live goalie GP = distinct games started; approximate via decisions+others → count rows per player
  const glGp = new Map<number, number>();
  for (const r of liveGlRows) glGp.set(r.playerId, (glGp.get(r.playerId) ?? 0) + 1);
  for (const [id, gp] of glGp) { const x = acc.get(id); if (x) x.gp += gp; }

  for (const a of awards) { if (a.playerId == null || !idSet.has(a.playerId)) continue; const x = mk(a.playerId); x.awardCats.set(a.category, (x.awardCats.get(a.category) ?? 0) + 1); }

  // cups: a player earns a ring for a champion season if their team that season == the champion team
  const champBySeason = new Map<string, number>(); for (const c of champs) if (c.championTeamId != null) champBySeason.set(c.season, c.championTeamId);
  for (const [id, x] of acc) { for (const [season, teamId] of x.teamThisSeason) { if (champBySeason.get(season) === teamId) x.cups++; } }

  const out: Resume[] = [];
  for (const p of players) {
    const x = acc.get(p.id); if (!x) continue;
    const isGoalie = p.position === "G";
    const awardsArr = [...x.awardCats.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => (AWARD_WEIGHT[b.category] ?? 20) - (AWARD_WEIGHT[a.category] ?? 20));
    const awardPts = awardsArr.reduce((t, a) => t + (AWARD_WEIGHT[a.category] ?? 20) * a.count, 0);
    const svPct = x.sa ? x.sv / x.sa : 0;
    const score = isGoalie
      ? Math.round(2 * x.wins + 6 * x.so + awardPts + 40 * x.cups + 5 * x.seasons.size)
      : Math.round(x.p + awardPts + 40 * x.cups + 5 * x.seasons.size + 0.5 * x.peak);
    out.push({
      playerId: p.id, name: cleanName(p.name), slug: p.slug, position: p.position, isGoalie,
      retired: p.rosterType === "RETIRED", retiredSeason: p.retiredSeason, hofSeason: p.hofSeason,
      teamCode: p.team?.code ?? p.team?.name ?? null, teamSlug: p.team?.slug ?? null,
      seasons: x.seasons.size, gp: x.gp, goals: x.g, assists: x.a, points: x.p, peakPoints: x.peak,
      wins: x.wins, shutouts: x.so, svPct, cups: x.cups, awards: awardsArr, awardCount: awardsArr.reduce((t, a) => t + a.count, 0), score,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

export type HallOfFame = { inducted: Resume[]; watch: Resume[]; threshold: number };

export async function hallOfFame(): Promise<HallOfFame> {
  const all = await computeResumes();
  const inducted = all.filter((r) => r.retired && (r.hofSeason != null || r.score >= HOF_THRESHOLD)).sort((a, b) => b.score - a.score);
  const inductedIds = new Set(inducted.map((r) => r.playerId));
  const watch = all.filter((r) => !r.retired && !inductedIds.has(r.playerId)).slice(0, 24);
  return { inducted, watch, threshold: HOF_THRESHOLD };
}

// ---- retirement (offseason) ----

const RETIRE_PROB: Record<number, number> = { 38: 0.12, 39: 0.3, 40: 0.55, 41: 0.8 };
function retireChance(age: number, overall: number): number {
  if (age >= 42) return 1;
  let base = RETIRE_PROB[age] ?? (age > 42 ? 1 : 0);
  if (overall >= 86) base *= 0.4;      // stars hang on
  else if (overall >= 80) base *= 0.7;
  return Math.min(1, base);
}

// Retire aging players at season's end. Marks rosterType=RETIRED + retiredSeason,
// then inducts any newly-retired player whose résumé clears the bar. Best-effort,
// idempotent-ish (won't touch already-RETIRED players).
export async function runRetirements(season: string): Promise<{ retired: { name: string; age: number }[]; inducted: string[] }> {
  const candidates = await prisma.player.findMany({ where: { rosterType: { in: ["NHL", "AHL"] }, age: { gte: 38 } }, select: { id: true, name: true, age: true, overall: true } });
  const retiring: number[] = [];
  const retired: { name: string; age: number }[] = [];
  for (const p of candidates) {
    const age = p.age ?? 38;
    if (Math.random() < retireChance(age, p.overall ?? 70)) { retiring.push(p.id); retired.push({ name: cleanName(p.name), age }); }
  }
  if (retiring.length) {
    await prisma.player.updateMany({ where: { id: { in: retiring } }, data: { rosterType: "RETIRED", retiredSeason: season } });
  }
  // induct newly-eligible retirees
  const resumes = await computeResumes({ retiredOnly: true });
  const toInduct = resumes.filter((r) => r.hofSeason == null && r.score >= HOF_THRESHOLD);
  if (toInduct.length) {
    await prisma.player.updateMany({ where: { id: { in: toInduct.map((r) => r.playerId) } }, data: { hofSeason: season } });
  }
  return { retired, inducted: toInduct.map((r) => r.name) };
}
