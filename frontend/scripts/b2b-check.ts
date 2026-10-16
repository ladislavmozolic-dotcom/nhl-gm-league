/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: V3 back-to-back effect — the same games with the home club rested vs on the 2nd night of a back-to-back.
// NHL ≈ a team on a B2B against a rested opponent wins ~44% (vs ~50%), goal diff ≈ −0.2/game. Run: npx tsx scripts/b2b-check.ts [bases=1] [B2B_TUNING json]
import { simulateGame, B2B_TUNING } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";
const bases = Number(process.argv[2] ?? 1);
if (process.argv[3]) Object.assign(B2B_TUNING, JSON.parse(process.argv[3]));
(async () => {
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
  const teams: any[] = []; for (const id of ids) teams.push(await loadSimTeam(id));
  const acc: Record<string, { g: number; w: number; gd: number; goals: number }> = { rested: { g: 0, w: 0, gd: 0, goals: 0 }, b2b: { g: 0, w: 0, gd: 0, goals: 0 } };
  for (let b = 0; b < bases; b++) for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
    if (i === j) continue;
    for (const arm of ["rested", "b2b"] as const) {
      const h = structuredClone(teams[i]); h.backToBack = arm === "b2b";
      const r: any = simulateGame(h, structuredClone(teams[j]), { settings, seed: 95_000_000 + b * 100_000 + i * 100 + j, engineVersion: ENGINE_V3 });
      const a = acc[arm]; a.g++; a.w += r.winner === r.home.teamId ? 1 : 0; a.gd += r.home.goals - r.away.goals; a.goals += r.home.goals + r.away.goals;
    }
  }
  for (const [k, a] of Object.entries(acc)) console.log(k.padEnd(7), `home win ${(100 * a.w / a.g).toFixed(1)}%  goal diff ${(a.gd / a.g).toFixed(2)}  goals/g ${(a.goals / a.g).toFixed(2)}`);
  await prisma.$disconnect();
})();
