import { prisma } from "../lib/prisma";
import { loadSimTeam } from "../lib/sim";
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
async function main() {
  const ids = async (c: string) => (await prisma.team.findFirst({ where: { code: c, league: "NHL", isAffiliate: false }, select: { id: true } }))!.id;
  const A = await loadSimTeam(await ids("COL")), B = await loadSimTeam(await ids("DET")), C = await loadSimTeam(await ids("OTT")), D = await loadSimTeam(await ids("NJD"));
  const base = await loadSettings();
  const N = 1500;
  for (const v of [0, 60, 85, 130, 200, 300]) {
    const settings = { ...base, gameVariancePct: v };
    const run = (h: typeof A, a: typeof A) => {
      let w = 0, gs: number[] = [];
      for (let i = 0; i < N; i++) { const r = simulateGame(h, a, { seed: 900000 + i * 7 + v, settings }); if (r.winner === (h as any).id) w++; gs.push(r.home.goals - r.away.goals); }
      const m = gs.reduce((x, y) => x + y, 0) / N, sd = Math.sqrt(gs.reduce((x, y) => x + (y - m) ** 2, 0) / N);
      return `win ${(100 * w / N).toFixed(1)}% goalDiffSD ${sd.toFixed(2)}`;
    };
    console.log(`var ${String(v).padStart(3)}% | COL(h) vs DET: ${run(A, B)} | OTT(h) vs NJD: ${run(C, D)}`);
  }
}
main().finally(() => prisma.$disconnect());
