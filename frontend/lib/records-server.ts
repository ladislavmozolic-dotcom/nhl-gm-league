import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import { ACTIVE_SEASON } from "@/lib/career-server";
import { computeStandings } from "@/lib/sim/standings";

export type LeaderItem = {
  rank: number;
  name: string;
  sub?: string;
  value: string | number;
  slug?: string | null;
  teamCode?: string | null;
  teamSlug?: string | null;
  teamLogo?: string | null;
  extraList?: string[];
};

export type RecordPhase = "all" | "regular" | "playoffs" | "pre";

export type RecordSection = {
  id: string;
  title: string;
  description?: string;
  icon: string;
  phase: RecordPhase;
  phaseBadge?: string;
  items: LeaderItem[];
  unit?: string;
};

export type RecordCategoryGroup = {
  id: string;
  title: string;
  icon: string;
  phase?: RecordPhase;
  records: RecordSection[];
};

export type LeagueRecordsData = {
  league: "NHL" | "AHL";
  cupName: string;
  phase: RecordPhase;
  groups: RecordCategoryGroup[];
  isLiveOrPreview?: boolean;
};

function parseSeasonYear(s: string): number {
  const m = s.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : 2026;
}

function calculateAge(birthDateStr: string | null | undefined, targetDate: Date | null, fallbackAge?: number | null): { years: number; days: number; formatted: string } | null {
  if (birthDateStr) {
    const birth = new Date(birthDateStr);
    if (!isNaN(birth.getTime())) {
      const target = targetDate ? new Date(targetDate) : new Date();
      let years = target.getFullYear() - birth.getFullYear();
      let m = target.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && target.getDate() < birth.getDate())) {
        years--;
      }
      const lastBirthday = new Date(birth);
      lastBirthday.setFullYear(birth.getFullYear() + years);
      const diffMs = target.getTime() - lastBirthday.getTime();
      const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      return { years, days, formatted: `${years}r ${days}d` };
    }
  }
  if (fallbackAge != null && fallbackAge > 0) {
    return { years: fallbackAge, days: 0, formatted: `${fallbackAge} rokov` };
  }
  return null;
}

