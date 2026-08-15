// Verify the engine's long-run quality correlation: load every NHL team once, play
// many double round-robins in memory (no DB writes), and report each team's average
// points-per-82. Averages out single-season variance → the engine's true verdict.
//   npx tsx scripts/verify-strength.ts [iterations]
import { prisma } from "../lib/prisma";
import { loadSimTeam } from "../lib/sim";
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import type { SimTeam } from "../lib/sim/types";

const ITER = Number(process.argv[2] ?? 20);

async function main() {
  const t0 = Date.now();
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true } });
  // OV strength proxy (best-18 skaters + starter) for the correlation
  const strength: Record<number, number> = {};
  for (const t of teams) {
    const pl = await prisma.player.findMany({ where: { teamId: t.id }, select: { overall: true, isGoalie: true } });
    const sk = pl.filter((x) => !x.isGoalie && x.overall != null).map((x) => x.overall!).sort((a, b) => b - a).slice(0, 18);
    const g = pl.filter((x) => x.isGoalie && x.overall != null).map((x) => x.overall!).sort((a, b) => b - a)[0] ?? 0;
    strength[t.id] = (sk.reduce((a, b) => a + b, 0) / (sk.length || 1)) * 0.8 + g * 0.2;
  }
  const sim = new Map<number, SimTeam>();
  for (const t of teams) sim.set(t.id, await loadSimTeam(t.id));
  const settings = await loadSettings();

  const pts: Record<number, number> = {}, gp: Record<number, number> = {};
  teams.forEach((t) => { pts[t.id] = 0; gp[t.id] = 0; });
  let seed = 1;
  for (let it = 0; it < ITER; it++) {
    for (const h of teams) for (const a of teams) {
      if (h.id === a.id) continue;
      const r = simulateGame(sim.get(h.id)!, sim.get(a.id)!, { seed: seed++, settings });
      gp[h.id]++; gp[a.id]++;
      const lid = r.winner === h.id ? a.id : h.id;
      pts[r.winner] += 2; if (r.endedIn !== "REG") pts[lid] += 1;
    }
  }
  const rows = teams.map((t) => ({ code: t.code, id: t.id, per82: (pts[t.id] / gp[t.id]) * 82, str: +strength[t.id].toFixed(1) }));
  rows.sort((a, b) => b.per82 - a.per82);
  rows.forEach((r, i) => (r as any).ptsRank = i + 1);
  const byStr = [...rows].sort((a, b) => b.str - a.str); byStr.forEach((r, i) => (r as any).strRank = i + 1);
  const n = rows.length, d2 = rows.reduce((s, r) => s + ((r as any).ptsRank - (r as any).strRank) ** 2, 0);
  const spearman = 1 - (6 * d2) / (n * (n * n - 1));

  console.log(`Mass-sim: ${ITER} double round-robins = ${ITER * n * (n - 1)} games in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`Spearman corr (OV strength vs long-run pts): ${spearman.toFixed(3)}`);
  console.log("\n=== engine's long-run points-per-82 (variance averaged out) ===");
  rows.forEach((r) => console.log(`${String((r as any).ptsRank).padStart(2)}. ${r.code.padEnd(4)} ${r.per82.toFixed(1).padStart(6)}   (strength ${r.str}, strRank #${(r as any).strRank})`));
  const ana = rows.find((r) => r.code === "ANA")!;
  console.log(`\n>>> ANAHEIM long-run: pts-rank #${(ana as any).ptsRank}, ${ana.per82.toFixed(1)} pts/82 · strength-rank #${(ana as any).strRank} (${ana.str})`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
