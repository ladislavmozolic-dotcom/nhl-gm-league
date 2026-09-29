import { prisma } from "@/lib/prisma";
import { REGULAR_SEASON } from "@/lib/phase";
import { computeStandings, type TeamStanding } from "@/lib/sim/standings";
import { skaterTotals, goalieTotals } from "@/lib/stats-server";

export type OverUnderQuestion = {
  id: number;
  text: string;
  target: string;
  metric: string;
  line: number;
};

export type H2HDuel = {
  id: number;
  playerA: string;
  playerB: string;
  metric: string;
};

export type BoldStatement = {
  id: number;
  text: string;
};

export const DEFAULT_OVER_UNDER_QUESTIONS: OverUnderQuestion[] = [
  { id: 1, text: "Connor McDavid — 125.5 bodu", target: "McDavid", metric: "points", line: 125.5 },
  { id: 2, text: "Auston Matthews — 52.5 gólu", target: "Matthews", metric: "goals", line: 52.5 },
  { id: 3, text: "Nathan MacKinnon — 115.5 bodu", target: "MacKinnon", metric: "points", line: 115.5 },
  { id: 4, text: "Nikita Kucherov — 110.5 bodu", target: "Kucherov", metric: "points", line: 110.5 },
  { id: 5, text: "Cale Makar — 88.5 bodu", target: "Makar", metric: "points", line: 88.5 },
  { id: 6, text: "Quinn Hughes — 85.5 bodu", target: "Hughes", metric: "points", line: 85.5 },
  { id: 7, text: "David Pastrňák — 48.5 gólu", target: "Pastrňák", metric: "goals", line: 48.5 },
  { id: 8, text: "Artemi Panarin — 95.5 bodu", target: "Panarin", metric: "points", line: 95.5 },
  { id: 9, text: "Connor Bedard — 75.5 bodu", target: "Bedard", metric: "points", line: 75.5 },
  { id: 10, text: "Macklin Celebrini — 62.5 bodu", target: "Celebrini", metric: "points", line: 62.5 },
  { id: 11, text: "Colorado Avalanche — 108.5 tímového bodu", target: "Colorado", metric: "teamPoints", line: 108.5 },
  { id: 12, text: "Edmonton Oilers — 106.5 tímového bodu", target: "Edmonton", metric: "teamPoints", line: 106.5 },
  { id: 13, text: "New York Rangers — 104.5 tímového bodu", target: "Rangers", metric: "teamPoints", line: 104.5 },
  { id: 14, text: "Chicago Blackhawks — 78.5 tímového bodu", target: "Chicago", metric: "teamPoints", line: 78.5 },
  { id: 15, text: "San Jose Sharks — 72.5 tímového bodu", target: "San Jose", metric: "teamPoints", line: 72.5 },
];

export const DEFAULT_H2H_DUELS: H2HDuel[] = [
  { id: 1, playerA: "Connor McDavid", playerB: "Nathan MacKinnon", metric: "Viac kanadských bodov" },
  { id: 2, playerA: "Auston Matthews", playerB: "David Pastrňák", metric: "Viac strelených gólov" },
  { id: 3, playerA: "Connor Bedard", playerB: "Macklin Celebrini", metric: "Viac kanadských bodov" },
  { id: 4, playerA: "Cale Makar", playerB: "Quinn Hughes", metric: "Viac kanadských bodov obrancu" },
  { id: 5, playerA: "Nikita Kucherov", playerB: "Artemi Panarin", metric: "Viac kanadských bodov" },
  { id: 6, playerA: "Leon Draisaitl", playerB: "Mikko Rantanen", metric: "Viac kanadských bodov" },
  { id: 7, playerA: "Jack Hughes", playerB: "Elias Pettersson", metric: "Viac kanadských bodov" },
  { id: 8, playerA: "Sidney Crosby", playerB: "Alex Ovechkin", metric: "Viac kanadských bodov" },
  { id: 9, playerA: "Igor Shesterkin", playerB: "Connor Hellebuyck", metric: "Lepšia % úspešnosť zákrokov" },
  { id: 10, playerA: "Adam Fox", playerB: "Roman Josi", metric: "Viac kanadských bodov obrancu" },
];

