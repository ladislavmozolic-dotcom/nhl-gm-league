// Preview draft class from Tankathon's public big board (https://www.tankathon.com/nhl/big-board).
// Order on the page = rank. Used until NHL Central Scouting publishes — that import
// replaces these rows (they carry csRank = null). Tankathon only gives birth year+month,
// so birthDate is stored as YYYY-MM.

import { previewRow, replacePreviewClass, currentDraftYear, type DraftClassRow } from "./draft-class-import";

const UA = { "User-Agent": "Mozilla/5.0" };
const ISO3: Record<string, string> = {
  Canada: "CAN", USA: "USA", Russia: "RUS", Sweden: "SWE", Slovakia: "SVK", Czechia: "CZE", Finland: "FIN", Latvia: "LVA",
  Switzerland: "CHE", Germany: "DEU", China: "CHN", Norway: "NOR", Denmark: "DNK", Belarus: "BLR", Kazakhstan: "KAZ",
};
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const decode = (t: string) => t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/[‐-―]/g, "-").trim();

function mapPos(raw: string): { position: string; shoots: string | null } {
  const first = raw.split("/")[0].trim().toUpperCase();
  if (first === "RD") return { position: "D", shoots: "R" };
  if (first === "LD") return { position: "D", shoots: "L" };
  if (first === "F") return { position: "C", shoots: null };
  if (first === "W") return { position: "LW", shoots: null };
  return { position: ["C", "LW", "RW", "D", "G"].includes(first) ? first : "C", shoots: null };
}

export async function fetchTankathonBoard(year: number): Promise<DraftClassRow[]> {
  const r = await fetch("https://www.tankathon.com/nhl/big-board", { headers: UA, cache: "no-store" });
  if (!r.ok) throw new Error(`Tankathon returned ${r.status}`);
  const html = await r.text();
  const chunks = html.split('<div class="mock-row ').slice(1);
  const rows: DraftClassRow[] = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    const name = /mock-row-name">([^<]*)/.exec(c)?.[1];
    if (!name) continue;
    const clean = decode(name);
    if (seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    const { position, shoots } = mapPos(/school-position">([^|<]*)/.exec(c)?.[1] ?? "");
    const hw = /class="height">([^<]*)<\/span>\s*<span class="weight">(\d+)/.exec(c);
    const ft = hw ? /(\d+)'(\d+)/.exec(decode(hw[1])) : null;
    const yr = /class="year">(\d{4})/.exec(c)?.[1], mo = /class="month">(\w{3})/.exec(c)?.[1];
    const mi = mo ? MONTHS.indexOf(mo.toUpperCase()) : -1;
    const country = /alt="([^"]*)" src="[^"]*flags/.exec(c)?.[1];
    rows.push(previewRow(year, rows.length + 1, {
      name: clean, position, shoots,
      heightIn: ft ? +ft[1] * 12 + +ft[2] : null, weightLb: hw ? +hw[2] : null,
      birthDate: yr && mi >= 0 ? `${yr}-${String(mi + 1).padStart(2, "0")}` : null,
      country: country ? (ISO3[country] ?? null) : null,
      amateurLeague: decode(/league-name">([^<]*)/.exec(c)?.[1] ?? "") || null,
    }));
  }
  return rows;
}

export async function importTankathonClass(): Promise<{ year: number; imported: number; error?: string }> {
  const year = await currentDraftYear();
  const rows = await fetchTankathonBoard(year);
  const saved = await replacePreviewClass(year, rows);
  return saved.error ? { year, imported: 0, error: saved.error } : { year, imported: rows.length };
}
