// Offline: with every V3 flag off, V3 must reproduce V2 byte-for-byte (apart from the version stamp).
// Run with: npx tsx scripts/v3-identity.ts [seedBase] [games]
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V2, ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";

const OFF = { fatigueDeployment: false, coachAdaptation: false, checkingMatchup: false, qualityDAssists: false, faceoffPressure: false, reboundClearance: false, momentumTimeout: false, assistSpread: false, emotionalDiscipline: false, finishingCurve: false, goalieRhythm: false, blockSkill: false, goalieComposure: false, overtimeStars: false, ppPuckMovement: false, speedDrawsPenalties: false, netFront: false };

async function main() {
  const seedBase = Number(process.argv[2] ?? 290000);
  const n = Number(process.argv[3] ?? 40);
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true } })).map((t) => t.id);
  const teams = [];
  for (const id of ids) teams.push(await loadSimTeam(id));
  let bad = 0;
  for (let k = 0; k < n; k++) {
    const i = k % teams.length, j = (k * 7 + 1) % teams.length;
    if (i === j) continue;
    const seed = seedBase + i * 100 + j;
    const a = JSON.parse(JSON.stringify(simulateGame(teams[i], teams[j], { settings, seed, engineVersion: ENGINE_V2 })));
    const b = JSON.parse(JSON.stringify(simulateGame(teams[i], teams[j], { settings, seed, engineVersion: ENGINE_V3, experimentalV3: OFF })));
    a.engineVersion = b.engineVersion = "x";
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) {
      bad++;
      if (bad <= 3) {
        let p = 0; while (sa[p] === sb[p]) p++;
        console.log(`DIFF seed ${seed} at char ${p}: ...${sa.slice(Math.max(0, p - 80), p + 60)}\n   vs ...${sb.slice(Math.max(0, p - 80), p + 60)}`);
      }
    }
  }
  console.log(bad === 0 ? `✅ identical on ${n} games` : `❌ ${bad}/${n} games differ`);
  await prisma.$disconnect();
}
main();
