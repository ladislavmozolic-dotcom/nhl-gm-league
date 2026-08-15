// Phase 5 — run the full calibration report from the CLI:  npx tsx scripts/calibration-lab.ts
import { runCalibration } from "../lib/sim/calibration";
import { prisma } from "../lib/prisma";

async function main() {
  const r = await runCalibration();
  const icon = (s: string) => (s === "ok" ? "✅" : s === "warn" ? "⚠️ " : "❌");
  console.log(`\n=== CALIBRATION LAB — ${r.games} games, ${r.teams} teams, ${(r.ms / 1000).toFixed(1)}s ===\n`);
  let group = "";
  for (const m of r.metrics) {
    if (m.group !== group) { group = m.group; console.log(`── ${group} ──`); }
    console.log(`  ${icon(m.status)} ${m.label.padEnd(34)} ${m.value.padStart(14)}   target ${m.target}${m.hint ? `   (${m.hint})` : ""}`);
  }
  const fails = r.metrics.filter((x) => x.status === "fail").length;
  const warns = r.metrics.filter((x) => x.status === "warn").length;
  console.log(`\n${fails === 0 ? "✅ all green" : `❌ ${fails} fail`}${warns ? ` · ${warns} warn` : ""}\n`);
  await prisma.$disconnect();
}
main();
