// League Records — the all-time record book, computed from every FINAL game in
// the database. Single-game feats (player / goalie / team), season bests, and the
// longest team win streak. This is also the source the engine checks against for
// an in-game "LEAGUE RECORD" alert (see recordThresholds).

import { prisma } from "./prisma";
import { cleanName } from "./playerName";
import { computeStandings } from "./sim/standings";

export type RecordHolder = {
  value: number;
  who: string;            // player or team name
  slug: string | null;
  team: string | null;    // team code (for player records)
  teamSlug: string | null;
  season: string | null;
  gameId: number | null;  // for single-game records → link to the box score
  detail: string | null;  // extra context ("in a 7-2 win", "vs BOS")
};

export type RecordRow = { key: string; label: string; unit: string; holder: RecordHolder | null };
export type RecordGroup = { title: string; icon: string; rows: RecordRow[] };

const teamCodeName = (t: { code: string | null; name: string }) => t.code ?? t.name;

// Top single-game player stat line for a given field.
async function topPlayerGame(field: "points" | "goals" | "assists" | "shots" | "hits" | "pim"): Promise<RecordHolder | null> {
  const row = await prisma.playerGameStat.findFirst({
    where: { game: { status: "FINAL", league: "NHL" }, [field]: { gt: 0 } },
    orderBy: [{ [field]: "desc" }, { points: "desc" }],
    include: {
      player: { select: { name: true, slug: true } },
      game: { select: { id: true, season: true, homeGoals: true, awayGoals: true, homeTeamId: true, awayTeamId: true, homeTeam: { select: { code: true, name: true, slug: true } }, awayTeam: { select: { code: true, name: true, slug: true } } } },
    },
  });
  if (!row) return null;
  const isHome = row.teamId === row.game.homeTeamId;
  const myTeam = isHome ? row.game.homeTeam : row.game.awayTeam;
  const oppTeam = isHome ? row.game.awayTeam : row.game.homeTeam;
  const my = isHome ? row.game.homeGoals : row.game.awayGoals;
  const opp = isHome ? row.game.awayGoals : row.game.homeGoals;
  return {
    value: row[field] as number, who: cleanName(row.player.name), slug: row.player.slug,
    team: teamCodeName(myTeam), teamSlug: myTeam.slug, season: row.game.season, gameId: row.game.id,
    detail: `vs ${teamCodeName(oppTeam)} (${my}–${opp})`,
  };
}

// Top single-game goalie feat: most saves in a win / a shutout with most saves.
async function topGoalieGame(mode: "saves" | "shutout"): Promise<RecordHolder | null> {
  const row = await prisma.goalieGameStat.findFirst({
    where: { game: { status: "FINAL", league: "NHL" }, started: true, ...(mode === "shutout" ? { goalsAgainst: 0, shotsAgainst: { gte: 15 } } : { saves: { gt: 0 } }) },
    orderBy: [{ saves: "desc" }],
    include: {
      player: { select: { name: true, slug: true } },
      game: { select: { id: true, season: true, homeTeamId: true, homeTeam: { select: { code: true, name: true, slug: true } }, awayTeam: { select: { code: true, name: true, slug: true } } } },
    },
  });
  if (!row) return null;
  const isHome = row.teamId === row.game.homeTeamId;
  const myTeam = isHome ? row.game.homeTeam : row.game.awayTeam;
  const oppTeam = isHome ? row.game.awayTeam : row.game.homeTeam;
  return {
    value: row.saves, who: cleanName(row.player.name), slug: row.player.slug,
    team: teamCodeName(myTeam), teamSlug: myTeam.slug, season: row.game.season, gameId: row.game.id,
    detail: `${row.saves}/${row.shotsAgainst} vs ${teamCodeName(oppTeam)}`,
  };
}

