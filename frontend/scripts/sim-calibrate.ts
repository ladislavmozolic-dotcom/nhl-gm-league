// Calibration harness: sim many games across all NHL teams and report aggregate
// stats vs NHL targets. Use this whenever tuning the engine constants.
//
//   npx tsx scripts/sim-calibrate.ts [gamesPerPair]

import { prisma } from "../lib/prisma";
import { loadSimTeam } from "../lib/sim";
import { simulateGame } from "../lib/sim/engine";
import type { SimTeam } from "../lib/sim/types";

const TARGETS = {
  goalsPerTeam: 3.05,
  shotsPerTeam: 29.5,
  savePct: 0.905,
  homeWinPct: 0.545,
  otSoPct: 0.23,     // share of games decided past regulation
};

async function main() {
  const perPair = Number(process.argv[2] ?? 2);
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, name: true },
  });

  // load all sim teams once
  const sims: SimTeam[] = [];
  for (const t of teams) {
    try { sims.push(await loadSimTeam(t.id)); }
    catch (e) { console.warn(`skip ${t.name}: ${(e as Error).message}`); }
  }
  console.log(`Loaded ${sims.length} NHL teams. Simulating...`);

  let games = 0, homeWins = 0, otso = 0;
  let totGoals = 0, totShots = 0, totSaves = 0, totSA = 0, totPP = 0, totPPO = 0;
  const offVals: number[] = [], defVals: number[] = [];

  for (const s of sims) { offVals.push(s.offenseRating); defVals.push(s.defenseRating); }

  for (let i = 0; i < sims.length; i++) {
    for (let j = 0; j < sims.length; j++) {
      if (i === j) continue;
      for (let g = 0; g < perPair; g++) {
        const r = simulateGame(sims[i], sims[j], { seed: (i * 1000 + j) * 31 + g });
        games++;
        if (r.winner === sims[i].id) homeWins++;
        if (r.endedIn !== "REG") otso++;
        for (const box of [r.home, r.away]) {
          totGoals += box.goals; totShots += box.shots;
          totSaves += box.goalie.saves; totSA += box.goalie.shotsAgainst;
          totPP += box.ppGoals; totPPO += box.ppOpp;
        }
      }
    }
  }

  const teamGames = games * 2;
  const fmt = (v: number, t: number, pct = false) => {
    const val = pct ? (v * 100).toFixed(1) + "%" : v.toFixed(2);
    const tgt = pct ? (t * 100).toFixed(1) + "%" : t.toFixed(2);
    const off = ((v - t) / t * 100);
    const flag = Math.abs(off) < 6 ? "OK " : Math.abs(off) < 15 ? "~  " : "!! ";
    return `${flag} ${val}  (target ${tgt}, ${off >= 0 ? "+" : ""}${off.toFixed(0)}%)`;
  };

  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  console.log(`\n=== ${games} games simulated ===`);
  console.log(`goals/team    ${fmt(totGoals / teamGames, TARGETS.goalsPerTeam)}`);
  console.log(`shots/team    ${fmt(totShots / teamGames, TARGETS.shotsPerTeam)}`);
  console.log(`team save%    ${fmt(totSaves / totSA, TARGETS.savePct, true)}`);
  console.log(`home win%     ${fmt(homeWins / games, TARGETS.homeWinPct, true)}`);
  console.log(`OT+SO share   ${fmt(otso / games, TARGETS.otSoPct, true)}`);
  console.log(`PP%           ${(totPP / totPPO * 100).toFixed(1)}%  (target ~20-22%)`);
  console.log(`\nteam offense rating  avg ${avg(offVals).toFixed(1)}  [${Math.min(...offVals).toFixed(0)}..${Math.max(...offVals).toFixed(0)}]`);
  console.log(`team defense rating  avg ${avg(defVals).toFixed(1)}  [${Math.min(...defVals).toFixed(0)}..${Math.max(...defVals).toFixed(0)}]`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
