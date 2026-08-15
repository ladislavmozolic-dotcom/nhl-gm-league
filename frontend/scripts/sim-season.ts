// CLI: generate a schedule, play the season, and print standings + leaders.
//
//   npx tsx scripts/sim-season.ts generate          # fresh schedule (SCHEDULED rows)
//   npx tsx scripts/sim-season.ts play              # play all scheduled games
//   npx tsx scripts/sim-season.ts play --round 0    # play only round 0
//   npx tsx scripts/sim-season.ts standings         # print standings + leaders
//   npx tsx scripts/sim-season.ts run               # generate + play + standings

import { prisma } from "../lib/prisma";
import { generateSchedule } from "../lib/sim/schedule";
import { playScheduledGames, resetConditions } from "../lib/sim/season";
import { computeStandings, skaterLeaders, goalieLeaders } from "../lib/sim/standings";

const SEASON = "2026-27";
const pad = (s: string | number, n: number, right = false) =>
  right ? String(s).padStart(n) : String(s).padEnd(n);

async function doGenerate(gamesPerTeam?: number) {
  const r = await generateSchedule(SEASON, gamesPerTeam ? { gamesPerTeam } : {});
  await resetConditions();
  console.log(`Schedule generated: ${r.teams} teams, ${r.games} games, ${r.rounds} rounds, ~${r.gamesPerTeam} games/team. Goalie CON reset to 100.`);
}

async function doPlay(round?: number) {
  const t0 = Date.now();
  let n = 0;
  const { played } = await playScheduledGames({
    season: SEASON, round,
    onGame: () => { if (++n % 100 === 0) process.stdout.write(`  ...${n} games\r`); },
  });
  console.log(`Played ${played} games in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
}

async function printStandings() {
  const standings = await computeStandings(SEASON);
  const byConf: Record<string, typeof standings> = {};
  for (const s of standings) {
    const key = s.conference ?? "League";
    (byConf[key] ??= []).push(s);
  }
  for (const [conf, rows] of Object.entries(byConf)) {
    console.log(`\n=== ${conf} ===`);
    console.log("  " + pad("Team", 22) + pad("GP", 4, true) + pad("W", 4, true) +
      pad("L", 4, true) + pad("OTL", 5, true) + pad("PTS", 5, true) +
      pad("GF", 5, true) + pad("GA", 5, true) + pad("DIFF", 6, true));
    for (const s of rows) {
      console.log("  " + pad(s.name, 22) + pad(s.gp, 4, true) + pad(s.w, 4, true) +
        pad(s.l, 4, true) + pad(s.otl, 5, true) + pad(s.points, 5, true) +
        pad(s.gf, 5, true) + pad(s.ga, 5, true) +
        pad((s.diff >= 0 ? "+" : "") + s.diff, 6, true));
    }
  }
}

async function printLeaders() {
  const skaters = await skaterLeaders(SEASON, 20);
  console.log("\n=== Scoring leaders (top 20) ===");
  console.log("  " + pad("Player", 24) + pad("Pos", 5) + pad("Tm", 5) + pad("GP", 4, true) +
    pad("G", 4, true) + pad("A", 4, true) + pad("P", 4, true) + pad("+/-", 5, true));
  for (const s of skaters) {
    console.log("  " + pad(s.name, 24) + pad(s.position, 5) + pad(s.teamCode ?? "", 5) + pad(s.gp, 4, true) +
      pad(s.goals, 4, true) + pad(s.assists, 4, true) + pad(s.points, 4, true) +
      pad((s.plusMinus >= 0 ? "+" : "") + s.plusMinus, 5, true));
  }
  const dCount = skaters.filter((s) => s.isDefense).length;
  console.log(`  -> ${dCount} defensemen in the top 20 (NHL typical: ~2-4)`);

  // top defenseman
  const topD = (await skaterLeaders(SEASON, 300)).filter((s) => s.isDefense)[0];
  if (topD) console.log(`  top D: ${topD.name} — ${topD.points} pts (${topD.goals}G ${topD.assists}A) in ${topD.gp} GP`);

  const goalies = await goalieLeaders(SEASON, 10);
  console.log("\n=== Goalie leaders ===");
  console.log("  " + pad("Goalie", 24) + pad("Tm", 5) + pad("GP", 4, true) +
    pad("W", 4, true) + pad("L", 4, true) + pad("SV%", 7, true) + pad("GAA", 6, true));
  for (const g of goalies) {
    console.log("  " + pad(g.name, 24) + pad(g.teamCode ?? "", 5) + pad(g.gp, 4, true) +
      pad(g.wins, 4, true) + pad(g.losses + g.otl, 4, true) +
      pad((g.savePct * 100).toFixed(1), 7, true) + pad(g.gaa.toFixed(2), 6, true));
  }
}

async function main() {
  const cmd = process.argv[2] ?? "run";
  const roundIdx = process.argv.indexOf("--round");
  const round = roundIdx >= 0 ? Number(process.argv[roundIdx + 1]) : undefined;
  // optional numeric arg = games per team (e.g. `run 82`)
  const gpt = process.argv.slice(3).map(Number).find((n) => Number.isFinite(n) && n > 10);

  switch (cmd) {
    case "generate": await doGenerate(gpt); break;
    case "play": await doPlay(round); break;
    case "standings": await printStandings(); await printLeaders(); break;
    case "run":
      await doGenerate(gpt);
      await doPlay();
      await printStandings();
      await printLeaders();
      break;
    default:
      console.error(`Unknown command "${cmd}". Use generate | play | standings | run.`);
      process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