// Team single-game records: most goals by one team, biggest win margin.
async function topTeamGame(mode: "goals" | "margin"): Promise<RecordHolder | null> {
  const games = await prisma.game.findMany({
    where: { status: "FINAL", league: "NHL", seriesId: null },
    select: { id: true, season: true, homeGoals: true, awayGoals: true, homeTeam: { select: { code: true, name: true, slug: true } }, awayTeam: { select: { code: true, name: true, slug: true } } },
  });
  let best: RecordHolder | null = null;
  for (const g of games) {
    const hg = g.homeGoals ?? 0, ag = g.awayGoals ?? 0;
    const candidates = mode === "goals"
      ? [{ v: hg, win: g.homeTeam, lose: g.awayTeam, gf: hg, ga: ag }, { v: ag, win: g.awayTeam, lose: g.homeTeam, gf: ag, ga: hg }]
      : [{ v: Math.abs(hg - ag), win: hg >= ag ? g.homeTeam : g.awayTeam, lose: hg >= ag ? g.awayTeam : g.homeTeam, gf: Math.max(hg, ag), ga: Math.min(hg, ag) }];
    for (const c of candidates) {
      if (!best || c.v > best.value) {
        best = { value: c.v, who: c.win.name, slug: c.win.slug, team: teamCodeName(c.win), teamSlug: c.win.slug, season: g.season, gameId: g.id, detail: `${c.gf}–${c.ga} vs ${teamCodeName(c.lose)}` };
      }
    }
  }
  return best;
}

// Season bests across every season present: player points/goals, team wins/points.
async function seasonBests(): Promise<{ playerPoints: RecordHolder | null; playerGoals: RecordHolder | null; teamWins: RecordHolder | null; teamPoints: RecordHolder | null; longestStreak: RecordHolder | null }> {
  const seasons = (await prisma.game.findMany({ where: { status: "FINAL", league: "NHL", seriesId: null }, distinct: ["season"], select: { season: true } })).map((s) => s.season);
  let playerPoints: RecordHolder | null = null, playerGoals: RecordHolder | null = null;
  let teamWins: RecordHolder | null = null, teamPoints: RecordHolder | null = null, longestStreak: RecordHolder | null = null;

  for (const season of seasons) {
    // player season totals (regular season) — aggregate PlayerGameStat over the season's games
    const gameIds = (await prisma.game.findMany({ where: { season, league: "NHL", status: "FINAL", seriesId: null }, select: { id: true } })).map((g) => g.id);
    if (gameIds.length) {
      const grouped = await prisma.playerGameStat.groupBy({ by: ["playerId", "teamId"], where: { gameId: { in: gameIds } }, _sum: { points: true, goals: true } });
      const byPlayer = new Map<number, { pts: number; g: number; teamId: number }>();
      for (const row of grouped) {
        const cur = byPlayer.get(row.playerId) ?? { pts: 0, g: 0, teamId: row.teamId };
        cur.pts += row._sum.points ?? 0; cur.g += row._sum.goals ?? 0;
        byPlayer.set(row.playerId, cur);
      }
      const arr = [...byPlayer.entries()];
      const topP = arr.sort((a, b) => b[1].pts - a[1].pts)[0];
      const topG = arr.sort((a, b) => b[1].g - a[1].g)[0];
      const teamOf = new Map((await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, code: true, name: true, slug: true } })).map((t) => [t.id, t]));
      const pInfo = await prisma.player.findMany({ where: { id: { in: [topP?.[0], topG?.[0]].filter((x): x is number => x != null) } }, select: { id: true, name: true, slug: true } });
      const pById = new Map(pInfo.map((p) => [p.id, p]));
      if (topP && (!playerPoints || topP[1].pts > playerPoints.value)) {
        const p = pById.get(topP[0]); const t = teamOf.get(topP[1].teamId);
        playerPoints = { value: topP[1].pts, who: cleanName(p?.name ?? "?"), slug: p?.slug ?? null, team: t ? teamCodeName(t) : null, teamSlug: t?.slug ?? null, season, gameId: null, detail: `${topP[1].g} goals` };
      }
      if (topG && (!playerGoals || topG[1].g > playerGoals.value)) {
        const p = pById.get(topG[0]); const t = teamOf.get(topG[1].teamId);
        playerGoals = { value: topG[1].g, who: cleanName(p?.name ?? "?"), slug: p?.slug ?? null, team: t ? teamCodeName(t) : null, teamSlug: t?.slug ?? null, season, gameId: null, detail: null };
      }
    }

    // team season standings for wins/points
    const st = await computeStandings(season, "NHL").catch(() => []);
    for (const t of st) {
      if (!teamWins || t.w > teamWins.value) teamWins = { value: t.w, who: t.name, slug: null, team: t.code, teamSlug: null, season, gameId: null, detail: `${t.points} pts` };
      if (!teamPoints || t.points > teamPoints.value) teamPoints = { value: t.points, who: t.name, slug: null, team: t.code, teamSlug: null, season, gameId: null, detail: `${t.w}–${t.l}–${t.otl}` };
    }

    // longest win streak this season
    const streak = await longestWinStreak(season);
    if (streak && (!longestStreak || streak.value > longestStreak.value)) longestStreak = streak;
  }
  return { playerPoints, playerGoals, teamWins, teamPoints, longestStreak };
}

