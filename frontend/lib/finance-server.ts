// Server-side finance processing: recompute each team's bank account from the
// season's played games. Ticket revenue (home games, scaled by attendance) in;
// salaries out over the schedule. Idempotent — sets the balance.

import { prisma } from "./prisma";
import { getArenaSections, selloutRevenue, computeTeamFinance, projectedPointsPct, farmSalaryExpense, liveCapHit } from "./finance";
import { computeStandings } from "./sim/standings";
import { loadSettings } from "./sim/settings";
import { specialEventIncome } from "./special-games";

/**
 * Season-end rewards paid into the NHL team's bank:
 *  - every NHL playoff team gets `rewardPlayoff`
 *  - the Cup champion gets `rewardCup` on top
 *  - the AHL Cup champion / finalist earn for their parent NHL organization
 * Returns a map of NHL teamId -> total reward (idempotent — derived from results).
 */
export async function computeRewards(season: string): Promise<Map<number, number>> {
  const s = await loadSettings();
  const rewards = new Map<number, number>();
  const add = (teamId: number | null | undefined, amt: number) => {
    if (!teamId || !amt) return;
    rewards.set(teamId, (rewards.get(teamId) ?? 0) + amt);
  };

  // NHL: playoff berths (everyone in a round-1 series) + Cup champion
  const nhlSeries = await prisma.playoffSeries.findMany({ where: { season, league: "NHL" }, select: { round: true, highSeedTeamId: true, lowSeedTeamId: true, winnerTeamId: true } });
  const playoffTeams = new Set<number>();
  for (const se of nhlSeries.filter((x) => x.round === 1)) { playoffTeams.add(se.highSeedTeamId); playoffTeams.add(se.lowSeedTeamId); }
  for (const id of playoffTeams) add(id, s.rewardPlayoff);
  const nhlFinal = nhlSeries.find((x) => x.round === 4 && x.winnerTeamId);
  add(nhlFinal?.winnerTeamId, s.rewardCup);

  // special events (outdoor games / Global Series) actually played this season
  const events = await prisma.game.findMany({ where: { season, league: "NHL", status: "FINAL", eventKind: { not: null } }, select: { homeTeamId: true, awayTeamId: true, eventKind: true } });
  for (const [id, v] of specialEventIncome(events, s)) add(id, v);

  // AHL: Cup champion + finalist earn for the parent NHL club
  const ahlFinal = await prisma.playoffSeries.findFirst({ where: { season, league: "AHL", round: 4, status: "DONE" }, select: { highSeedTeamId: true, lowSeedTeamId: true, winnerTeamId: true } });
  if (ahlFinal?.winnerTeamId) {
    const loserId = ahlFinal.winnerTeamId === ahlFinal.highSeedTeamId ? ahlFinal.lowSeedTeamId : ahlFinal.highSeedTeamId;
    const affiliates = await prisma.team.findMany({ where: { id: { in: [ahlFinal.winnerTeamId, loserId] } }, select: { id: true, parentTeamId: true } });
    const parentOf = new Map(affiliates.map((a) => [a.id, a.parentTeamId]));
    add(parentOf.get(ahlFinal.winnerTeamId), s.rewardAhlCup);
    add(parentOf.get(loserId), s.rewardAhlFinalist);
  }
  return rewards;
}

export async function processFinances(season = "2026-27", league = "NHL") {
  const [teams, standings] = await Promise.all([
    prisma.team.findMany({
      where: { league, isAffiliate: false },
      select: {
        id: true, capacity: true, arenaSections: true, popularity: true,
        bankAccount: true, ledgerAdj: true, financeSeason: true, seasonOpeningBank: true,
        players: { where: { rosterType: league }, select: { capHit: true, retainedSalary: true, contractYears: true } },
        affiliateTeams: { select: { players: { where: { rosterType: "AHL" }, select: { capHit: true, ahlSalary: true, contractType: true, contractYears: true } } } },
      },
    }),
    computeStandings(season, league),
  ]);
  const stById = new Map(standings.map((s) => [s.teamId, s]));
  const rewards = league === "NHL" ? await computeRewards(season) : new Map<number, number>();

  // The first Detailed Finance season opens at the commissioner-set capital. Every
  // later season carries the prior closing balance forward. seasonOpeningBank makes
  // the daily recompute idempotent while ledgerAdj preserves in-season cash moves.
  const { loadSettings } = await import("./sim/settings");
  const settings = await loadSettings();
  const startBankUniform = settings.startingCapital;
  const detailed = league === "NHL" && settings.financeMode === "detailed";
  const detailedFin = detailed ? await (await import("./detailed-finance-server")).leagueDetailedFinance(season) : null;

  const updates: Promise<unknown>[] = [];
  for (const t of teams) {
    const [homeGames, totalGames] = await Promise.all([
      prisma.game.count({ where: { season, league, status: "FINAL", seriesId: null, homeTeamId: t.id } }),
      prisma.game.count({ where: { season, league, status: "FINAL", seriesId: null, OR: [{ homeTeamId: t.id }, { awayTeamId: t.id }] } }),
    ]);
    const st = stById.get(t.id);
    const rollingIntoNewSeason = t.financeSeason != null && t.financeSeason !== season;
    const startBank = rollingIntoNewSeason
      ? (t.bankAccount ?? startBankUniform)
      : (t.seasonOpeningBank ?? startBankUniform);
    const ledgerAdj = rollingIntoNewSeason ? 0 : (t.ledgerAdj ?? 0);
    const reward = rewards.get(t.id) ?? 0;

    let bank: number;
    const df = detailedFin?.get(t.id);
    if (df) {
      const progress = Math.min(1, totalGames / 82); // season fraction played
      bank = startBank + df.net * progress;
    } else {
      const fin = computeTeamFinance({
        popularity: t.popularity,
        pointsPct: projectedPointsPct(st),
        selloutRevenue: selloutRevenue(getArenaSections(t)),
        // real dollars owed by THIS club — a player it acquired with retention
        // only costs it the post-retention share; the retaining club carries the
        // rest. Farm contracts use their AHL salary on two-way deals and their
        // listed salary otherwise; they never touch the NHL cap.
        salary: t.players.reduce((s, p) => s + Math.max(0, liveCapHit(p) - (p.retainedSalary ?? 0)), 0)
          + farmSalaryExpense(t.affiliateTeams.flatMap((a) => a.players)),
        homeGamesPlayed: homeGames,
        totalGamesPlayed: totalGames,
        startingBank: startBank,
      });
      bank = fin.bankAccount;
    }
    // ledgerAdj preserves GM cash moves (trades/buyouts/fines) across this season's
    // recomputes; once carried into a new opening balance it resets to zero.
    updates.push(prisma.team.update({
      where: { id: t.id },
      data: {
        bankAccount: Math.round(bank + reward + ledgerAdj),
        financeSeason: season,
        seasonOpeningBank: startBank,
        ...(rollingIntoNewSeason ? { ledgerAdj: 0 } : {}),
      },
    }));
  }
  await Promise.all(updates);
  return { teams: teams.length };
}
