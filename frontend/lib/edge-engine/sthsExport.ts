// STHS EXPORT — CSV of the finished ratings, ready to paste into the simulator.
// PO and OV are left blank on purpose: PO needs a separate prospect model and OV is
// computed by STHS itself (it's display-only and the engine doesn't use it).

import type { RatingBundle } from "./types";

const COLS = ["Name", "POS", "CK", "FG", "DI", "SK", "ST", "EN", "DU", "PH", "FO", "PA", "SC", "DF", "PS", "EX", "LD", "PO", "MO", "OV"] as const;

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toSthsCsv(bundles: RatingBundle[]): string {
  const lines = [COLS.join(",")];
  for (const b of bundles) {
    const f = b.final;
    lines.push([
      esc(b.name), b.pos,
      f.CK, f.FG, f.DI, f.SK, f.ST, f.EN, f.DU, f.PH, f.FO, f.PA, f.SC, f.DF, f.PS, f.EX, f.LD,
      "" /* PO */, f.MO, "" /* OV */,
    ].join(","));
  }
  return lines.join("\n") + "\n";
}