async function longestWinStreak(season: string): Promise<RecordHolder | null> {
  const teams = await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true, code: true, name: true } });
  const games = await prisma.game.findMany({ where: { season, league: "NHL", status: "FINAL", seriesId: null }, select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, round: true, id: true }, orderBy: [{ round: "asc" }, { id: "asc" }] });
  const seq = new Map<number, boolean[]>(); teams.forEach((t) => seq.set(t.id, []));
  for (const g of games) {
    const hw = (g.homeGoals ?? 0) > (g.awayGoals ?? 0);
    seq.get(g.homeTeamId)?.push(hw); seq.get(g.awayTeamId)?.push(!hw);
  }
  let best: RecordHolder | null = null;
  for (const t of teams) {
    let cur = 0, mx = 0;
    for (const w of seq.get(t.id)!) { if (w) { cur++; mx = Math.max(mx, cur); } else cur = 0; }
    if (mx > 0 && (!best || mx > best.value)) best = { value: mx, who: t.name, slug: null, team: t.code, teamSlug: null, season, gameId: null, detail: "consecutive wins" };
  }
  return best;
}

export async function leagueRecords(): Promise<RecordGroup[]> {
  const [pPts, pG, pA, pSh, pHit, pPim, gSaves, gSO, tGoals, tMargin, season] = await Promise.all([
    topPlayerGame("points"), topPlayerGame("goals"), topPlayerGame("assists"), topPlayerGame("shots"), topPlayerGame("hits"), topPlayerGame("pim"),
    topGoalieGame("saves"), topGoalieGame("shutout"), topTeamGame("goals"), topTeamGame("margin"), seasonBests(),
  ]);
  return [
    { title: "Single Game — Skater", icon: "\u{1F3D2}", rows: [
      { key: "gpts", label: "Most points", unit: "pts", holder: pPts },
      { key: "gg", label: "Most goals", unit: "G", holder: pG },
      { key: "ga", label: "Most assists", unit: "A", holder: pA },
      { key: "gsh", label: "Most shots", unit: "SOG", holder: pSh },
      { key: "ghit", label: "Most hits", unit: "hits", holder: pHit },
      { key: "gpim", label: "Most PIM", unit: "PIM", holder: pPim },
    ] },
    { title: "Single Game — Goalie & Team", icon: "\u{1F9E4}", rows: [
      { key: "gsaves", label: "Most saves", unit: "saves", holder: gSaves },
      { key: "gso", label: "Biggest shutout", unit: "saves", holder: gSO },
      { key: "tgoals", label: "Most goals (team)", unit: "goals", holder: tGoals },
      { key: "tmargin", label: "Biggest blowout", unit: "margin", holder: tMargin },
    ] },
    { title: "Single Season", icon: "\u{1F4C5}", rows: [
      { key: "spts", label: "Most points", unit: "pts", holder: season.playerPoints },
      { key: "sg", label: "Most goals", unit: "G", holder: season.playerGoals },
      { key: "sw", label: "Most wins (team)", unit: "W", holder: season.teamWins },
      { key: "sp", label: "Most points (team)", unit: "pts", holder: season.teamPoints },
      { key: "sstreak", label: "Longest win streak", unit: "games", holder: season.longestStreak },
    ] },
  ];
}

// Live single-game thresholds the engine can flag as "LEAGUE RECORD" territory.
export async function recordThresholds(): Promise<{ points: number; goals: number; saves: number; teamGoals: number }> {
  const groups = await leagueRecords();
  const find = (title: string, key: string) => groups.find((g) => g.title === title)?.rows.find((r) => r.key === key)?.holder?.value ?? 0;
  return {
    points: find("Single Game — Skater", "gpts"),
    goals: find("Single Game — Skater", "gg"),
    saves: find("Single Game — Goalie & Team", "gsaves"),
    teamGoals: find("Single Game — Goalie & Team", "tgoals"),
  };
}
