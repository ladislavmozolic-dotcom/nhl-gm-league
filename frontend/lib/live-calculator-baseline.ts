import fs from "fs";
import path from "path";

export type ParamKey =
  | "ck" | "fg" | "di" | "sk" | "st"
  | "en" | "du" | "ph" | "fo" | "pa"
  | "sc" | "df" | "ps" | "ex" | "ld";

export type PlayerBaselineItem = {
  nhlId?: number;
  name: string;
  team?: string;
  pos?: string;
  ck: number;
  fg: number;
  di: number;
  sk: number;
  st: number;
  en: number;
  du: number;
  ph: number;
  fo: number;
  pa: number;
  sc: number;
  df: number;
  ps: number;
  ex: number;
  ld: number;
  ov: number;
};

// SimonT V3 Overall Formula weights (from Overall-Formula.png)
// Sum of attribute weights = 80
// Option sum (Goals: 40*4=160, Injuries: 45*4=180, Penalties: 30*4=120, Shots: 67*4=268, Hits: 99*4=396) = 1124
export const STHS_OV_WEIGHTS: Record<string, number> = {
  ck: 5, fg: 0, di: 3, sk: 11, st: 4,
  en: 1, du: 3, ph: 11, fo: 0, pa: 11,
  sc: 14, df: 8, ps: 0, ex: 4, ld: 5,
};
export const STHS_OPTION_SUM = 1124;

let cachedBaseline: {
  dists: { F: Record<string, number[]>; D: Record<string, number[]> };
  playerBaselines: Record<string, PlayerBaselineItem>;
} | null = null;

let cachedCurves: {
  F: Record<string, number[]>;
  D: Record<string, number[]>;
} | null = null;

function loadData() {
  if (!cachedBaseline) {
    try {
      const p = path.join(process.cwd(), "data", "baseline-reference.json");
      if (fs.existsSync(p)) {
        cachedBaseline = JSON.parse(fs.readFileSync(p, "utf8"));
      }
    } catch (e) {
      console.error("[Baseline] Error loading baseline-reference.json:", e);
    }
  }
  if (!cachedCurves) {
    try {
      const p = path.join(process.cwd(), "data", "rating-curves.json");
      if (fs.existsSync(p)) {
        cachedCurves = JSON.parse(fs.readFileSync(p, "utf8"));
      }
    } catch (e) {
      console.error("[Baseline] Error loading rating-curves.json:", e);
    }
  }
}

/** Look up an individual player's baseline attributes by NHL ID or cleaned name */
export function getBaselinePlayer(nhlId?: number | null, name?: string | null): PlayerBaselineItem | null {
  loadData();
  if (!cachedBaseline) return null;
  if (nhlId && cachedBaseline.playerBaselines[`id_${nhlId}`]) {
    return cachedBaseline.playerBaselines[`id_${nhlId}`];
  }
  if (name) {
    const k = `name_${name.toLowerCase().trim()}`;
    if (cachedBaseline.playerBaselines[k]) {
      return cachedBaseline.playerBaselines[k];
    }
  }
  return null;
}

/** Map percentile (0..1) to rating for a specific parameter and position group (F or D) */
export function lookupRatingFromPercentile(
  param: string,
  posGroup: "F" | "D",
  percentile: number
): number {
  loadData();
  const upperParam = param.toUpperCase();
  const clamped = Math.max(0, Math.min(1, percentile));

  if (cachedCurves && cachedCurves[posGroup] && cachedCurves[posGroup][upperParam]) {
    const curve = cachedCurves[posGroup][upperParam];
    const idx = Math.min(curve.length - 1, Math.max(0, Math.round(clamped * (curve.length - 1))));
    return curve[idx];
  }

  // Fallback to distribution percentile if curve is not found
  if (cachedBaseline && cachedBaseline.dists[posGroup] && cachedBaseline.dists[posGroup][upperParam]) {
    const arr = cachedBaseline.dists[posGroup][upperParam];
    const idx = Math.min(arr.length - 1, Math.max(0, Math.round(clamped * (arr.length - 1))));
    return arr[idx];
  }

  return 50;
}

/** Calculate SimonT V3 Overall rating from ratings map */
export function calculateSimonTOverall(ratings: Record<string, number | null | undefined>): number {
  let attrSum = 0;
  for (const [key, weight] of Object.entries(STHS_OV_WEIGHTS)) {
    if (weight > 0) {
      const val = ratings[key.toLowerCase()] ?? 50;
      attrSum += val * weight;
    }
  }
  const ov = Math.round((attrSum + STHS_OPTION_SUM) / 100);
  return Math.max(25, Math.min(99, ov));
}
