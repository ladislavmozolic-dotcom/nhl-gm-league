/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: all V3 realism ON vs ON-without-one-flag (ABL=pin|dump|pace|playEvents|transitionRush|stoppageRealism|fightStory), identical seeds.
// Prints goals, shots, higher-rated-team win %, home win %. Run: ABL=pin npx tsx scripts/realism-ablation.ts [bases=2] [seedBase=91000000]
import { simulateGame } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";

const bases = Number(process.argv[2] ?? 2), seedBase = Number(process.argv[3] ?? 91_000_000);
const ABL = process.env.ABL ?? "pin";
const ALL = { transitionRush: true, stoppageRealism: true, playEvents: true, fightStory: true, pace: true, pin: true, dump: true };
(async () => {
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
  const teams: Awaited<ReturnType<typeof loadSimTeam>>[] = [];
  for (const id of ids) teams.push(await loadSimTeam(id));
  const acc: Record<string, any> = { all: { g: 0, goals: 0, shots: 0, fav: 0, home: 0 }, without: { g: 0, goals: 0, shots: 0, fav: 0, home: 0 } };
  for (let b = 0; b < bases; b++) for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
    if (i === j) continue;
    for (const arm of ["all", "without"] as const) {
      const flags: any = arm === "all" ? ALL : { ...ALL, [ABL]: false };
      const r: any = simulateGame(structuredClone(teams[i]), structuredClone(teams[j]), { settings, seed: seedBase + b * 100_000 + i * 100 + j, engineVersion: ENGINE_V3, experimentalV3: flags });
      const a = acc[arm]; a.g++; a.goals += r.home.goals + r.away.goals; a.shots += r.home.shots + r.away.shots;
      a.fav += r.winner === (teams[i].avgOV >= teams[j].avgOV ? teams[i].id : teams[j].id) ? 1 : 0; a.home += r.winner === r.home.teamId ? 1 : 0;
    }
  }
  for (const [k, a] of Object.entries(acc)) console.log(`ABL=${ABL} ${k.padEnd(7)} games ${a.g}  goals/g ${(a.goals / a.g).toFixed(2)}  shots/tg ${(a.shots / a.g / 2).toFixed(1)}  fav wins ${(100 * a.fav / a.g).toFixed(1)}%  home wins ${(100 * a.home / a.g).toFixed(1)}%`);
  await prisma.$disconnect();
})();
