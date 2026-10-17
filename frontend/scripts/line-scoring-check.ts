/* eslint-disable @typescript-eslint/no-explicit-any */
// Read-only: how scoring spreads over the forward lines in V3 — share of forward goals/points per line, even-strength
// points per 60 by line, and whether a well-rated depth forward (line 3) produces like a line-2 forward of the same
// rating. Every ordered pair of the 32 NHL clubs × bases.
// Run: SETTINGS=scripts/fixtures/league-settings-2026-10.json npx tsx scripts/line-scoring-check.ts [bases=1]
// NHL ≈ (5v5 + PP, forwards): line 1 ≈ 37%, line 2 ≈ 29%, line 3 ≈ 21%, line 4 ≈ 13% of forward goals.
import { readFileSync } from "fs";
import { simulateGame, DEPTH_TUNING } from "../lib/sim/engine";
import { loadSettings, mergeSettings } from "../lib/sim/settings";
import { loadSimTeam } from "../lib/sim/index";
import { ENGINE_V3 } from "../lib/sim/version";
import { prisma } from "../lib/prisma";

const bases = Number(process.argv[2] ?? 1);
if (process.env.DEPTH) Object.assign(DEPTH_TUNING, JSON.parse(process.env.DEPTH));
type Acc = { g: number; p: number; esP: number; esToi: number; n: number };
(async () => {
  const settings = process.env.SETTINGS ? mergeSettings(JSON.parse(readFileSync(process.env.SETTINGS, "utf8"))) : await loadSettings();
  const ids = (await prisma.team.findMany({ where: { league: "NHL" }, select: { id: true }, orderBy: { id: "asc" } })).map((t) => t.id);
  const teams: any[] = []; for (const id of ids) teams.push(await loadSimTeam(id));
  // player → forward line (1..4) from the set lines, and his offense rating
  const lineOf = new Map<number, number>(), off = new Map<number, number>();
  for (const t of teams) {
    (t.units ?? []).filter((u: any) => !u.isDef).forEach((u: any, i: number) => { for (const m of u.members) if (!lineOf.has(m)) lineOf.set(m, i + 1); });
    for (const s of t.forwards) off.set(s.id, s.offense);
  }
  const byLine: Record<number, Acc> = {};
  const band: Record<string, Acc> = {}; // `${line}:${ratingBand}`
  let games = 0;
  for (let b = 0; b < bases; b++) for (let i = 0; i < teams.length; i++) for (let j = 0; j < teams.length; j++) {
    if (i === j) continue;
    const r: any = simulateGame(structuredClone(teams[i]), structuredClone(teams[j]), { settings, seed: 99_000_000 + b * 100_000 + i * 100 + j, engineVersion: ENGINE_V3, ...(process.env.EXP ? { experimentalV3: JSON.parse(process.env.EXP) } : {}) });
    games++;
    for (const side of [r.home, r.away]) for (const l of side.skaters) {
      const ln = lineOf.get(l.id); if (!ln) continue;
      const es = l.points - (l.ppGoals ?? 0) - (l.ppAssists ?? 0) - (l.shGoals ?? 0) - (l.shAssists ?? 0);
      const esToi = Math.max(0, (l.toi ?? 0) - (l.ppToi ?? 0) - (l.pkToi ?? 0));
      const a = (byLine[ln] ??= { g: 0, p: 0, esP: 0, esToi: 0, n: 0 }); a.g += l.goals; a.p += l.points; a.esP += es; a.esToi += esToi; a.n++;
      const rb = Math.floor((off.get(l.id) ?? 50) / 5) * 5;
      const k = `${ln}:${rb}`; const c = (band[k] ??= { g: 0, p: 0, esP: 0, esToi: 0, n: 0 }); c.esP += es; c.esToi += esToi; c.p += l.points; c.n++;
    }
  }
  const totG = Object.values(byLine).reduce((n, a) => n + a.g, 0), totP = Object.values(byLine).reduce((n, a) => n + a.p, 0);
  console.log(`\n${games} games · goals/g ${(totG / games).toFixed(2)} (forwards)\n\n| Line | Goals % | Points % | ES TOI/g | ES P/60 | NHL goals % |\n|---|---:|---:|---:|---:|---:|`);
  const nhl: Record<number, string> = { 1: "≈37", 2: "≈29", 3: "≈21", 4: "≈13" };
  for (const ln of [1, 2, 3, 4]) { const a = byLine[ln]; if (!a) continue; console.log(`| ${ln} | ${(100 * a.g / totG).toFixed(1)} | ${(100 * a.p / totP).toFixed(1)} | ${(a.esToi / a.n / 60).toFixed(1)} | ${(a.esP / (a.esToi / 3600)).toFixed(2)} | ${nhl[ln]} |`); }
  console.log("\nES points/60 by OFFENSE rating band and line (does a good player produce on any line?)\n\n| OFF | L1 | L2 | L3 | L4 |\n|---|---:|---:|---:|---:|");
  for (const rb of [55, 60, 65, 70, 75, 80]) {
    const cell = (ln: number) => { const c = band[`${ln}:${rb}`]; return c && c.n >= 200 ? (c.esP / (c.esToi / 3600)).toFixed(2) : "—"; };
    console.log(`| ${rb}–${rb + 4} | ${cell(1)} | ${cell(2)} | ${cell(3)} | ${cell(4)} |`);
  }
  await prisma.$disconnect();
})();
