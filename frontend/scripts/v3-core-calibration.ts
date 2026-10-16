// Read-only distribution check for the isolated V3 Core prototype.
// Run with: npx tsx scripts/v3-core-calibration.ts [seedBase] [ticks]
import { prisma } from "../lib/prisma";
import { loadSimTeam } from "../lib/sim";
import { diagnoseCorePrototype } from "../lib/sim/v3-core/diagnostic";

async function main() {
  const seedBase = Number(process.argv[2] ?? 90_000);
  const ticks = Number(process.argv[3] ?? 720);
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true } })).map((t) => t.id);
  const teams = await Promise.all(ids.map((id) => loadSimTeam(id)));
  let games = 0, goals = 0, shots = 0, turnovers = 0;
  const actionMix: Record<string, number> = {};
  for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
    if (i === j) continue;
    const report = diagnoseCorePrototype(teams[i], teams[j], seedBase + i * 100 + j, ticks);
    games++; goals += report.score.home + report.score.away; shots += report.shots; turnovers += report.turnovers;
    for (const [action, n] of Object.entries(report.actionMix)) actionMix[action] = (actionMix[action] ?? 0) + n;
  }
  const perTeamGame = (n: number) => n / games / 2;
  console.log(`\n=== V3 CORE PROTOTYPE CALIBRATION — ${games} games, ${ticks} ticks/game ===`);
  console.log(`Goals / team / game: ${perTeamGame(goals).toFixed(2)} (future target 2.9–3.15)`);
  console.log(`Shots / team / game: ${perTeamGame(shots).toFixed(1)} (future target 28–32)`);
  console.log(`Turnovers / team / game: ${perTeamGame(turnovers).toFixed(1)} (diagnostic; no target yet)`);
  console.log(`Action mix / game: ${Object.entries(actionMix).map(([action, n]) => `${action} ${(n / games).toFixed(1)}`).join(" · ")}`);
  await prisma.$disconnect();
}
main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
