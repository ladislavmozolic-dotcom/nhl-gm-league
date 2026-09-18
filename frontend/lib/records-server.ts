import { prisma } from "@/lib/prisma";
import { cleanName, isRookieName } from "@/lib/playerName";
import { ACTIVE_SEASON } from "@/lib/career-server";
import { PRE_SEASON, REGULAR_SEASON } from "@/lib/phase";
import { teamManagerLabel } from "@/lib/team-gm";

export type LeaderTeamInfo = {
  code: string;
  slug?: string | null;
  logoUrl?: string | null;
};

export type LeaderItem = {
  rank: number;
  name: string;
  sub?: string;
  value: string | number;
  slug?: string | null;
  photoUrl?: string | null;
  gmSlug?: string | null;
  teamCode?: string | null;
  teamSlug?: string | null;
  teamLogo?: string | null;
  teams?: LeaderTeamInfo[];
  extraList?: string[];
  hideTeam?: boolean;
};

export type RecordPhase = "all" | "regular" | "playoffs" | "pre";
export type MainRecordCategory = "all" | "skaters" | "goalies" | "gms" | "teams" | "trophies" | "games" | "pre";

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
  mainCategory: "skaters" | "goalies" | "gms" | "teams" | "trophies" | "games" | "pre";
  records: RecordSection[];
};

export type LeagueRecordsData = {
  league: "NHL" | "AHL";
  cupName: string;
  phase: RecordPhase;
  category: MainRecordCategory;
  groups: RecordCategoryGroup[];
  isLiveOrPreview?: boolean;
};

function parseSeasonYear(s: string): number {
  const m = s.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : 2026;
}

