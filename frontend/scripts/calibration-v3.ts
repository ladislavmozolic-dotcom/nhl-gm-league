// Offline V3 calibration: never changes LeagueConfig or persists a game.
// Run with: npx tsx scripts/calibration-v3.ts
import { runCalibration } from "../lib/sim/calibration";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";

async function main() {
  const seedBase = Number(process.argv[2]);
  const mode = process.argv[3];
  const experimentalV3 = mode === "fatigue-only" ? { fatigueDeployment: true, coachAdaptation: false }
    : mode === "coach-only" ? { fatigueDeployment: false, coachAdaptation: true }
      : mode === "baseline" ? { fatigueDeployment: false, coachAdaptation: false, checkingMatchup: false, qualityDAssists: false, faceoffPressure: false, reboundClearance: false, momentumTimeout: false, assistSpread: false, emotionalDiscipline: false, finishingCurve: false, goalieRhythm: false, blockSkill: false, goalieComposure: false, overtimeStars: false, ppPuckMovement: false, speedDrawsPenalties: false }
        : undefined;
  const r = await runCalibration({ engineVersion: ENGINE_V3, ...(Number.isFinite(seedBase) ? { seedBase } : {}), ...(experimentalV3 ? { experimentalV3 } : {}) });
  const icon = (s: string) => (s === "ok" ? "✅" : s === "warn" ? "⚠️ " : "❌");
  console.log(`\n=== V3 OFFLINE CALIBRATION — ${r.games} games, ${r.teams} teams, ${(r.ms / 1000).toFixed(1)}s${Number.isFinite(seedBase) ? `, seed ${seedBase}` : ""}${mode ? `, ${mode}` : ""} ===\n`);
  let group = "";
  for (const m of r.metrics) {
    if (m.group !== group) { group = m.group; console.log(`── ${group} ──`); }
    console.log(`  ${icon(m.status)} ${m.label.padEnd(34)} ${m.value.padStart(14)}   target ${m.target}${m.hint ? `   (${m.hint})` : ""}`);
  }
  const fails = r.metrics.filter((x) => x.status === "fail").length;
  const warns = r.metrics.filter((x) => x.status === "warn").length;
  console.log(`\n${fails === 0 ? "✅ all green" : `❌ ${fails} fail`}${warns ? " · " + warns + " warn" : ""}\n`);
  await prisma.$disconnect();
}
main();
