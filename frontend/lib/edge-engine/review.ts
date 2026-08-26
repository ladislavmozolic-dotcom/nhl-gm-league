/* Full-roster QA review: coverage, nhlId collisions, unmatched players, small samples, extremes.
 *   npx tsx lib/edge-engine/review.ts --dir <csvDir> --bio bio.json --db dbnames.json \
 *        [--edge edge.csv --injury injury.csv --fights fights.csv] [--out review.csv]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadMoneyPuckSeason } from "./loaders/moneypuck";
import { loadEdgeCsv } from "./loaders/edge";
import { loadInjuryCsv, loadFightsCsv } from "./loaders/extras";
import { assemble, mpPos, type Extra } from "./loaders/assemble";
import { rate } from "./engine";
import { RATING_KEYS, type PlayerBio } from "./types";

const argv = process.argv.slice(2);
const opt = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const dir = opt("--dir")!;
const maps = ["2025", "2024", "2023"].map((y, i) => loadMoneyPuckSeason(readFileSync(`${dir}/mp${y}.csv`, "utf8"), ["2025-26", "2024-25", "2023-24"][i]));
const bio: Record<string, { age?: number; heightCm?: number; weightKg?: number } & Extra> = opt("--bio") ? JSON.parse(readFileSync(opt("--bio")!, "utf8")) : {};
const db: Record<string, { name: string; rt: string; pos: string }> = opt("--db") ? JSON.parse(readFileSync(opt("--db")!, "utf8")) : {};
const edge = opt("--edge") ? loadEdgeCsv(readFileSync(opt("--edge")!, "utf8")) : null;
const injury = opt("--injury") ? loadInjuryCsv(readFileSync(opt("--injury")!, "utf8")) : null;
const fights = opt("--fights") ? loadFightsCsv(readFileSync(opt("--fights")!, "utf8")) : null;

const assembled = assemble(
  maps,
  (s) => { const r = bio[s.playerId]; return { id: s.playerId, name: s.name, pos: mpPos(s.pos), age: r?.age ?? 26, heightCm: r?.heightCm, weightKg: r?.weightKg } as PlayerBio; },
  (id) => ({ edge: edge?.byId.get(id), career: bio[id]?.career, injuries: injury?.get(id) }),
  2,
);
if (fights) for (const a of assembled) { const f = fights.get(a.input.bio.id); if (f != null && a.input.seasons[0]) a.input.seasons[0].fights = f; }

const key = (n: string) => n.replace(/''[A-Za-z]''|\([^)]*\)/g, "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ").trim().split(/\s+/);
const lastOf = (n: string) => { const p = key(n); return p[p.length - 1] || ""; };

const rows = assembled.map((a) => {
  const b = rate(a.input);
  const id = a.input.bio.id;
  const dbrec = db[id];
  const seasons = a.input.seasons.length;
  const gp3 = a.input.seasons.reduce((s, x) => s + x.gamesPlayed, 0);
  const collision = dbrec ? lastOf(a.mpName) !== lastOf(dbrec.name) : false;
  return { id, mpName: a.mpName, team: a.team, pos: a.input.bio.pos, dbName: dbrec?.name ?? null, rt: dbrec?.rt ?? null, seasons, gp3, collision, hasBio: !!bio[id], hasCareer: !!bio[id]?.career, final: b.final };
});

// ── coverage ────────────────────────────────────────────────────────────────
const ratedIds = new Set(rows.map((r) => r.id));
const dbSkaters = Object.entries(db).filter(([, v]) => (v.rt === "NHL" || v.rt === "AHL") && !/G/.test(v.pos || "") || (v.rt === "NHL" && v.pos !== "G"));
const inDbNotRated = Object.entries(db).filter(([id, v]) => (v.rt === "NHL") && v.pos !== "G" && !ratedIds.has(id));
console.log(`\n=== COVERAGE ===`);
console.log(`rated skaters: ${rows.length}`);
console.log(`  matched to our DB: ${rows.filter((r) => r.dbName).length}  | not in our DB: ${rows.filter((r) => !r.dbName).length}`);
console.log(`  with career (EX/LD real): ${rows.filter((r) => r.hasCareer).length}`);
console.log(`NHL skaters in DB but NOT rated (no ≥2-season MoneyPuck): ${inDbNotRated.length}`);
console.log("  e.g. " + inDbNotRated.slice(0, 12).map(([, v]) => v.name.replace(/ ''?[CA]''?/, "")).join(", "));

// ── nhlId collisions (stats attributed to a different person than our DB) ─────
const collisions = rows.filter((r) => r.collision);
console.log(`\n=== nhlId COLLISIONS (MoneyPuck name ≠ our DB name for the same id): ${collisions.length} ===`);
for (const c of collisions.slice(0, 25)) console.log(`  id ${c.id}: MoneyPuck "${c.mpName}"  vs  DB "${c.dbName}"`);

// ── players not in our DB at all (rated but unknown to us) ────────────────────
const notInDb = rows.filter((r) => !r.dbName);
console.log(`\n=== RATED BUT NOT IN OUR DB: ${notInDb.length} ===`);
console.log("  " + notInDb.slice(0, 20).map((r) => `${r.mpName}(${r.team})`).join(", "));

// ── small samples (rated on thin ice) ─────────────────────────────────────────
const thin = rows.filter((r) => r.gp3 < 60).sort((a, b) => a.gp3 - b.gp3);
console.log(`\n=== SMALL SAMPLE (<60 GP over 3y): ${thin.length} — ratings lean on regression ===`);
for (const t of thin.slice(0, 12)) console.log(`  ${t.mpName.padEnd(22)} ${t.gp3} GP  PA${t.final.PA} SC${t.final.SC} DF${t.final.DF}`);

// ── extremes per computed param ───────────────────────────────────────────────
const COMPUTED = ["CK", "PA", "SC", "DF", "PH", "EN", "EX", "LD"] as const;
console.log(`\n=== EXTREMES (top 3 / bottom 3 per computed param) ===`);
for (const k of COMPUTED) {
  const s = [...rows].sort((a, b) => b.final[k] - a.final[k]);
  const top = s.slice(0, 3).map((r) => `${r.mpName.split(" ").pop()} ${r.final[k]}`).join(", ");
  const bot = s.slice(-3).map((r) => `${r.mpName.split(" ").pop()} ${r.final[k]}`).join(", ");
  console.log(`  ${k.padEnd(3)} top: ${top}   | bottom: ${bot}`);
}

// ── full CSV ──────────────────────────────────────────────────────────────────
const out = opt("--out");
if (out) {
  const H = ["id", "name", "dbName", "team", "pos", "seasons", "gp3", "collision", "inDb", ...RATING_KEYS];
  const lines = [H.join(",")];
  for (const r of rows.sort((a, b) => (b.final.PA + b.final.SC) - (a.final.PA + a.final.SC)))
    lines.push([r.id, JSON.stringify(r.mpName), JSON.stringify(r.dbName ?? ""), r.team, r.pos, r.seasons, r.gp3, r.collision, !!r.dbName, ...RATING_KEYS.map((k) => r.final[k])].join(","));
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(`\nfull review CSV (${rows.length} rows) → ${out}`);
}
