/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: print a period of a V3 play-by-play (no line changes) for eyeballing. npx tsx scripts/_pbp-sample.ts [seed] [period] [from] [to]
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";
(async () => {
  const [seed = "777001", period = "1", from = "0", to = "95"] = process.argv.slice(2);
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" }, take: 8 })).map((t) => t.id);
  const a = await loadSimTeam(ids[1]), b = await loadSimTeam(ids[6]);
  const r: any = simulateGame(a, b, { settings, seed: Number(seed), engineVersion: ENGINE_V3 });
  console.log(r.playByPlay.filter((l: any) => l.period === Number(period) && l.kind !== "change").slice(Number(from), Number(to)).map((l: any) => `${l.time} [${l.kind}] ${l.text}`).join("\n"));
  await prisma.$disconnect();
})();
