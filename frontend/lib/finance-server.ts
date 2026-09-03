// Server-side finance processing: recompute each team's bank account from the
// season's played games. Ticket revenue (home games, scaled by attendance) in;
// salaries out over the schedule. Idempotent — sets the balance.

import { prisma } from "./prisma";
import { getArenaSections, selloutRevenue, computeTeamFinance, projectedPointsPct, STARTING_BANK } from "./finance";
import { computeStandings } from "./sim/standings";
import { loadSettings } from "./sim/settings";

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
  const [teams, standings, cfg] = await Promise.all([
    prisma.team.findMany({
      where: { league, isAffiliate: false },
      select: {
        id: true, capacity: true, arenaSections: true, popularity: true,
        profinhlBank: true, ledgerAdj: true,
        players: { where: { rosterType: league }, select: { capHit: true } },
      },
    }),
    computeStandings(season, league),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } }),
  ]);
  const stById = new Map(standings.map((s) => [s.teamId, s]));
  const rewards = league === "NHL" ? await computeRewards(season) : new Map<number, number>();

  // Season-opening bank: a uniform commissioner-set starting capital for every club
  // (a level playing field). Detailed Finance then drives the bank off the fan-
  // interest → demand → revenue model, pro-rated by how much of the season is played.
  const { loadSettings } = await import("./sim/settings");
  const settings = await loadSettings();
  const startBankUniform = settings.startingCapital;
  const detailed = league === "NHL" && settings.financeMode === "detailed";
  const detailedFin = detailed ? await (await import("./detailed-finance-server")).leagueDetailedFinance() : null;

  const updates: Promise<unknown>[] = [];
  for (const t of teams) {
    const [homeGames, totalGames] = await Promise.all([
      prisma.game.count({ where: { season, league, status: "FINAL", seriesId: null, homeTeamId: t.id } }),
      prisma.game.count({ where: { season, league, status: "FINAL", seriesId: null, OR: [{ homeTeamId: t.id }, { awayTeamId: t.id }] } }),
    ]);
    const st = stById.get(t.id);
    const startBank = startBankUniform;
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
        salary: t.players.reduce((s, p) => s + (p.capHit ?? 0), 0),
        homeGamesPlayed: homeGames,
        totalGamesPlayed: totalGames,
        startingBank: startBank,
      });
      bank = fin.bankAccount;
    }
    // ledgerAdj preserves GM cash moves (trades/buyouts/fines) across this recompute
    updates.push(prisma.team.update({ where: { id: t.id }, data: { bankAccount: Math.round(bank + reward + (t.ledgerAdj ?? 0)) } }));
  }
  await Promise.all(updates);
  return { teams: teams.length };
}
