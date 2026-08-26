/* Build the full rating package from real MoneyPuck season CSVs.
 *
 *   npx tsx lib/edge-engine/build.ts --dir <csvDir> [--bio bio.json] [--out ratings.csv] [--top N]
 *
 * csvDir must contain mp2025.csv / mp2024.csv / mp2023.csv (MoneyPuck seasonSummary skaters,
 * newest = 2025-26). bio.json (optional) supplies what MoneyPuck lacks, keyed by MoneyPuck
 * playerId OR exact name:
 *   { "8478402": { "age":29,"heightCm":185,"weightKg":88,
 *                  "edge":{...},"career":{...},"injuries":[...],"previous":{...} }, ... }
 * Without bio the engine still runs (pos from MoneyPuck, neutral bio) — SK/ST/EX/LD/DU then
 * lean on priors/fallbacks. Feed EDGE + career + injuries for full fidelity.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadMoneyPuckSeason } from "./loaders/moneypuck";
import { loadEdgeCsv } from "./loaders/edge";
import { loadInjuryCsv, loadFightsCsv } from "./loaders/extras";
import { assemble, mpPos, type Extra } from "./loaders/assemble";
import { rateRoster } from "./engine";
import { isCalibrated } from "./config";
import { toSthsCsv } from "./sthsExport";
import { qaFor } from "./qa";
import { RATING_KEYS, type PlayerBio, type RatingKey } from "./types";

const argv = process.argv.slice(2);
const opt = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const dir = opt("--dir");
if (!dir) { console.error("usage: build.ts --dir <csvDir> [--bio bio.json] [--out ratings.csv] [--top N]"); process.exit(1); }

const maps = ["2025", "2024", "2023"].map((y, i) =>
  loadMoneyPuckSeason(readFileSync(`${dir}/mp${y}.csv`, "utf8"), ["2025-26", "2024-25", "2023-24"][i]));

type BioRec = { pos?: string; age?: number; heightCm?: number; weightKg?: number } & Extra;
const bioFile: Record<string, BioRec> = opt("--bio") ? JSON.parse(readFileSync(opt("--bio")!, "utf8")) : {};
const lookup = (id: string, name: string): BioRec | undefined => bioFile[id] ?? bioFile[name];

// Optional manual feeds — real SK / DU / FG for the players they cover.
const edge = opt("--edge") ? loadEdgeCsv(readFileSync(opt("--edge")!, "utf8")) : null;
const injury = opt("--injury") ? loadInjuryCsv(readFileSync(opt("--injury")!, "utf8")) : null;
const fights = opt("--fights") ? loadFightsCsv(readFileSync(opt("--fights")!, "utf8")) : null;
const nameById = new Map<string, string>();
maps.forEach((m) => m.forEach((s, id) => { if (!nameById.has(id)) nameById.set(id, s.name); }));

const assembled = assemble(
  maps,
  (s) => {
    const r = lookup(s.playerId, s.name);
    const bio: PlayerBio = { id: s.playerId, name: s.name, pos: mpPos(r?.pos ?? s.pos), age: r?.age ?? 26, heightCm: r?.heightCm, weightKg: r?.weightKg };
    return bio;
  },
  (id) => {
    const r = bioFile[id];
    const ed = edge ? (edge.byId.get(id) ?? edge.byName.get((nameById.get(id) ?? "").toLowerCase())) : undefined;
    return { edge: ed ?? r?.edge, career: r?.career, injuries: injury?.get(id) ?? r?.injuries, previous: r?.previous, overrides: r?.overrides };
  },
  2, // require ≥2 seasons of data
);

// fights feed → inject the 3-yr total onto the newest season so FG computes fights/82
if (fights) for (const a of assembled) { const f = fights.get(a.input.bio.id); if (f != null && a.input.seasons[0]) a.input.seasons[0].fights = f; }

const bundles = rateRoster(assembled.map((a) => a.input));
const avg = (b: (typeof bundles)[number]) => Math.round(RATING_KEYS.reduce((s, k) => s + b.final[k], 0) / RATING_KEYS.length);
bundles.sort((a, b) => avg(b) - avg(a));

const topN = opt("--top") ? parseInt(opt("--top")!, 10) : 25;
const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(`\nEdgeNHL Rating Engine 2.0 — ${bundles.length} skaters  (calibration: ${isCalibrated ? "ProfiNHL curves + fitted REF" : "hand priors"})`);
console.log("Player".padEnd(22), ...RATING_KEYS.map((k) => pad(k, 3)));
for (const b of bundles.slice(0, topN)) console.log(b.name.padEnd(22), ...RATING_KEYS.map((k) => pad(b.final[k], 3)));

const out = opt("--out");
if (out) { writeFileSync(out, toSthsCsv(bundles)); console.log(`\nSTHS CSV (${bundles.length} rows) → ${out}`); }

// ── QA: old (DB `previous`) vs new, with flags + reasons ────────────────────
const prevById = new Map(assembled.map((a) => [a.input.bio.id, a.input.previous]));
const COMPUTED: RatingKey[] = ["CK", "DI", "EN", "PH", "FO", "PA", "SC", "DF", "ST"]; // MoneyPuck-driven this pass (SK/EX/LD/DU/FG/PS keep prior — no feed yet)
const flagCount: Record<string, { y: number; r: number }> = {};
const qaLines = ["Player,Param,Old,New,Delta,Flag,Reason"];
let withPrev = 0;
for (const b of bundles) {
  const prev = prevById.get(b.id); if (!prev) continue; withPrev++;
  for (const row of qaFor(b, prev)) {
    if (row.old == null) continue;
    if (row.flag) { const f = (flagCount[row.key] ??= { y: 0, r: 0 }); if (row.flag === "red") f.r++; else f.y++; }
    qaLines.push([JSON.stringify(b.name), row.key, row.old, row.neu, row.delta, row.flag, JSON.stringify(row.reason)].join(","));
  }
}
if (out) { const qp = out.replace(/\.csv$/, "") + ".qa.csv"; writeFileSync(qp, qaLines.join("\n") + "\n"); console.log(`QA (old vs new, ${withPrev} matched) → ${qp}`); }
console.log("\nQA flag counts (Δ>5 yellow / Δ>8 red), computed params only:");
for (const k of COMPUTED) { const f = flagCount[k]; if (f) console.log(`  ${k}: ${f.y} yellow, ${f.r} red`); }
// biggest movers among computed params
const movers = bundles.flatMap((b) => { const prev = prevById.get(b.id); if (!prev) return []; return qaFor(b, prev).filter((r) => COMPUTED.includes(r.key) && r.delta != null).map((r) => ({ name: b.name, ...r })); })
  .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!)).slice(0, 12);
console.log("\nBiggest computed-param moves vs DB:");
for (const m of movers) console.log(`  ${m.name.padEnd(22)} ${m.key} ${m.old}→${m.neu} (${m.delta! > 0 ? "+" : ""}${m.delta}) ${m.reason}`);
