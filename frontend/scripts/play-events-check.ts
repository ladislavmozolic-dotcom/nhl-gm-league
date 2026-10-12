/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: V3 with vs without in-play hits/blocks/takeaways on identical seeds (every ordered pair of the 32 NHL clubs).
// Totals that must stay put: goals, shots, PIM. Targets per team-game: hits ≈21, blocks ≈14, takeaways ≈7.
// Run: npx tsx scripts/play-events-check.ts [bases=1] [seedBase=31000000]
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";

const bases = Number(process.argv[2] ?? 1), seedBase = Number(process.argv[3] ?? 31_000_000);
const fresh = () => ({ games: 0, goals: 0, shots: 0, pim: 0, hits: 0, blocks: 0, takes: 0, hitEv: 0, blockEv: 0, ot: 0, closeTake: 0 });

(async () => {
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
  const teams: Awaited<ReturnType<typeof loadSimTeam>>[] = [];
  for (const id of ids) teams.push(await loadSimTeam(id));
  const arms = { off: fresh(), on: fresh() };
  for (let b = 0; b < bases; b++) for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
    if (i === j) continue;
    for (const arm of ["off", "on"] as const) {
      const r: any = simulateGame(structuredClone(teams[i]), structuredClone(teams[j]), { settings, seed: seedBase + b * 100_000 + i * 100 + j, engineVersion: ENGINE_V3, experimentalV3: { playEvents: arm === "on" } });
      const a = arms[arm]; a.games++;
      a.goals += r.home.goals + r.away.goals; a.shots += r.home.shots + r.away.shots; a.pim += r.home.pim + r.away.pim;
      a.hits += r.home.hits + r.away.hits; a.blocks += r.home.blocks + r.away.blocks; a.ot += r.endedIn !== "REG" ? 1 : 0;
      const ev: any[] = r.events ?? [];
      a.takes += ev.filter((e) => e.type === "TAKEAWAY").length;
      const tk = ev.filter((e) => e.type === "TAKEAWAY").map((e) => (e.period - 1) * 1200 + e.seconds).sort((x, y) => x - y);
      for (let k = 1; k < tk.length; k++) if (tk[k] - tk[k - 1] <= 3) a.closeTake++;
    }
  }
  for (const [k, a] of Object.entries(arms)) {
    const tg = a.games * 2;
    console.log(k.padEnd(4), `games ${a.games}`, `goals/g ${(a.goals / a.games).toFixed(2)}`, `shots/tg ${(a.shots / tg).toFixed(1)}`, `pim/g ${(a.pim / a.games).toFixed(1)}`, `OT ${(100 * a.ot / a.games).toFixed(1)}%`,
      `| hits/tg ${(a.hits / tg).toFixed(1)}`, `blocks/tg ${(a.blocks / tg).toFixed(1)}`, `takeaways/tg ${(a.takes / tg).toFixed(1)}`, `takeaways ≤3s apart/g ${(a.closeTake / a.games).toFixed(2)}`);
  }
  await prisma.$disconnect();
})();