function resolveTeams(teamIds: Set<number>, teamById: Map<number, any>): {
  teams?: LeaderTeamInfo[];
  teamCode?: string | null;
  teamLogo?: string | null;
  teamSlug?: string | null;
} {
  const list = [...teamIds]
    .map((id) => teamById.get(id))
    .filter(Boolean) as Array<{ code: string; slug?: string | null; logoUrl?: string | null }>;
  if (!list.length) return {};
  if (list.length === 1) {
    return {
      teamCode: list[0].code,
      teamLogo: list[0].logoUrl,
      teamSlug: list[0].slug,
    };
  }
  return {
    teams: list.map((t) => ({ code: t.code, slug: t.slug, logoUrl: t.logoUrl })),
    teamCode: list.map((t) => t.code).join(" / "),
    teamLogo: null,
    teamSlug: null,
  };
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
  phase: RecordPhase = "all",
  category: MainRecordCategory = "all"
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
      gmFirstName: true,
      gmLastName: true,
      gmNickname: true,
      passwordHash: true,
      arena: true,
      capacity: true,
      parentTeamId: true,
      parentTeam: {
        select: {
          id: true,
          name: true,
          code: true,
          slug: true,
          gm: true,
          gmFirstName: true,
          gmLastName: true,
          gmNickname: true,
          passwordHash: true,
        },
      },
    },
  });

  const teamById = new Map<number, (typeof allTeams)[number]>();
  allTeams.forEach((t) => teamById.set(t.id, t));

  const getTeamGm = (teamId: number | null | undefined): string => {
    if (!teamId) return "—";
    const tm = teamById.get(teamId);
    if (!tm) return "—";
    return teamManagerLabel(tm.parentTeam ? tm.parentTeam : tm);
  };

  // 2. Fetch Archived / Historical Record Data
  const [seasonRecords, seasonAwards, archivedSkaters, archivedGoalies, archivedTeams, allPlayersWithBirth] = await Promise.all([
    prisma.seasonRecord.findMany({ where: { league } }),
    prisma.seasonAward.findMany({ where: { league } }),
    prisma.playerSeasonStat.findMany({ where: { league } }),
    prisma.goalieSeasonStat.findMany({ where: { league } }),
    prisma.teamSeasonStat.findMany({ where: { league } }),
    prisma.player.findMany({
      where: { rosterType: isAhl ? "AHL" : "NHL" },
      select: { id: true, name: true, slug: true, photoUrl: true, position: true, isGoalie: true, birthDate: true, age: true, teamId: true, overall: true },
    }),
  ]);

  // 3. Fetch All Games (pre-season, regular season and playoffs)
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
      endedIn: true,
      goalEvents: { select: { teamId: true } },
    },
    orderBy: [
      { season: "asc" },
      { round: "asc" },
      { gameDate: "asc" },
      { id: "asc" },
    ],
  });

  const preGames = allFinalGames.filter((g) => g.season.endsWith("-PRE") || g.season === PRE_SEASON);
  const regularGames = allFinalGames.filter((g) => !g.season.endsWith("-PRE") && g.season !== PRE_SEASON && g.seriesId == null);
  const playoffGames = allFinalGames.filter((g) => g.seriesId != null);

  const allGameIds = allFinalGames.map((g) => g.id);

  // 4. Fetch Skater & Goalie Game Stats for all played games
  const [allSkaterStats, allGoalieStats] = await Promise.all([
    allGameIds.length
      ? prisma.playerGameStat.findMany({
          where: { gameId: { in: allGameIds } },
          select: {
            playerId: true,
            teamId: true,
            gameId: true,
            goals: true,
            assists: true,
            points: true,
            pim: true,
            plusMinus: true,
            ppGoals: true,
            ppAssists: true,
            shGoals: true,
            shAssists: true,
            shots: true,
            hits: true,
            blocks: true,
            game: { select: { id: true, gameDate: true, playedAt: true, season: true, seriesId: true, round: true, league: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true } },
          },
        })
      : Promise.resolve([]),
    allGameIds.length
      ? prisma.goalieGameStat.findMany({
          where: { gameId: { in: allGameIds }, started: true },
          select: {
            playerId: true,
            teamId: true,
            gameId: true,
            shotsAgainst: true,
            saves: true,
            goalsAgainst: true,
            decision: true,
            xga: true,
            game: { select: { id: true, gameDate: true, playedAt: true, season: true, seriesId: true, round: true, homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true, goalEvents: true, league: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  // Player cache
  const playerMap = new Map<number, typeof allPlayersWithBirth[number]>();
  allPlayersWithBirth.forEach((p) => playerMap.set(p.id, p));

  const allReferencedPlayerIds = new Set<number>();
  archivedSkaters.forEach((s) => allReferencedPlayerIds.add(s.playerId));
  archivedGoalies.forEach((g) => allReferencedPlayerIds.add(g.playerId));
  allSkaterStats.forEach((s) => allReferencedPlayerIds.add(s.playerId));
  allGoalieStats.forEach((g) => allReferencedPlayerIds.add(g.playerId));
  seasonAwards.forEach((a) => { if (a.playerId) allReferencedPlayerIds.add(a.playerId); });

  const missingIds = [...allReferencedPlayerIds].filter((id) => !playerMap.has(id));
  if (missingIds.length) {
    const extra = await prisma.player.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, name: true, slug: true, photoUrl: true, position: true, isGoalie: true, birthDate: true, age: true, teamId: true, overall: true },
    });
    extra.forEach((p) => playerMap.set(p.id, p));
  }

  // ==========================================
  // A. GM RECORDS (Manažérske rekordy)
  // ==========================================
  const gmTotalSeasons = new Map<string, { gm: string; teamId: number; seasons: Set<string> }>();
  const gmTeamSeasons = new Map<string, { gm: string; teamId: number; seasons: Set<string> }>();

  // Add historical seasons from archived teams
  for (const t of archivedTeams) {
    const gm = getTeamGm(t.teamId);
    if (!gm || gm === "—") continue;
    if (!gmTotalSeasons.has(gm)) gmTotalSeasons.set(gm, { gm, teamId: t.teamId, seasons: new Set() });
    gmTotalSeasons.get(gm)!.seasons.add(t.season);

    const key = `${gm}::${t.teamId}`;
    if (!gmTeamSeasons.has(key)) gmTeamSeasons.set(key, { gm, teamId: t.teamId, seasons: new Set() });
    gmTeamSeasons.get(key)!.seasons.add(t.season);
  }

  // Add active current season for all real registered GMs
  const activeLeagueTeams = allTeams.filter((t) => t.code !== "FA" && t.name !== "Free Agents");
  for (const tm of activeLeagueTeams) {
    const gm = getTeamGm(tm.id);
    if (!gm || gm === "—") continue;
    if (!gmTotalSeasons.has(gm)) gmTotalSeasons.set(gm, { gm, teamId: tm.id, seasons: new Set() });
    gmTotalSeasons.get(gm)!.seasons.add(ACTIVE_SEASON);

    const key = `${gm}::${tm.id}`;
    if (!gmTeamSeasons.has(key)) gmTeamSeasons.set(key, { gm, teamId: tm.id, seasons: new Set() });
    gmTeamSeasons.get(key)!.seasons.add(ACTIVE_SEASON);
  }

  const gmSeasonsLeader: LeaderItem[] = [...gmTotalSeasons.values()]
    .map((entry) => {
      const tm = teamById.get(entry.teamId);
      const parentTm = tm?.parentTeam ? tm.parentTeam : tm;
      const nick = parentTm?.gmNickname ? `@${parentTm.gmNickname}` : null;
      const sub = [nick, tm?.name].filter(Boolean).join(" · ");
      return {
        rank: 1,
        name: entry.gm,
        sub: sub || undefined,
        teamCode: tm?.code ?? tm?.name,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        gmSlug: parentTm?.slug,
        value: `${entry.seasons.size} ${entry.seasons.size === 1 ? "sezóna" : entry.seasons.size < 5 ? "sezóny" : "sezón"}`,
        rawVal: entry.seasons.size,
      };
    })
    .sort((a, b) => b.rawVal - a.rawVal || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const gmOneTeamLeader: LeaderItem[] = [...gmTeamSeasons.values()]
    .map((entry) => {
      const tm = teamById.get(entry.teamId);
      const parentTm = tm?.parentTeam ? tm.parentTeam : tm;
      const nick = parentTm?.gmNickname ? `@${parentTm.gmNickname}` : null;
      const sub = [nick, tm?.name].filter(Boolean).join(" · ");
      return {
        rank: 1,
        name: entry.gm,
        sub: sub || undefined,
        teamCode: tm?.code ?? tm?.name,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        gmSlug: parentTm?.slug,
        value: `${entry.seasons.size} ${entry.seasons.size === 1 ? "sezóna" : entry.seasons.size < 5 ? "sezóny" : "sezón"}`,
        rawVal: entry.seasons.size,
      };
    })
    .sort((a, b) => b.rawVal - a.rawVal || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const gmStreakLeader: LeaderItem[] = [...gmTotalSeasons.values()]
    .map((entry) => {
      const sortedSeasons = [...entry.seasons].sort();
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

      const tm = teamById.get(entry.teamId);
      const parentTm = tm?.parentTeam ? tm.parentTeam : tm;
      const nick = parentTm?.gmNickname ? `@${parentTm.gmNickname}` : null;
      const spanText = bestStart === bestEnd ? bestStart : `${bestStart} až ${bestEnd}`;
      const sub = [nick, spanText].filter(Boolean).join(" · ");

      return {
        rank: 1,
        name: entry.gm,
        sub,
        teamCode: tm?.code ?? tm?.name,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        gmSlug: parentTm?.slug,
        value: `${maxStreak} v rade`,
        rawVal: maxStreak,
      };
    })
    .sort((a, b) => b.rawVal - a.rawVal || a.name.localeCompare(b.name))
    .slice(0, 5)
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

  const teamCupLeaders: LeaderItem[] = [...teamCups.entries()]
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
    .slice(0, 5)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  const gmCups = new Map<string, Array<{ season: string; teamName: string; teamCode?: string }>>();
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

  const gmCupLeaders: LeaderItem[] = [...gmCups.entries()]
    .map(([gm, items]) => ({
      rank: 1,
      name: gm,
      value: `${items.length}× ${cupName}`,
      sub: items.map((i) => `${i.season} (${i.teamCode ?? i.teamName})`).join(", "),
      extraList: items.map((i) => `${i.season} (${i.teamCode ?? i.teamName})`),
      rawVal: items.length,
    }))
    .sort((a, b) => b.rawVal - a.rawVal)
    .slice(0, 5)
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
    const row: LeaderItem & { rawVal: number } = {
      rank: 1,
      name: cleanName(p.name),
      slug: p.slug,
      photoUrl: p.photoUrl,
      hideTeam: true,
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
  skaterRingsLeader.splice(5);
  skaterRingsLeader.forEach((item, idx) => { item.rank = idx + 1; });

  goalieRingsLeader.sort((a, b) => (b as any).rawVal - (a as any).rawVal);
  goalieRingsLeader.splice(5);
  goalieRingsLeader.forEach((item, idx) => { item.rank = idx + 1; });

  // ==========================================
  // D. SKATER & GOALIE SPLITS & DEBUT TRACKING
  // ==========================================
  const archivedRegSkaters = archivedSkaters.filter((s) => !s.isPlayoff);
  const archivedPlayoffSkaters = archivedSkaters.filter((s) => s.isPlayoff);
  const archivedRegGoalies = archivedGoalies.filter((g) => !g.isPlayoff);
  const archivedPlayoffGoalies = archivedGoalies.filter((g) => g.isPlayoff);

  const regSkaterStats = allSkaterStats.filter((s) => !s.game.season.endsWith("-PRE") && s.game.season !== PRE_SEASON && s.game.seriesId == null);
  const playoffSkaterStats = allSkaterStats.filter((s) => s.game.seriesId != null);
  const preSkaterStats = allSkaterStats.filter((s) => s.game.season.endsWith("-PRE") || s.game.season === PRE_SEASON);

  const regGoalieStats = allGoalieStats.filter((g) => !g.game.season.endsWith("-PRE") && g.game.season !== PRE_SEASON && g.game.seriesId == null);
  const playoffGoalieStats = allGoalieStats.filter((g) => g.game.seriesId != null);
  const preGoalieStats = allGoalieStats.filter((g) => g.game.season.endsWith("-PRE") || g.game.season === PRE_SEASON);

  // Debut season determination for rookie records
  const allSeasonOccurrences = new Map<number, Set<string>>();
  archivedSkaters.forEach((s) => {
    if (!allSeasonOccurrences.has(s.playerId)) allSeasonOccurrences.set(s.playerId, new Set());
    allSeasonOccurrences.get(s.playerId)!.add(s.season);
  });
  archivedGoalies.forEach((g) => {
    if (!allSeasonOccurrences.has(g.playerId)) allSeasonOccurrences.set(g.playerId, new Set());
    allSeasonOccurrences.get(g.playerId)!.add(g.season);
  });
  allSkaterStats.forEach((s) => {
    if (!allSeasonOccurrences.has(s.playerId)) allSeasonOccurrences.set(s.playerId, new Set());
    allSeasonOccurrences.get(s.playerId)!.add(s.game.season);
  });
  allGoalieStats.forEach((g) => {
    if (!allSeasonOccurrences.has(g.playerId)) allSeasonOccurrences.set(g.playerId, new Set());
    allSeasonOccurrences.get(g.playerId)!.add(g.game.season);
  });

  const playerDebutSeason = new Map<number, string>();
  for (const [pId, seasons] of allSeasonOccurrences.entries()) {
    const sorted = [...seasons].sort();
    if (sorted.length) playerDebutSeason.set(pId, sorted[0]);
  }

  // ==========================================
  // E. CAREER REGULAR-SEASON RECORDS (ZČ Kariéra)
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
    ppGoals: number;
    ppAssists: number;
    ppPoints: number;
    shGoals: number;
    shAssists: number;
    shPoints: number;
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
      acc = {
        playerId: id,
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        shots: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
        teamId: null,
      };
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

  // 1. Archived career stats (Regular season)
  for (const s of archivedRegSkaters) {
    const a = getSkAcc(s.playerId);
    a.gp += s.gp;
    a.goals += s.goals;
    a.assists += s.assists;
    a.points += s.points;
    a.shots += s.shots;
    a.pim += s.pim;
    a.plusMinus += s.plusMinus;
    a.ppGoals += s.ppGoals ?? 0;
    a.ppAssists += s.ppAssists ?? 0;
    a.ppPoints += (s.ppGoals ?? 0) + (s.ppAssists ?? 0);
    a.shGoals += s.shGoals ?? 0;
    a.shAssists += s.shAssists ?? 0;
    a.shPoints += (s.shGoals ?? 0) + (s.shAssists ?? 0);
    a.teamId = s.teamId;
  }

  for (const g of archivedRegGoalies) {
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

  // 2. Add regular season game stats from live games
  for (const s of regSkaterStats) {
    const a = getSkAcc(s.playerId);
    a.gp += 1;
    a.goals += s.goals;
    a.assists += s.assists;
    a.points += s.points;
    a.shots += s.shots;
    a.pim += s.pim;
    a.plusMinus += s.plusMinus;
    a.ppGoals += s.ppGoals ?? 0;
    a.ppAssists += s.ppAssists ?? 0;
    a.ppPoints += (s.ppGoals ?? 0) + (s.ppAssists ?? 0);
    a.shGoals += s.shGoals ?? 0;
    a.shAssists += s.shAssists ?? 0;
    a.shPoints += (s.shGoals ?? 0) + (s.shAssists ?? 0);
    if (s.teamId) a.teamId = s.teamId;
  }

  for (const g of regGoalieStats) {
    const a = getGlAcc(g.playerId);
    a.gp += 1;
    a.shotsAgainst += g.shotsAgainst;
    a.saves += g.saves;
    a.goalsAgainst += g.goalsAgainst;
    if (g.teamId) a.teamId = g.teamId;

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

  const skRowItem = (s: { playerId: number }, val: string | number, sub?: string): LeaderItem => {
    const p = playerMap.get(s.playerId);
    return {
      rank: 1,
      name: p ? cleanName(p.name) : "—",
      slug: p?.slug,
      photoUrl: p?.photoUrl,
      hideTeam: true,
      value: val,
      sub,
    };
  };

  const glRowItem = (g: { playerId: number }, val: string | number, sub?: string): LeaderItem => {
    const p = playerMap.get(g.playerId);
    return {
      rank: 1,
      name: p ? cleanName(p.name) : "—",
      slug: p?.slug,
      photoUrl: p?.photoUrl,
      hideTeam: true,
      value: val,
      sub,
    };
  };

  const skList = [...skCareerMap.values()];
  const glList = [...glCareerMap.values()];

  const topSkaters = (fn: (s: SkaterCareerAcc) => number, valFmt: (s: SkaterCareerAcc) => string | number, subFmt?: (s: SkaterCareerAcc) => string, sortAsc = false) =>
    [...skList]
      .filter((s) => (sortAsc ? fn(s) < 0 : fn(s) > 0))
      .sort((a, b) => (sortAsc ? fn(a) - fn(b) : fn(b) - fn(a)))
      .slice(0, 5)
      .map((s, idx) => ({ ...skRowItem(s, valFmt(s), subFmt?.(s)), rank: idx + 1 }));

  const topGoalies = (fn: (g: GoalieCareerAcc) => number, valFmt: (g: GoalieCareerAcc) => string | number, subFmt?: (g: GoalieCareerAcc) => string) =>
    [...glList]
      .filter((g) => fn(g) !== 0)
      .sort((a, b) => fn(b) - fn(a))
      .slice(0, 5)
      .map((g, idx) => ({ ...glRowItem(g, valFmt(g), subFmt?.(g)), rank: idx + 1 }));

  const careerGpItems = topSkaters((s) => s.gp, (s) => `${s.gp} GP`, (s) => `${s.goals}G + ${s.assists}A · ${s.points} PTS`);
  const careerGoalsItems = topSkaters((s) => s.goals, (s) => `${s.goals} G`, (s) => `${s.gp} GP · ${s.points} PTS`);
  const careerAssistsItems = topSkaters((s) => s.assists, (s) => `${s.assists} A`, (s) => `${s.gp} GP · ${s.points} PTS`);
  const careerPointsItems = topSkaters((s) => s.points, (s) => `${s.points} PTS`, (s) => `${s.goals}G + ${s.assists}A (${s.gp} GP)`);
  const careerPimItems = topSkaters((s) => s.pim, (s) => `${s.pim} TM`, (s) => `${s.gp} GP · ${s.points} PTS`);
  const careerPlusMinusBestItems = topSkaters((s) => s.plusMinus, (s) => `+${s.plusMinus} +/-`, (s) => `${s.gp} GP · ${s.points} PTS`);
  const careerPlusMinusWorstItems = topSkaters((s) => s.plusMinus, (s) => `${s.plusMinus} +/-`, (s) => `${s.gp} GP · ${s.points} PTS`, true);

  const careerPpGoalsItems = topSkaters((s) => s.ppGoals, (s) => `${s.ppGoals} PPG`, (s) => `${s.goals} G celkovo · ${s.gp} GP`);
  const careerPpAssistsItems = topSkaters((s) => s.ppAssists, (s) => `${s.ppAssists} PPA`, (s) => `${s.assists} A celkovo · ${s.gp} GP`);
  const careerPpPointsItems = topSkaters((s) => s.ppPoints, (s) => `${s.ppPoints} PPP`, (s) => `${s.ppGoals} PPG + ${s.ppAssists} PPA (${s.points} PTS)`);

  const careerShGoalsItems = topSkaters((s) => s.shGoals, (s) => `${s.shGoals} SHG`, (s) => `${s.goals} G celkovo · ${s.gp} GP`);
  const careerShAssistsItems = topSkaters((s) => s.shAssists, (s) => `${s.shAssists} SHA`, (s) => `${s.assists} A celkovo · ${s.gp} GP`);
  const careerShPointsItems = topSkaters((s) => s.shPoints, (s) => `${s.shPoints} SHP`, (s) => `${s.shGoals} SHG + ${s.shAssists} SHA (${s.points} PTS)`);

  // Streaks across regular season games
  const playerRegGameStats = new Map<number, typeof regSkaterStats>();
  for (const s of regSkaterStats) {
    if (!playerRegGameStats.has(s.playerId)) playerRegGameStats.set(s.playerId, []);
    playerRegGameStats.get(s.playerId)!.push(s);
  }

  for (const [, list] of playerRegGameStats.entries()) {
    list.sort((a, b) => {
      const da = a.game.gameDate ? new Date(a.game.gameDate).getTime() : 0;
      const db = b.game.gameDate ? new Date(b.game.gameDate).getTime() : 0;
      return da - db || a.gameId - b.gameId;
    });
  }

  type StreakInfo = { playerId: number; streak: number; startSeason: string; endSeason: string };
  const goalStreaks: StreakInfo[] = [];
  const assistStreaks: StreakInfo[] = [];
  const pointStreaks: StreakInfo[] = [];
  const ironmanStreaks: StreakInfo[] = [];

  for (const [pId, list] of playerRegGameStats.entries()) {
    let maxG = 0, curG = 0, startG = "", curStartG = "", endG = "";
    let maxA = 0, curA = 0, startA = "", curStartA = "", endA = "";
    let maxP = 0, curP = 0, startP = "", curStartP = "", endP = "";
    let maxIron = 0, curIron = 0, startIron = "", curStartIron = "", endIron = "";

    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      const seas = g.game.season;

      // Iron
      if (curIron === 0) curStartIron = seas;
      curIron++;
      if (curIron > maxIron) {
        maxIron = curIron;
        startIron = curStartIron;
        endIron = seas;
      }

      // Goal
      if (g.goals > 0) {
        if (curG === 0) curStartG = seas;
        curG++;
        if (curG > maxG) {
          maxG = curG;
          startG = curStartG;
          endG = seas;
        }
      } else {
        curG = 0;
      }

      // Assist
      if (g.assists > 0) {
        if (curA === 0) curStartA = seas;
        curA++;
        if (curA > maxA) {
          maxA = curA;
          startA = curStartA;
          endA = seas;
        }
      } else {
        curA = 0;
      }

      // Point
      if (g.points > 0) {
        if (curP === 0) curStartP = seas;
        curP++;
        if (curP > maxP) {
          maxP = curP;
          startP = curStartP;
          endP = seas;
        }
      } else {
        curP = 0;
      }
    }

    if (maxIron > 0) ironmanStreaks.push({ playerId: pId, streak: maxIron, startSeason: startIron, endSeason: endIron });
    if (maxG > 0) goalStreaks.push({ playerId: pId, streak: maxG, startSeason: startG, endSeason: endG });
    if (maxA > 0) assistStreaks.push({ playerId: pId, streak: maxA, startSeason: startA, endSeason: endA });
    if (maxP > 0) pointStreaks.push({ playerId: pId, streak: maxP, startSeason: startP, endSeason: endP });
  }

  const buildStreakLeader = (list: StreakInfo[], unitSuffix: string): LeaderItem[] =>
    list
      .filter((s) => s.streak > 0)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 5)
      .map((item, idx) => {
        const p = playerMap.get(item.playerId);
        const spanText = item.startSeason === item.endSeason ? `Sezóna ${item.startSeason}` : `${item.startSeason} až ${item.endSeason}`;
        return {
          rank: idx + 1,
          name: p ? cleanName(p.name) : "Hráč",
          slug: p?.slug,
          photoUrl: p?.photoUrl,
          hideTeam: true,
          value: `${item.streak} ${unitSuffix}`,
          sub: spanText,
        };
      });

  const ironmanLeader = buildStreakLeader(ironmanStreaks, "zápasov v rade");
  const goalStreakLeader = buildStreakLeader(goalStreaks, "zápasov s gólom");
  const assistStreakLeader = buildStreakLeader(assistStreaks, "zápasov s asistenciou");
  const pointStreakLeader = buildStreakLeader(pointStreaks, "zápasov s bodom");

  // Player first match and last match dates for debut / oldest appearance
  type PlayerMatchSpan = { playerId: number; firstDate: Date; lastDate: Date; firstSeason: string; lastSeason: string };
  const playerMatchDates = new Map<number, PlayerMatchSpan>();

  const recordPlayerGameDate = (playerId: number, gameDate: Date | null, season: string) => {
    const d = gameDate ? new Date(gameDate) : new Date("2026-01-01");
    if (!playerMatchDates.has(playerId)) {
      playerMatchDates.set(playerId, { playerId, firstDate: d, lastDate: d, firstSeason: season, lastSeason: season });
    } else {
      const span = playerMatchDates.get(playerId)!;
      if (d.getTime() < span.firstDate.getTime()) {
        span.firstDate = d;
        span.firstSeason = season;
      }
      if (d.getTime() > span.lastDate.getTime()) {
        span.lastDate = d;
        span.lastSeason = season;
      }
    }
  };

  for (const s of regSkaterStats) {
    recordPlayerGameDate(s.playerId, s.game.gameDate, s.game.season);
  }
  for (const g of regGoalieStats) {
    recordPlayerGameDate(g.playerId, g.game.gameDate, g.game.season);
  }

  const matchDebutYoungest: LeaderItem[] = [...playerMatchDates.values()]
    .map((span) => {
      const p = playerMap.get(span.playerId);
      if (!p) return null;
      const age = calculateAge(p.birthDate, span.firstDate, p.age);
      if (!age || age.years < 15 || age.years > 65) return null;
      const totalDays = age.years * 365 + age.days;
      return { span, p, age, totalDays };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => a.totalDays - b.totalDays)
    .slice(0, 5)
    .map(({ span, p, age }, idx) => ({
      rank: idx + 1,
      name: cleanName(p.name),
      slug: p.slug,
      photoUrl: p.photoUrl,
      hideTeam: true,
      value: age.formatted,
      sub: `Debut v sezóne ${span.firstSeason} (${span.firstDate.toLocaleDateString("sk-SK")})`,
    }));

  const matchAppearanceOldest: LeaderItem[] = [...playerMatchDates.values()]
    .map((span) => {
      const p = playerMap.get(span.playerId);
      if (!p) return null;
      const age = calculateAge(p.birthDate, span.lastDate, p.age);
      if (!age || age.years < 15 || age.years > 65) return null;
      const totalDays = age.years * 365 + age.days;
      return { span, p, age, totalDays };
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
    .sort((a, b) => b.totalDays - a.totalDays)
    .slice(0, 5)
    .map(({ span, p, age }, idx) => ({
      rank: idx + 1,
      name: cleanName(p.name),
      slug: p.slug,
      photoUrl: p.photoUrl,
      hideTeam: true,
      value: age.formatted,
      sub: `Zápas v sezóne ${span.lastSeason} (${span.lastDate.toLocaleDateString("sk-SK")})`,
    }));

  const skaterCareerSections: RecordSection[] = [
    { id: "career-gp", title: "Najviac odohraných zápasov v kariére", icon: "🏒", phase: "regular", phaseBadge: "ZČ", items: careerGpItems },
    { id: "career-goals", title: "Najviac gólov v kariére", icon: "🎯", phase: "regular", phaseBadge: "ZČ", items: careerGoalsItems },
    { id: "career-assists", title: "Najviac asistencií v kariére", icon: "🪄", phase: "regular", phaseBadge: "ZČ", items: careerAssistsItems },
    { id: "career-points", title: "Najviac bodov v kariére", icon: "⭐", phase: "regular", phaseBadge: "ZČ", items: careerPointsItems },
    { id: "career-pim", title: "Najviac trestných minút v kariére", icon: "⏱️", phase: "regular", phaseBadge: "ZČ", items: careerPimItems },
    { id: "career-plus-minus-best", title: "Najlepší +/- v kariére", icon: "🟢", phase: "regular", phaseBadge: "ZČ", items: careerPlusMinusBestItems },
    { id: "career-plus-minus-worst", title: "Najhorší +/- v kariére", icon: "🔴", phase: "regular", phaseBadge: "ZČ", items: careerPlusMinusWorstItems },
    { id: "career-pp-goals", title: "Najviac presilovkových gólov v kariére (PPG)", icon: "⚡", phase: "regular", phaseBadge: "ZČ", items: careerPpGoalsItems },
    { id: "career-pp-assists", title: "Najviac presilovkových asistencií v kariére (PPA)", icon: "🏒", phase: "regular", phaseBadge: "ZČ", items: careerPpAssistsItems },
    { id: "career-pp-points", title: "Najviac presilovkových bodov v kariére (PPP)", icon: "⭐", phase: "regular", phaseBadge: "ZČ", items: careerPpPointsItems },
    { id: "career-sh-goals", title: "Najviac oslabovkových gólov v kariére (SHG)", icon: "🛡️", phase: "regular", phaseBadge: "ZČ", items: careerShGoalsItems },
    { id: "career-sh-assists", title: "Najviac oslabovkových asistencií v kariére (SHA)", icon: "🧤", phase: "regular", phaseBadge: "ZČ", items: careerShAssistsItems },
    { id: "career-sh-points", title: "Najviac oslabovkových bodov v kariére (SHP)", icon: "⭐", phase: "regular", phaseBadge: "ZČ", items: careerShPointsItems },
    { id: "career-ironman", title: "Najviac odohraných zápasov v rade (Ironman streak)", icon: "🛡️", phase: "regular", phaseBadge: "ZČ", items: ironmanLeader },
    { id: "career-goal-streak", title: "Najdlhšia gólová séria v rade (zápasy s gólom)", icon: "🔥", phase: "regular", phaseBadge: "ZČ", items: goalStreakLeader },
    { id: "career-assist-streak", title: "Najdlhšia asistenčná séria v rade (zápasy s asistenciou)", icon: "🪄", phase: "regular", phaseBadge: "ZČ", items: assistStreakLeader },
    { id: "career-point-streak", title: "Najdlhšia bodová séria v rade (zápasy s bodom)", icon: "⚡", phase: "regular", phaseBadge: "ZČ", items: pointStreakLeader },
    { id: "career-youngest-debut", title: "Najmladší hráč pri debute v zápase", icon: "👶", phase: "regular", phaseBadge: "ZČ", items: matchDebutYoungest },
    { id: "career-oldest-appearance", title: "Najstarší hráč v zápase", icon: "👴", phase: "regular", phaseBadge: "ZČ", items: matchAppearanceOldest },
  ];

  // ==========================================
  // F. SINGLE SEASON SKATER RECORDS (ZČ Jedna sezóna)
  // ==========================================
  type SeasonSkaterAcc = {
    playerId: number;
    season: string;
    teamIds: Set<number>;
    gp: number;
    goals: number;
    assists: number;
    points: number;
    pim: number;
    plusMinus: number;
    ppGoals: number;
    ppAssists: number;
    ppPoints: number;
    shGoals: number;
    shAssists: number;
    shPoints: number;
  };

  const seasonSkaterMap = new Map<string, SeasonSkaterAcc>();

  for (const s of archivedRegSkaters) {
    const key = `${s.playerId}::${s.season}`;
    if (!seasonSkaterMap.has(key)) {
      seasonSkaterMap.set(key, {
        playerId: s.playerId,
        season: s.season,
        teamIds: new Set(),
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
      });
    }
    const acc = seasonSkaterMap.get(key)!;
    acc.gp += s.gp;
    acc.goals += s.goals;
    acc.assists += s.assists;
    acc.points += s.points;
    acc.pim += s.pim;
    acc.plusMinus += s.plusMinus;
    acc.ppGoals += s.ppGoals ?? 0;
    acc.ppAssists += s.ppAssists ?? 0;
    acc.ppPoints += (s.ppGoals ?? 0) + (s.ppAssists ?? 0);
    acc.shGoals += s.shGoals ?? 0;
    acc.shAssists += s.shAssists ?? 0;
    acc.shPoints += (s.shGoals ?? 0) + (s.shAssists ?? 0);
    if (s.teamId) acc.teamIds.add(s.teamId);
  }

  for (const s of regSkaterStats) {
    const season = s.game.season;
    const key = `${s.playerId}::${season}`;
    if (!seasonSkaterMap.has(key)) {
      seasonSkaterMap.set(key, {
        playerId: s.playerId,
        season,
        teamIds: new Set(),
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
      });
    }
    const acc = seasonSkaterMap.get(key)!;
    acc.gp += 1;
    acc.goals += s.goals;
    acc.assists += s.assists;
    acc.points += s.points;
    acc.pim += s.pim;
    acc.plusMinus += s.plusMinus;
    acc.ppGoals += s.ppGoals ?? 0;
    acc.ppAssists += s.ppAssists ?? 0;
    acc.ppPoints += (s.ppGoals ?? 0) + (s.ppAssists ?? 0);
    acc.shGoals += s.shGoals ?? 0;
    acc.shAssists += s.shAssists ?? 0;
    acc.shPoints += (s.shGoals ?? 0) + (s.shAssists ?? 0);
    if (s.teamId) acc.teamIds.add(s.teamId);
  }

  const allSeasonSkaters = [...seasonSkaterMap.values()];

  const buildSeasonSkaterLeader = (
    list: SeasonSkaterAcc[],
    sortFn: (a: SeasonSkaterAcc, b: SeasonSkaterAcc) => number,
    filterFn: (s: SeasonSkaterAcc) => boolean,
    valFmt: (s: SeasonSkaterAcc) => string | number,
    subFmt: (s: SeasonSkaterAcc) => string
  ): LeaderItem[] =>
    list
      .filter(filterFn)
      .sort(sortFn)
      .slice(0, 5)
      .map((entry, idx) => {
        const p = playerMap.get(entry.playerId);
        const tmInfo = resolveTeams(entry.teamIds, teamById);
        return {
          rank: idx + 1,
          name: p ? cleanName(p.name) : "Hráč",
          slug: p?.slug,
          photoUrl: p?.photoUrl,
          ...tmInfo,
          value: valFmt(entry),
          sub: subFmt(entry),
        };
      });

  const seasonGoalsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.goals - a.goals || b.points - a.points, (s) => s.goals > 0, (s) => `${s.goals} G`, (s) => `Sezóna ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const seasonAssistsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.assists - a.assists || b.points - a.points, (s) => s.assists > 0, (s) => `${s.assists} A`, (s) => `Sezóna ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const seasonPointsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.points - a.points || b.goals - a.goals, (s) => s.points > 0, (s) => `${s.points} PTS`, (s) => `Sezóna ${s.season} · ${s.goals}G + ${s.assists}A (${s.gp} GP)`);
  const seasonPimLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.pim - a.pim, (s) => s.pim > 0, (s) => `${s.pim} TM`, (s) => `Sezóna ${s.season} · ${s.gp} GP`);
  const seasonPlusMinusBestLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.plusMinus - a.plusMinus || b.points - a.points, (s) => s.plusMinus > 0, (s) => `+${s.plusMinus} +/-`, (s) => `Sezóna ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const seasonPlusMinusWorstLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => a.plusMinus - b.plusMinus || a.points - b.points, (s) => s.plusMinus < 0, (s) => `${s.plusMinus} +/-`, (s) => `Sezóna ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const seasonPpGoalsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.ppGoals - a.ppGoals || b.goals - a.goals, (s) => s.ppGoals > 0, (s) => `${s.ppGoals} PPG`, (s) => `Sezóna ${s.season} · ${s.goals} G celkovo (${s.gp} GP)`);
  const seasonPpAssistsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.ppAssists - a.ppAssists || b.assists - a.assists, (s) => s.ppAssists > 0, (s) => `${s.ppAssists} PPA`, (s) => `Sezóna ${s.season} · ${s.assists} A celkovo (${s.gp} GP)`);
  const seasonPpPointsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.ppPoints - a.ppPoints || b.points - a.points, (s) => s.ppPoints > 0, (s) => `${s.ppPoints} PPP`, (s) => `Sezóna ${s.season} · ${s.ppGoals} PPG + ${s.ppAssists} PPA (${s.points} PTS)`);
  const seasonShGoalsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.shGoals - a.shGoals || b.goals - a.goals, (s) => s.shGoals > 0, (s) => `${s.shGoals} SHG`, (s) => `Sezóna ${s.season} · ${s.goals} G celkovo (${s.gp} GP)`);
  const seasonShAssistsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.shAssists - a.shAssists || b.assists - a.assists, (s) => s.shAssists > 0, (s) => `${s.shAssists} SHA`, (s) => `Sezóna ${s.season} · ${s.assists} A celkovo (${s.gp} GP)`);
  const seasonShPointsLeader = buildSeasonSkaterLeader(allSeasonSkaters, (a, b) => b.shPoints - a.shPoints || b.points - a.points, (s) => s.shPoints > 0, (s) => `${s.shPoints} SHP`, (s) => `Sezóna ${s.season} · ${s.shGoals} SHG + ${s.shAssists} SHA (${s.points} PTS)`);

  const skaterSeasonSections: RecordSection[] = [
    { id: "season-goals", title: "Najviac gólov v jednej sezóne", icon: "🎯", phase: "regular", phaseBadge: "ZČ", items: seasonGoalsLeader },
    { id: "season-assists", title: "Najviac asistencií v jednej sezóne", icon: "🪄", phase: "regular", phaseBadge: "ZČ", items: seasonAssistsLeader },
    { id: "season-points", title: "Najviac bodov v jednej sezóne", icon: "⭐", phase: "regular", phaseBadge: "ZČ", items: seasonPointsLeader },
    { id: "season-pim", title: "Najviac trestných minút v jednej sezóne", icon: "⏱️", phase: "regular", phaseBadge: "ZČ", items: seasonPimLeader },
    { id: "season-plus-minus-best", title: "Najlepší +/- v jednej sezóne", icon: "🟢", phase: "regular", phaseBadge: "ZČ", items: seasonPlusMinusBestLeader },
    { id: "season-plus-minus-worst", title: "Najhorší +/- v jednej sezóne", icon: "🔴", phase: "regular", phaseBadge: "ZČ", items: seasonPlusMinusWorstLeader },
    { id: "season-pp-goals", title: "Najviac presilovkových gólov v jednej sezóne (PPG)", icon: "⚡", phase: "regular", phaseBadge: "ZČ", items: seasonPpGoalsLeader },
    { id: "season-pp-assists", title: "Najviac presilovkových asistencií v jednej sezóne (PPA)", icon: "🏒", phase: "regular", phaseBadge: "ZČ", items: seasonPpAssistsLeader },
    { id: "season-pp-points", title: "Najviac presilovkových bodov v jednej sezóne (PPP)", icon: "⭐", phase: "regular", phaseBadge: "ZČ", items: seasonPpPointsLeader },
    { id: "season-sh-goals", title: "Najviac oslabovkových gólov v jednej sezóne (SHG)", icon: "🛡️", phase: "regular", phaseBadge: "ZČ", items: seasonShGoalsLeader },
    { id: "season-sh-assists", title: "Najviac oslabovkových asistencií v jednej sezóne (SHA)", icon: "🧤", phase: "regular", phaseBadge: "ZČ", items: seasonShAssistsLeader },
    { id: "season-sh-points", title: "Najviac oslabovkových bodov v jednej sezóne (SHP)", icon: "⭐", phase: "regular", phaseBadge: "ZČ", items: seasonShPointsLeader },
  ];

  // ==========================================
  // G. ROOKIE REGULAR-SEASON RECORDS (ZČ Nováčikovia)
  // ==========================================
  const rookieSeasonSkaters = allSeasonSkaters.filter((s) => {
    const p = playerMap.get(s.playerId);
    return playerDebutSeason.get(s.playerId) === s.season || (p && isRookieName(p.name));
  });

  const rookieGoalsLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => b.goals - a.goals || b.points - a.points, (s) => s.goals > 0, (s) => `${s.goals} G`, (s) => `Sezóna nováčika ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const rookieAssistsLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => b.assists - a.assists || b.points - a.points, (s) => s.assists > 0, (s) => `${s.assists} A`, (s) => `Sezóna nováčika ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const rookiePointsLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => b.points - a.points || b.goals - a.goals, (s) => s.points > 0, (s) => `${s.points} PTS`, (s) => `Sezóna nováčika ${s.season} · ${s.goals}G + ${s.assists}A (${s.gp} GP)`);
  const rookiePimLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => b.pim - a.pim, (s) => s.pim > 0, (s) => `${s.pim} TM`, (s) => `Sezóna nováčika ${s.season} · ${s.gp} GP`);
  const rookiePlusMinusBestLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => b.plusMinus - a.plusMinus || b.points - a.points, (s) => s.plusMinus > 0, (s) => `+${s.plusMinus} +/-`, (s) => `Sezóna nováčika ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const rookiePlusMinusWorstLeader = buildSeasonSkaterLeader(rookieSeasonSkaters, (a, b) => a.plusMinus - b.plusMinus || a.points - b.points, (s) => s.plusMinus < 0, (s) => `${s.plusMinus} +/-`, (s) => `Sezóna nováčika ${s.season} · ${s.points} PTS (${s.gp} GP)`);

  const rookieSections: RecordSection[] = [
    { id: "rookie-season-goals", title: "Najviac gólov v nováčikovskej sezóne", icon: "🎯", phase: "regular", phaseBadge: "ZČ", items: rookieGoalsLeader },
    { id: "rookie-season-assists", title: "Najviac asistencií v nováčikovskej sezóne", icon: "🪄", phase: "regular", phaseBadge: "ZČ", items: rookieAssistsLeader },
    { id: "rookie-season-points", title: "Najviac bodov v nováčikovskej sezóne", icon: "⭐", phase: "regular", phaseBadge: "ZČ", items: rookiePointsLeader },
    { id: "rookie-season-pim", title: "Najviac trestných minút v nováčikovskej sezóne", icon: "⏱️", phase: "regular", phaseBadge: "ZČ", items: rookiePimLeader },
    { id: "rookie-season-plus-minus-best", title: "Najlepší +/- v nováčikovskej sezóne", icon: "🟢", phase: "regular", phaseBadge: "ZČ", items: rookiePlusMinusBestLeader },
    { id: "rookie-season-plus-minus-worst", title: "Najhorší +/- v nováčikovskej sezóne", icon: "🔴", phase: "regular", phaseBadge: "ZČ", items: rookiePlusMinusWorstLeader },
  ];

  // ==========================================
  // H. SINGLE GAME SKATER RECORDS (ZČ Jeden zápas)
  // ==========================================
  const buildGameSkaterLeader = (
    list: typeof regSkaterStats,
    sortFn: (a: (typeof regSkaterStats)[0], b: (typeof regSkaterStats)[0]) => number,
    filterFn: (s: (typeof regSkaterStats)[0]) => boolean,
    valFmt: (s: (typeof regSkaterStats)[0]) => string | number,
    subFmt: (s: (typeof regSkaterStats)[0]) => string
  ): LeaderItem[] =>
    list
      .filter(filterFn)
      .sort(sortFn)
      .slice(0, 5)
      .map((s, idx) => {
        const p = playerMap.get(s.playerId);
        const tm = s.teamId ? teamById.get(s.teamId) : null;
        return {
          rank: idx + 1,
          name: p ? cleanName(p.name) : "Hráč",
          slug: p?.slug,
          photoUrl: p?.photoUrl,
          teamCode: tm?.code,
          teamSlug: tm?.slug,
          teamLogo: tm?.logoUrl,
          value: valFmt(s),
          sub: subFmt(s),
        };
      });

  const getGameDateStr = (g: any) => (g?.gameDate ? new Date(g.gameDate).toLocaleDateString("sk-SK") : g?.season ?? "");

  const gameGoalsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => b.goals - a.goals || b.points - a.points, (s) => s.goals > 0, (s) => `${s.goals} G v zápase`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const gameAssistsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => b.assists - a.assists || b.points - a.points, (s) => s.assists > 0, (s) => `${s.assists} A v zápase`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const gamePointsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => b.points - a.points || b.goals - a.goals, (s) => s.points > 0, (s) => `${s.points} PTS v zápase`, (s) => `${s.goals}G + ${s.assists}A · ${s.game.season} (${getGameDateStr(s.game)})`);
  const gamePimLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => b.pim - a.pim, (s) => s.pim > 0, (s) => `${s.pim} TM v zápase`, (s) => `${s.game.season} (${getGameDateStr(s.game)})`);
  const gamePlusMinusBestLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => b.plusMinus - a.plusMinus || b.points - a.points, (s) => s.plusMinus > 0, (s) => `+${s.plusMinus} +/- v zápase`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const gamePlusMinusWorstLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => a.plusMinus - b.plusMinus || a.points - b.points, (s) => s.plusMinus < 0, (s) => `${s.plusMinus} +/- v zápase`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const gamePpGoalsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => (b.ppGoals ?? 0) - (a.ppGoals ?? 0) || b.goals - a.goals, (s) => (s.ppGoals ?? 0) > 0, (s) => `${s.ppGoals} PPG v zápase`, (s) => `${s.goals} G celkovo · ${s.game.season} (${getGameDateStr(s.game)})`);
  const gamePpAssistsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => (b.ppAssists ?? 0) - (a.ppAssists ?? 0) || b.assists - a.assists, (s) => (s.ppAssists ?? 0) > 0, (s) => `${s.ppAssists} PPA v zápase`, (s) => `${s.assists} A celkovo · ${s.game.season} (${getGameDateStr(s.game)})`);
  const gamePpPointsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => ((b.ppGoals ?? 0) + (b.ppAssists ?? 0)) - ((a.ppGoals ?? 0) + (a.ppAssists ?? 0)) || b.points - a.points, (s) => (s.ppGoals ?? 0) + (s.ppAssists ?? 0) > 0, (s) => `${(s.ppGoals ?? 0) + (s.ppAssists ?? 0)} PPP v zápase`, (s) => `${s.ppGoals} PPG + ${s.ppAssists} PPA · ${s.game.season}`);
  const gameShGoalsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => (b.shGoals ?? 0) - (a.shGoals ?? 0) || b.goals - a.goals, (s) => (s.shGoals ?? 0) > 0, (s) => `${s.shGoals} SHG v zápase`, (s) => `${s.goals} G celkovo · ${s.game.season} (${getGameDateStr(s.game)})`);
  const gameShAssistsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => (b.shAssists ?? 0) - (a.shAssists ?? 0) || b.assists - a.assists, (s) => (s.shAssists ?? 0) > 0, (s) => `${s.shAssists} SHA v zápase`, (s) => `${s.assists} A celkovo · ${s.game.season} (${getGameDateStr(s.game)})`);
  const gameShPointsLeader = buildGameSkaterLeader(regSkaterStats, (a, b) => ((b.shGoals ?? 0) + (b.shAssists ?? 0)) - ((a.shGoals ?? 0) + (a.shAssists ?? 0)) || b.points - a.points, (s) => (s.shGoals ?? 0) + (s.shAssists ?? 0) > 0, (s) => `${(s.shGoals ?? 0) + (s.shAssists ?? 0)} SHP v zápase`, (s) => `${s.shGoals} SHG + ${s.shAssists} SHA · ${s.game.season}`);

  const skaterGameSections: RecordSection[] = [
    { id: "game-goals", title: "Najviac gólov v jednom zápase", icon: "🎯", phase: "regular", phaseBadge: "ZČ", items: gameGoalsLeader },
    { id: "game-assists", title: "Najviac asistencií v jednom zápase", icon: "🪄", phase: "regular", phaseBadge: "ZČ", items: gameAssistsLeader },
    { id: "game-points", title: "Najviac bodov v jednom zápase", icon: "⭐", phase: "regular", phaseBadge: "ZČ", items: gamePointsLeader },
    { id: "game-pim", title: "Najviac trestných minút v jednom zápase", icon: "⏱️", phase: "regular", phaseBadge: "ZČ", items: gamePimLeader },
    { id: "game-plus-minus-best", title: "Najlepší +/- v jednom zápase", icon: "🟢", phase: "regular", phaseBadge: "ZČ", items: gamePlusMinusBestLeader },
    { id: "game-plus-minus-worst", title: "Najhorší +/- v jednom zápase", icon: "🔴", phase: "regular", phaseBadge: "ZČ", items: gamePlusMinusWorstLeader },
    { id: "game-pp-goals", title: "Najviac presilovkových gólov v jednom zápase (PPG)", icon: "⚡", phase: "regular", phaseBadge: "ZČ", items: gamePpGoalsLeader },
    { id: "game-pp-assists", title: "Najviac presilovkových asistencií v jednom zápase (PPA)", icon: "🏒", phase: "regular", phaseBadge: "ZČ", items: gamePpAssistsLeader },
    { id: "game-pp-points", title: "Najviac presilovkových bodov v jednom zápase (PPP)", icon: "⭐", phase: "regular", phaseBadge: "ZČ", items: gamePpPointsLeader },
    { id: "game-sh-goals", title: "Najviac oslabovkových gólov v jednom zápase (SHG)", icon: "🛡️", phase: "regular", phaseBadge: "ZČ", items: gameShGoalsLeader },
    { id: "game-sh-assists", title: "Najviac oslabovkových asistencií v jednom zápase (SHA)", icon: "🧤", phase: "regular", phaseBadge: "ZČ", items: gameShAssistsLeader },
    { id: "game-sh-points", title: "Najviac oslabovkových bodov v jednom zápase (SHP)", icon: "⭐", phase: "regular", phaseBadge: "ZČ", items: gameShPointsLeader },
  ];

  // ==========================================
  // I. PLAYOFF SKATER RECORDS (Play-off Kariéra, Sezóna, Zápas)
  // ==========================================
  // 1. Playoff Career Skaters
  const poSkCareerMap = new Map<number, SkaterCareerAcc>();
  const getPoSkAcc = (id: number): SkaterCareerAcc => {
    let acc = poSkCareerMap.get(id);
    if (!acc) {
      acc = {
        playerId: id,
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        shots: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
        teamId: null,
      };
      poSkCareerMap.set(id, acc);
    }
    return acc;
  };

  for (const s of archivedPlayoffSkaters) {
    const a = getPoSkAcc(s.playerId);
    a.gp += s.gp;
    a.goals += s.goals;
    a.assists += s.assists;
    a.points += s.points;
    a.pim += s.pim;
    a.plusMinus += s.plusMinus;
    a.teamId = s.teamId;
  }
  for (const s of playoffSkaterStats) {
    const a = getPoSkAcc(s.playerId);
    a.gp += 1;
    a.goals += s.goals;
    a.assists += s.assists;
    a.points += s.points;
    a.pim += s.pim;
    a.plusMinus += s.plusMinus;
    if (s.teamId) a.teamId = s.teamId;
  }

  const poSkCareerList = [...poSkCareerMap.values()];

  const poCareerGpLeader = poSkCareerList.filter((s) => s.gp > 0).sort((a, b) => b.gp - a.gp).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.gp} GP`, `${s.goals}G + ${s.assists}A · ${s.points} PTS`), rank: idx + 1 }));
  const poCareerGoalsLeader = poSkCareerList.filter((s) => s.goals > 0).sort((a, b) => b.goals - a.goals || b.points - a.points).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.goals} G`, `${s.gp} GP · ${s.points} PTS`), rank: idx + 1 }));
  const poCareerAssistsLeader = poSkCareerList.filter((s) => s.assists > 0).sort((a, b) => b.assists - a.assists || b.points - a.points).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.assists} A`, `${s.gp} GP · ${s.points} PTS`), rank: idx + 1 }));
  const poCareerPointsLeader = poSkCareerList.filter((s) => s.points > 0).sort((a, b) => b.points - a.points || b.goals - a.goals).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.points} PTS`, `${s.goals}G + ${s.assists}A (${s.gp} GP)`), rank: idx + 1 }));
  const poCareerPimLeader = poSkCareerList.filter((s) => s.pim > 0).sort((a, b) => b.pim - a.pim).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.pim} TM`, `${s.gp} GP · ${s.points} PTS`), rank: idx + 1 }));
  const poCareerPlusMinusBestLeader = poSkCareerList.filter((s) => s.plusMinus > 0).sort((a, b) => b.plusMinus - a.plusMinus).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `+${s.plusMinus} +/-`, `${s.gp} GP · ${s.points} PTS`), rank: idx + 1 }));
  const poCareerPlusMinusWorstLeader = poSkCareerList.filter((s) => s.plusMinus < 0).sort((a, b) => a.plusMinus - b.plusMinus).slice(0, 5).map((s, idx) => ({ ...skRowItem(s, `${s.plusMinus} +/-`, `${s.gp} GP · ${s.points} PTS`), rank: idx + 1 }));

  const playoffSkaterCareerSections: RecordSection[] = [
    { id: "playoff-career-gp", title: "Najviac odohraných zápasov v play-off v kariére", icon: "🏒", phase: "playoffs", phaseBadge: "Play-off", items: poCareerGpLeader },
    { id: "playoff-career-goals", title: "Najviac gólov v play-off v kariére", icon: "🎯", phase: "playoffs", phaseBadge: "Play-off", items: poCareerGoalsLeader },
    { id: "playoff-career-assists", title: "Najviac asistencií v play-off v kariére", icon: "🪄", phase: "playoffs", phaseBadge: "Play-off", items: poCareerAssistsLeader },
    { id: "playoff-career-points", title: "Najviac bodov v play-off v kariére", icon: "⭐", phase: "playoffs", phaseBadge: "Play-off", items: poCareerPointsLeader },
    { id: "playoff-career-pim", title: "Najviac trestných minút v play-off v kariére", icon: "⏱️", phase: "playoffs", phaseBadge: "Play-off", items: poCareerPimLeader },
    { id: "playoff-career-plus-minus-best", title: "Najlepší +/- v play-off v kariére", icon: "🟢", phase: "playoffs", phaseBadge: "Play-off", items: poCareerPlusMinusBestLeader },
    { id: "playoff-career-plus-minus-worst", title: "Najhorší +/- v play-off v kariére", icon: "🔴", phase: "playoffs", phaseBadge: "Play-off", items: poCareerPlusMinusWorstLeader },
  ];

  // 2. Playoff Single Season / Run Skaters
  const poSeasonSkaterMap = new Map<string, SeasonSkaterAcc>();
  for (const s of archivedPlayoffSkaters) {
    const key = `${s.playerId}::${s.season}`;
    if (!poSeasonSkaterMap.has(key)) {
      poSeasonSkaterMap.set(key, {
        playerId: s.playerId,
        season: s.season,
        teamIds: new Set(),
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
      });
    }
    const acc = poSeasonSkaterMap.get(key)!;
    acc.gp += s.gp;
    acc.goals += s.goals;
    acc.assists += s.assists;
    acc.points += s.points;
    acc.pim += s.pim;
    acc.plusMinus += s.plusMinus;
    if (s.teamId) acc.teamIds.add(s.teamId);
  }
  for (const s of playoffSkaterStats) {
    const season = s.game.season;
    const key = `${s.playerId}::${season}`;
    if (!poSeasonSkaterMap.has(key)) {
      poSeasonSkaterMap.set(key, {
        playerId: s.playerId,
        season,
        teamIds: new Set(),
        gp: 0,
        goals: 0,
        assists: 0,
        points: 0,
        pim: 0,
        plusMinus: 0,
        ppGoals: 0,
        ppAssists: 0,
        ppPoints: 0,
        shGoals: 0,
        shAssists: 0,
        shPoints: 0,
      });
    }
    const acc = poSeasonSkaterMap.get(key)!;
    acc.gp += 1;
    acc.goals += s.goals;
    acc.assists += s.assists;
    acc.points += s.points;
    acc.pim += s.pim;
    acc.plusMinus += s.plusMinus;
    if (s.teamId) acc.teamIds.add(s.teamId);
  }

  const allPoSeasonSkaters = [...poSeasonSkaterMap.values()];

  const poSeasonGoalsLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => b.goals - a.goals || b.points - a.points, (s) => s.goals > 0, (s) => `${s.goals} G`, (s) => `Play-off ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const poSeasonAssistsLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => b.assists - a.assists || b.points - a.points, (s) => s.assists > 0, (s) => `${s.assists} A`, (s) => `Play-off ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const poSeasonPointsLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => b.points - a.points || b.goals - a.goals, (s) => s.points > 0, (s) => `${s.points} PTS`, (s) => `Play-off ${s.season} · ${s.goals}G + ${s.assists}A (${s.gp} GP)`);
  const poSeasonPimLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => b.pim - a.pim, (s) => s.pim > 0, (s) => `${s.pim} TM`, (s) => `Play-off ${s.season} · ${s.gp} GP`);
  const poSeasonPlusMinusBestLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => b.plusMinus - a.plusMinus || b.points - a.points, (s) => s.plusMinus > 0, (s) => `+${s.plusMinus} +/-`, (s) => `Play-off ${s.season} · ${s.points} PTS (${s.gp} GP)`);
  const poSeasonPlusMinusWorstLeader = buildSeasonSkaterLeader(allPoSeasonSkaters, (a, b) => a.plusMinus - b.plusMinus || a.points - b.points, (s) => s.plusMinus < 0, (s) => `${s.plusMinus} +/-`, (s) => `Play-off ${s.season} · ${s.points} PTS (${s.gp} GP)`);

  const playoffSkaterSeasonSections: RecordSection[] = [
    { id: "playoff-season-goals", title: "Najviac gólov v jednom play-off", icon: "🎯", phase: "playoffs", phaseBadge: "Play-off", items: poSeasonGoalsLeader },
    { id: "playoff-season-assists", title: "Najviac asistencií v jednom play-off", icon: "🪄", phase: "playoffs", phaseBadge: "Play-off", items: poSeasonAssistsLeader },
    { id: "playoff-season-points", title: "Najviac bodov v jednom play-off", icon: "⭐", phase: "playoffs", phaseBadge: "Play-off", items: poSeasonPointsLeader },
    { id: "playoff-season-pim", title: "Najviac trestných minút v jednom play-off", icon: "⏱️", phase: "playoffs", phaseBadge: "Play-off", items: poSeasonPimLeader },
    { id: "playoff-season-plus-minus-best", title: "Najlepší +/- v jednom play-off", icon: "🟢", phase: "playoffs", phaseBadge: "Play-off", items: poSeasonPlusMinusBestLeader },
    { id: "playoff-season-plus-minus-worst", title: "Najhorší +/- v jednom play-off", icon: "🔴", phase: "playoffs", phaseBadge: "Play-off", items: poSeasonPlusMinusWorstLeader },
  ];

  // 3. Playoff Single Game Skaters
  const poGameGoalsLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => b.goals - a.goals || b.points - a.points, (s) => s.goals > 0, (s) => `${s.goals} G v zápase PO`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const poGameAssistsLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => b.assists - a.assists || b.points - a.points, (s) => s.assists > 0, (s) => `${s.assists} A v zápase PO`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const poGamePointsLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => b.points - a.points || b.goals - a.goals, (s) => s.points > 0, (s) => `${s.points} PTS v zápase PO`, (s) => `${s.goals}G + ${s.assists}A · ${s.game.season} (${getGameDateStr(s.game)})`);
  const poGamePimLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => b.pim - a.pim, (s) => s.pim > 0, (s) => `${s.pim} TM v zápase PO`, (s) => `${s.game.season} (${getGameDateStr(s.game)})`);
  const poGamePlusMinusBestLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => b.plusMinus - a.plusMinus || b.points - a.points, (s) => s.plusMinus > 0, (s) => `+${s.plusMinus} +/- v zápase PO`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);
  const poGamePlusMinusWorstLeader = buildGameSkaterLeader(playoffSkaterStats, (a, b) => a.plusMinus - b.plusMinus || a.points - b.points, (s) => s.plusMinus < 0, (s) => `${s.plusMinus} +/- v zápase PO`, (s) => `${s.game.season} (${getGameDateStr(s.game)}) · ${s.points} PTS`);

  const playoffSkaterGameSections: RecordSection[] = [
    { id: "playoff-game-goals", title: "Najviac gólov v zápase play-off", icon: "🎯", phase: "playoffs", phaseBadge: "Play-off", items: poGameGoalsLeader },
    { id: "playoff-game-assists", title: "Najviac asistencií v zápase play-off", icon: "🪄", phase: "playoffs", phaseBadge: "Play-off", items: poGameAssistsLeader },
    { id: "playoff-game-points", title: "Najviac bodov v zápase play-off", icon: "⭐", phase: "playoffs", phaseBadge: "Play-off", items: poGamePointsLeader },
    { id: "playoff-game-pim", title: "Najviac trestných minút v zápase play-off", icon: "⏱️", phase: "playoffs", phaseBadge: "Play-off", items: poGamePimLeader },
    { id: "playoff-game-plus-minus-best", title: "Najlepší +/- v zápase play-off", icon: "🟢", phase: "playoffs", phaseBadge: "Play-off", items: poGamePlusMinusBestLeader },
    { id: "playoff-game-plus-minus-worst", title: "Najhorší +/- v zápase play-off", icon: "🔴", phase: "playoffs", phaseBadge: "Play-off", items: poGamePlusMinusWorstLeader },
  ];

  // Playoff Career Wins from real playoff goalie stats
  const playoffGoalieAcc = new Map<number, { playerId: number; teamId: number | null; gp: number; wins: number; saves: number; shutouts: number }>();
  for (const g of playoffGoalieStats) {
    if (!playoffGoalieAcc.has(g.playerId)) {
      playoffGoalieAcc.set(g.playerId, { playerId: g.playerId, teamId: g.teamId, gp: 0, wins: 0, saves: 0, shutouts: 0 });
    }
    const acc = playoffGoalieAcc.get(g.playerId)!;
    acc.gp += 1;
    if (g.decision === "W") acc.wins += 1;
    acc.saves += g.saves;
    if (g.goalsAgainst === 0) acc.shutouts += 1;
    if (g.teamId) acc.teamId = g.teamId;
  }

  const playoffCareerWins: LeaderItem[] = [...playoffGoalieAcc.values()]
    .filter((g) => g.wins > 0)
    .sort((a, b) => b.wins - a.wins || b.saves - a.saves)
    .slice(0, 5)
    .map((g, idx) => {
      const p = playerMap.get(g.playerId);
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : "Brankár",
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        hideTeam: true,
        value: `${g.wins} W`,
        sub: `${g.gp} GP · ${g.shutouts} SO`,
      };
    });

  // Goalie Regular Season Career Records
  const careerWinsItems = topGoalies((g) => g.wins, (g) => `${g.wins} W`, (g) => `${g.gp} GP · ${g.shutouts} SO`);
  const careerStealsItems = topGoalies((g) => g.steals, (g) => `${g.steals} STL`, (g) => `${g.wins} W · ${g.gp} GP`);
  const careerGsaxItems = topGoalies((g) => g.gsax, (g) => (g.gsax > 0 ? `+${g.gsax.toFixed(1)} GSAx` : `${g.gsax.toFixed(1)} GSAx`), (g) => `${g.gp} GP · ${g.goalsAgainst} GA`);
  const careerShutoutsItems = topGoalies((g) => g.shutouts, (g) => `${g.shutouts} SO`, (g) => `${g.gp} GP · ${g.wins} W`);

  const goalieCareerSections: RecordSection[] = [
    { id: "career-wins", title: "Najviac výhier v kariére (brankár)", icon: "🧤", phase: "regular", phaseBadge: "ZČ", items: careerWinsItems },
    { id: "career-steals", title: "Najviac ukradnutých zápasov (steals) v kariére", icon: "🥷", phase: "regular", phaseBadge: "ZČ", items: careerStealsItems },
    { id: "career-gsax", title: "Najlepší GSAx (Goals Saved Above Expected) v kariére", icon: "📊", phase: "regular", phaseBadge: "ZČ", items: careerGsaxItems },
    { id: "career-shutouts", title: "Najviac čistých kont v kariére", icon: "🧱", phase: "regular", phaseBadge: "ZČ", items: careerShutoutsItems },
  ];

  // ==========================================
  // E. ATTENDANCE & GAME RECORDS (Návštevnosť a zápasy)
  // ==========================================
  const gamesWithAtt = allFinalGames.filter((g) => (g.attendance ?? 0) > 0);

  const highestAttGames: LeaderItem[] = [...gamesWithAtt]
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

  const lowestAttGames: LeaderItem[] = [...gamesWithAtt]
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
    .filter((entry) => entry.games >= 2)
    .map((entry) => ({
      ...entry,
      avg: Math.round(entry.totalAtt / entry.games),
    }));

  const highestAvgAtt: LeaderItem[] = [...teamSeasonAttList]
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

  const lowestAvgAtt: LeaderItem[] = [...teamSeasonAttList]
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

  const highestScoringGames: LeaderItem[] = [...allFinalGames]
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

  const highestVictoryGames: LeaderItem[] = [...allFinalGames]
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

  // ==========================================
  // F. TEAM SEASON & STREAK RECORDS (Tímové sezónne rekordy ZČ)
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

  const mostPointsSeason: LeaderItem[] = [...teamSeasons]
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

  const mostLossesSeason: LeaderItem[] = [...teamSeasons]
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

  const mostGfSeason: LeaderItem[] = [...teamSeasons]
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

  const mostGaSeason: LeaderItem[] = [...teamSeasons]
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
  for (const s of regSkaterStats) {
    if (!s.teamId) continue;
    const season = s.game.season;
    const key = `${s.teamId}::${season}`;
    if (!teamSeasonPimMap.has(key)) teamSeasonPimMap.set(key, { teamId: s.teamId, season, pim: 0 });
    teamSeasonPimMap.get(key)!.pim += s.pim;
  }

  const mostPimSeason: LeaderItem[] = [...teamSeasonPimMap.values()]
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

  // ==========================================
  // G. AGE RECORDS (Vekové rekordy)
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
        photoUrl: p.photoUrl,
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
        photoUrl: p.photoUrl,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: age.formatted,
        sub: `${tm?.name ?? "Tím"} · Narodený ${p.birthDate}`,
      };
    });

  // ==========================================
  // H. PRE-SEASON RECORDS (Reálne dáta z prípravy)
  // ==========================================
  // 1. Preseason Standings (Real teams W-L-OTL)
  type PreTeamAcc = { teamId: number; gp: number; w: number; l: number; otl: number; points: number; gf: number; ga: number };
  const preTeamMap = new Map<number, PreTeamAcc>();
  for (const t of allTeams) {
    preTeamMap.set(t.id, { teamId: t.id, gp: 0, w: 0, l: 0, otl: 0, points: 0, gf: 0, ga: 0 });
  }

  for (const g of preGames) {
    const h = preTeamMap.get(g.homeTeamId);
    const a = preTeamMap.get(g.awayTeamId);
    const hg = g.homeGoals ?? 0;
    const ag = g.awayGoals ?? 0;
    const isOt = g.endedIn != null && g.endedIn !== "";

    if (h) {
      h.gp += 1;
      h.gf += hg;
      h.ga += ag;
      if (hg > ag) {
        h.w += 1;
        h.points += 2;
      } else if (isOt) {
        h.otl += 1;
        h.points += 1;
      } else {
        h.l += 1;
      }
    }

    if (a) {
      a.gp += 1;
      a.gf += ag;
      a.ga += hg;
      if (ag > hg) {
        a.w += 1;
        a.points += 2;
      } else if (isOt) {
        a.otl += 1;
        a.points += 1;
      } else {
        a.l += 1;
      }
    }
  }

  const preSeasonBestTeams: LeaderItem[] = [...preTeamMap.values()]
    .filter((t) => t.gp > 0)
    .sort((a, b) => b.points - a.points || b.w - a.w || (b.gf - b.ga) - (a.gf - a.ga))
    .slice(0, 5)
    .map((t, idx) => {
      const tm = teamById.get(t.teamId);
      return {
        rank: idx + 1,
        name: tm?.name ?? "Tím",
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${t.points} bodov (${t.w}-${t.l}-${t.otl})`,
        sub: `Skóre ${t.gf}:${t.ga} (${t.gp} GP · Príprava ${ACTIVE_SEASON})`,
      };
    });

  // 2. Preseason Top Scorers
  const preSkaterAcc = new Map<number, { playerId: number; teamIds: Set<number>; gp: number; goals: number; assists: number; points: number; shots: number; pim: number }>();

  for (const s of preSkaterStats) {
    if (!preSkaterAcc.has(s.playerId)) {
      preSkaterAcc.set(s.playerId, { playerId: s.playerId, teamIds: new Set(), gp: 0, goals: 0, assists: 0, points: 0, shots: 0, pim: 0 });
    }
    const acc = preSkaterAcc.get(s.playerId)!;
    acc.gp += 1;
    acc.goals += s.goals;
    acc.assists += s.assists;
    acc.points += s.points;
    acc.shots += s.shots;
    acc.pim += s.pim;
    if (s.teamId) acc.teamIds.add(s.teamId);
  }

  const preSeasonScorers: LeaderItem[] = [...preSkaterAcc.values()]
    .filter((s) => s.points > 0)
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, 5)
    .map((s, idx) => {
      const p = playerMap.get(s.playerId);
      const tmInfo = resolveTeams(s.teamIds, teamById);
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : "Hráč",
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        ...tmInfo,
        value: `${s.points} PTS`,
        sub: `${s.goals}G + ${s.assists}A (${s.gp} GP · Príprava ${ACTIVE_SEASON})`,
      };
    });

  const preSeasonGoals: LeaderItem[] = [...preSkaterAcc.values()]
    .filter((s) => s.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.points - a.points)
    .slice(0, 5)
    .map((s, idx) => {
      const p = playerMap.get(s.playerId);
      const tmInfo = resolveTeams(s.teamIds, teamById);
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : "Hráč",
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        ...tmInfo,
        value: `${s.goals} G`,
        sub: `${s.points} PTS (${s.gp} GP · Príprava ${ACTIVE_SEASON})`,
      };
    });

  const preSeasonAssists: LeaderItem[] = [...preSkaterAcc.values()]
    .filter((s) => s.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.points - a.points)
    .slice(0, 5)
    .map((s, idx) => {
      const p = playerMap.get(s.playerId);
      const tmInfo = resolveTeams(s.teamIds, teamById);
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : "Hráč",
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        ...tmInfo,
        value: `${s.assists} A`,
        sub: `${s.points} PTS (${s.gp} GP · Príprava ${ACTIVE_SEASON})`,
      };
    });

  // 3. Preseason Single-game scoring records
  const preSingleGamePoints: LeaderItem[] = [...preSkaterStats]
    .filter((s) => s.points > 0)
    .sort((a, b) => b.points - a.points || b.goals - a.goals)
    .slice(0, 5)
    .map((s, idx) => {
      const p = playerMap.get(s.playerId);
      const tm = s.teamId ? teamById.get(s.teamId) : null;
      const dateStr = s.game?.gameDate ? new Date(s.game.gameDate).toLocaleDateString("sk-SK") : "";
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : "Hráč",
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        teamCode: tm?.code,
        teamSlug: tm?.slug,
        teamLogo: tm?.logoUrl,
        value: `${s.points} PTS v zápase`,
        sub: `${s.goals}G + ${s.assists}A · ${dateStr}`,
      };
    });

  // 4. Preseason Goalie Saves
  const preGoalieAcc = new Map<number, { playerId: number; teamIds: Set<number>; gp: number; wins: number; saves: number; shots: number; ga: number; shutouts: number }>();

  for (const g of preGoalieStats) {
    if (!preGoalieAcc.has(g.playerId)) {
      preGoalieAcc.set(g.playerId, { playerId: g.playerId, teamIds: new Set(), gp: 0, wins: 0, saves: 0, shots: 0, ga: 0, shutouts: 0 });
    }
    const acc = preGoalieAcc.get(g.playerId)!;
    acc.gp += 1;
    if (g.decision === "W") acc.wins += 1;
    acc.saves += g.saves;
    acc.shots += g.shotsAgainst;
    acc.ga += g.goalsAgainst;
    if (g.goalsAgainst === 0) acc.shutouts += 1;
    if (g.teamId) acc.teamIds.add(g.teamId);
  }

  const preGoalieSaves: LeaderItem[] = [...preGoalieAcc.values()]
    .filter((g) => g.saves > 0)
    .sort((a, b) => b.saves - a.saves || b.wins - a.wins)
    .slice(0, 5)
    .map((g, idx) => {
      const p = playerMap.get(g.playerId);
      const tmInfo = resolveTeams(g.teamIds, teamById);
      const svPct = g.shots > 0 ? ((g.saves / g.shots) * 100).toFixed(1) : "0.0";
      return {
        rank: idx + 1,
        name: p ? cleanName(p.name) : "Brankár",
        slug: p?.slug,
        photoUrl: p?.photoUrl,
        ...tmInfo,
        value: `${g.saves} zákrokov`,
        sub: `${svPct}% SV% · ${g.wins} W (${g.gp} GP · Príprava ${ACTIVE_SEASON})`,
      };
    });

  // ==========================================
  // I. AWARDS & TROPHIES
  // ==========================================
  const awardCategoryCounts = new Map<string, Map<string, { name: string; slug?: string | null; photoUrl?: string | null; teamId?: number | null; count: number; seasons: string[] }>>();

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
    let winnerPhotoUrl: string | null = null;
    let teamId = a.teamId;

    if (a.playerId) {
      winnerKey = `p_${a.playerId}`;
      const p = playerMap.get(a.playerId);
      winnerName = p ? cleanName(p.name) : cleanName(a.playerName || "—");
      winnerSlug = p?.slug ?? null;
      winnerPhotoUrl = p?.photoUrl ?? null;
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
      catMap.set(winnerKey, { name: winnerName, slug: winnerSlug, photoUrl: winnerPhotoUrl, teamId, count: 0, seasons: [] });
    }
    const entry = catMap.get(winnerKey)!;
    entry.count++;
    entry.seasons.push(a.season);
  }

  const buildAwardLeader = (catTitle: string, aliasKeys: string[], awardPhase: RecordPhase = "all"): RecordSection => {
    let combinedMap = new Map<string, { name: string; slug?: string | null; photoUrl?: string | null; teamId?: number | null; count: number; seasons: string[] }>();
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

    const items: LeaderItem[] = [...combinedMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((entry, idx) => {
        return {
          rank: idx + 1,
          name: entry.name,
          slug: entry.slug,
          photoUrl: entry.photoUrl,
          hideTeam: true,
          value: `${entry.count}×`,
          sub: entry.seasons.sort().join(", "),
        };
      });

    return {
      id: catTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: catTitle,
      icon: "🏵️",
      phase: awardPhase,
      phaseBadge: awardPhase === "playoffs" ? "Play-off" : awardPhase === "pre" ? "Príprava" : "ZČ",
      items,
    };
  };

  const trophySections: RecordSection[] = [
    buildAwardLeader("Hart Memorial Trophy", ["Hart Memorial Trophy", "Hart", "Hart (MVP)"], "regular"),
    buildAwardLeader("Art Ross Trophy", ["Art Ross Trophy", "Art Ross", "Art Ross (Points)"], "regular"),
    buildAwardLeader("Maurice 'Rocket' Richard Trophy", ["Maurice 'Rocket' Richard Trophy", "Rocket Richard", "Rocket Richard (Goals)"], "regular"),
    buildAwardLeader("James Norris Memorial Trophy", ["James Norris Memorial Trophy", "Norris", "Norris (Defense)"], "regular"),
    buildAwardLeader("Vézina Trophy", ["Vézina Trophy", "Vezina", "Vezina Trophy", "Vezina (Goalie)"], "regular"),
    buildAwardLeader("Conn Smythe Trophy", ["Conn Smythe Trophy", "Conn Smythe", "Conn Smythe (Playoffs)"], "playoffs"),
    buildAwardLeader("Ted Lindsay Award", ["Ted Lindsay Award", "Ted Lindsay"], "regular"),
    buildAwardLeader("Frank J. Selke Trophy", ["Frank J. Selke Trophy", "Selke", "Selke (Def. Fwd)"], "regular"),
    buildAwardLeader("Lady Byng Trophy", ["Lady Byng Trophy", "Lady Byng"], "regular"),
    buildAwardLeader("NHL Plus - Minus Award", ["NHL Plus - Minus Award", "Plus-Minus"], "regular"),
    buildAwardLeader("Sam Pollock Trophy (GM of the Year)", ["Sam Pollock Trophy (GM of the Year)", "GM of the Year", "General Manager of the Year Award"], "all"),
  ];

  // ==========================================
  // J. COMPOSE FINAL CATEGORY GROUPS
  // ==========================================
  const rawGroups: RecordCategoryGroup[] = [
    {
      id: "gm-records",
      title: "Manažérske rekordy (GM)",
      icon: "👔",
      phase: "all",
      mainCategory: "gms",
      records: [
        {
          id: "gm-seasons-total",
          title: `Najviac odohraných sezón v u${league} (ako GM)`,
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
          title: `Počet vyhraných ${cupName}ov (ako GM)`,
          icon: "🏆",
          phase: "playoffs",
          phaseBadge: "Play-off",
          items: gmCupLeaders,
        },
      ],
    },
    {
      id: "career-skaters",
      title: "Individuálne kariérne rekordy — Korčuliari (ZČ)",
      icon: "🏒",
      phase: "regular",
      mainCategory: "skaters",
      records: skaterCareerSections,
    },
    {
      id: "season-skaters",
      title: "Individuálne sezónne rekordy — Korčuliari (ZČ)",
      icon: "📅",
      phase: "regular",
      mainCategory: "skaters",
      records: skaterSeasonSections,
    },
    {
      id: "game-skaters",
      title: "Individuálne zápasové rekordy — Korčuliari (ZČ)",
      icon: "⚡",
      phase: "regular",
      mainCategory: "skaters",
      records: skaterGameSections,
    },
    {
      id: "rookie-records",
      title: "Individuálne sezónne rekordy nováčikov (ZČ)",
      icon: "👶",
      phase: "regular",
      mainCategory: "skaters",
      records: rookieSections,
    },
    {
      id: "playoff-career-skaters",
      title: "Kariérne rekordy v play-off — Korčuliari",
      icon: "⭐",
      phase: "playoffs",
      mainCategory: "skaters",
      records: playoffSkaterCareerSections,
    },
    {
      id: "playoff-season-skaters",
      title: "Rekordy v jednom play-off — Korčuliari",
      icon: "🔥",
      phase: "playoffs",
      mainCategory: "skaters",
      records: playoffSkaterSeasonSections,
    },
    {
      id: "playoff-game-skaters",
      title: "Zápasové rekordy v play-off — Korčuliari",
      icon: "⚡",
      phase: "playoffs",
      mainCategory: "skaters",
      records: playoffSkaterGameSections,
    },
    {
      id: "career-goalies",
      title: "Individuálne kariérne rekordy — Brankári (ZČ)",
      icon: "🧤",
      phase: "regular",
      mainCategory: "goalies",
      records: goalieCareerSections,
    },
    {
      id: "championships",
      title: `${cupName} & Tímové tituly`,
      icon: "🏆",
      phase: "playoffs",
      mainCategory: "teams",
      records: [
        {
          id: "team-cups",
          title: `Počet vyhraných ${cupName}ov (ako tím)`,
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
      id: "team-seasons",
      title: "Tímové sezónne a sériové rekordy (ZČ)",
      icon: "📊",
      phase: "regular",
      mainCategory: "teams",
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
      id: "trophies",
      title: "Trofeje a ocenenia",
      icon: "🏵️",
      phase: "all",
      mainCategory: "trophies",
      records: trophySections,
    },
    {
      id: "attendance-games",
      title: "Návštevnosť a zápasové rekordy (ZČ / Všetko)",
      icon: "🏟️",
      phase: "all",
      mainCategory: "games",
      records: [
        {
          id: "highest-attendance",
          title: "Najvyššia návštevnosť v jednom zápase",
          icon: "👥",
          phase: "all",
          phaseBadge: "Zápas",
          items: highestAttGames,
        },
        {
          id: "lowest-attendance",
          title: "Najnižšia návštevnosť v jednom zápase",
          icon: "👤",
          phase: "all",
          phaseBadge: "Zápas",
          items: lowestAttGames,
        },
        {
          id: "highest-avg-attendance",
          title: "Najvyššia priemerná návštevnosť v jednej sezóne",
          icon: "📈",
          phase: "all",
          phaseBadge: "Sezóna",
          items: highestAvgAtt,
        },
        {
          id: "lowest-avg-attendance",
          title: "Najnižšia priemerná návštevnosť v jednej sezóne",
          icon: "📉",
          phase: "all",
          phaseBadge: "Sezóna",
          items: lowestAvgAtt,
        },
        {
          id: "highest-scoring-game",
          title: "Highest scoring game (Najviac gólov v zápase)",
          icon: "🚨",
          phase: "all",
          phaseBadge: "Zápas",
          items: highestScoringGames,
        },
        {
          id: "largest-victory",
          title: "Najvyššie víťazstvo (Najväčší gólový rozdiel)",
          icon: "⚡",
          phase: "all",
          phaseBadge: "Zápas",
          items: highestVictoryGames,
        },
      ],
    },
    {
      id: "age-records",
      title: "Vekové rekordy (Súpisky ligy)",
      icon: "🎂",
      phase: "all",
      mainCategory: "games",
      records: [
        {
          id: "youngest-player",
          title: `Najmladší hráč v lige u${league}`,
          icon: "👶",
          phase: "all",
          phaseBadge: "Vek",
          items: youngestPlayers,
        },
        {
          id: "oldest-player",
          title: `Najstarší hráč v lige u${league}`,
          icon: "👴",
          phase: "all",
          phaseBadge: "Vek",
          items: oldestPlayers,
        },
      ],
    },
    {
      id: "pre-season-group",
      title: "Prípravné zápasy (Pre-season rekordy)",
      icon: "☀️",
      phase: "pre",
      mainCategory: "pre",
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
        {
          id: "pre-goals",
          title: "Najlepší strelec v príprave (Góly)",
          icon: "🎯",
          phase: "pre",
          phaseBadge: "Príprava",
          items: preSeasonGoals,
        },
        {
          id: "pre-assists",
          title: "Najviac asistencií v príprave",
          icon: "🪄",
          phase: "pre",
          phaseBadge: "Príprava",
          items: preSeasonAssists,
        },
        {
          id: "pre-single-game-pts",
          title: "Najviac bodov v jednom zápase prípravy",
          icon: "⚡",
          phase: "pre",
          phaseBadge: "Príprava",
          items: preSingleGamePoints,
        },
        {
          id: "pre-goalie-saves",
          title: "Najviac zákrokov brankára v príprave",
          icon: "🧤",
          phase: "pre",
          phaseBadge: "Príprava",
          items: preGoalieSaves,
        },
      ],
    },
  ];

  // Filter groups according to the selected category and phase
  let filteredGroups = rawGroups;

  if (category !== "all") {
    filteredGroups = filteredGroups.filter((g) => g.mainCategory === category);
  }

  if (phase === "regular") {
    filteredGroups = filteredGroups
      .map((g) => ({
        ...g,
        records: g.records.filter((r) => r.phase === "regular" || r.phase === "all"),
      }))
      .filter((g) => g.records.length > 0 && g.id !== "pre-season-group" && g.id !== "championships");
  } else if (phase === "playoffs") {
    filteredGroups = filteredGroups
      .map((g) => ({
        ...g,
        records: g.records.filter((r) => r.phase === "playoffs"),
      }))
      .filter((g) => g.records.length > 0);
  } else if (phase === "pre") {
    filteredGroups = filteredGroups
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
    category,
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