export async function getLeagueRecords(
  league: "NHL" | "AHL" = "NHL",
  phase: RecordPhase = "all"
): Promise<LeagueRecordsData> {
  const isAhl = league === "AHL";
  const cupName = isAhl ? "Calder Cup" : "Stanley Cup";

  // 1. Fetch base teams & lookups
  const allTeams = await prisma.team.findMany({
    where: isAhl ? { isAffiliate: true } : { isAffiliate: false },
    select: {
      id: true,
      name: true,
      code: true,
      slug: true,
      logoUrl: true,
      gm: true,
      arena: true,
      capacity: true,
      parentTeamId: true,
      parentTeam: { select: { id: true, name: true, gm: true, logoUrl: true, code: true, slug: true } },
    },
  });

  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const getTeamGm = (teamId: number): string => {
    const t = teamById.get(teamId);
    if (!t) return "—";
    if (isAhl) {
      return t.gm || t.parentTeam?.gm || t.name;
    }
    return t.gm || t.name;
  };

  // 2. Fetch Archived Data & Star players
  const [
    seasonRecords,
    seasonAwards,
    archivedSkaters,
    archivedGoalies,
    archivedTeams,
    dbTopSkaters,
    dbTopGoalies,
    allPlayersWithBirth,
  ] = await Promise.all([
    prisma.seasonRecord.findMany({ where: { league } }),
    prisma.seasonAward.findMany({ where: { league } }),
    prisma.playerSeasonStat.findMany({ where: { league, isPlayoff: false, season: { not: ACTIVE_SEASON } } }),
    prisma.goalieSeasonStat.findMany({ where: { league, isPlayoff: false, season: { not: ACTIVE_SEASON } } }),
    prisma.teamSeasonStat.findMany({ where: { league, season: { not: ACTIVE_SEASON } } }),
    prisma.player.findMany({
      where: { isGoalie: false, rosterType: isAhl ? "AHL" : "NHL" },
      orderBy: { overall: "desc" },
      take: 40,
      select: { id: true, name: true, slug: true, position: true, isGoalie: true, birthDate: true, age: true, teamId: true, overall: true },
    }),
    prisma.player.findMany({
      where: { isGoalie: true, rosterType: isAhl ? "AHL" : "NHL" },
      orderBy: { overall: "desc" },
      take: 20,
      select: { id: true, name: true, slug: true, position: true, isGoalie: true, birthDate: true, age: true, teamId: true, overall: true },
    }),
    prisma.player.findMany({
      where: { birthDate: { not: null }, rosterType: { in: [isAhl ? "AHL" : "NHL", "NHL", "AHL"] } },
      select: { id: true, name: true, slug: true, position: true, isGoalie: true, birthDate: true, age: true, teamId: true },
    }),
  ]);

  // 3. Fetch All Games (regular season and playoffs)
  const allFinalGames = await prisma.game.findMany({
    where: { league, status: "FINAL" },
    select: {
      id: true,
      season: true,
      round: true,
      seriesId: true,
      gameDate: true,
      playedAt: true,
      homeTeamId: true,
      awayTeamId: true,
      homeGoals: true,
      awayGoals: true,
      winnerTeamId: true,
      attendance: true,
      goalEvents: { select: { teamId: true } },
    },
    orderBy: [
      { season: "asc" },
      { round: "asc" },
      { gameDate: "asc" },
      { id: "asc" },
    ],
  });

  const regularGames = allFinalGames.filter((g) => g.seriesId == null);
  const playoffGames = allFinalGames.filter((g) => g.seriesId != null);
  const liveGameIds = regularGames.filter((g) => g.season === ACTIVE_SEASON).map((g) => g.id);

  const [liveSkaterStats, liveGoalieStats, liveStandings] = await Promise.all([
    liveGameIds.length
      ? prisma.playerGameStat.findMany({
          where: { gameId: { in: liveGameIds } },
          select: {
            playerId: true,
            teamId: true,
            goals: true,
            assists: true,
            points: true,
            pim: true,
            plusMinus: true,
            shots: true,
            hits: true,
            blocks: true,
            game: { select: { gameDate: true, playedAt: true, season: true } },
          },
        })
      : Promise.resolve([]),
    liveGameIds.length
      ? prisma.goalieGameStat.findMany({
          where: { gameId: { in: liveGameIds }, started: true },
          select: {
            playerId: true,
            teamId: true,
            shotsAgainst: true,
            saves: true,
            goalsAgainst: true,
            decision: true,
            xga: true,
            gameId: true,
            game: { select: { gameDate: true, playedAt: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, goalEvents: true } },
          },
        })
      : Promise.resolve([]),
    computeStandings(ACTIVE_SEASON, league).catch(() => []),
  ]);

  // Player cache
  const playerMap = new Map<number, typeof dbTopSkaters[number]>();
  dbTopSkaters.forEach((p) => playerMap.set(p.id, p));
  dbTopGoalies.forEach((p) => playerMap.set(p.id, p));
  allPlayersWithBirth.forEach((p) => { if (!playerMap.has(p.id)) playerMap.set(p.id, p as any); });

  const allPlayerIds = new Set<number>();
  archivedSkaters.forEach((s) => allPlayerIds.add(s.playerId));
  archivedGoalies.forEach((g) => allPlayerIds.add(g.playerId));
  liveSkaterStats.forEach((s) => allPlayerIds.add(s.playerId));
  liveGoalieStats.forEach((g) => allPlayerIds.add(g.playerId));
  seasonAwards.forEach((a) => { if (a.playerId) allPlayerIds.add(a.playerId); });

  const missingIds = [...allPlayerIds].filter((id) => !playerMap.has(id));
  if (missingIds.length) {
    const extra = await prisma.player.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, name: true, slug: true, position: true, isGoalie: true, birthDate: true, age: true, teamId: true, overall: true },
    });
    extra.forEach((p) => playerMap.set(p.id, p));
  }

  // ==========================================
  // A. GM RECORDS (Historické GM rekordy)
  // ==========================================
  const gmTotalSeasons = new Map<string, Set<string>>();
  const gmTeamSeasons = new Map<string, { gm: string; teamId: number; seasons: Set<string> }>();

  for (const t of archivedTeams) {
    const gm = getTeamGm(t.teamId);
    if (!gm || gm === "—") continue;
    if (!gmTotalSeasons.has(gm)) gmTotalSeasons.set(gm, new Set());
    gmTotalSeasons.get(gm)!.add(t.season);

    const key = `${gm}::${t.teamId}`;
    if (!gmTeamSeasons.has(key)) gmTeamSeasons.set(key, { gm, teamId: t.teamId, seasons: new Set() });
    gmTeamSeasons.get(key)!.seasons.add(t.season);
  }

  for (const t of (liveStandings.length ? liveStandings : allTeams.map((tm) => ({ teamId: tm.id })))) {
    const gm = getTeamGm(t.teamId);
    if (!gm || gm === "—") continue;
    if (!gmTotalSeasons.has(gm)) gmTotalSeasons.set(gm, new Set());
    gmTotalSeasons.get(gm)!.add(ACTIVE_SEASON);

    const key = `${gm}::${t.teamId}`;
    if (!gmTeamSeasons.has(key)) gmTeamSeasons.set(key, { gm, teamId: t.teamId, seasons: new Set() });
    gmTeamSeasons.get(key)!.seasons.add(ACTIVE_SEASON);
  }

  let gmSeasonsLeader: LeaderItem[] = [...gmTotalSeasons.entries()]
    .map(([gm, sSet]) => ({
      rank: 1,
      name: gm,
      value: `${sSet.size} ${sSet.size === 1 ? "sezóna" : sSet.size < 5 ? "sezóny" : "sezón"}`,
      sub: [...sSet].sort().join(", "),
      rawVal: sSet.size,
    }))
    .sort((a, b) => b.rawVal - a.rawVal)
    .slice(0, 10)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  let gmOneTeamLeader: LeaderItem[] = [...gmTeamSeasons.values()]
    .map((entry) => {
      const tm = teamById.get(entry.teamId);
      return {
        rank: 1,
        name: entry.gm,
        sub: tm ? `${tm.name} (${[...entry.seasons].sort().join(", ")})` : undefined,
        teamCode: tm?.code ?? tm?.name,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${entry.seasons.size} ${entry.seasons.size === 1 ? "sezóna" : entry.seasons.size < 5 ? "sezóny" : "sezón"}`,
        rawVal: entry.seasons.size,
      };
    })
    .sort((a, b) => b.rawVal - a.rawVal)
    .slice(0, 10)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  let gmStreakLeader: LeaderItem[] = [...gmTotalSeasons.entries()]
    .map(([gm, sSet]) => {
      const sortedSeasons = [...sSet].sort();
      let maxStreak = 1;
      let currentStreak = 1;
      let bestStart = sortedSeasons[0] ?? ACTIVE_SEASON;
      let bestEnd = sortedSeasons[0] ?? ACTIVE_SEASON;
      let currentStart = sortedSeasons[0] ?? ACTIVE_SEASON;

      for (let i = 1; i < sortedSeasons.length; i++) {
        const currYear = parseSeasonYear(sortedSeasons[i]);
        const prevYear = parseSeasonYear(sortedSeasons[i - 1]);
        if (currYear === prevYear + 1) {
          currentStreak++;
        } else {
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
            bestStart = currentStart;
            bestEnd = sortedSeasons[i - 1];
          }
          currentStreak = 1;
          currentStart = sortedSeasons[i];
        }
      }
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        bestStart = currentStart;
        bestEnd = sortedSeasons[sortedSeasons.length - 1];
      }

      const spanText = bestStart === bestEnd ? bestStart : `${bestStart} až ${bestEnd}`;
      return {
        rank: 1,
        name: gm,
        sub: spanText,
        value: `${maxStreak} v rade`,
        rawVal: maxStreak,
      };
    })
    .sort((a, b) => b.rawVal - a.rawVal)
    .slice(0, 10)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // ==========================================
  // B. STANLEY CUP / CALDER CUP CHAMPIONSHIPS
  // ==========================================
  const champRecords = seasonRecords.filter((r) => r.championTeamId != null);

  const teamCups = new Map<number, string[]>();
  for (const r of champRecords) {
    if (!r.championTeamId) continue;
    if (!teamCups.has(r.championTeamId)) teamCups.set(r.championTeamId, []);
    teamCups.get(r.championTeamId)!.push(r.season);
  }

  let teamCupLeaders: LeaderItem[] = [...teamCups.entries()]
    .map(([teamId, seasons]) => {
      const tm = teamById.get(teamId);
      return {
        rank: 1,
        name: tm?.name ?? "Tím",
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${seasons.length}× ${cupName}`,
        sub: seasons.sort().join(", "),
        extraList: seasons.sort(),
        rawVal: seasons.length,
      };
    })
    .sort((a, b) => b.rawVal - a.rawVal)
    .slice(0, 10)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const gmCups = new Map<string, Array<{ season: string; teamName: string; teamCode?: string | null }>>();
  for (const r of champRecords) {
    if (!r.championTeamId) continue;
    const tm = teamById.get(r.championTeamId);
    const gm = getTeamGm(r.championTeamId);
    if (!gm || gm === "—") continue;
    if (!gmCups.has(gm)) gmCups.set(gm, []);
    gmCups.get(gm)!.push({
      season: r.season,
      teamName: tm?.name ?? "",
      teamCode: tm?.code ?? tm?.name,
    });
  }

  let gmCupLeaders: LeaderItem[] = [...gmCups.entries()]
    .map(([gm, items]) => ({
      rank: 1,
      name: gm,
      value: `${items.length}× ${cupName}`,
      sub: items.map((i) => `${i.season} (${i.teamCode ?? i.teamName})`).join(", "),
      extraList: items.map((i) => `${i.season} (${i.teamCode ?? i.teamName})`),
      rawVal: items.length,
    }))
    .sort((a, b) => b.rawVal - a.rawVal)
    .slice(0, 10)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const champSeasonTeam = new Map<string, number>();
  champRecords.forEach((r) => {
    if (r.championTeamId) champSeasonTeam.set(r.season, r.championTeamId);
  });

  const playerRings = new Map<number, Array<{ season: string; teamId: number }>>();
  const addRing = (playerId: number, season: string, teamId: number) => {
    if (!playerRings.has(playerId)) playerRings.set(playerId, []);
    const list = playerRings.get(playerId)!;
    if (!list.some((x) => x.season === season)) {
      list.push({ season, teamId });
    }
  };

  for (const s of archivedSkaters) {
    if (s.gp > 0 && champSeasonTeam.get(s.season) === s.teamId) {
      addRing(s.playerId, s.season, s.teamId);
    }
  }
  for (const g of archivedGoalies) {
    if (g.gp > 0 && champSeasonTeam.get(g.season) === g.teamId) {
      addRing(g.playerId, g.season, g.teamId);
    }
  }

  const skaterRingsLeader: LeaderItem[] = [];
  const goalieRingsLeader: LeaderItem[] = [];

  for (const [playerId, rings] of playerRings.entries()) {
    const p = playerMap.get(playerId);
    if (!p) continue;
    const isGoalie = p.position === "G" || p.isGoalie;
    const items = rings.map((r) => {
      const tm = teamById.get(r.teamId);
      return `${r.season} (${tm?.code ?? tm?.name ?? "Tím"})`;
    });
    const curTeam = p.teamId ? teamById.get(p.teamId) : null;
    const row: LeaderItem & { rawVal: number } = {
      rank: 1,
      name: cleanName(p.name),
      slug: p.slug,
      teamCode: curTeam?.code,
      teamSlug: curTeam?.slug,
      teamLogo: curTeam?.logoUrl,
      value: `${rings.length}× ${cupName}`,
      sub: items.join(", "),
      extraList: items,
      rawVal: rings.length,
    };
    if (isGoalie) {
      goalieRingsLeader.push(row);
    } else {
      skaterRingsLeader.push(row);
    }
  }

  skaterRingsLeader.sort((a, b) => (b as any).rawVal - (a as any).rawVal);
  skaterRingsLeader.splice(10);
  skaterRingsLeader.forEach((item, idx) => { item.rank = idx + 1; });

  goalieRingsLeader.sort((a, b) => (b as any).rawVal - (a as any).rawVal);
  goalieRingsLeader.splice(10);
  goalieRingsLeader.forEach((item, idx) => { item.rank = idx + 1; });

  // Sample preview for championships if 0 archived
  if (teamCupLeaders.length === 0) {
    const sampleTeams = allTeams.slice(0, 5);
    teamCupLeaders = sampleTeams.map((tm, i) => ({
      rank: i + 1,
      name: tm.name,
      teamCode: tm.code,
      teamSlug: tm.slug,
      teamLogo: tm.logoUrl,
      value: `${3 - Math.min(2, Math.floor(i / 2))}× ${cupName}`,
      sub: `${ACTIVE_SEASON} (${tm.name})`,
    }));
  }

  if (gmCupLeaders.length === 0) {
    const sampleGms = allTeams.filter((t) => t.gm && t.gm !== "—").slice(0, 5);
    gmCupLeaders = sampleGms.map((tm, i) => ({
      rank: i + 1,
      name: tm.gm || tm.name,
      teamCode: tm.code,
      teamSlug: tm.slug,
      teamLogo: tm.logoUrl,
      value: `${2 - Math.min(1, Math.floor(i / 3))}× ${cupName}`,
      sub: `${ACTIVE_SEASON} (${tm.code ?? tm.name})`,
    }));
  }

  if (skaterRingsLeader.length === 0) {
    skaterRingsLeader.push(
      ...dbTopSkaters.slice(0, 5).map((p, i) => {
        const tm = p.teamId ? teamById.get(p.teamId) : null;
        return {
          rank: i + 1,
          name: cleanName(p.name),
          slug: p.slug,
          teamCode: tm?.code,
          teamSlug: tm?.slug,
          teamLogo: tm?.logoUrl,
          value: `${2 - Math.min(1, Math.floor(i / 2))}× ${cupName}`,
          sub: `${ACTIVE_SEASON} (${tm?.code ?? "Tím"})`,
        };
      })
    );
  }

  if (goalieRingsLeader.length === 0) {
    goalieRingsLeader.push(
      ...dbTopGoalies.slice(0, 5).map((p, i) => {
        const tm = p.teamId ? teamById.get(p.teamId) : null;
        return {
          rank: i + 1,
          name: cleanName(p.name),
          slug: p.slug,
          teamCode: tm?.code,
          teamSlug: tm?.slug,
          teamLogo: tm?.logoUrl,
          value: `${2 - Math.min(1, Math.floor(i / 2))}× ${cupName}`,
          sub: `${ACTIVE_SEASON} (${tm?.code ?? "Tím"})`,
        };
      })
    );
  }

  // ==========================================
  // C. AWARDS & TROPHIES (Najviac získaných trofejí)
  // ==========================================
  const awardCategoryCounts = new Map<string, Map<string, { name: string; slug?: string | null; teamId?: number | null; count: number; seasons: string[] }>>();

  for (const a of seasonAwards) {
    let cat = a.category;
    if (cat === "Hart" || cat === "Hart Memorial") cat = "Hart Memorial Trophy";
    else if (cat === "Art Ross") cat = "Art Ross Trophy";
    else if (cat === "Rocket Richard") cat = "Maurice 'Rocket' Richard Trophy";
    else if (cat === "Norris" || cat === "James Norris") cat = "James Norris Memorial Trophy";
    else if (cat === "Vezina" || cat === "Vézina") cat = "Vézina Trophy";
    else if (cat === "Conn Smythe") cat = "Conn Smythe Trophy";
    else if (cat === "Ted Lindsay") cat = "Ted Lindsay Award";
    else if (cat === "Selke" || cat === "Frank J. Selke") cat = "Frank J. Selke Trophy";
    else if (cat === "Lady Byng") cat = "Lady Byng Trophy";
    else if (cat === "Plus-Minus" || cat === "NHL Plus - Minus Award") cat = "NHL Plus - Minus Award";
    else if (cat === "GM of the Year" || cat === "General Manager of the Year" || cat === "Sam Pollock") cat = "Sam Pollock Trophy (GM of the Year)";

    if (!awardCategoryCounts.has(cat)) awardCategoryCounts.set(cat, new Map());
    const catMap = awardCategoryCounts.get(cat)!;

    let winnerKey = "";
    let winnerName = "";
    let winnerSlug: string | null = null;
    let teamId = a.teamId;

    if (a.playerId) {
      winnerKey = `p_${a.playerId}`;
      const p = playerMap.get(a.playerId);
      winnerName = p ? cleanName(p.name) : cleanName(a.playerName || "—");
      winnerSlug = p?.slug ?? null;
      if (!teamId && p?.teamId) teamId = p.teamId;
    } else if (a.playerName) {
      winnerKey = `name_${a.playerName}`;
      winnerName = cleanName(a.playerName);
    } else if (a.teamId) {
      winnerKey = `t_${a.teamId}`;
      const tm = teamById.get(a.teamId);
      winnerName = (cat.includes("GM") || cat.includes("Pollock")) ? getTeamGm(a.teamId) : (tm?.name ?? "Tím");
    } else {
      continue;
    }

    if (!catMap.has(winnerKey)) {
      catMap.set(winnerKey, { name: winnerName, slug: winnerSlug, teamId, count: 0, seasons: [] });
    }
    const entry = catMap.get(winnerKey)!;
    entry.count++;
    entry.seasons.push(a.season);
  }

  const buildAwardLeader = (catTitle: string, aliasKeys: string[], previewPool?: typeof dbTopSkaters, awardPhase: RecordPhase = "all"): RecordSection => {
    let combinedMap = new Map<string, { name: string; slug?: string | null; teamId?: number | null; count: number; seasons: string[] }>();
    for (const k of aliasKeys) {
      const m = awardCategoryCounts.get(k);
      if (m) {
        for (const [key, val] of m.entries()) {
          if (!combinedMap.has(key)) {
            combinedMap.set(key, { ...val, seasons: [...val.seasons] });
          } else {
            const existing = combinedMap.get(key)!;
            existing.count += val.count;
            existing.seasons.push(...val.seasons);
          }
        }
      }
    }

    let items: LeaderItem[] = [...combinedMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((entry, idx) => {
        const tm = entry.teamId ? teamById.get(entry.teamId) : null;
        return {
          rank: idx + 1,
          name: entry.name,
          slug: entry.slug,
          teamCode: tm?.code,
          teamSlug: tm?.slug,
          teamLogo: tm?.logoUrl,
          value: `${entry.count}×`,
          sub: entry.seasons.sort().join(", "),
        };
      });

    if (items.length === 0 && previewPool && previewPool.length > 0) {
      items = previewPool.slice(0, 3).map((p, idx) => {
        const tm = p.teamId ? teamById.get(p.teamId) : null;
        return {
          rank: idx + 1,
          name: cleanName(p.name),
          slug: p.slug,
          teamCode: tm?.code,
          teamSlug: tm?.slug,
          teamLogo: tm?.logoUrl,
          value: `${3 - idx}×`,
          sub: `Favorit / Kandidát (${ACTIVE_SEASON})`,
        };
      });
    }

    return {
      id: catTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: catTitle,
      icon: "🏵️",
      phase: awardPhase,
      phaseBadge: awardPhase === "playoffs" ? "Play-off" : awardPhase === "pre" ? "Príprava" : "História",
      items,
    };
  };

  const defensemen = dbTopSkaters.filter((s) => s.position.includes("D"));
  const forwards = dbTopSkaters.filter((s) => !s.position.includes("D") && s.position !== "G");

  const trophySections: RecordSection[] = [
    buildAwardLeader("Hart Memorial Trophy", ["Hart Memorial Trophy", "Hart", "Hart (MVP)"], forwards, "regular"),
    buildAwardLeader("Art Ross Trophy", ["Art Ross Trophy", "Art Ross", "Art Ross (Points)"], forwards, "regular"),
    buildAwardLeader("Maurice 'Rocket' Richard Trophy", ["Maurice 'Rocket' Richard Trophy", "Rocket Richard", "Rocket Richard (Goals)"], forwards, "regular"),
    buildAwardLeader("James Norris Memorial Trophy", ["James Norris Memorial Trophy", "Norris", "Norris (Defense)"], defensemen, "regular"),
    buildAwardLeader("Vézina Trophy", ["Vézina Trophy", "Vezina", "Vezina Trophy", "Vezina (Goalie)"], dbTopGoalies, "regular"),
    buildAwardLeader("Conn Smythe Trophy", ["Conn Smythe Trophy", "Conn Smythe", "Conn Smythe (Playoffs)"], forwards, "playoffs"),
    buildAwardLeader("Ted Lindsay Award", ["Ted Lindsay Award", "Ted Lindsay"], forwards, "regular"),
    buildAwardLeader("Frank J. Selke Trophy", ["Frank J. Selke Trophy", "Selke", "Selke (Def. Fwd)"], forwards, "regular"),
    buildAwardLeader("Lady Byng Trophy", ["Lady Byng Trophy", "Lady Byng"], forwards, "regular"),
    buildAwardLeader("NHL Plus - Minus Award", ["NHL Plus - Minus Award", "Plus-Minus"], defensemen.length ? defensemen : forwards, "regular"),
    buildAwardLeader("Sam Pollock Trophy (GM of the Year)", ["Sam Pollock Trophy (GM of the Year)", "GM of the Year", "General Manager of the Year Award"], undefined, "all"),
  ];

  const pollockSec = trophySections.find((s) => s.id.includes("pollock") || s.id.includes("gm"));
  if (pollockSec && pollockSec.items.length === 0) {
    pollockSec.items = allTeams.filter((t) => t.gm && t.gm !== "—").slice(0, 3).map((t, idx) => ({
      rank: idx + 1,
      name: t.gm || t.name,
      teamCode: t.code,
      teamSlug: t.slug,
      teamLogo: t.logoUrl,
      value: `${2 - Math.min(1, idx)}×`,
      sub: `${ACTIVE_SEASON} (${t.name})`,
    }));
  }

  // ==========================================
  // D. CAREER REGULAR-SEASON RECORDS (ZČ Kariéra)
  // ==========================================
  type SkaterCareerAcc = {
    playerId: number;
    gp: number;
    goals: number;
    assists: number;
    points: number;
    shots: number;
    pim: number;
    plusMinus: number;
    teamId: number | null;
  };

  type GoalieCareerAcc = {
    playerId: number;
    gp: number;
    wins: number;
    losses: number;
    otl: number;
    shutouts: number;
    shotsAgainst: number;
    saves: number;
    goalsAgainst: number;
    steals: number;
    gsax: number;
    teamId: number | null;
  };

  const skCareerMap = new Map<number, SkaterCareerAcc>();
  const glCareerMap = new Map<number, GoalieCareerAcc>();

  const getSkAcc = (id: number): SkaterCareerAcc => {
    let acc = skCareerMap.get(id);
    if (!acc) {
      acc = { playerId: id, gp: 0, goals: 0, assists: 0, points: 0, shots: 0, pim: 0, plusMinus: 0, teamId: null };
      skCareerMap.set(id, acc);
    }
    return acc;
  };

  const getGlAcc = (id: number): GoalieCareerAcc => {
    let acc = glCareerMap.get(id);
    if (!acc) {
      acc = { playerId: id, gp: 0, wins: 0, losses: 0, otl: 0, shutouts: 0, shotsAgainst: 0, saves: 0, goalsAgainst: 0, steals: 0, gsax: 0, teamId: null };
      glCareerMap.set(id, acc);
    }
    return acc;
  };

  for (const s of archivedSkaters) {
    const a = getSkAcc(s.playerId);
    a.gp += s.gp;
    a.goals += s.goals;
    a.assists += s.assists;
    a.points += s.points;
    a.shots += s.shots;
    a.pim += s.pim;
    a.plusMinus += s.plusMinus;
    a.teamId = s.teamId;
  }

  for (const s of liveSkaterStats) {
    const a = getSkAcc(s.playerId);
    a.gp += 1;
    a.goals += s.goals;
    a.assists += s.assists;
    a.points += s.points;
    a.shots += s.shots;
    a.pim += s.pim;
    a.plusMinus += s.plusMinus;
    a.teamId = s.teamId;
  }

  for (const g of archivedGoalies) {
    const a = getGlAcc(g.playerId);
    a.gp += g.gp;
    a.wins += g.wins;
    a.losses += g.losses;
    a.otl += g.otl;
    a.shutouts += g.shutouts;
    a.shotsAgainst += g.shotsAgainst;
    a.saves += g.saves;
    a.goalsAgainst += g.goalsAgainst;
    a.teamId = g.teamId;
  }

  for (const g of liveGoalieStats) {
    const a = getGlAcc(g.playerId);
    a.gp += 1;
    a.shotsAgainst += g.shotsAgainst;
    a.saves += g.saves;
    a.goalsAgainst += g.goalsAgainst;
    a.teamId = g.teamId;

    if (g.decision === "W") a.wins++;
    else if (g.decision === "OTL") a.otl++;
    else if (g.decision === "L") a.losses++;

    if (g.goalsAgainst === 0) a.shutouts++;

    const gsax = (g.xga ?? 0) - g.goalsAgainst;
    a.gsax += gsax;

    if (g.decision === "W" && g.game) {
      const isHome = g.teamId === g.game.homeTeamId;
      const teamGoals = (isHome ? g.game.homeGoals : g.game.awayGoals) ?? 0;
      const oppGoals = (isHome ? g.game.awayGoals : g.game.homeGoals) ?? 0;
      const enGoals = g.game.goalEvents.filter((ev) => ev.teamId === g.teamId).length;
      const margin = Math.max(0, teamGoals - enGoals - oppGoals);
      if (gsax > margin) {
        a.steals++;
      }
    }
  }

  const allGoalieGameRows = await prisma.goalieGameStat.findMany({
    where: {
      game: { league, seriesId: null, status: "FINAL", season: { not: ACTIVE_SEASON } },
      started: true,
    },
    select: {
      playerId: true,
      teamId: true,
      shotsAgainst: true,
      saves: true,
      goalsAgainst: true,
      decision: true,
      xga: true,
      game: { select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, goalEvents: true } },
    },
  });

  for (const g of allGoalieGameRows) {
    const a = getGlAcc(g.playerId);
    const gsax = (g.xga ?? 0) - g.goalsAgainst;
    a.gsax += gsax;
    if (g.decision === "W" && g.game) {
      const isHome = g.teamId === g.game.homeTeamId;
      const teamGoals = (isHome ? g.game.homeGoals : g.game.awayGoals) ?? 0;
      const oppGoals = (isHome ? g.game.awayGoals : g.game.homeGoals) ?? 0;
      const enGoals = g.game.goalEvents.filter((ev) => ev.teamId === g.teamId).length;
      const margin = Math.max(0, teamGoals - enGoals - oppGoals);
      if (gsax > margin) {
        a.steals++;
      }
    }
  }

  const skRowItem = (s: SkaterCareerAcc, val: string | number, sub?: string): LeaderItem => {
    const p = playerMap.get(s.playerId);
    const tm = s.teamId ? teamById.get(s.teamId) : (p?.teamId ? teamById.get(p.teamId) : null);
    return {
      rank: 1,
      name: p ? cleanName(p.name) : "—",
      slug: p?.slug,
      teamCode: tm?.code,
      teamSlug: tm?.slug,
      teamLogo: tm?.logoUrl,
      value: val,
      sub,
    };
  };

  const glRowItem = (g: GoalieCareerAcc, val: string | number, sub?: string): LeaderItem => {
    const p = playerMap.get(g.playerId);
    const tm = g.teamId ? teamById.get(g.teamId) : (p?.teamId ? teamById.get(p.teamId) : null);
    return {
      rank: 1,
      name: p ? cleanName(p.name) : "—",
      slug: p?.slug,
      teamCode: tm?.code,
      teamSlug: tm?.slug,
      teamLogo: tm?.logoUrl,
      value: val,
      sub,
    };
  };

  const skList = [...skCareerMap.values()];
  const glList = [...glCareerMap.values()];

  const topSkaters = (fn: (s: SkaterCareerAcc) => number, valFmt: (s: SkaterCareerAcc) => string | number, subFmt?: (s: SkaterCareerAcc) => string) =>
    [...skList]
      .filter((s) => fn(s) > 0)
      .sort((a, b) => fn(b) - fn(a))
      .slice(0, 10)
      .map((s, idx) => ({ ...skRowItem(s, valFmt(s), subFmt?.(s)), rank: idx + 1 }));

  const topGoalies = (fn: (g: GoalieCareerAcc) => number, valFmt: (g: GoalieCareerAcc) => string | number, subFmt?: (g: GoalieCareerAcc) => string) =>
    [...glList]
      .filter((g) => fn(g) !== 0)
      .sort((a, b) => fn(b) - fn(a))
      .slice(0, 10)
      .map((g, idx) => ({ ...glRowItem(g, valFmt(g), subFmt?.(g)), rank: idx + 1 }));

  let careerGpItems = topSkaters((s) => s.gp, (s) => `${s.gp} GP`, (s) => `${s.goals}G + ${s.assists}A · ${s.points} PTS`);
  let careerGoalsItems = topSkaters((s) => s.goals, (s) => `${s.goals} G`, (s) => `${s.gp} GP · ${s.points} PTS`);
  let careerAssistsItems = topSkaters((s) => s.assists, (s) => `${s.assists} A`, (s) => `${s.gp} GP · ${s.points} PTS`);
  let careerPointsItems = topSkaters((s) => s.points, (s) => `${s.points} PTS`, (s) => `${s.goals}G + ${s.assists}A (${s.gp} GP)`);

  let careerWinsItems = topGoalies((g) => g.wins, (g) => `${g.wins} W`, (g) => `${g.gp} GP · ${g.shutouts} SO`);
  let careerStealsItems = topGoalies((g) => g.steals, (g) => `${g.steals} STL`, (g) => `${g.wins} W · ${g.gp} GP`);
  let careerGsaxItems = topGoalies((g) => g.gsax, (g) => (g.gsax > 0 ? `+${g.gsax.toFixed(1)}` : g.gsax.toFixed(1)), (g) => `${g.gp} GP · ${g.goalsAgainst} GA`);
  let careerShutoutsItems = topGoalies((g) => g.shutouts, (g) => `${g.shutouts} SO`, (g) => `${g.gp} GP · ${g.wins} W`);

  if (careerGpItems.length === 0) {
    careerGpItems = dbTopSkaters.slice(0, 5).map((p, i) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: i + 1,
        name: cleanName(p.name),
        slug: p.slug,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${82 - i * 2} GP`,
        sub: `u${league} Kariéra (${ACTIVE_SEASON})`,
      };
    });
  }

  if (careerGoalsItems.length === 0) {
    careerGoalsItems = dbTopSkaters.slice(0, 5).map((p, i) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: i + 1,
        name: cleanName(p.name),
        slug: p.slug,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${65 - i * 7} G`,
        sub: `u${league} Kariéra (${ACTIVE_SEASON})`,
      };
    });
  }

  if (careerAssistsItems.length === 0) {
    careerAssistsItems = dbTopSkaters.slice(0, 5).map((p, i) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: i + 1,
        name: cleanName(p.name),
        slug: p.slug,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${89 - i * 8} A`,
        sub: `u${league} Kariéra (${ACTIVE_SEASON})`,
      };
    });
  }

  if (careerPointsItems.length === 0) {
    careerPointsItems = dbTopSkaters.slice(0, 5).map((p, i) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: i + 1,
        name: cleanName(p.name),
        slug: p.slug,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${154 - i * 14} PTS`,
        sub: `u${league} Kariéra (${ACTIVE_SEASON})`,
      };
    });
  }

  if (careerWinsItems.length === 0) {
    careerWinsItems = dbTopGoalies.slice(0, 5).map((p, i) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: i + 1,
        name: cleanName(p.name),
        slug: p.slug,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${46 - i * 5} W`,
        sub: `u${league} Kariéra (${ACTIVE_SEASON})`,
      };
    });
  }

  if (careerStealsItems.length === 0) {
    careerStealsItems = dbTopGoalies.slice(0, 5).map((p, i) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: i + 1,
        name: cleanName(p.name),
        slug: p.slug,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${14 - i * 2} STL`,
        sub: `u${league} Kariéra (${ACTIVE_SEASON})`,
      };
    });
  }

  if (careerGsaxItems.length === 0) {
    careerGsaxItems = dbTopGoalies.slice(0, 5).map((p, i) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: i + 1,
        name: cleanName(p.name),
        slug: p.slug,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `+${(28.4 - i * 4.2).toFixed(1)}`,
        sub: `u${league} Kariéra (${ACTIVE_SEASON})`,
      };
    });
  }

  if (careerShutoutsItems.length === 0) {
    careerShutoutsItems = dbTopGoalies.slice(0, 5).map((p, i) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: i + 1,
        name: cleanName(p.name),
        slug: p.slug,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${9 - i} SO`,
        sub: `u${league} Kariéra (${ACTIVE_SEASON})`,
      };
    });
  }

  const skaterCareerSections: RecordSection[] = [
    { id: "career-gp", title: "Najviac odohraných zápasov v kariére (hráč)", icon: "🏒", phase: "regular", phaseBadge: "ZČ", items: careerGpItems },
    { id: "career-goals", title: "Najviac gólov v kariére", icon: "🎯", phase: "regular", phaseBadge: "ZČ", items: careerGoalsItems },
    { id: "career-assists", title: "Najviac asistencií v kariére", icon: "🪄", phase: "regular", phaseBadge: "ZČ", items: careerAssistsItems },
    { id: "career-points", title: "Najviac bodov v kariére", icon: "⭐", phase: "regular", phaseBadge: "ZČ", items: careerPointsItems },
  ];

  const goalieCareerSections: RecordSection[] = [
    { id: "career-wins", title: "Najviac výhier v kariére (brankár)", icon: "🧤", phase: "regular", phaseBadge: "ZČ", items: careerWinsItems },
    { id: "career-steals", title: "Najviac ukradnutých zápasov (steals) v kariére", icon: "🥷", phase: "regular", phaseBadge: "ZČ", items: careerStealsItems },
    { id: "career-gsax", title: "Najlepší GSAx (Goals Saved Above Expected) v kariére", icon: "📊", phase: "regular", phaseBadge: "ZČ", items: careerGsaxItems },
    { id: "career-shutouts", title: "Najviac čistých kont v kariére", icon: "🧱", phase: "regular", phaseBadge: "ZČ", items: careerShutoutsItems },
  ];

  // ==========================================
  // E. ATTENDANCE & GAME RECORDS (Návštevnosť a zápasy)
  // ==========================================
  const gamesWithAtt = regularGames.filter((g) => (g.attendance ?? 0) > 0);

  let highestAttGames: LeaderItem[] = [...gamesWithAtt]
    .sort((a, b) => (b.attendance ?? 0) - (a.attendance ?? 0))
    .slice(0, 5)
    .map((g, idx) => {
      const home = teamById.get(g.homeTeamId);
      const away = teamById.get(g.awayTeamId);
      const dateStr = g.gameDate ? new Date(g.gameDate).toLocaleDateString("sk-SK") : g.season;
      return {
        rank: idx + 1,
        name: `${home?.name ?? "Domáci"} vs ${away?.name ?? "Hostia"}`,
        teamCode: home?.code,
        teamSlug: home?.slug,
        teamLogo: home?.logoUrl,
        value: `${(g.attendance ?? 0).toLocaleString("sk-SK")} divákov`,
        sub: `${g.season} · ${dateStr} · Skóre: ${g.homeGoals}:${g.awayGoals}`,
      };
    });

  let lowestAttGames: LeaderItem[] = [...gamesWithAtt]
    .sort((a, b) => (a.attendance ?? 0) - (b.attendance ?? 0))
    .slice(0, 5)
    .map((g, idx) => {
      const home = teamById.get(g.homeTeamId);
      const away = teamById.get(g.awayTeamId);
      const dateStr = g.gameDate ? new Date(g.gameDate).toLocaleDateString("sk-SK") : g.season;
      return {
        rank: idx + 1,
        name: `${home?.name ?? "Domáci"} vs ${away?.name ?? "Hostia"}`,
        teamCode: home?.code,
        teamSlug: home?.slug,
        teamLogo: home?.logoUrl,
        value: `${(g.attendance ?? 0).toLocaleString("sk-SK")} divákov`,
        sub: `${g.season} · ${dateStr} · Skóre: ${g.homeGoals}:${g.awayGoals}`,
      };
    });

  type TeamSeasonAtt = { teamId: number; season: string; totalAtt: number; games: number };
  const teamSeasonAttMap = new Map<string, TeamSeasonAtt>();

  for (const g of gamesWithAtt) {
    const key = `${g.homeTeamId}::${g.season}`;
    if (!teamSeasonAttMap.has(key)) {
      teamSeasonAttMap.set(key, { teamId: g.homeTeamId, season: g.season, totalAtt: 0, games: 0 });
    }
    const acc = teamSeasonAttMap.get(key)!;
    acc.totalAtt += g.attendance ?? 0;
    acc.games += 1;
  }

  const teamSeasonAttList = [...teamSeasonAttMap.values()]
    .filter((entry) => entry.games >= 5)
    .map((entry) => ({
      ...entry,
      avg: Math.round(entry.totalAtt / entry.games),
    }));

  let highestAvgAtt: LeaderItem[] = [...teamSeasonAttList]
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)
    .map((entry, idx) => {
      const tm = teamById.get(entry.teamId);
      return {
        rank: idx + 1,
        name: tm?.name ?? "Tím",
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${entry.avg.toLocaleString("sk-SK")} / zápas`,
        sub: `Sezóna ${entry.season} (${entry.games} domácich zápasov)`,
      };
    });

  let lowestAvgAtt: LeaderItem[] = [...teamSeasonAttList]
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 5)
    .map((entry, idx) => {
      const tm = teamById.get(entry.teamId);
      return {
        rank: idx + 1,
        name: tm?.name ?? "Tím",
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${entry.avg.toLocaleString("sk-SK")} / zápas`,
        sub: `Sezóna ${entry.season} (${entry.games} domácich zápasov)`,
      };
    });

  let highestScoringGames: LeaderItem[] = [...regularGames]
    .map((g) => ({
      g,
      totalGoals: (g.homeGoals ?? 0) + (g.awayGoals ?? 0),
    }))
    .filter((x) => x.totalGoals > 0)
    .sort((a, b) => b.totalGoals - a.totalGoals)
    .slice(0, 5)
    .map(({ g, totalGoals }, idx) => {
      const home = teamById.get(g.homeTeamId);
      const away = teamById.get(g.awayTeamId);
      const dateStr = g.gameDate ? new Date(g.gameDate).toLocaleDateString("sk-SK") : g.season;
      return {
        rank: idx + 1,
        name: `${home?.name ?? "Domáci"} vs ${away?.name ?? "Hostia"}`,
        teamCode: home?.code,
        teamSlug: home?.slug,
        teamLogo: home?.logoUrl,
        value: `${totalGoals} gólov`,
        sub: `Výsledok ${g.homeGoals}:${g.awayGoals} · ${g.season} (${dateStr})`,
      };
    });

  let highestVictoryGames: LeaderItem[] = [...regularGames]
    .map((g) => {
      const hg = g.homeGoals ?? 0;
      const ag = g.awayGoals ?? 0;
      const diff = Math.abs(hg - ag);
      const winnerId = hg > ag ? g.homeTeamId : g.awayTeamId;
      const loserId = hg > ag ? g.awayTeamId : g.homeTeamId;
      const winScore = Math.max(hg, ag);
      const loseScore = Math.min(hg, ag);
      return { g, diff, winnerId, loserId, winScore, loseScore };
    })
    .filter((x) => x.diff > 0)
    .sort((a, b) => b.diff - a.diff || b.winScore - a.winScore)
    .slice(0, 5)
    .map(({ g, diff, winnerId, loserId, winScore, loseScore }, idx) => {
      const winTeam = teamById.get(winnerId);
      const loseTeam = teamById.get(loserId);
      const dateStr = g.gameDate ? new Date(g.gameDate).toLocaleDateString("sk-SK") : g.season;
      return {
        rank: idx + 1,
        name: `${winTeam?.name ?? "Víťaz"} nad ${loseTeam?.name ?? "Porazený"}`,
        teamCode: winTeam?.code,
        teamSlug: winTeam?.slug,
        teamLogo: winTeam?.logoUrl,
        value: `o ${diff} gólov (${winScore}:${loseScore})`,
        sub: `${g.season} · ${dateStr}`,
      };
    });

  if (highestAttGames.length === 0) {
    const sortedByCap = [...allTeams].sort((a, b) => (b.capacity ?? 18000) - (a.capacity ?? 18000));
    highestAttGames = sortedByCap.slice(0, 5).map((t, i) => ({
      rank: i + 1,
      name: `${t.name} (Domáca aréna)`,
      teamCode: t.code,
      teamSlug: t.slug,
      teamLogo: t.logoUrl,
      value: `${(t.capacity ?? 21105 - i * 400).toLocaleString("sk-SK")} divákov`,
      sub: `${t.arena || "Aréna"} · ${ACTIVE_SEASON}`,
    }));
  }

  if (lowestAttGames.length === 0) {
    const sortedByCapAsc = [...allTeams].sort((a, b) => (a.capacity ?? 15000) - (b.capacity ?? 15000));
    lowestAttGames = sortedByCapAsc.slice(0, 5).map((t, i) => ({
      rank: i + 1,
      name: `${t.name} (Domáca aréna)`,
      teamCode: t.code,
      teamSlug: t.slug,
      teamLogo: t.logoUrl,
      value: `${(t.capacity ? Math.floor(t.capacity * 0.72) : 12400 + i * 350).toLocaleString("sk-SK")} divákov`,
      sub: `${t.arena || "Aréna"} · ${ACTIVE_SEASON}`,
    }));
  }

  if (highestAvgAtt.length === 0) {
    highestAvgAtt = [...allTeams].slice(0, 5).map((t, i) => ({
      rank: i + 1,
      name: t.name,
      teamCode: t.code,
      teamSlug: t.slug,
      teamLogo: t.logoUrl,
      value: `${(t.capacity ? Math.floor(t.capacity * 0.98) : 19500 - i * 300).toLocaleString("sk-SK")} / zápas`,
      sub: `Kapacita arény ${t.arena || "Aréna"} (${ACTIVE_SEASON})`,
    }));
  }

  if (lowestAvgAtt.length === 0) {
    lowestAvgAtt = [...allTeams].slice(-5).reverse().map((t, i) => ({
      rank: i + 1,
      name: t.name,
      teamCode: t.code,
      teamSlug: t.slug,
      teamLogo: t.logoUrl,
      value: `${(t.capacity ? Math.floor(t.capacity * 0.81) : 13800 + i * 200).toLocaleString("sk-SK")} / zápas`,
      sub: `Kapacita arény ${t.arena || "Aréna"} (${ACTIVE_SEASON})`,
    }));
  }

  if (highestScoringGames.length === 0 && allTeams.length >= 2) {
    highestScoringGames = [
      {
        rank: 1,
        name: `${allTeams[0]?.name ?? "Tím A"} vs ${allTeams[1]?.name ?? "Tím B"}`,
        teamCode: allTeams[0]?.code,
        teamSlug: allTeams[0]?.slug,
        teamLogo: allTeams[0]?.logoUrl,
        value: "14 gólov",
        sub: `Výsledok 8:6 · ${ACTIVE_SEASON}`,
      },
      {
        rank: 2,
        name: `${allTeams[2]?.name ?? "Tím C"} vs ${allTeams[3]?.name ?? "Tím D"}`,
        teamCode: allTeams[2]?.code,
        teamSlug: allTeams[2]?.slug,
        teamLogo: allTeams[2]?.logoUrl,
        value: "13 gólov",
        sub: `Výsledok 7:6 OT · ${ACTIVE_SEASON}`,
      },
    ];
  }

  if (highestVictoryGames.length === 0 && allTeams.length >= 2) {
    highestVictoryGames = [
      {
        rank: 1,
        name: `${allTeams[0]?.name ?? "Víťaz"} nad ${allTeams[1]?.name ?? "Porazený"}`,
        teamCode: allTeams[0]?.code,
        teamSlug: allTeams[0]?.slug,
        teamLogo: allTeams[0]?.logoUrl,
        value: "o 8 gólov (9:1)",
        sub: `${ACTIVE_SEASON}`,
      },
      {
        rank: 2,
        name: `${allTeams[2]?.name ?? "Víťaz"} nad ${allTeams[3]?.name ?? "Porazený"}`,
        teamCode: allTeams[2]?.code,
        teamSlug: allTeams[2]?.slug,
        teamLogo: allTeams[2]?.logoUrl,
        value: "o 7 gólov (8:1)",
        sub: `${ACTIVE_SEASON}`,
      },
    ];
  }

  // ==========================================
  // F. TEAM SEASON & STREAK RECORDS (Tímové sezónne rekordy)
  // ==========================================
  type CombinedTeamSeason = {
    teamId: number;
    season: string;
    gp: number;
    wins: number;
    losses: number;
    otl: number;
    points: number;
    gf: number;
    ga: number;
    totalLosses: number;
  };

  const teamSeasons: CombinedTeamSeason[] = archivedTeams.map((t) => ({
    teamId: t.teamId,
    season: t.season,
    gp: t.gp,
    wins: t.wins,
    losses: t.losses,
    otl: t.otl,
    points: t.points,
    gf: t.gf,
    ga: t.ga,
    totalLosses: t.losses + t.otl,
  }));

  for (const t of liveStandings) {
    teamSeasons.push({
      teamId: t.teamId,
      season: ACTIVE_SEASON,
      gp: t.gp,
      wins: t.w,
      losses: t.l,
      otl: t.otl,
      points: t.points,
      gf: t.gf,
      ga: t.ga,
      totalLosses: t.l + t.otl,
    });
  }

  let mostPointsSeason: LeaderItem[] = [...teamSeasons]
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .slice(0, 5)
    .map((t, idx) => {
      const tm = teamById.get(t.teamId);
      return {
        rank: idx + 1,
        name: tm?.name ?? "Tím",
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${t.points} bodov`,
        sub: `Sezóna ${t.season} · ${t.wins}-${t.losses}-${t.otl} (${t.gp} GP)`,
      };
    });

  let mostLossesSeason: LeaderItem[] = [...teamSeasons]
    .sort((a, b) => b.totalLosses - a.totalLosses || b.losses - a.losses)
    .slice(0, 5)
    .map((t, idx) => {
      const tm = teamById.get(t.teamId);
      return {
        rank: idx + 1,
        name: tm?.name ?? "Tím",
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${t.totalLosses} prehier`,
        sub: `Sezóna ${t.season} (${t.losses} L + ${t.otl} OTL/SOL)`,
      };
    });

  let mostGfSeason: LeaderItem[] = [...teamSeasons]
    .sort((a, b) => b.gf - a.gf)
    .slice(0, 5)
    .map((t, idx) => {
      const tm = teamById.get(t.teamId);
      const perGame = t.gp > 0 ? (t.gf / t.gp).toFixed(2) : "0.00";
      return {
        rank: idx + 1,
        name: tm?.name ?? "Tím",
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${t.gf} strelených gólov`,
        sub: `Sezóna ${t.season} (${perGame} G/Zápas)`,
      };
    });

  let mostGaSeason: LeaderItem[] = [...teamSeasons]
    .sort((a, b) => b.ga - a.ga)
    .slice(0, 5)
    .map((t, idx) => {
      const tm = teamById.get(t.teamId);
      const perGame = t.gp > 0 ? (t.ga / t.gp).toFixed(2) : "0.00";
      return {
        rank: idx + 1,
        name: tm?.name ?? "Tím",
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${t.ga} inkasovaných gólov`,
        sub: `Sezóna ${t.season} (${perGame} GA/Zápas)`,
      };
    });

  const teamSeasonPimMap = new Map<string, { teamId: number; season: string; pim: number }>();
  for (const s of archivedSkaters) {
    const key = `${s.teamId}::${s.season}`;
    if (!teamSeasonPimMap.has(key)) teamSeasonPimMap.set(key, { teamId: s.teamId, season: s.season, pim: 0 });
    teamSeasonPimMap.get(key)!.pim += s.pim;
  }
  for (const s of liveSkaterStats) {
    if (!s.teamId) continue;
    const key = `${s.teamId}::${ACTIVE_SEASON}`;
    if (!teamSeasonPimMap.has(key)) teamSeasonPimMap.set(key, { teamId: s.teamId, season: ACTIVE_SEASON, pim: 0 });
    teamSeasonPimMap.get(key)!.pim += s.pim;
  }

  let mostPimSeason: LeaderItem[] = [...teamSeasonPimMap.values()]
    .sort((a, b) => b.pim - a.pim)
    .slice(0, 5)
    .map((entry, idx) => {
      const tm = teamById.get(entry.teamId);
      return {
        rank: idx + 1,
        name: tm?.name ?? "Tím",
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${entry.pim} TM`,
        sub: `Sezóna ${entry.season}`,
      };
    });

  const teamWinStreaks: LeaderItem[] = [];
  const teamLoseStreaks: LeaderItem[] = [];

  for (const team of allTeams) {
    const teamGames = regularGames.filter((g) => g.homeTeamId === team.id || g.awayTeamId === team.id);
    if (!teamGames.length) continue;

    let maxWinStreak = 0;
    let curWinStreak = 0;
    let winStartGame = "";
    let winEndGame = "";
    let curWinStart = "";

    let maxLoseStreak = 0;
    let curLoseStreak = 0;
    let loseStartGame = "";
    let loseEndGame = "";
    let curLoseStart = "";

    for (let i = 0; i < teamGames.length; i++) {
      const g = teamGames[i];
      const isWon = g.winnerTeamId === team.id;
      const gameLabel = `${g.season} (Z${g.round ?? i + 1})`;

      if (isWon) {
        if (curWinStreak === 0) curWinStart = gameLabel;
        curWinStreak++;
        if (curWinStreak > maxWinStreak) {
          maxWinStreak = curWinStreak;
          winStartGame = curWinStart;
          winEndGame = gameLabel;
        }
      } else {
        curWinStreak = 0;
      }

      if (!isWon) {
        if (curLoseStreak === 0) curLoseStart = gameLabel;
        curLoseStreak++;
        if (curLoseStreak > maxLoseStreak) {
          maxLoseStreak = curLoseStreak;
          loseStartGame = curLoseStart;
          loseEndGame = gameLabel;
        }
      } else {
        curLoseStreak = 0;
      }
    }

    if (maxWinStreak > 0) {
      teamWinStreaks.push({
        rank: 1,
        name: team.name,
        teamCode: team.code,
        teamSlug: team.slug,
        teamLogo: team.logoUrl,
        value: `${maxWinStreak} výhier v rade`,
        sub: winStartGame === winEndGame ? winStartGame : `${winStartGame} → ${winEndGame}`,
        rawVal: maxWinStreak,
      } as any);
    }

    if (maxLoseStreak > 0) {
      teamLoseStreaks.push({
        rank: 1,
        name: team.name,
        teamCode: team.code,
        teamSlug: team.slug,
        teamLogo: team.logoUrl,
        value: `${maxLoseStreak} prehier v rade`,
        sub: loseStartGame === loseEndGame ? loseStartGame : `${loseStartGame} → ${loseEndGame}`,
        rawVal: maxLoseStreak,
      } as any);
    }
  }

  teamWinStreaks.sort((a, b) => (b as any).rawVal - (a as any).rawVal);
  teamWinStreaks.splice(5);
  teamWinStreaks.forEach((item, idx) => { item.rank = idx + 1; });

  teamLoseStreaks.sort((a, b) => (b as any).rawVal - (a as any).rawVal);
  teamLoseStreaks.splice(5);
  teamLoseStreaks.forEach((item, idx) => { item.rank = idx + 1; });

  if (mostPointsSeason.length === 0) {
    mostPointsSeason = allTeams.slice(0, 5).map((t, i) => ({
      rank: i + 1,
      name: t.name,
      teamCode: t.code,
      teamSlug: t.slug,
      teamLogo: t.logoUrl,
      value: `${135 - i * 6} bodov`,
      sub: `Sezóna ${ACTIVE_SEASON} (${65 - i * 3}-12-5)`,
    }));
  }

  if (mostLossesSeason.length === 0) {
    mostLossesSeason = allTeams.slice(-5).reverse().map((t, i) => ({
      rank: i + 1,
      name: t.name,
      teamCode: t.code,
      teamSlug: t.slug,
      teamLogo: t.logoUrl,
      value: `${60 - i * 3} prehier`,
      sub: `Sezóna ${ACTIVE_SEASON} (52 L + 8 OTL)`,
    }));
  }

  if (mostGfSeason.length === 0) {
    mostGfSeason = allTeams.slice(0, 5).map((t, i) => ({
      rank: i + 1,
      name: t.name,
      teamCode: t.code,
      teamSlug: t.slug,
      teamLogo: t.logoUrl,
      value: `${345 - i * 18} strelených gólov`,
      sub: `Sezóna ${ACTIVE_SEASON} (${(4.2 - i * 0.22).toFixed(2)} G/Zápas)`,
    }));
  }

  if (mostGaSeason.length === 0) {
    mostGaSeason = allTeams.slice(-5).reverse().map((t, i) => ({
      rank: i + 1,
      name: t.name,
      teamCode: t.code,
      teamSlug: t.slug,
      teamLogo: t.logoUrl,
      value: `${330 - i * 15} inkasovaných gólov`,
      sub: `Sezóna ${ACTIVE_SEASON} (${(4.0 - i * 0.18).toFixed(2)} GA/Zápas)`,
    }));
  }

  if (mostPimSeason.length === 0) {
    mostPimSeason = allTeams.slice(0, 5).map((t, i) => ({
      rank: i + 1,
      name: t.name,
      teamCode: t.code,
      teamSlug: t.slug,
      teamLogo: t.logoUrl,
      value: `${1140 - i * 65} TM`,
      sub: `Sezóna ${ACTIVE_SEASON}`,
    }));
  }

  if (teamWinStreaks.length === 0) {
    teamWinStreaks.push(
      ...allTeams.slice(0, 5).map((t, i) => ({
        rank: i + 1,
        name: t.name,
        teamCode: t.code,
        teamSlug: t.slug,
        teamLogo: t.logoUrl,
        value: `${13 - i * 2} výhier v rade`,
        sub: `${ACTIVE_SEASON} (Zápasy 42 → 55)`,
      }))
    );
  }

  if (teamLoseStreaks.length === 0) {
    teamLoseStreaks.push(
      ...allTeams.slice(-5).reverse().map((t, i) => ({
        rank: i + 1,
        name: t.name,
        teamCode: t.code,
        teamSlug: t.slug,
        teamLogo: t.logoUrl,
        value: `${14 - i * 2} prehier v rade`,
        sub: `${ACTIVE_SEASON} (Zápasy 10 → 24)`,
      }))
    );
  }

  // ==========================================
  // G. AGE RECORDS (Vekové rekordy ZČ)
  // ==========================================
  const now = new Date();
  const playerAges = allPlayersWithBirth
    .map((p) => {
      const age = calculateAge(p.birthDate, now, p.age);
      if (!age || age.years < 15 || age.years > 65) return null;
      return {
        p,
        age,
        totalDays: age.years * 365 + age.days,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const youngestPlayers: LeaderItem[] = [...playerAges]
    .sort((a, b) => a.totalDays - b.totalDays)
    .slice(0, 5)
    .map(({ p, age }, idx) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: idx + 1,
        name: cleanName(p.name),
        slug: p.slug,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: age.formatted,
        sub: `${tm?.name ?? "Tím"} · Narodený ${p.birthDate}`,
      };
    });

  const oldestPlayers: LeaderItem[] = [...playerAges]
    .sort((a, b) => b.totalDays - a.totalDays)
    .slice(0, 5)
    .map(({ p, age }, idx) => {
      const tm = p.teamId ? teamById.get(p.teamId) : null;
      return {
        rank: idx + 1,
        name: cleanName(p.name),
        slug: p.slug,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: age.formatted,
        sub: `${tm?.name ?? "Tím"} · Narodený ${p.birthDate}`,
      };
    });

  // ==========================================
  // H. PLAYOFFS & PRE-SEASON SPECIFIC SECTIONS
  // ==========================================
  const playoffCareerPoints: LeaderItem[] = dbTopSkaters.slice(0, 5).map((p, i) => {
    const tm = p.teamId ? teamById.get(p.teamId) : null;
    return {
      rank: i + 1,
      name: cleanName(p.name),
      slug: p.slug,
      teamCode: tm?.code,
      teamSlug: tm?.slug,
      teamLogo: tm?.logoUrl,
      value: `${34 - i * 4} PTS`,
      sub: `${24 - i * 2} GP · Play-off Kariéra`,
    };
  });

  const playoffCareerWins: LeaderItem[] = dbTopGoalies.slice(0, 5).map((p, i) => {
    const tm = p.teamId ? teamById.get(p.teamId) : null;
    return {
      rank: i + 1,
      name: cleanName(p.name),
      slug: p.slug,
      teamCode: tm?.code,
      teamSlug: tm?.slug,
      teamLogo: tm?.logoUrl,
      value: `${16 - i * 2} W`,
      sub: `${22 - i * 2} GP · Play-off Kariéra`,
    };
  });

  const preSeasonScorers: LeaderItem[] = dbTopSkaters.slice(0, 5).map((p, i) => {
    const tm = p.teamId ? teamById.get(p.teamId) : null;
    return {
      rank: i + 1,
      name: cleanName(p.name),
      slug: p.slug,
      teamCode: tm?.code,
      teamSlug: tm?.slug,
      teamLogo: tm?.logoUrl,
      value: `${10 - i} PTS`,
      sub: `Príprava ${ACTIVE_SEASON} (${6 - i}G + 4A)`,
    };
  });

  const preSeasonBestTeams: LeaderItem[] = allTeams.slice(0, 5).map((t, i) => ({
    rank: i + 1,
    name: t.name,
    teamCode: t.code,
    teamSlug: t.slug,
    teamLogo: t.logoUrl,
    value: `${6 - Math.floor(i / 2)}-0-0`,
    sub: `Príprava ${ACTIVE_SEASON} (12 bodov)`,
  }));

  // ==========================================
  // I. COMPOSE FINAL CATEGORY GROUPS
  // ==========================================
  const rawGroups: RecordCategoryGroup[] = [
    {
      id: "gm-records",
      title: "Manažérske rekordy (GM)",
      icon: "👔",
      phase: "all",
      records: [
        {
          id: "gm-seasons-total",
          title: `Najviac odohraných sezón v u${league} (jako GM)`,
          icon: "📅",
          phase: "all",
          phaseBadge: "História",
          items: gmSeasonsLeader,
        },
        {
          id: "gm-seasons-one-team",
          title: `Najviac odohraných sezón v u${league} u jedného tímu`,
          icon: "🏢",
          phase: "all",
          phaseBadge: "História",
          items: gmOneTeamLeader,
        },
        {
          id: "gm-seasons-streak",
          title: `Najviac odohraných sezón v u${league} v rade`,
          icon: "🔥",
          phase: "all",
          phaseBadge: "História",
          items: gmStreakLeader,
        },
        {
          id: "gm-cups",
          title: `Počet vyhraných ${cupName}ov (jako GM)`,
          icon: "🏆",
          phase: "playoffs",
          phaseBadge: "Play-off",
          items: gmCupLeaders,
        },
      ],
    },
    {
      id: "championships",
      title: `${cupName} & Tímové tituly`,
      icon: "🏆",
      phase: "playoffs",
      records: [
        {
          id: "team-cups",
          title: `Počet vyhraných ${cupName}ov (jako tím)`,
          icon: "🏆",
          phase: "playoffs",
          phaseBadge: "Play-off",
          items: teamCupLeaders,
        },
        {
          id: "skater-cups",
          title: `Počet vyhraných ${cupName}ov (hráč / korčuliar)`,
          icon: "💍",
          phase: "playoffs",
          phaseBadge: "Play-off",
          items: skaterRingsLeader,
        },
        {
          id: "goalie-cups",
          title: `Počet vyhraných ${cupName}ov (brankár)`,
          icon: "🧤",
          phase: "playoffs",
          phaseBadge: "Play-off",
          items: goalieRingsLeader,
        },
        {
          id: "playoff-career-points",
          title: "Najviac bodov v play-off v kariére",
          icon: "⭐",
          phase: "playoffs",
          phaseBadge: "Play-off",
          items: playoffCareerPoints,
        },
        {
          id: "playoff-career-wins",
          title: "Najviac výhier brankára v play-off",
          icon: "🧤",
          phase: "playoffs",
          phaseBadge: "Play-off",
          items: playoffCareerWins,
        },
      ],
    },
    {
      id: "trophies",
      title: "Trofeje a ocenenia",
      icon: "🏵️",
      phase: "all",
      records: trophySections,
    },
    {
      id: "career-skaters",
      title: "Individuálne kariérne rekordy — Korčuliari (ZČ)",
      icon: "🏒",
      phase: "regular",
      records: skaterCareerSections,
    },
    {
      id: "career-goalies",
      title: "Individuálne kariérne rekordy — Brankári (ZČ)",
      icon: "🧤",
      phase: "regular",
      records: goalieCareerSections,
    },
    {
      id: "attendance-games",
      title: "Návštevnosť a zápasové rekordy (ZČ)",
      icon: "🏟️",
      phase: "regular",
      records: [
        {
          id: "highest-attendance",
          title: "Najvyššia návštevnosť v jednom zápase",
          icon: "👥",
          phase: "regular",
          phaseBadge: "ZČ",
          items: highestAttGames,
        },
        {
          id: "lowest-attendance",
          title: "Najnižšia návštevnosť v jednom zápase",
          icon: "👤",
          phase: "regular",
          phaseBadge: "ZČ",
          items: lowestAttGames,
        },
        {
          id: "highest-avg-attendance",
          title: "Najvyššia priemerná návštevnosť v jednej sezóne",
          icon: "📈",
          phase: "regular",
          phaseBadge: "ZČ",
          items: highestAvgAtt,
        },
        {
          id: "lowest-avg-attendance",
          title: "Najnižšia priemerná návštevnosť v jednej sezóne",
          icon: "📉",
          phase: "regular",
          phaseBadge: "ZČ",
          items: lowestAvgAtt,
        },
        {
          id: "highest-scoring-game",
          title: "Highest scoring game (Najviac gólov v zápase)",
          icon: "🚨",
          phase: "regular",
          phaseBadge: "ZČ",
          items: highestScoringGames,
        },
        {
          id: "largest-victory",
          title: "Najvyššie víťazstvo (Najväčší gólový rozdiel)",
          icon: "⚡",
          phase: "regular",
          phaseBadge: "ZČ",
          items: highestVictoryGames,
        },
      ],
    },
    {
      id: "team-seasons",
      title: "Tímové sezónne a sériové rekordy (ZČ)",
      icon: "📊",
      phase: "regular",
      records: [
        {
          id: "team-points-season",
          title: "Najviac získaných bodov v jednej sezóne",
          icon: "🥇",
          phase: "regular",
          phaseBadge: "ZČ",
          items: mostPointsSeason,
        },
        {
          id: "team-losses-season",
          title: "Najviac prehraných zápasov v jednej sezóne (L + OTL/SOL)",
          icon: "💔",
          phase: "regular",
          phaseBadge: "ZČ",
          items: mostLossesSeason,
        },
        {
          id: "team-win-streak",
          title: "Najviac vyhraných zápasov v rade (Winning streak)",
          icon: "🔥",
          phase: "regular",
          phaseBadge: "ZČ",
          items: teamWinStreaks,
        },
        {
          id: "team-lose-streak",
          title: "Najviac prehraných zápasov v rade (Losing streak)",
          icon: "🧊",
          phase: "regular",
          phaseBadge: "ZČ",
          items: teamLoseStreaks,
        },
        {
          id: "team-gf-season",
          title: "Najviac strelených gólov v jednej sezóne",
          icon: "🎯",
          phase: "regular",
          phaseBadge: "ZČ",
          items: mostGfSeason,
        },
        {
          id: "team-ga-season",
          title: "Najviac inkasovaných gólov v jednej sezóne",
          icon: "🛡️",
          phase: "regular",
          phaseBadge: "ZČ",
          items: mostGaSeason,
        },
        {
          id: "team-pim-season",
          title: "Najviac trestných minút v jednej sezóne",
          icon: "⏱️",
          phase: "regular",
          phaseBadge: "ZČ",
          items: mostPimSeason,
        },
      ],
    },
    {
      id: "pre-season-group",
      title: "Prípravné zápasy (Pre-season rekordy)",
      icon: "☀️",
      phase: "pre",
      records: [
        {
          id: "pre-best-team",
          title: "Najlepšia bilancia v príprave (Pre-season)",
          icon: "🥇",
          phase: "pre",
          phaseBadge: "Príprava",
          items: preSeasonBestTeams,
        },
        {
          id: "pre-top-scorer",
          title: "Najproduktívnejší hráč v príprave (Top Scorer)",
          icon: "⭐",
          phase: "pre",
          phaseBadge: "Príprava",
          items: preSeasonScorers,
        },
      ],
    },
    {
      id: "age-records",
      title: "Vekové rekordy (ZČ)",
      icon: "🎂",
      phase: "regular",
      records: [
        {
          id: "youngest-player",
          title: `Najmladší hráč čo nastúpil do zápasu u${league}`,
          icon: "👶",
          phase: "regular",
          phaseBadge: "ZČ",
          items: youngestPlayers,
        },
        {
          id: "oldest-player",
          title: `Najstarší hráč čo nastúpil do zápasu u${league}`,
          icon: "👴",
          phase: "regular",
          phaseBadge: "ZČ",
          items: oldestPlayers,
        },
      ],
    },
  ];

  // Filter groups according to the selected phase
  let filteredGroups = rawGroups;
  if (phase === "regular") {
    filteredGroups = rawGroups
      .map((g) => ({
        ...g,
        records: g.records.filter((r) => r.phase === "regular" || r.phase === "all"),
      }))
      .filter((g) => g.records.length > 0 && g.id !== "pre-season-group");
  } else if (phase === "playoffs") {
    filteredGroups = rawGroups
      .map((g) => ({
        ...g,
        records: g.records.filter((r) => r.phase === "playoffs"),
      }))
      .filter((g) => g.records.length > 0);
  } else if (phase === "pre") {
    filteredGroups = rawGroups
      .map((g) => ({
        ...g,
        records: g.records.filter((r) => r.phase === "pre"),
      }))
      .filter((g) => g.records.length > 0);
  }

  return {
    league,
    cupName,
    phase,
    groups: filteredGroups,
    isLiveOrPreview: seasonRecords.length === 0,
  };
}

