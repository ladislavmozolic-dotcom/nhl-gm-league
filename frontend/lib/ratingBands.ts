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

// baked league averages (per group, per attr) — used as the yellow centre for un-overridden attrs
const AVG: Record<PosGroup, Record<string, number>> = {
  F: { ck: 66, fg: 44, di: 84, sk: 48, st: 79, en: 82, du: 83, ph: 48, fo: 70, pa: 49, sc: 49, df: 63, ps: 62, ex: 71, ld: 70, mo: 50, OV: 53 },
  D: { ck: 72, fg: 45, di: 82, sk: 37, st: 81, en: 83, du: 83, ph: 37, fo: 30, pa: 48, sc: 44, df: 71, ps: 49, ex: 71, ld: 70, mo: 50, OV: 54 },
  G: { sk: 77, du: 79, en: 79, sz: 91, ag: 75, rb: 76, sc: 75, hs: 75, rt: 75, ph: 75, ps: 74, ex: 75, ld: 75, mo: 50, OV: 66 },
};

// explicit {greenMin, yellowMin}: green ≥ g, yellow ≥ y (and < g), red < y
const OVERRIDE: Record<PosGroup, Record<string, { g: number; y: number }>> = {
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
