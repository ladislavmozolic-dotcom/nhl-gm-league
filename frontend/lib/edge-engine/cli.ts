/* EdgeNHL Rating Engine 2.0 — CLI runner.
 *
 *   npx tsx lib/edge-engine/cli.ts                 # run the built-in demo roster
 *   npx tsx lib/edge-engine/cli.ts --in roster.json # run your own PlayerInput[] JSON
 *   npx tsx lib/edge-engine/cli.ts --out ratings.csv # also write the STHS CSV
 *   npx tsx lib/edge-engine/cli.ts --why            # print per-player reasons/QA flags
 *
 * Nothing here touches the website or the DB — it's a standalone offline tool.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DEMO_PLAYERS } from "./demo";
import { rateRoster } from "./engine";
import { qaFor } from "./qa";
import { toSthsCsv } from "./sthsExport";
import { RATING_KEYS, type PlayerInput } from "./types";

const argv = process.argv.slice(2);
const opt = (flag: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
const has = (flag: string) => argv.includes(flag);

const players: PlayerInput[] = opt("--in")
  ? (JSON.parse(readFileSync(opt("--in")!, "utf8")) as PlayerInput[])
  : DEMO_PLAYERS;

const bundles = rateRoster(players);

// ── FINAL RATINGS table ───────────────────────────────────────────────────────
const pad = (s: string | number, n: number) => String(s).padStart(n);
const padE = (s: string | number, n: number) => String(s).padEnd(n);
const DECISION = ["SK", "PH", "PA", "SC", "DF"] as const;

const header = ["Player".padEnd(20), "POS", ...RATING_KEYS.map((k) => pad(k, 3)), " Cnf", " Archetype"].join(" ");
console.log("\nEdgeNHL Rating Engine 2.0 — FINAL RATINGS\n" + "=".repeat(header.length));
console.log(header);
console.log("-".repeat(header.length));

for (const b of bundles) {
  const avgConf = Math.round(RATING_KEYS.reduce((a, k) => a + b.cells[k].confidence, 0) / RATING_KEYS.length);
  // archetype = which decision rating leads (shooter/playmaker/two-way/…)
  const best = DECISION.reduce((m, k) => (b.final[k] > b.final[m] ? k : m), DECISION[0]);
  const arche = { SK: "skater", PH: "puck-mover", PA: "playmaker", SC: "shooter", DF: "two-way/D" }[best];
  const row = [
    padE(b.name, 20), pad(b.pos, 3),
    ...RATING_KEYS.map((k) => pad(b.final[k], 3)),
    pad(avgConf, 4), "  " + arche,
  ].join(" ");
  console.log(row);
}

// ── decision-rating profiles (the STHS calibration point) ──────────────────────
console.log("\nDecision ratings (SK/PH/PA/SC/DF) — relative profile drives shoot/pass/skate:");
for (const b of bundles) {
  console.log("  " + padE(b.name, 20) + DECISION.map((k) => `${k} ${pad(b.final[k], 2)}`).join("  "));
}

// ── QA / reasons ───────────────────────────────────────────────────────────────
if (has("--why")) {
  for (const b of bundles) {
    console.log(`\n── ${b.name} (${b.pos}) ──`);
    for (const r of qaFor(b, (players.find((p) => p.bio.id === b.id)?.previous))) {
      const flag = r.flag ? ` [${r.flag.toUpperCase()}]` : "";
      const d = r.delta != null ? ` (Δ${r.delta > 0 ? "+" : ""}${r.delta})` : "";
      console.log(`  ${padE(r.key, 3)} ${pad(r.neu, 3)}  cnf ${pad(r.confidence, 3)}${d}${flag}  ${r.reason}`);
    }
    if (b.notes.length) console.log("  notes: " + b.notes.join(" | "));
  }
}

// ── STHS CSV ────────────────────────────────────────────────────────────────────
const csv = toSthsCsv(bundles);
const outPath = opt("--out");
if (outPath) { writeFileSync(outPath, csv); console.log(`\nSTHS CSV written → ${outPath}`); }
else console.log("\n(STHS CSV preview — pass --out ratings.csv to save)\n" + csv.split("\n").slice(0, 3).join("\n") + "\n…");
