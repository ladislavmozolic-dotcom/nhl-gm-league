// Import a real NHL Entry Draft class from NHL Central Scouting rankings.
// Source: https://api-web.nhle.com/v1/draft/rankings/{year}/{category}
//   category 1 = North American skaters, 2 = International skaters,
//            3 = North American goalies, 4 = International goalies
// Each prospect is real (name/position/physicals/junior club/birth). Sim ratings
// aren't published, so we DERIVE a draft-day OV + ceiling (potential) from the
// Central Scouting rank — top picks get elite ceilings, later picks longshots.

import { prisma } from "./prisma";
import { getLeagueDate } from "./calendar-server";
import { draftSourceWhere } from "./draft-source";

const UA = { "User-Agent": "Mozilla/5.0" };

// The draft belongs to the league YEAR (July→June). It flips automatically the
// moment the season ends and the next offseason opens (July 1), so "2026 Draft
// Room" becomes "2027 Draft Room" on its own when the 26/27 season is over.
const leagueYearOf = (d: Date) => (d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1);

/** The draft currently RUN in-app (this league year's). Derived from the clock. */
export async function currentDraftYear(): Promise<number> {
  return leagueYearOf(await getLeagueDate());
}
/** The NEXT draft GMs scout for (its class auto-imports when NHL publishes it). */
export async function nextDraftYear(): Promise<number> {
  return (await currentDraftYear()) + 1;
}

/** Import the upcoming draft class when NHL Central Scouting has published it (no-op
 *  until it's out; refreshes each run as midterm→final rankings are released). */
export async function autoImportUpcomingClass(): Promise<{ year: number; imported: number }> {
  const year = await nextDraftYear();
  const r = await importDraftClass(year);
  return { year, imported: r.imported };
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function mapPosition(code: string): string {
  if (code === "L") return "LW";
  if (code === "R") return "RW";
  return code; // C, D, G
}

// Central Scouting ranks NA & International skaters (and goalies) on SEPARATE
// lists, so we merge them into one global board: Intl skaters slot just behind the
// equally-ranked NA skater, and goalies fall well down (a rank-1 goalie ≈ a mid-1st
// skater). The derived ceiling/rating then follow this single global rank.
function globalScore(csRank: number, category: number): number {
  if (category === 1) return csRank;              // NA skaters — the spine of the board
  if (category === 2) return csRank + 0.5;         // Intl skaters — interleave just behind
  return csRank * 2.6 + 12;                         // goalies — pushed down the board
}
/** Ceiling from the global rank: elites ~91, a smooth gradient to longshots ~55. */
function derivePotential(globalRank: number): number {
  const p = 92 - 34 * Math.pow(globalRank / 224, 0.62);
  const jitter = globalRank % 3 === 0 ? 1 : 0; // faint texture, stable across imports
  return clamp(Math.round(p) - jitter, 55, 91);
}
/** Draft-day current rating: 18-year-olds sit well under their ceiling. */
function deriveOv(potential: number, globalRank: number): number {
  return clamp(Math.round(potential * 0.8 - globalRank * 0.012), 38, 74);
}

export type DraftClassRow = {
  draftYear: number; firstName: string; lastName: string; name: string; position: string;
  shoots: string | null; heightIn: number | null; weightLb: number | null; birthDate: string | null;
  country: string | null; amateurClub: string | null; amateurLeague: string | null;
  csRank: number | null; category: number; ov: number; potential: number;
};

export async function fetchDraftClass(year: number): Promise<DraftClassRow[]> {
  type Raw = { p: any; category: number; csRank: number; score: number };
  const raws: Raw[] = [];
  const seen = new Set<string>();
  for (const category of [1, 2, 3, 4]) {
    let json: any;
    try {
      const r = await fetch(`https://api-web.nhle.com/v1/draft/rankings/${year}/${category}`, { headers: UA });
      if (!r.ok) continue;
      json = await r.json();
    } catch { continue; }
    for (const p of json.rankings ?? []) {
      const csRank = p.finalRank ?? p.midtermRank ?? 999;
      const name = `${(p.firstName ?? "").trim()} ${(p.lastName ?? "").trim()}`.trim();
      const key = `${name}|${p.birthDate ?? ""}`;
      if (!name || seen.has(key)) continue;
      seen.add(key);
      raws.push({ p, category, csRank, score: globalScore(csRank, category) });
    }
  }
  // one merged board → global rank drives ceiling + rating
  raws.sort((a, b) => a.score - b.score);
  return raws.map((raw, i) => {
    const { p, category, csRank } = raw;
    const globalRank = i + 1;
    const potential = derivePotential(globalRank);
    const isGoalie = category >= 3;
    return {
      draftYear: year, firstName: (p.firstName ?? "").trim(), lastName: (p.lastName ?? "").trim(),
      name: `${(p.firstName ?? "").trim()} ${(p.lastName ?? "").trim()}`.trim(),
      position: mapPosition(p.positionCode ?? (isGoalie ? "G" : "C")),
      shoots: p.shootsCatches ?? null,
      heightIn: p.heightInInches ?? null, weightLb: p.weightInPounds ?? null,
      birthDate: p.birthDate ?? null, country: p.birthCountry ?? null,
      amateurClub: p.lastAmateurClub ?? null, amateurLeague: p.lastAmateurLeague ?? null,
      csRank, category, ov: deriveOv(potential, globalRank), potential,
    };
  });
}

/** Replace the draft class for a year (idempotent). Undrafted pool only. */
export async function importDraftClass(year: number): Promise<{ imported: number }> {
  const rows = await fetchDraftClass(year);
  if (rows.length === 0) return { imported: 0 };
  // tag the class with the active roster world so it stays separate from the other
  // mode's drafts (see lib/draft-source.ts) — real-mode classes never mix with ProfiNHL.
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  const source = cfg?.rosterMode === "real" ? "real" : "profinhl";
  await prisma.$transaction([
    prisma.draftProspect.deleteMany({ where: { draftYear: year, draftedByTeamId: null, ...draftSourceWhere(cfg?.rosterMode) } }),
    prisma.draftProspect.createMany({ data: rows.map((r) => ({ ...r, source })) }),
  ]);
  return { imported: rows.length };
}
