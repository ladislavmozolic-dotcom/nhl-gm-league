/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: do player roles come through in V3? D vs F share of shots/goals/assists, the top shooters' volume,
// shooters vs playmakers. Every ordered pair of the 32 NHL clubs × bases. Run: npx tsx scripts/player-profile-check.ts [bases=1]
import { simulateGame, ROLE_TUNING } from "../lib/sim/engine";
import { loadSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";

const bases = Number(process.argv[2] ?? 1);
if (process.argv[3]) Object.assign(ROLE_TUNING, JSON.parse(process.argv[3]));
type P = { name: string; d: boolean; sc: number; pa: number; gp: number; g: number; a: number; s: number };

(async () => {
  const settings = await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
  const teams: any[] = []; for (const id of ids) teams.push(await loadSimTeam(id));
  const attrs = new Map<number, { sc: number; pa: number; d: boolean }>();
  for (const t of teams) for (const s of [...t.forwards, ...t.defense]) attrs.set(s.id, { sc: s.attrs.sc ?? 50, pa: s.attrs.pa ?? 50, d: s.isDefense });
  const ps = new Map<number, P>();
  for (let b = 0; b < bases; b++) for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
    if (i === j) continue;
    const r: any = simulateGame(structuredClone(teams[i]), structuredClone(teams[j]), { settings, seed: 93_000_000 + b * 100_000 + i * 100 + j, engineVersion: ENGINE_V3, ...(process.env.EXP ? { experimentalV3: JSON.parse(process.env.EXP) } : {}) });
    for (const side of [r.home, r.away]) for (const l of side.skaters) {
      const at = attrs.get(l.id); if (!at) continue;
      const p = ps.get(l.id) ?? { name: l.name, d: at.d, sc: at.sc, pa: at.pa, gp: 0, g: 0, a: 0, s: 0 };
      p.gp++; p.g += l.goals; p.a += l.assists; p.s += l.shots; ps.set(l.id, p);
    }
  }
  const all = [...ps.values()].filter((p) => p.gp >= 20);
  const sum = (f: (p: P) => number, arr = all) => arr.reduce((n, p) => n + f(p), 0);
  const D = all.filter((p) => p.d);
  const row = (l: string, v: number, n: string) => console.log(`| ${l} | ${v.toFixed(1)} | ${n} |`);
  console.log(`\n${all.length} skaters, ${bases * 992} games\n\n| Metric | V3 | NHL ≈ |\n|---|---:|---:|`);
  row("D share of shots %", 100 * sum((p) => p.s, D) / sum((p) => p.s), "30");
  row("D share of goals %", 100 * sum((p) => p.g, D) / sum((p) => p.g), "14");
  row("D share of assists %", 100 * sum((p) => p.a, D) / sum((p) => p.a), "30");
  row("Assists per goal", sum((p) => p.a) / sum((p) => p.g), "1.70");
  const per82 = (p: P, k: "g" | "a" | "s") => (p[k] / p.gp) * 82;
  const top = (k: "g" | "a" | "s", n = 10) => [...all].sort((x, y) => per82(y, k) - per82(x, k)).slice(0, n);
  row("Top-10 shooters, SOG / 82", sum((p) => per82(p, "s"), top("s")) / 10, "290");
  row("Top-10 goal scorers, G / 82", sum((p) => per82(p, "g"), top("g")) / 10, "48");
  row("Top-10 playmakers, A / 82", sum((p) => per82(p, "a"), top("a")) / 10, "68");
  row("Best shooting % (≥150 SOG/82)", Math.max(...all.filter((p) => per82(p, "s") >= 150).map((p) => 100 * p.g / Math.max(1, p.s))), "≈20");
  // shooters vs playmakers among forwards: SC−PA gap vs their A/G ratio
  const F = all.filter((p) => !p.d && p.g + p.a >= 20);
  const shooters = F.filter((p) => p.sc - p.pa >= 8), makers = F.filter((p) => p.pa - p.sc >= 8);
  row(`Shooters (SC ≥ PA+8, n=${shooters.length}): A per G`, sum((p) => p.a, shooters) / Math.max(1, sum((p) => p.g, shooters)), "≈1.0");
  row(`Playmakers (PA ≥ SC+8, n=${makers.length}): A per G`, sum((p) => p.a, makers) / Math.max(1, sum((p) => p.g, makers)), "≈2.5");
  row("Shooters: SOG per game", sum((p) => p.s, shooters) / Math.max(1, sum((p) => p.gp, shooters)), "≈3");
  row("Playmakers: SOG per game", sum((p) => p.s, makers) / Math.max(1, sum((p) => p.gp, makers)), "≈2");
  console.log(`Goals/game ${(sum((p) => p.g) / (bases * 992)).toFixed(2)}`);
  console.log("\nTop 8 by G/82:"); for (const p of top("g", 8)) console.log(`  ${p.name.padEnd(24)} SC ${p.sc} PA ${p.pa}  G ${per82(p, "g").toFixed(0)} A ${per82(p, "a").toFixed(0)} SOG ${per82(p, "s").toFixed(0)}`);
  console.log("Top 8 by A/82:"); for (const p of top("a", 8)) console.log(`  ${p.name.padEnd(24)} SC ${p.sc} PA ${p.pa}  G ${per82(p, "g").toFixed(0)} A ${per82(p, "a").toFixed(0)} SOG ${per82(p, "s").toFixed(0)}`);
  await prisma.$disconnect();
})();
