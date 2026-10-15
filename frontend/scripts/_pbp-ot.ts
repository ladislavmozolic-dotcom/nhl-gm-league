/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: find a V3 game that went to OT and print its overtime play-by-play. npx tsx scripts/_pbp-ot.ts
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";
(async () => {
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" }, take: 8 })).map((t) => t.id);
  const a = await loadSimTeam(ids[2]), b = await loadSimTeam(ids[5]);
  for (let seed = 1; seed < 200; seed++) {
    const r: any = simulateGame(structuredClone(a), structuredClone(b), { settings, seed, engineVersion: ENGINE_V3 });
    if (r.endedIn === "OT") { console.log("seed", seed, r.endedIn); console.log(r.playByPlay.filter((l: any) => l.period >= 4 && l.kind !== "change").map((l: any) => `${l.time} [${l.kind}] ${l.text}`).join("\n")); break; }
  }
  await prisma.$disconnect();
})();
