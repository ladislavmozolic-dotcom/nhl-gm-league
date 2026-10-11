/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: V3 with vs without transition rushes on identical seeds (all 32 NHL clubs, every ordered pair = 992 games/base).
// Prints league totals (must stay put) and what the rushes themselves look like per team-game.
// Run: npx tsx scripts/rush-check.ts [bases=3] [seedBase=21000000] ['{"rate":1,"gate":1,"danger":1}']
import { simulateGame, RUSH_TUNING } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";

const FLAG = process.env.FLAG ?? "transitionRush"; // which V3 flag the two arms differ by
const bases = Number(process.argv[2] ?? 3), seedBase = Number(process.argv[3] ?? 21_000_000);
if (process.argv[4]) Object.assign(RUSH_TUNING, JSON.parse(process.argv[4]));

type Acc = { games: number; goals: number; shots: number; pim: number; ppOpp: number; ot: number; home: number; blow: number;
  rush: Record<string, { n: number; out: Record<string, number>; shots: number; goals: number }>; ps: number; psGoals: number; hd: number };
const fresh = (): Acc => ({ games: 0, goals: 0, shots: 0, pim: 0, ppOpp: 0, ot: 0, home: 0, blow: 0, rush: {}, ps: 0, psGoals: 0, hd: 0 });

(async () => {
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
  const teams: Awaited<ReturnType<typeof loadSimTeam>>[] = [];
  for (const id of ids) teams.push(await loadSimTeam(id));
  const arms: Record<string, Acc> = { off: fresh(), on: fresh() };
  for (let b = 0; b < bases; b++) for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
    if (i === j) continue;
    for (const arm of ["off", "on"] as const) {
      // fresh clones: a game must not see state the other arm's game touched
      const r: any = simulateGame(structuredClone(teams[i]), structuredClone(teams[j]), { settings, seed: seedBase + b * 100_000 + i * 100 + j, engineVersion: ENGINE_V3, experimentalV3: Object.fromEntries(FLAG.split(",").map((f) => [f, arm === "on"])) as any });
      const a = arms[arm]; a.games++;
      a.goals += r.home.goals + r.away.goals; a.shots += r.home.shots + r.away.shots; a.pim += r.home.pim + r.away.pim;
      a.ppOpp += r.home.ppOpp + r.away.ppOpp; a.ot += r.endedIn !== "REG" ? 1 : 0; a.home += r.winner === r.home.teamId ? 1 : 0;
      a.blow += Math.abs(r.home.goals - r.away.goals) >= 4 ? 1 : 0; a.hd += r.home.hdFor + r.away.hdFor;
      const ev: any[] = r.events ?? [];
      for (const e of ev) {
        if (e.type === "WHISTLE") { const k = "WHISTLE:" + e.meta.reason; const x = (a.rush[k] ??= { n: 0, out: {}, shots: 0, goals: 0 }); x.n++; }
        else if (e.type === "RUSH") { const k = e.meta.kind; const x = (a.rush[k] ??= { n: 0, out: {}, shots: 0, goals: 0 }); x.n++; x.out[e.meta.outcome] = (x.out[e.meta.outcome] ?? 0) + 1; }
        else if (e.type === "SHOT" && e.meta?.rush) { (a.rush[e.meta.rush] ??= { n: 0, out: {}, shots: 0, goals: 0 }).shots++; }
        else if (e.type === "GOAL" && e.meta?.rush) { a.rush[e.meta.rush].goals++; }
        else if (e.type === "PENALTY_SHOT") a.ps++;
        else if (e.type === "GOAL" && e.meta?.penaltyShot) a.psGoals++;
      }
    }
  }
  const per = (n: number, a: Acc) => (n / a.games / 2);
  for (const arm of ["off", "on"] as const) {
    const a = arms[arm];
    console.log(`\n=== rush ${arm.toUpperCase()} — ${a.games} games ===`);
    console.log(`goals/team ${per(a.goals, a).toFixed(3)}  shots/team ${per(a.shots, a).toFixed(2)}  PIM/team ${per(a.pim, a).toFixed(2)}  PP opp/team ${per(a.ppOpp, a).toFixed(3)}  HD shots/team ${per(a.hd, a).toFixed(2)}`);
    console.log(`OT/SO ${(a.ot / a.games * 100).toFixed(2)}%  home win ${(a.home / a.games * 100).toFixed(2)}%  blowouts(≥4) ${(a.blow / a.games * 100).toFixed(2)}%`);
    if (arm === "on") {
      for (const k of Object.keys(a.rush).filter((x) => x.startsWith("WHISTLE:"))) console.log(`${k.padEnd(18)} per game ${(a.rush[k].n / a.games).toFixed(2)}`);
      for (const k of ["BREAKAWAY", "2ON1", "3ON2"]) { const x = a.rush[k]; if (!x) continue; console.log(`${k.padEnd(9)} rushes/team ${per(x.n, a).toFixed(2)}  shots/team ${per(x.shots, a).toFixed(2)}  goals/team ${per(x.goals, a).toFixed(3)}  conv ${(x.goals / Math.max(1, x.shots) * 100).toFixed(1)}%  outcomes ${JSON.stringify(x.out)}`); }
      console.log(`penalty shots/game ${(a.ps / a.games).toFixed(3)}  converted ${(a.psGoals / Math.max(1, a.ps) * 100).toFixed(0)}%`);
    }
  }
  const o = arms.off, n = arms.on, d = (x: number, y: number) => `${(per(y, n) - per(x, o) >= 0 ? "+" : "")}${(per(y, n) - per(x, o)).toFixed(3)}`;
  console.log(`\nΔ on−off: goals ${d(o.goals, n.goals)}  shots ${d(o.shots, n.shots)}  PIM ${d(o.pim, n.pim)}  PP opp ${d(o.ppOpp, n.ppOpp)}  OT% ${((n.ot - o.ot) / o.games * 100).toFixed(2)}`);
  await prisma.$disconnect(); process.exit(0);
})();
