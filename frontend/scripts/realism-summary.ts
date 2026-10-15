/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: V3 with every realism feature OFF vs the current V3 default (all ON), identical seeds, every ordered pair of the 32 NHL clubs.
// Prints a markdown table. Run: npx tsx scripts/realism-summary.ts [bases=3] [seedBase=88000000]
import { simulateGame, TEAM_EDGE_TUNING } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";

const bases = Number(process.argv[2] ?? 3), seedBase = Number(process.argv[3] ?? 88_000_000);
if (process.argv[4]) Object.assign(TEAM_EDGE_TUNING, JSON.parse(process.argv[4]));
const OFF = { transitionRush: false, stoppageRealism: false, playEvents: false, fightStory: false, pace: false, pin: false, dump: false };
const ON = { transitionRush: true, stoppageRealism: true, playEvents: true, fightStory: true, pace: true, pin: true, dump: true };

type A = Record<string, number>;
const fresh = (): A => ({ games: 0 });
const add = (a: A, k: string, v: number) => { a[k] = (a[k] ?? 0) + v; };

(async () => {
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
  const teams: Awaited<ReturnType<typeof loadSimTeam>>[] = [];
  for (const id of ids) teams.push(await loadSimTeam(id));
  const arms: Record<string, A> = { off: fresh(), on: fresh() };
  for (let b = 0; b < bases; b++) for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
    if (i === j) continue;
    for (const arm of ["off", "on"] as const) {
      const r: any = simulateGame(structuredClone(teams[i]), structuredClone(teams[j]), { settings, seed: seedBase + b * 100_000 + i * 100 + j, engineVersion: ENGINE_V3, experimentalV3: arm === "on" ? ON : OFF });
      const a = arms[arm]; a.games++;
      add(a, "goals", r.home.goals + r.away.goals); add(a, "shots", r.home.shots + r.away.shots);
      add(a, "pim", r.home.pim + r.away.pim); add(a, "ppOpp", r.home.ppOpp + r.away.ppOpp);
      add(a, "hits", r.home.hits + r.away.hits); add(a, "blocks", r.home.blocks + r.away.blocks);
      add(a, "ot", r.endedIn !== "REG" ? 1 : 0); add(a, "homeWin", r.winner === r.home.teamId ? 1 : 0);
      add(a, "fav", r.winner === (teams[i].avgOV >= teams[j].avgOV ? teams[i].id : teams[j].id) ? 1 : 0);
      add(a, "blow", Math.abs(r.home.goals - r.away.goals) >= 4 ? 1 : 0);
      add(a, "shutout", (r.home.goals === 0 ? 1 : 0) + (r.away.goals === 0 ? 1 : 0));
      add(a, "svp", (1 - (r.home.goals + r.away.goals) / Math.max(1, r.home.shots + r.away.shots)) * 100);
      const ev: any[] = r.events ?? [];
      const n = (t: string) => ev.filter((e) => e.type === t).length;
      add(a, "entries", n("ZONE_ENTRY")); add(a, "dumps", ev.filter((e) => e.type === "ZONE_ENTRY" && e.meta?.entryType === "dump").length);
      add(a, "takeaways", n("TAKEAWAY")); add(a, "rush", n("RUSH")); add(a, "penShot", n("PENALTY_SHOT"));
      add(a, "rushGoals", ev.filter((e) => e.type === "GOAL" && e.meta?.rush).length);
      add(a, "whistles", n("WHISTLE")); add(a, "pressure", n("PRESSURE")); add(a, "fights", n("FIGHT"));
      add(a, "fightsAnswer", ev.filter((e) => e.type === "FIGHT" && e.meta?.revenge).length);
      add(a, "goalieGetsPuck", r.playByPlay.filter((l: any) => /play the dump-in/.test(l.text)).length);
      add(a, "pbpLines", r.playByPlay.length);
    }
  }
  const o = arms.off, n = arms.on;
  const per = (a: A, k: string, d: "game" | "team") => (a[k] ?? 0) / (a.games * (d === "team" ? 2 : 1));
  const rows: [string, string, number, number][] = [
    ["Goals / game", "game", per(o, "goals", "game"), per(n, "goals", "game")],
    ["Shots / team", "team", per(o, "shots", "team"), per(n, "shots", "team")],
    ["Penalty minutes / game", "game", per(o, "pim", "game"), per(n, "pim", "game")],
    ["Power plays / team", "team", per(o, "ppOpp", "team"), per(n, "ppOpp", "team")],
    ["OT/SO games (%)", "pct", 100 * o.ot / o.games, 100 * n.ot / n.games],
    ["Home win (%)", "pct", 100 * o.homeWin / o.games, 100 * n.homeWin / n.games],
    ["Higher-rated team wins (%)", "pct", 100 * o.fav / o.games, 100 * n.fav / n.games],
    ["Blowouts ≥4 goals (%)", "pct", 100 * o.blow / o.games, 100 * n.blow / n.games],
    ["Shutouts / game", "game", per(o, "shutout", "game"), per(n, "shutout", "game")],
    ["Hits / team", "team", per(o, "hits", "team"), per(n, "hits", "team")],
    ["Blocked shots / team", "team", per(o, "blocks", "team"), per(n, "blocks", "team")],
    ["Takeaways / team", "team", per(o, "takeaways", "team"), per(n, "takeaways", "team")],
    ["Zone entries / team", "team", per(o, "entries", "team"), per(n, "entries", "team")],
    ["…of which dump-ins / team", "team", per(o, "dumps", "team"), per(n, "dumps", "team")],
    ["Goalie plays the puck / game", "game", per(o, "goalieGetsPuck", "game"), per(n, "goalieGetsPuck", "game")],
    ["Odd-man rushes / team", "team", per(o, "rush", "team"), per(n, "rush", "team")],
    ["Goals off rushes / game", "game", per(o, "rushGoals", "game"), per(n, "rushGoals", "game")],
    ["Penalty shots / game", "game", per(o, "penShot", "game"), per(n, "penShot", "game")],
    ["Named stoppages / game", "game", per(o, "whistles", "game"), per(n, "whistles", "game")],
    ["Long zone pins (20 s+) / game", "game", per(o, "pressure", "game"), per(n, "pressure", "game")],
    ["Fights / game", "game", per(o, "fights", "game"), per(n, "fights", "game")],
    ["…answers to a hit / game", "game", per(o, "fightsAnswer", "game"), per(n, "fightsAnswer", "game")],
    ["Play-by-play lines / game", "game", per(o, "pbpLines", "game"), per(n, "pbpLines", "game")],
  ];
  console.log(`\n${o.games} games per arm (every ordered pair of the 32 NHL clubs × ${bases}); seeds identical\n`);
  console.log("| Metric | V3 before | V3 now | Δ |\n|---|---:|---:|---:|");
  for (const [label, , a, b] of rows) console.log(`| ${label} | ${a.toFixed(2)} | ${b.toFixed(2)} | ${(b - a >= 0 ? "+" : "") + (b - a).toFixed(2)} |`);
  await prisma.$disconnect();
})();