export const DEFAULT_BOLD_STATEMENTS: BoldStatement[] = [
  { id: 1, text: "Tím, ktorý minulú sezónu nehral play-off, vyhrá divíziu." },
  { id: 2, text: "Aspoň jeden hráč strelí v základnej časti 60+ gólov." },
  { id: 3, text: "Nováčik (Rookie) dosiahne v základnej časti 80+ bodov." },
  { id: 4, text: "Víťaz Presidents' Trophy vypadne hneď v 1. kole play-off." },
  { id: 5, text: "Aspoň dva kanadské tímy postúpia do konferenčných finále." },
  { id: 6, text: "Brankár zaznamená 40+ víťazstiev v základnej časti." },
  { id: 7, text: "Obranca pokorí hranicu 100 bodov v základnej časti." },
  { id: 8, text: "Aspoň jeden tím získa 120+ bodov v základnej časti." },
  { id: 9, text: "Posledný tím ligy bude mať menej ako 55 bodov." },
  { id: 10, text: "Finále Stanley Cupu skončí stavom 4:0 alebo 4:1 na zápasy." },
];

export type TrophyPick = {
  key: string;
  name: string;
  playerId?: number;
  playerName?: string;
  teamId?: number;
  teamName?: string;
  confidence: 1 | 2 | 3;
};

export type SeasonPicksFormData = {
  stanleyCup?: {
    winnerTeamId?: number;
    finalistTeamId?: number;
    seriesScore?: "4:0" | "4:1" | "4:2" | "4:3";
  };
  divisionWinners?: {
    atlanticTeamId?: number;
    metroTeamId?: number;
    centralTeamId?: number;
    pacificTeamId?: number;
  };
  presidentsTrophy?: {
    teamId?: number;
    points?: number;
  };
  playoffTeams?: number[]; // 16 team IDs (8 east, 8 west)
  statLeaders?: {
    artRossPlayerId?: number;
    rocketRichardPlayerId?: number;
    assistsPlayerId?: number;
    topDmanPlayerId?: number;
    topRookiePlayerId?: number;
  };
  trophies?: TrophyPick[];
  overUnder?: Record<string, "OVER" | "UNDER">;
  h2h?: Record<string, "A" | "B">;
  bold?: Record<string, "YES" | "NO">;
  wildcard?: {
    sleeperTeamId?: number;
    bustTeamId?: number;
  };
};

export type SectionPointsBreakdown = {
  stanleyCup: { points: number; max: number; details: Record<string, any> };
  divisionWinners: { points: number; max: number; details: Record<string, any> };
  presidentsTrophy: { points: number; max: number; details: Record<string, any> };
  playoffTeams: { points: number; max: number; details: Record<string, any> };
  statLeaders: { points: number; max: number; details: Record<string, any> };
  trophies: { points: number; max: number; details: Record<string, any> };
  overUnder: { points: number; max: number; details: Record<string, any> };
  h2h: { points: number; max: number; details: Record<string, any> };
  bold: { points: number; max: number; details: Record<string, any> };
  wildcard: { points: number; max: number; details: Record<string, any> };
};

export async function getOrCreateSeasonPicksConfig(season = REGULAR_SEASON, league = "NHL") {
  let cfg = await prisma.seasonPicksConfig.findUnique({
    where: { season_league: { season, league } },
  });

  if (!cfg) {
    cfg = await prisma.seasonPicksConfig.create({
      data: {
        season,
        league,
        status: "OPEN",
        overUnderQuestions: DEFAULT_OVER_UNDER_QUESTIONS,
        h2hDuels: DEFAULT_H2H_DUELS,
        boldStatements: DEFAULT_BOLD_STATEMENTS,
      },
    });
  }

  return cfg;
}

