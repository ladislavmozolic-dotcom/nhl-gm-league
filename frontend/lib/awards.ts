import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/sim/standings";
import { skaterTotals, goalieTotals } from "@/lib/stats-server";
import { getBracket } from "@/lib/sim/playoffs";
import { PRE_SEASON } from "@/lib/phase";

export type AwardRow = { category: string; playerId?: number; playerName?: string; teamId?: number; detail?: string };
export type SeasonAwards = {
  championTeamId: number | null;
  runnerUpTeamId: number | null;
  presidentsTeamId: number | null;
  awards: AwardRow[];
};

export type Finalist = { playerId?: number; playerName?: string; teamId?: number; detail: string };
export type AwardFinalists = { category: string; finalists: Finalist[] };
export type SeasonFinalists = {
  championTeamId: number | null;
  runnerUpTeamId: number | null;
  presidentsTeamId: number | null;
  categories: AwardFinalists[];
};

const isDef = (pos = "") => pos.includes("D") && !(pos.includes("C") || pos.includes("W") || pos.includes("F"));
const isFwd = (pos = "") => !isDef(pos) && pos !== "G" && pos !== "—";
const TOP = 3;

/**
 * Rank every award category, keeping the top few candidates (finalists) per
 * trophy. The winner of each award is simply `finalists[0]`, so this is the
 * single source of truth for both the archiver and the ceremony page.
 */
export async function computeSeasonFinalists(season: string, league = "NHL"): Promise<SeasonFinalists> {
  const [standings, skaters, goalies, poSkaters, bracket] = await Promise.all([
    computeStandings(season, league),
    skaterTotals(season, league),
    goalieTotals(season, league),
    skaterTotals(season, league, true), // playoffs
    getBracket(season, league).catch(() => []),
  ]);

  const presidentsTeamId = standings[0]?.teamId ?? null;

  const final = bracket.find((s: any) => s.round === 4 && s.status === "DONE") as any;
  let championTeamId: number | null = null, runnerUpTeamId: number | null = null;
  if (final) {
    championTeamId = final.winnerTeamId ?? null;
    runnerUpTeamId = final.high?.id === championTeamId ? final.low?.id ?? null : final.high?.id ?? null;
  }

  type S = (typeof skaters)[number];
  type G = (typeof goalies)[number];
  const skaterFinalist = (s: S, detail: string): Finalist => ({ playerId: s.playerId, playerName: s.name, teamId: s.teamId ?? undefined, detail });
  const goalieFinalist = (g: G, detail: string): Finalist => ({ playerId: g.playerId, playerName: g.name, teamId: g.teamId ?? undefined, detail });

  const byPoints = [...skaters].sort((a, b) => b.points - a.points || b.goals - a.goals);
  const byGoals = [...skaters].sort((a, b) => b.goals - a.goals);

  const categories: AwardFinalists[] = [];
  const push = (category: string, finalists: Finalist[]) => { if (finalists.length) categories.push({ category, finalists }); };

  push("Hart", byPoints.slice(0, TOP).map((s) => skaterFinalist(s, `${s.points} pts`))); // MVP ≈ scoring leader
  push("Art Ross", byPoints.slice(0, TOP).map((s) => skaterFinalist(s, `${s.points} pts`)));
  push("Rocket Richard", byGoals.slice(0, TOP).map((s) => skaterFinalist(s, `${s.goals} G`)));
  push("Norris", byPoints.filter((s) => isDef(s.position)).slice(0, TOP).map((s) => skaterFinalist(s, `${s.points} pts`)));

  // Vezina: best SV% among genuine starters. gp is meaningless (every roster
  // goalie gets a row per game), so gate on shots faced — a workhorse sees ~2000+.
  const workhorses = goalies.filter((g) => g.shotsAgainst >= 1500);
  const vezPool = [...(workhorses.length ? workhorses : goalies)].sort((a, b) => b.svPct - a.svPct || a.gaa - b.gaa);
  push("Vezina", vezPool.slice(0, TOP).map((g) => goalieFinalist(g, `${(g.svPct * 100).toFixed(1)}% SV%, ${g.gaa.toFixed(2)} GAA`)));

  push("Calder", byPoints.filter((s) => s.rookie).slice(0, TOP).map((s) => skaterFinalist(s, `${s.points} pts`)));

  // Selke: best defensive forward — a two-way score with a scoring floor.
  const selkeScore = (s: S) => s.plusMinus * 2 + s.shGoals * 4 + s.blocks * 0.5 + s.hits * 0.25 + s.points * 0.15;
  const selke = skaters.filter((s) => isFwd(s.position) && s.points >= 25).sort((a, b) => selkeScore(b) - selkeScore(a));
  push("Selke", selke.slice(0, TOP).map((s) => skaterFinalist(s, `+${s.plusMinus}, ${s.shGoals} SHG, ${s.blocks} BLK`)));

  // Lady Byng: skill + sportsmanship — genuine scorers (>= 40 pts), fewest PIM.
  const byng = skaters.filter((s) => s.points >= 40).sort((a, b) => a.pim - b.pim || b.points - a.points);
  push("Lady Byng", byng.slice(0, TOP).map((s) => skaterFinalist(s, `${s.points} pts, ${s.pim} PIM`)));

  // Conn Smythe: playoff scoring leader (skaters).
  const smythe = [...poSkaters].filter((s) => s.gp > 0).sort((a, b) => b.points - a.points || b.goals - a.goals);
  push("Conn Smythe", smythe.slice(0, TOP).map((s) => skaterFinalist(s, `${s.points} pts (${s.gp} GP)`)));

  // Jack Adams: coach of the best regular-season teams.
  const topTeamIds = standings.slice(0, TOP).map((s) => s.teamId);
  if (topTeamIds.length) {
    const teams = await prisma.team.findMany({ where: { id: { in: topTeamIds } }, select: { id: true, coach: true } });
    const coachOf = new Map(teams.map((t) => [t.id, t.coach]));
    const jackAdams: Finalist[] = standings.slice(0, TOP)
      .filter((s) => coachOf.get(s.teamId))
      .map((s, i) => ({ playerName: coachOf.get(s.teamId)!, teamId: s.teamId, detail: i === 0 ? "Best record" : `${s.points} pts` }));
    push("Jack Adams", jackAdams);
  }

  return { championTeamId, runnerUpTeamId, presidentsTeamId, categories };
}

