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
// Letters NFD does NOT decompose to ASCII (ø/æ/å/etc.) — transliterate so "Søgaard"
// keys to "sogaard", not "sgaard".
const TRANSLIT: Record<string, string> = { "ø": "o", "æ": "ae", "å": "a", "œ": "oe", "ð": "d", "þ": "th", "ł": "l", "đ": "d", "ß": "ss", "ĸ": "k", "ŋ": "ng", "ə": "e" };
// first-name variants (hockey-reference formal vs. our short forms, and the many
// Cyrillic-romanisation spellings) → one canonical form.
const FIRST_ALIAS: Record<string, string> = {
  mitchell: "mitch", alexander: "alex", aleksander: "alex", alexei: "alex", aleksei: "alex", alexey: "alex", aleksey: "alex",
  william: "will", zachary: "zach", zack: "zach", joshua: "josh", matthew: "matt", benjamin: "ben",
  cameron: "cam", fyodor: "fedor", nicholas: "nick", nicklaus: "nick", nikolai: "nik", nikolaj: "nik",
  maxime: "max", maximilian: "max", maxim: "max", maksim: "max", samuel: "sam", jacob: "jake", joseph: "joe",
  michael: "mike", mikey: "mike", christopher: "chris", theodore: "theo",
  dmitri: "dmitry", dmitrii: "dmitry", dmitriy: "dmitry", dima: "dmitry",
  yegor: "egor", jegor: "egor", evgenii: "evgeny", evgeni: "evgeny", sergey: "sergei", andrey: "andrei",
  daniil: "danil", grigori: "grigory", grigorii: "grigory", vasili: "vasily", vasiliy: "vasily",
};
const norm = (name: string) => {
  let s = declutter(name).toLowerCase();
  s = s.replace(/[øæåœðþłđßĸŋə]/g, (ch) => TRANSLIT[ch] ?? ch);
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
};
/** Diacritic-free, punctuation-free key with the first name canonicalized to catch nicknames. */
function key(name: string): string {
  const words = norm(name).split(/[^a-z]+/).filter(Boolean);
  if (words.length && FIRST_ALIAS[words[0]]) words[0] = FIRST_ALIAS[words[0]];
  return words.join("");
}
/** Loose fallback: first initial + surname (last word) — catches compound/middle-name
 *  differences like "Emil Martinsen Lilleberg" vs "Emil Lilleberg". Only trusted when
 *  it resolves to exactly one player. */
function looseKey(name: string): string {
  const words = norm(name).split(/[^a-z]+/).filter(Boolean);
  if (words.length < 2) return "";
  const first = FIRST_ALIAS[words[0]] ?? words[0];
  return first[0] + words[words.length - 1];
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
  const loose = new Map<string, number[]>(); // first-initial+surname → player ids (for the fallback)
  for (const p of players) {
    idx.set(key(p.name), p.id);
    const lk = looseKey(p.name); if (lk) (loose.get(lk) ?? loose.set(lk, []).get(lk)!).push(p.id);
  }

  let matched = 0;
  const unmatched: string[] = [];
  for (const row of rows) {
    let id = idx.get(key(row.name)) ?? null;
    if (id == null) { const lk = looseKey(row.name); const hit = lk ? loose.get(lk) : undefined; if (hit && hit.length === 1) id = hit[0]; } // unique loose match only
    if (id == null) { unmatched.push(row.name); continue; }
    const data = mode === "current"
      ? { curSeasonGP: row.gp, curSeasonG: row.g, curSeasonA: row.a, curSeasonHits: row.hits ?? null, curSeasonBlocks: row.blocks ?? null }
      : { lastSeasonGP: row.gp, lastSeasonPts: row.g + row.a, lastSeasonG: row.g, lastSeasonA: row.a, lastSeasonHits: row.hits ?? null, lastSeasonBlocks: row.blocks ?? null };
    await prisma.player.update({ where: { id }, data });
    matched++;
  }
  return { total: rows.length, matched, unmatched };
}
