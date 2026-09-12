// League-average-relative colouring of player ratings.
// Averages were computed from the whole DB per position group (F/D/G).
// Green = clearly above average (best), Yellow = around average, Red = below average.
// Specific attributes (DF, PA, SC, OV) use explicit thresholds the user calibrated,
// because raw DB averages are dragged down by depth/AHL players.

export type PosGroup = "F" | "D" | "G";

export function posGroup(position: string | null | undefined, isGoalie: boolean): PosGroup {
  if (isGoalie || position === "G") return "G";
  const p = position ?? "";
  const fwd = p.includes("C") || p.includes("W") || p.includes("F");
  return p.includes("D") && !fwd ? "D" : "F";
}

// Canonical display order for the full rating card — shared by the player
// profile page and any tool that lists every attribute (e.g. Find Player),
// so both always show the same columns in the same order.
export const SKATER_ATTRS: { key: string; label: string }[] = [
  { key: "ck", label: "CK" }, { key: "fg", label: "FG" }, { key: "di", label: "DI" },
  { key: "sk", label: "SK" }, { key: "st", label: "ST" }, { key: "en", label: "EN" },
  { key: "du", label: "DU" }, { key: "ph", label: "PH" }, { key: "fo", label: "FO" },
  { key: "pa", label: "PA" }, { key: "sc", label: "SC" }, { key: "df", label: "DF" },
  { key: "ps", label: "PS" }, { key: "ex", label: "EX" }, { key: "ld", label: "LD" },
  { key: "mo", label: "MO" },
];
export const GOALIE_ATTRS: { key: string; label: string }[] = [
  { key: "sk", label: "SK" }, { key: "du", label: "DU" }, { key: "en", label: "EN" },
  { key: "sz", label: "SZ" }, { key: "ag", label: "AG" }, { key: "rb", label: "RB" },
  { key: "sc", label: "SC" }, { key: "hs", label: "HS" }, { key: "rt", label: "RT" },
  { key: "ph", label: "PH" }, { key: "ps", label: "PS" }, { key: "ex", label: "EX" },
  { key: "ld", label: "LD" }, { key: "mo", label: "MO" },
];

// baked league averages (per group, per attr) — used as the yellow centre for un-overridden attrs.
// Exported so other league-average-relative logic (e.g. lib/sim/role-fit.ts's role
// classification) can share this SAME baseline instead of each guessing its own.
export const AVG: Record<PosGroup, Record<string, number>> = {
  F: { ck: 66, fg: 44, di: 84, sk: 48, st: 79, en: 82, du: 83, ph: 48, fo: 70, pa: 49, sc: 49, df: 63, ps: 62, ex: 71, ld: 70, mo: 50, OV: 53 },
  D: { ck: 72, fg: 45, di: 82, sk: 37, st: 81, en: 83, du: 83, ph: 37, fo: 30, pa: 48, sc: 44, df: 71, ps: 49, ex: 71, ld: 70, mo: 50, OV: 54 },
  G: { sk: 77, du: 79, en: 79, sz: 91, ag: 75, rb: 76, sc: 75, hs: 75, rt: 75, ph: 75, ps: 74, ex: 75, ld: 75, mo: 50, OV: 66 },
};

// explicit {greenMin, yellowMin}: green ≥ g, yellow ≥ y (and < g), red < y
// Exported so other logic that needs "is this attribute actually good" (e.g.
// lib/player-type.ts's Two-Way Defenseman check) can reuse the SAME calibrated
// bar the UI already colours green/yellow with, instead of inventing its own.
export const OVERRIDE: Record<PosGroup, Record<string, { g: number; y: number }>> = {
  F: { df: { g: 70, y: 65 }, pa: { g: 56, y: 50 }, sc: { g: 56, y: 50 }, OV: { g: 60, y: 55 } },
  D: { df: { g: 80, y: 76 }, pa: { g: 51, y: 45 }, sc: { g: 51, y: 45 }, OV: { g: 60, y: 55 } },
  G: { OV: { g: 68, y: 64 } },
};

/** Tailwind text colour class for a rating value, relative to its group/attr average. */
export function ratingColor(group: PosGroup, attr: string, v: number | null | undefined): string {
  if (v == null) return "text-slate-500";
  const ov = OVERRIDE[group]?.[attr];
  let g: number, y: number;
  if (ov) { g = ov.g; y = ov.y; }
  else {
    const avg = AVG[group]?.[attr] ?? 55;
    y = avg;        // average and just below → yellow (fair)
    g = avg + 3;    // a few points above average → green (strong)
  }
  if (v >= g) return "text-green-400";
  if (v >= y) return "text-yellow-400";
  return "text-red-400";
}

export const ovColor = (group: PosGroup, v: number | null | undefined) => ratingColor(group, "OV", v);
