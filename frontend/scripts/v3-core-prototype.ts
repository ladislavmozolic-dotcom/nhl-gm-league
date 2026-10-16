// Read-only V3 Core architecture diagnostic. Run with:
// npx tsx scripts/v3-core-prototype.ts [homeTeamId] [awayTeamId] [seed]
import { prisma } from "../lib/prisma";
import { loadSimTeam } from "../lib/sim";
import { diagnoseCorePrototype } from "../lib/sim/v3-core/diagnostic";

async function main() {
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" }, take: 2 })).map((t) => t.id);
  const homeId = Number(process.argv[2] ?? ids[0]);
  const awayId = Number(process.argv[3] ?? ids[1]);
  const seed = Number(process.argv[4] ?? 90_000);
  if (!Number.isFinite(homeId) || !Number.isFinite(awayId) || homeId === awayId) throw new Error("Supply two distinct NHL team ids.");
  const [home, away] = await Promise.all([loadSimTeam(homeId), loadSimTeam(awayId)]);
  const report = diagnoseCorePrototype(home, away, seed);
  console.log(`\n=== V3 CORE PROTOTYPE — ${home.name} vs ${away.name}, seed ${seed} ===`);
  console.log(`Score: ${report.score.home} – ${report.score.away} | shots: ${report.shots} | turnovers: ${report.turnovers}`);
  console.log(`Action mix: ${Object.entries(report.actionMix).map(([key, value]) => `${key} ${value}`).join(" · ")}`);
  console.log("\nFirst causal events:");
  for (const line of report.eventLog) console.log(`  ${line}`);
  await prisma.$disconnect();
}
main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