/** Compute all end-of-season award WINNERS (finalists[0]) for a season/league. */
export async function computeSeasonAwards(season: string, league = "NHL"): Promise<SeasonAwards> {
  const f = await computeSeasonFinalists(season, league);
  const awards: AwardRow[] = f.categories.map((c) => {
    const w = c.finalists[0];
    return { category: c.category, playerId: w.playerId, playerName: w.playerName, teamId: w.teamId, detail: w.detail };
  });
  return { championTeamId: f.championTeamId, runnerUpTeamId: f.runnerUpTeamId, presidentsTeamId: f.presidentsTeamId, awards };
}

/** Snapshot whatever pre-season data currently exists (NHL only — pre-season has no
 *  AHL slate) into a durable per-year record, since the pre-season Game rows
 *  themselves live under one fixed season string and get wiped by next year's
 *  Off-season cascade. Best-effort: silently no-ops if nothing was ever generated. */
async function archivePreseasonSnapshot(season: string, league: string) {
  if (league !== "NHL") return;
  const games = await prisma.game.count({ where: { season: PRE_SEASON, status: "FINAL" } });
  if (!games) return;
  const [standings, scorers] = await Promise.all([
    computeStandings(PRE_SEASON, league).catch(() => []),
    skaterTotals(PRE_SEASON, league).catch(() => []),
  ]);
  const bestTeamId = standings[0]?.teamId ?? null;
  const top = [...scorers].sort((a, b) => b.points - a.points || b.goals - a.goals)[0];
  await prisma.seasonPreseasonRecord.upsert({
    where: { season_league: { season, league } },
    update: { gamesPlayed: games, bestTeamId, topScorerId: top?.playerId ?? null, topScorerName: top?.name ?? null, topScorerPoints: top?.points ?? null },
    create: { season, league, gamesPlayed: games, bestTeamId, topScorerId: top?.playerId ?? null, topScorerName: top?.name ?? null, topScorerPoints: top?.points ?? null },
  });
}

/** Persist a season's awards + record. Replaces any existing entry for that season/league. */
export async function archiveSeason(season: string, league = "NHL") {
  const a = await computeSeasonAwards(season, league);
  await prisma.$transaction([
    prisma.seasonAward.deleteMany({ where: { season, league } }),
    prisma.seasonRecord.upsert({
      where: { season_league: { season, league } },
      update: { championTeamId: a.championTeamId, runnerUpTeamId: a.runnerUpTeamId, presidentsTeamId: a.presidentsTeamId },
      create: { season, league, championTeamId: a.championTeamId, runnerUpTeamId: a.runnerUpTeamId, presidentsTeamId: a.presidentsTeamId },
    }),
    prisma.seasonAward.createMany({
      data: a.awards.map((w) => ({ season, league, category: w.category, playerId: w.playerId, playerName: w.playerName, teamId: w.teamId, detail: w.detail })),
    }),
  ]);
  // Freeze the per-season stat archive (careers + franchise history) before any
  // reset wipes the per-game rows. Best-effort — never block the award archive.
  try {
    const { archiveSeasonStats } = await import("./career-server");
    await archiveSeasonStats(season, league);
  } catch (e) {
    console.error("[archiveSeason] archiveSeasonStats failed:", e);
  }
  // Best-effort, same reasoning: capture pre-season before it's overwritten.
  try {
    await archivePreseasonSnapshot(season, league);
  } catch (e) {
    console.error("[archiveSeason] archivePreseasonSnapshot failed:", e);
  }
  return a;
}
