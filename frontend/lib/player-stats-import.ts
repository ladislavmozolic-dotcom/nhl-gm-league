// Import real last-season stats from the ProfiNHL "Players Calculator" workbook
// (its live hockey-reference data table). We only need games played + points to
// power the FA demand engine's performance signal — the ratings themselves are
// already built from these numbers. See [[players-calculator]].

import * as XLSX from "xlsx";
import { prisma } from "./prisma";

// The calculator's raw data table lives at AC89:BF839 — name in AC, and (per its
// VLOOKUP offsets) GP=AG, G=AH, A=AI, Hits=BC.
const NAME_COL = "AC", GP_COL = "AG", G_COL = "AH", A_COL = "AI", HITS_COL = "BC";
const ROW_START = 89, ROW_END = 839;

export type StatRow = { name: string; gp: number; g: number; a: number; hits?: number; blocks?: number };
export type ImportMode = "last" | "current";

const declutter = (s: string) => s.replace(/''?[A-Za-z]''?/g, " ").replace(/\((?:NTC|NMC|R)\)/gi, " ");
// common first-name variants (hockey-reference formal vs. our short forms, both directions → one canonical form)
const FIRST_ALIAS: Record<string, string> = {
  mitchell: "mitch", alexander: "alex", william: "will", zachary: "zach", zack: "zach",
  joshua: "josh", matthew: "matt", benjamin: "ben", cameron: "cam", fyodor: "fedor",
  nicholas: "nick", nikolai: "nik", maxime: "max", maximilian: "max", samuel: "sam",
  jacob: "jake", joseph: "joe", michael: "mike", christopher: "chris", theodore: "theo",
};
/** Diacritic-free, punctuation-free key with the first name canonicalized to catch nicknames. */
function key(name: string): string {
  const flat = declutter(name).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const words = flat.split(/[^a-z]+/).filter(Boolean);
  if (words.length && FIRST_ALIAS[words[0]]) words[0] = FIRST_ALIAS[words[0]];
  return words.join("");
}

export function parseCalculatorSheet(data: Uint8Array): StatRow[] {
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets["List1"] ?? wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows: StatRow[] = [];
  for (let r = ROW_START; r <= ROW_END; r++) {
    const name = ws[`${NAME_COL}${r}`]?.v;
    if (typeof name !== "string" || !name.trim()) continue;
    const gp = Number(ws[`${GP_COL}${r}`]?.v ?? 0);
    const g = Number(ws[`${G_COL}${r}`]?.v ?? 0);
    const a = Number(ws[`${A_COL}${r}`]?.v ?? 0);
    const hits = Number(ws[`${HITS_COL}${r}`]?.v ?? 0);
    if (!gp && !g && !a) continue;
    rows.push({ name: name.trim(), gp, g, a, hits });
  }
  return rows;
}

/** Write imported stats to either the last-season or current-season columns. */
export async function importPlayerStats(rows: StatRow[], mode: ImportMode = "last") {
  const players = await prisma.player.findMany({ select: { id: true, name: true } });
  const idx = new Map<string, number>();
  for (const p of players) idx.set(key(p.name), p.id);

  let matched = 0;
  const unmatched: string[] = [];
  for (const row of rows) {
    const id = idx.get(key(row.name));
    if (id == null) { unmatched.push(row.name); continue; }
    const data = mode === "current"
      ? { curSeasonGP: row.gp, curSeasonG: row.g, curSeasonA: row.a, curSeasonHits: row.hits ?? null, curSeasonBlocks: row.blocks ?? null }
      : { lastSeasonGP: row.gp, lastSeasonPts: row.g + row.a, lastSeasonG: row.g, lastSeasonA: row.a, lastSeasonHits: row.hits ?? null, lastSeasonBlocks: row.blocks ?? null };
    await prisma.player.update({ where: { id }, data });
    matched++;
  }
  return { total: rows.length, matched, unmatched };
}