export async function getSeasonPicksData(viewerTeamId?: number | null, season = REGULAR_SEASON, league = "NHL") {
  const [config, teams, players, submissions] = await Promise.all([
    getOrCreateSeasonPicksConfig(season, league),
    prisma.team.findMany({
      where: { league, isAffiliate: false },
      select: {
        id: true,
        name: true,
        slug: true,
        code: true,
        logoUrl: true,
        division: true,
        conference: true,
        gm: true,
        gmNickname: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.player.findMany({
      where: {
        team: { league, isAffiliate: false },
      },
      select: {
        id: true,
        name: true,
        position: true,
        teamId: true,
        isGoalie: true,
        nhlId: true,
        photoUrl: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.seasonPicksSubmission.findMany({
      where: { season, league },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            logoUrl: true,
            gm: true,
            gmNickname: true,
          },
        },
      },
      orderBy: [{ totalPoints: "desc" }, { submittedAt: "asc" }],
    }),
  ]);

  const now = new Date();
  const isLocked = config.status === "LOCKED" || config.status === "RESOLVED" || (config.deadline ? now > config.deadline : false);

  const mySubmission = viewerTeamId ? submissions.find((s) => s.teamId === viewerTeamId) : null;

  return {
    config: {
      ...config,
      isLocked,
    },
    teams,
    players,
    submissions: submissions.map((s) => ({
      ...s,
      picks: isLocked || s.teamId === viewerTeamId ? (s.picks as SeasonPicksFormData) : null,
      pointsBreakdown: s.pointsBreakdown as SectionPointsBreakdown | null,
    })),
    mySubmission: mySubmission
      ? {
          ...mySubmission,
          picks: mySubmission.picks as SeasonPicksFormData,
          pointsBreakdown: mySubmission.pointsBreakdown as SectionPointsBreakdown | null,
        }
      : null,
  };
}

/** Calculate points for a single submission based on official results or computed season stats */
export function calculateSubmissionPoints(
  picks: SeasonPicksFormData,
  official: Record<string, any>
): { totalPoints: number; breakdown: SectionPointsBreakdown } {
  let total = 0;

  // 1. Stanley Cup (Max 70)
  let scPoints = 0;
  const scDetails: Record<string, any> = {};
  if (official.stanleyCup) {
    const pickWinner = picks.stanleyCup?.winnerTeamId;
    const pickFinalist = picks.stanleyCup?.finalistTeamId;
    const pickScore = picks.stanleyCup?.seriesScore;

    const realWinner = official.stanleyCup.winnerTeamId;
    const realFinalist = official.stanleyCup.finalistTeamId;
    const realScore = official.stanleyCup.seriesScore;

    if (pickWinner && realWinner && pickWinner === realWinner) {
      scPoints += 30;
      scDetails.winner = true;
    }
    if (pickFinalist && realFinalist && pickFinalist === realFinalist) {
      scPoints += 15;
      scDetails.finalist = true;
    }
    // Pair bonus: both finalists correctly identified regardless of who won
    const pickedPair = [pickWinner, pickFinalist].filter(Boolean);
    const realPair = [realWinner, realFinalist].filter(Boolean);
    if (
      pickedPair.length === 2 &&
      realPair.length === 2 &&
      pickedPair.includes(realWinner) &&
      pickedPair.includes(realFinalist)
    ) {
      scPoints += 15;
      scDetails.pairBonus = true;
    }
    // Exact series score
    if (pickScore && realScore && pickScore === realScore && pickWinner === realWinner) {
      scPoints += 10;
      scDetails.score = true;
    }
  }
  total += scPoints;

  // 2. Division Winners (Max 55)
  let divPoints = 0;
  let divCount = 0;
  const divDetails: Record<string, any> = {};
  if (official.divisionWinners) {
    const divs = ["atlantic", "metro", "central", "pacific"] as const;
    for (const d of divs) {
      const pTeam = picks.divisionWinners?.[`${d}TeamId` as keyof typeof picks.divisionWinners];
      const rTeam = official.divisionWinners[`${d}TeamId`];
      if (pTeam && rTeam && pTeam === rTeam) {
        divPoints += 10;
        divCount++;
        divDetails[d] = true;
      }
    }
    if (divCount === 4) {
      divPoints += 15; // 4/4 bonus
      divDetails.bonus = true;
    }
  }
  total += divPoints;

  // 3. Presidents' Trophy (Max 25)
  let presPoints = 0;
  const presDetails: Record<string, any> = {};
  if (official.presidentsTrophy) {
    const pTeam = picks.presidentsTrophy?.teamId;
    const rTeam = official.presidentsTrophy.teamId;
    if (pTeam && rTeam && pTeam === rTeam) {
      presPoints += 15;
      presDetails.team = true;
    }

    const pPts = picks.presidentsTrophy?.points;
    const rPts = official.presidentsTrophy.points;
    if (typeof pPts === "number" && typeof rPts === "number") {
      const diff = Math.abs(pPts - rPts);
      if (diff === 0) {
        presPoints += 10;
        presDetails.pointsExact = true;
      } else if (diff <= 2) {
        presPoints += 7;
        presDetails.pointsNear2 = true;
      } else if (diff <= 5) {
        presPoints += 4;
        presDetails.pointsNear5 = true;
      }
    }
  }
  total += presPoints;

  // 4. Playoff Teams (Max 52)
  let poPoints = 0;
  const poDetails: Record<string, any> = {};
  if (Array.isArray(official.playoffTeams) && official.playoffTeams.length > 0) {
    const picked = new Set(picks.playoffTeams || []);
    const realSet = new Set(official.playoffTeams as number[]);
    let correctCount = 0;
    for (const id of picked) {
      if (realSet.has(id)) {
        correctCount++;
        poPoints += 2;
      }
    }
    poDetails.correctCount = correctCount;

    // Conference bonuses (+10 if all 8 in east, +10 if all 8 in west)
    if (Array.isArray(official.eastPlayoffTeams) && Array.isArray(official.westPlayoffTeams)) {
      const eastReal = new Set(official.eastPlayoffTeams as number[]);
      const westReal = new Set(official.westPlayoffTeams as number[]);
      const eastPicked = (picks.playoffTeams || []).filter((id) => eastReal.has(id));
      const westPicked = (picks.playoffTeams || []).filter((id) => westReal.has(id));

      if (eastPicked.length === 8) {
        poPoints += 10;
        poDetails.eastBonus = true;
      }
      if (westPicked.length === 8) {
        poPoints += 10;
        poDetails.westBonus = true;
      }
    }
  }
  total += poPoints;

  // 5. Stat Leaders (Max 60)
  let statPoints = 0;
  const statDetails: Record<string, any> = {};
  if (official.statLeaders) {
    const cats: { key: keyof NonNullable<SeasonPicksFormData["statLeaders"]>; pts: number }[] = [
      { key: "artRossPlayerId", pts: 15 },
      { key: "rocketRichardPlayerId", pts: 15 },
      { key: "assistsPlayerId", pts: 10 },
      { key: "topDmanPlayerId", pts: 10 },
      { key: "topRookiePlayerId", pts: 10 },
    ];
    for (const c of cats) {
      const pId = picks.statLeaders?.[c.key];
      const rId = official.statLeaders[c.key];
      if (pId && rId && pId === rId) {
        statPoints += c.pts;
        statDetails[c.key] = true;
      }
    }
  }
  total += statPoints;

  // 6. Trophies with Confidence (Dynamic)
  let trophyPoints = 0;
  const trophyDetails: Record<string, any> = {};
  if (official.trophies && Array.isArray(picks.trophies)) {
    for (const t of picks.trophies) {
      const realWinner = official.trophies[t.key];
      if (realWinner !== undefined && realWinner !== null) {
        const conf = t.confidence || 1;
        const matched =
          (t.playerId && t.playerId === realWinner.playerId) ||
          (t.teamId && t.teamId === realWinner.teamId) ||
          (t.name && realWinner.name && t.name.toLowerCase() === realWinner.name.toLowerCase());

        if (matched) {
          const gain = 10 * conf;
          trophyPoints += gain;
          trophyDetails[t.key] = { matched: true, gain, conf };
        } else {
          const loss = -5 * conf;
          trophyPoints += loss;
          trophyDetails[t.key] = { matched: false, loss, conf };
        }
      }
    }
  }
  total += trophyPoints;

  // 7. Over / Under (4 pts each)
  let ouPoints = 0;
  const ouDetails: Record<string, any> = {};
  if (official.overUnder && picks.overUnder) {
    for (const [qId, pickVal] of Object.entries(picks.overUnder)) {
      const realVal = official.overUnder[qId];
      if (realVal && realVal === pickVal) {
        ouPoints += 4;
        ouDetails[qId] = true;
      }
    }
  }
  total += ouPoints;

  // 8. Head-to-Head Duels (3 pts each)
  let h2hPoints = 0;
  const h2hDetails: Record<string, any> = {};
  if (official.h2h && picks.h2h) {
    for (const [dId, pickVal] of Object.entries(picks.h2h)) {
      const realVal = official.h2h[dId];
      if (realVal && realVal === pickVal) {
        h2hPoints += 3;
        h2hDetails[dId] = true;
      }
    }
  }
  total += h2hPoints;

  // 9. Bold Predictions (4 pts each)
  let boldPoints = 0;
  const boldDetails: Record<string, any> = {};
  if (official.bold && picks.bold) {
    for (const [sId, pickVal] of Object.entries(picks.bold)) {
      const realVal = official.bold[sId];
      if (realVal && realVal === pickVal) {
        boldPoints += 4;
        boldDetails[sId] = true;
      }
    }
  }
  total += boldPoints;

  // 10. Wildcard: Sleeper & Bust (Max 30)
  let wildcardPoints = 0;
  const wildcardDetails: Record<string, any> = {};
  if (official.wildcard) {
    const sleeperId = picks.wildcard?.sleeperTeamId;
    const bustId = picks.wildcard?.bustTeamId;

    if (sleeperId) {
      if (official.wildcard.playoffTeams?.includes(sleeperId)) {
        wildcardPoints += 10;
        wildcardDetails.sleeperPlayoff = true;
      }
      if (official.wildcard.divisionWinners?.includes(sleeperId)) {
        wildcardPoints += 20;
        wildcardDetails.sleeperDivision = true;
      }
    }

    if (bustId) {
      if (official.wildcard.missedPlayoffs?.includes(bustId)) {
        wildcardPoints += 10;
        wildcardDetails.bustMissed = true;
      }
    }
  }
  total += wildcardPoints;

  const breakdown: SectionPointsBreakdown = {
    stanleyCup: { points: scPoints, max: 70, details: scDetails },
    divisionWinners: { points: divPoints, max: 55, details: divDetails },
    presidentsTrophy: { points: presPoints, max: 25, details: presDetails },
    playoffTeams: { points: poPoints, max: 52, details: poDetails },
    statLeaders: { points: statPoints, max: 60, details: statDetails },
    trophies: { points: trophyPoints, max: 60, details: trophyDetails },
    overUnder: { points: ouPoints, max: 60, details: ouDetails },
    h2h: { points: h2hPoints, max: 30, details: h2hDetails },
    bold: { points: boldPoints, max: 40, details: boldDetails },
    wildcard: { points: wildcardPoints, max: 30, details: wildcardDetails },
  };

  return { totalPoints: total, breakdown };
}

/** Auto-derive official results from live season tables & game records */
export async function deriveLiveSeasonResults(season = REGULAR_SEASON, league = "NHL"): Promise<Record<string, any>> {
  const [standings, skaters, goalies, finalSeries] = await Promise.all([
    computeStandings(season, league),
    skaterTotals(season, league),
    goalieTotals(season, league),
    prisma.playoffSeries.findMany({
      where: { season, league },
    }),
  ]);

  const res: Record<string, any> = {
    divisionWinners: {},
    presidentsTrophy: {},
    playoffTeams: [],
    eastPlayoffTeams: [],
    westPlayoffTeams: [],
    statLeaders: {},
    trophies: {},
    wildcard: {
      playoffTeams: [],
      divisionWinners: [],
      missedPlayoffs: [],
    },
  };

  if (standings.length > 0) {
    // Presidents' Trophy
    const sorted = [...standings].sort((a, b) => b.points - a.points || b.w - a.w);
    if (sorted.length > 0) {
      res.presidentsTrophy = {
        teamId: sorted[0].teamId,
        points: sorted[0].points,
        teamName: sorted[0].name,
      };
    }

    // Division winners
    const divs = ["Atlantic", "Metropolitan", "Central", "Pacific"];
    for (const d of divs) {
      const inDiv = standings.filter((s) => s.division?.toLowerCase().includes(d.toLowerCase()));
      inDiv.sort((a, b) => b.points - a.points || b.w - a.w);
      if (inDiv.length > 0) {
        const key = d === "Metropolitan" ? "metroTeamId" : `${d.toLowerCase()}TeamId`;
        res.divisionWinners[key] = inDiv[0].teamId;
      }
    }

    // Playoff teams (top 8 in East, top 8 in West)
    const east = standings.filter((s) => s.conference?.toLowerCase().includes("east")).sort((a, b) => b.points - a.points);
    const west = standings.filter((s) => s.conference?.toLowerCase().includes("west")).sort((a, b) => b.points - a.points);

    res.eastPlayoffTeams = east.slice(0, 8).map((t) => t.teamId);
    res.westPlayoffTeams = west.slice(0, 8).map((t) => t.teamId);
    res.playoffTeams = [...res.eastPlayoffTeams, ...res.westPlayoffTeams];

    const allDivWinners = Object.values(res.divisionWinners).filter(Boolean) as number[];
    const missed = standings.filter((s) => !res.playoffTeams.includes(s.teamId)).map((s) => s.teamId);

    res.wildcard = {
      playoffTeams: res.playoffTeams,
      divisionWinners: allDivWinners,
      missedPlayoffs: missed,
    };
  }

  // Stat leaders
  if (skaters.length > 0) {
    const byPoints = [...skaters].sort((a, b) => b.points - a.points || b.goals - a.goals);
    const byGoals = [...skaters].sort((a, b) => b.goals - a.goals || b.points - a.points);
    const byAssists = [...skaters].sort((a, b) => b.assists - a.assists || b.points - a.points);
    const byDman = skaters.filter((s) => s.position.includes("D")).sort((a, b) => b.points - a.points);
    const byRookie = skaters.filter((s) => s.rookie).sort((a, b) => b.points - a.points);

    res.statLeaders = {
      artRossPlayerId: byPoints[0]?.playerId,
      rocketRichardPlayerId: byGoals[0]?.playerId,
      assistsPlayerId: byAssists[0]?.playerId,
      topDmanPlayerId: byDman[0]?.playerId,
      topRookiePlayerId: byRookie[0]?.playerId,
    };
  }

  // Stanley cup finals
  const finals = finalSeries.find((s) => s.round === 4);
  if (finals && finals.winnerTeamId) {
    const loser = finals.winnerTeamId === finals.highSeedTeamId ? finals.lowSeedTeamId : finals.highSeedTeamId;
    const maxWins = Math.max(finals.highWins, finals.lowWins);
    const minWins = Math.min(finals.highWins, finals.lowWins);
    res.stanleyCup = {
      winnerTeamId: finals.winnerTeamId,
      finalistTeamId: loser,
      seriesScore: `${maxWins}:${minWins}`,
    };
  }

  return res;
}

/** Recalculate and persist scores for all submissions */
export async function evaluateAllSubmissions(season = REGULAR_SEASON, league = "NHL") {
  const cfg = await getOrCreateSeasonPicksConfig(season, league);
  const liveResults = await deriveLiveSeasonResults(season, league);

  // Merge live auto results with any admin official results overrides
  const official = {
    ...liveResults,
    ...((cfg.officialResults as Record<string, any>) || {}),
  };

  const submissions = await prisma.seasonPicksSubmission.findMany({
    where: { season, league },
  });

  for (const s of submissions) {
    const picks = s.picks as SeasonPicksFormData;
    const { totalPoints, breakdown } = calculateSubmissionPoints(picks, official);

    await prisma.seasonPicksSubmission.update({
      where: { id: s.id },
      data: {
        totalPoints,
        pointsBreakdown: breakdown,
      },
    });
  }

  return { ok: true, count: submissions.length, official };
}
