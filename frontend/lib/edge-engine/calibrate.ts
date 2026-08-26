/* Fit the REF (league mean/sd) for every per-60 sub-metric from real MoneyPuck data, so an
 * elite player's real rate maps to a genuinely elite z-score. Pair with the ProfiNHL-fitted
 * output curves (curves.calibrated.json) to reproduce the current ProfiNHL scale.
 *
 *   npx tsx lib/edge-engine/calibrate.ts <dir-with-mp2025/2024/2023.csv>
 * writes lib/edge-engine/ref.calibrated.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadMoneyPuckSeason } from "./loaders/moneypuck";
import { assemble, mpPos } from "./loaders/assemble";
import { weightedOnIce, weightedPer60 } from "./math";
import { groupOf, type PlayerInput, type SituationLine } from "./types";

const DIR = process.argv[2];
if (!DIR) { console.error("usage: calibrate.ts <csv-dir>"); process.exit(1); }
const maps = ["2025", "2024", "2023"].map((y, i) =>
  loadMoneyPuckSeason(readFileSync(`${DIR}/mp${y}.csv`, "utf8"), ["2025-26", "2024-25", "2023-24"][i]));

// assemble every skater (minimal bio — only pos matters for these rate metrics)
const players = assemble(maps, (s) => ({ id: s.playerId, name: s.name, pos: mpPos(s.pos), age: 26 })).map((a) => a.input);

const ev = (p: PlayerInput, f: (l: SituationLine) => number | undefined) => weightedPer60(p.seasons, "ev5v5", f);
const all = (p: PlayerInput, f: (l: SituationLine) => number | undefined) => weightedPer60(p.seasons, "all", f);
const pp = (p: PlayerInput, f: (l: SituationLine) => number | undefined) => weightedPer60(p.seasons, "pp", f);

const meanSd = (xs: number[]) => {
  if (xs.length < 5) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return { mean: Math.round(m * 1000) / 1000, sd: Math.round(Math.sqrt(v) * 1000) / 1000 };
};

// metric → (player → value | null); `split` fits F and D separately.
type Def = { key: string; split?: boolean; get: (p: PlayerInput) => number | null };
const MIN_EV = 150; // min weighted 5v5 minutes to be included
const evMin = (p: PlayerInput) => weightedPer60(p.seasons, "ev5v5", () => 1).exposureMin;
const allMin = (p: PlayerInput) => weightedPer60(p.seasons, "all", () => 1).exposureMin;

const DEFS: Def[] = [
  { key: "hits60", split: true, get: (p) => ev(p, (l) => l.hits).per60 },
  { key: "hitsAll60", split: true, get: (p) => all(p, (l) => l.hits).per60 },
  { key: "minors60", get: (p) => all(p, (l) => l.minorsTaken).per60 },
  { key: "majors60", get: (p) => all(p, (l) => l.majorsTaken).per60 },
  { key: "a1_5v5", split: true, get: (p) => ev(p, (l) => l.primaryAssists).per60 },
  { key: "a2_5v5", split: true, get: (p) => ev(p, (l) => l.secondaryAssists).per60 },
  { key: "ppa1", split: true, get: (p) => (pp(p, () => 1).exposureMin > 30 ? pp(p, (l) => l.primaryAssists).per60 : null) },
  { key: "ppa2", split: true, get: (p) => (pp(p, () => 1).exposureMin > 30 ? pp(p, (l) => l.secondaryAssists).per60 : null) },
  { key: "g5v5", split: true, get: (p) => ev(p, (l) => l.goals).per60 },
  { key: "xg5v5", split: true, get: (p) => ev(p, (l) => l.xGoals).per60 },
  { key: "sog5v5", split: true, get: (p) => ev(p, (l) => l.shotsOnGoal).per60 },
  { key: "ppg", split: true, get: (p) => (pp(p, () => 1).exposureMin > 30 ? pp(p, (l) => l.goals).per60 : null) },
  { key: "penDrawn60", get: (p) => all(p, (l) => l.penaltiesDrawn).per60 },
  { key: "dzGiveaway60", get: (p) => all(p, (l) => l.dzGiveaways).per60 },
  { key: "blocks60", split: true, get: (p) => all(p, (l) => l.blocks).per60 },
  { key: "takeaways60", get: (p) => all(p, (l) => l.takeaways).per60 },
  { key: "shootingTalent", get: (p) => { const g = ev(p, (l) => l.goals).totalCount, x = ev(p, (l) => l.xGoals).totalCount, s = ev(p, (l) => l.shotsOnGoal).totalCount; return s > 0 ? (g - x) / s : null; } },
  { key: "advTurnover", get: (p) => { const sog = all(p, (l) => l.shotsOnGoal).totalCount, a1 = all(p, (l) => l.primaryAssists).totalCount, a2 = all(p, (l) => l.secondaryAssists).totalCount, gv = all(p, (l) => l.giveaways).totalCount; const inv = 1.9 * sog + 1.5 * a1 + 0.75 * a2; return inv > 0 ? gv / inv : null; } },
  { key: "xGA60Rel", get: (p) => weightedOnIce(p.seasons, "ev5v5", (l) => l.xGA60Rel).value },
  { key: "hdXGA60Rel", get: (p) => weightedOnIce(p.seasons, "ev5v5", (l) => l.hdXGA60Rel).value },
  { key: "CA60Rel", get: (p) => weightedOnIce(p.seasons, "ev5v5", (l) => l.CA60Rel).value },
  { key: "pkXGA60Rel", get: (p) => { const e = weightedOnIce(p.seasons, "pk", (l) => l.xGA60Rel); return e.exposureMin > 20 ? e.value : null; } },
  { key: "toiPerGP", split: true, get: (p) => { let n = 0, d = 0; p.seasons.forEach((s, i) => { if (s.all?.icetime && s.gamesPlayed) { const w = [1, 0.55, 0.3][i] ?? 0.1; n += w * s.all.icetime / 60; d += w * s.gamesPlayed; } }); return d > 0 ? n / d : null; } },
  { key: "pkUsage", get: (p) => { let n = 0, d = 0; p.seasons.forEach((s, i) => { if (s.gamesPlayed) { const w = [1, 0.55, 0.3][i] ?? 0.1; n += w * (s.pk?.icetime ?? 0) / 60; d += w * s.gamesPlayed; } }); return d > 0 ? n / d : null; } },
];

const out: Record<string, { mean: number; sd: number }> = {};
for (const def of DEFS) {
  const groups = def.split ? (["F", "D"] as const) : (["ALL"] as const);
  for (const g of groups) {
    const xs: number[] = [];
    for (const p of players) {
      if (evMin(p) < MIN_EV && allMin(p) < MIN_EV) continue;
      if (g !== "ALL" && groupOf(p.bio.pos) !== g) continue;
      const v = def.get(p);
      if (v != null && Number.isFinite(v)) xs.push(v);
    }
    const ms = meanSd(xs);
    if (ms) out[g === "ALL" ? def.key : `${def.key}|${g}`] = ms;
  }
}

const path = new URL("./ref.calibrated.json", import.meta.url);
writeFileSync(path, JSON.stringify(out, null, 0) + "\n");
console.log(`fitted ${Object.keys(out).length} refs from ${players.length} skaters → ref.calibrated.json`);
for (const k of ["a1_5v5|F", "g5v5|F", "sog5v5|F", "xGA60Rel", "advTurnover", "hits60|F"]) console.log(" ", k, JSON.stringify(out[k]));
