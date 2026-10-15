/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: V3 overtime pace on vs off — how games end, shots in OT, goals. Run: npx tsx scripts/ot-check.ts [bases=2] [seedBase=47000000]
import { simulateGame, OT_TUNING } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";
const bases = Number(process.argv[2] ?? 2), seedBase = Number(process.argv[3] ?? 47_000_000);
if (process.argv[4]) Object.assign(OT_TUNING, JSON.parse(process.argv[4]));
(async () => {
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
  const teams: any[] = []; for (const id of ids) teams.push(await loadSimTeam(id));
  const acc: Record<string, any> = { off: { g: 0, goals: 0, shots: 0, reg: 0, ot: 0, so: 0, otShots: 0, otGames: 0 }, on: { g: 0, goals: 0, shots: 0, reg: 0, ot: 0, so: 0, otShots: 0, otGames: 0 } };
  for (let b = 0; b < bases; b++) for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
    if (i === j) continue;
    for (const arm of ["off", "on"] as const) {
      const r: any = simulateGame(structuredClone(teams[i]), structuredClone(teams[j]), { settings, seed: seedBase + b * 100_000 + i * 100 + j, engineVersion: ENGINE_V3, experimentalV3: { otPace: arm === "on" } });
      const a = acc[arm]; a.g++; a.goals += r.home.goals + r.away.goals; a.shots += r.home.shots + r.away.shots;
      a[r.endedIn === "REG" ? "reg" : r.endedIn === "OT" ? "ot" : "so"]++;
      if (r.endedIn !== "REG") { a.otGames++; a.otShots += (r.events ?? []).filter((e: any) => e.type === "SHOT" && e.period === 4).length + (r.events ?? []).filter((e: any) => e.type === "GOAL" && e.period === 4 && !e.meta?.so).length; }
    }
  }
  for (const [k, a] of Object.entries(acc)) console.log(k.padEnd(3), `games ${a.g}`, `goals/g ${(a.goals / a.g).toFixed(3)}`, `shots/tg ${(a.shots / a.g / 2).toFixed(2)}`, `| REG ${(100 * a.reg / a.g).toFixed(1)}% OT-goal ${(100 * a.ot / a.g).toFixed(1)}% SO ${(100 * a.so / a.g).toFixed(1)}% | OT: SO share ${(100 * a.so / Math.max(1, a.ot + a.so)).toFixed(1)}%, shots+goals in OT per OT game ${(a.otShots / Math.max(1, a.otGames)).toFixed(2)}`);
  await prisma.$disconnect();
})();