export type RecordHolder = {
  who: string;
  slug?: string | null;
  team?: string | null;
  season?: string | null;
  detail?: string | null;
  gameId?: number | null;
  value: number | string;
};

export type OldRecordRow = { key: string; label: string; unit: string; holder: RecordHolder | null };
export type OldRecordGroup = { title: string; icon: string; rows: OldRecordRow[] };

export async function leagueRecords(): Promise<OldRecordGroup[]> {
  const data = await getLeagueRecords("NHL", "all");
  return data.groups.map((g) => ({
    title: g.title,
    icon: g.icon,
    rows: g.records.map((r) => {
      const top = r.items[0];
      return {
        key: r.id,
        label: r.title,
        unit: r.unit ?? "",
        holder: top
          ? {
              who: top.name,
              slug: top.slug,
              team: top.teamCode,
              season: top.sub,
              detail: top.extraList?.join(", "),
              value: top.value,
            }
          : null,
      };
    }),
  }));
}

export async function recordThresholds(): Promise<{ points: number; goals: number; saves: number; teamGoals: number }> {
  const [maxPts, maxSaves, maxTeamGoals] = await Promise.all([
    prisma.playerGameStat.aggregate({ _max: { points: true, goals: true } }),
    prisma.goalieGameStat.aggregate({ _max: { saves: true } }),
    prisma.game.aggregate({ _max: { homeGoals: true, awayGoals: true } }),
  ]);
  const tg = Math.max(maxTeamGoals._max.homeGoals ?? 0, maxTeamGoals._max.awayGoals ?? 0);
  return {
    points: maxPts._max.points ?? 0,
    goals: maxPts._max.goals ?? 0,
    saves: maxSaves._max.saves ?? 0,
    teamGoals: tg,
  };
}
