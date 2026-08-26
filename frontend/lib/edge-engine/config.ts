// EdgeNHL Rating Engine 2.0 — CONFIG.
//
// Every weight, K value, league reference (mean/sd), PNHL curve and league-EQ coefficient
// lives here so calibration is one file. In production the REF means/sds and the curves are
// recomputed/fitted from the real league; the values below are plausible NHL priors that let
// the demo run end-to-end and land elite skaters in ProfiNHL's conservative high-70s/low-80s.

import { readFileSync } from "node:fs";
import type { Curve } from "./math";
import type { Group, RatingKey } from "./types";

// ── Comparison groups (spec table) ──────────────────────────────────────────
// "both" = F and D share one distribution/curve; "split" = separate F vs D.
export const GROUPING: Record<RatingKey, "both" | "split"> = {
  CK: "split", FG: "both", DI: "split", SK: "split", ST: "both", EN: "split",
  DU: "both", PH: "split", FO: "split", PA: "split", SC: "split", DF: "split",
  PS: "both", EX: "both", LD: "both", MO: "both",
};

// ── League reference distributions per raw sub-metric (mean, sd) ─────────────
// Keyed "metric" (shared) or "metric|F" / "metric|D" (split). Rates are per-60 unless noted.
export interface Ref { mean: number; sd: number }
export const REF: Record<string, Ref> = {
  // CK — hits/60
  "hits60|F": { mean: 5.5, sd: 3.6 }, "hits60|D": { mean: 6.4, sd: 3.4 },
  "hitsAll60|F": { mean: 5.0, sd: 3.4 }, "hitsAll60|D": { mean: 6.0, sd: 3.2 },
  // FG — fights per 82
  fights82: { mean: 0.9, sd: 1.6 },
  // DI — penalties taken/60 (inverse)
  minors60: { mean: 0.85, sd: 0.5 }, majors60: { mean: 0.06, sd: 0.09 },
  // SK — EDGE
  maxSpeed: { mean: 21.4, sd: 1.25 }, bursts20pg: { mean: 8.0, sd: 4.5 }, bursts22pg: { mean: 1.6, sd: 1.8 },
  // ST — physical
  weightKg: { mean: 91, sd: 7 }, massResidual: { mean: 0, sd: 6 }, shotSpeed: { mean: 88, sd: 5.5 },
  // EN — workload
  toiPerGP: { mean: 16.5, sd: 4.2 }, highWorkloadPct: { mean: 0.45, sd: 0.3 }, dist60: { mean: 2.6, sd: 0.4 },
  // PH — puck control (inverse turnover rates)
  advTurnover: { mean: 0.075, sd: 0.03 }, dzGiveaway60: { mean: 0.35, sd: 0.22 },
  penDrawn60: { mean: 0.9, sd: 0.55 }, rush60: { mean: 2.1, sd: 1.5 },
  // PA — passing (per 60)
  "a1_5v5|F": { mean: 0.55, sd: 0.28 }, "a1_5v5|D": { mean: 0.38, sd: 0.2 },
  "a2_5v5|F": { mean: 0.36, sd: 0.2 }, "a2_5v5|D": { mean: 0.32, sd: 0.18 },
  "ppa1|F": { mean: 0.95, sd: 0.85 }, "ppa1|D": { mean: 0.85, sd: 0.75 },
  "ppa2|F": { mean: 0.6, sd: 0.55 }, "ppa2|D": { mean: 0.6, sd: 0.5 },
  // SC — scoring (per 60)
  "g5v5|F": { mean: 0.82, sd: 0.42 }, "g5v5|D": { mean: 0.22, sd: 0.14 },
  "xg5v5|F": { mean: 0.78, sd: 0.34 }, "xg5v5|D": { mean: 0.24, sd: 0.11 },
  "sog5v5|F": { mean: 7.6, sd: 2.4 }, "sog5v5|D": { mean: 5.4, sd: 1.9 },
  "ppg|F": { mean: 1.25, sd: 1.2 }, "ppg|D": { mean: 0.45, sd: 0.55 },
  shootingTalent: { mean: 0, sd: 0.025 }, // shooting % above expected
  // DF — relative on-ice (inverse) + counting
  xGA60Rel: { mean: 0, sd: 0.24 }, hdXGA60Rel: { mean: 0, sd: 0.21 }, CA60Rel: { mean: 0, sd: 4.2 },
  pkXGA60Rel: { mean: 0, sd: 0.9 }, pkUsage: { mean: 1.2, sd: 1.3 },
  "blocks60|F": { mean: 2.2, sd: 1.3 }, "blocks60|D": { mean: 5.0, sd: 2.0 },
  takeaways60: { mean: 1.2, sd: 0.7 },
};

// Reference means/sds fitted from real MoneyPuck data override the hand priors above.
try {
  const fitted: Record<string, Ref> = JSON.parse(readFileSync(new URL("./ref.calibrated.json", import.meta.url), "utf8"));
  Object.assign(REF, fitted);
} catch { /* no fitted refs → keep the hand priors */ }

export const refFor = (metric: string, g: Group): Ref =>
  REF[`${metric}|${g}`] ?? REF[metric] ?? { mean: 0, sd: 1 };

// ── Sub-metric weights per parameter (must sum to 1 within each) ─────────────
export const WEIGHTS = {
  CK: { hits60: 0.8, hitsAll60: 0.2 },
  DI: { minors60: 0.8, majors60: 0.2 }, // both inverse
  SK: { maxSpeed: 0.4, bursts20pg: 0.4, bursts22pg: 0.2 },
  ST: { weightKg: 0.4, massResidual: 0.4, shotSpeed: 0.2 },
  EN: { toiPerGP: 0.6, highWorkloadPct: 0.25, dist60: 0.15 },
  PH: { advTurnover: 0.5, dzGiveaway60: 0.2, penDrawn60: 0.15, rush60: 0.15 }, // first two inverse
  PA: { a1_5v5: 0.55, a2_5v5: 0.15, ppa1: 0.2, ppa2: 0.1 },
  SC: { g5v5: 0.35, xg5v5: 0.25, sog5v5: 0.15, ppg: 0.15, shootingTalent: 0.1 },
  DF_F: { xGA60Rel: 0.3, hdXGA60Rel: 0.2, CA60Rel: 0.15, pkXGA60Rel: 0.15, pkUsage: 0.1, blocks60: 0.05, takeaways60: 0.05 },
  DF_D: { xGA60Rel: 0.25, hdXGA60Rel: 0.2, CA60Rel: 0.15, pkXGA60Rel: 0.15, pkUsage: 0.1, blocks60: 0.1, takeaways60: 0.05 },
} as const;

/** Sub-metrics that are "lower is better" — their z-score is negated before combining. */
export const INVERSE = new Set([
  "minors60", "majors60", "advTurnover", "dzGiveaway60", "xGA60Rel", "hdXGA60Rel", "CA60Rel", "pkXGA60Rel",
]);

// ── Regression K (exposure at ~50% confidence), in the metric's exposure unit ──
// Rate params: minutes of TOI. FO: faceoff attempts. PS: shootout attempts.
export const K: Record<string, number> = {
  CK: 350, DI: 500, SK: 200, ST: 100, EN: 300, PH: 450, PA: 550, SC: 500, DF: 650,
  FG: 246 /* ~3 seasons of games */, FO: 300, PS: 20, DU: 82, default: 400,
};

// ── PNHL curves: percentile (0-1) → rating. Deliberately conservative at the top. ──
const CONSERVATIVE: Curve = [
  { p: 0.0, r: 40 }, { p: 0.25, r: 56 }, { p: 0.5, r: 64 }, { p: 0.7, r: 71 },
  { p: 0.85, r: 76 }, { p: 0.93, r: 79 }, { p: 0.98, r: 82 }, { p: 0.997, r: 85 }, { p: 1, r: 88 },
];
const DF_CURVE: Curve = [
  { p: 0.0, r: 42 }, { p: 0.5, r: 63 }, { p: 0.7, r: 72 }, { p: 0.85, r: 77 },
  { p: 0.93, r: 80 }, { p: 0.98, r: 83 }, { p: 0.997, r: 86 }, { p: 1, r: 89 },
];
// DF is a defenceman's job → D must sit well above forwards on the DF axis. Position-specific
// own-base curves: even a mid D (~median) outranks a strong defensive forward (~top F).
const DF_F_CURVE: Curve = [
  { p: 0.0, r: 30 }, { p: 0.5, r: 46 }, { p: 0.8, r: 58 }, { p: 0.92, r: 66 }, { p: 0.98, r: 71 }, { p: 1, r: 76 },
];
const DF_D_CURVE: Curve = [
  { p: 0.0, r: 55 }, { p: 0.4, r: 66 }, { p: 0.6, r: 72 }, { p: 0.8, r: 78 }, { p: 0.92, r: 83 }, { p: 0.98, r: 86 }, { p: 1, r: 90 },
];
const EN_CURVE: Curve = [ // workload spreads wide — Makar/Werenski land in the 90s
  { p: 0.0, r: 45 }, { p: 0.5, r: 68 }, { p: 0.8, r: 82 }, { p: 0.9, r: 88 },
  { p: 0.97, r: 94 }, { p: 0.999, r: 98 }, { p: 1, r: 99 },
];
const CK_CURVE: Curve = [
  { p: 0.0, r: 30 }, { p: 0.4, r: 50 }, { p: 0.7, r: 64 }, { p: 0.9, r: 78 },
  { p: 0.97, r: 88 }, { p: 0.999, r: 96 }, { p: 1, r: 99 },
];
const FG_CURVE: Curve = [
  { p: 0.0, r: 20 }, { p: 0.6, r: 28 }, { p: 0.85, r: 45 }, { p: 0.95, r: 70 },
  { p: 0.99, r: 88 }, { p: 1, r: 99 },
];
const DI_CURVE: Curve = [
  { p: 0.0, r: 35 }, { p: 0.3, r: 55 }, { p: 0.6, r: 68 }, { p: 0.85, r: 80 },
  { p: 0.97, r: 90 }, { p: 1, r: 97 },
];
const ST_CURVE: Curve = [
  { p: 0.0, r: 40 }, { p: 0.5, r: 62 }, { p: 0.85, r: 78 }, { p: 0.97, r: 90 }, { p: 1, r: 97 },
];
export const CURVES: Record<RatingKey, Curve> = {
  CK: CK_CURVE, FG: FG_CURVE, DI: DI_CURVE, SK: CONSERVATIVE, ST: ST_CURVE, EN: EN_CURVE,
  DU: CONSERVATIVE, PH: CONSERVATIVE, FO: CONSERVATIVE, PA: CONSERVATIVE, SC: CONSERVATIVE,
  DF: DF_CURVE, PS: CONSERVATIVE, EX: CONSERVATIVE, LD: CONSERVATIVE, MO: CONSERVATIVE,
};

// OWN BASE (default): the engine uses the hand-designed conservative CURVES above, so ratings
// are built purely from the spec on OUR OWN scale — never copied from the current ProfiNHL
// numbers. Set USE_PROFI_CURVES=true only to reproduce the legacy ProfiNHL distribution
// (quantile-matched, from curves.calibrated.json) for a side-by-side comparison.
const USE_PROFI_CURVES = process.env.EDGE_PROFI_CURVES === "1";
let CALIBRATED: Record<string, Curve> = {};
if (USE_PROFI_CURVES) {
  try {
    CALIBRATED = JSON.parse(readFileSync(new URL("./curves.calibrated.json", import.meta.url), "utf8"));
  } catch { /* no file → hand-tuned CURVES */ }
}

// Own-base position-specific curves (used unless the ProfiNHL comparison mode is on).
const OWN_GROUP_CURVES: Record<string, Curve> = { "DF|F": DF_F_CURVE, "DF|D": DF_D_CURVE };

// AUTHORITATIVE curves from the user's "Players Calculator 2.0" workbook (PNHL_CURVES + DF v2):
// per-parameter × F/D percentile→rating tables the user designed. These define the output scale
// (e.g. SC_F median 65 / SC_D 58, DF_F 63 / DF_D 72, CK_F 62…). Preferred over the hand curves.
let PNHL: Record<string, Curve> = {};
try {
  PNHL = JSON.parse(readFileSync(new URL("./curves.pnhl.json", import.meta.url), "utf8"));
} catch { /* no workbook curves → hand-tuned fallback */ }

/** Curve for a parameter+group: ProfiNHL-comparison → workbook (PNHL) → own position → hand-tuned. */
export function curveFor(key: RatingKey, g: Group): Curve {
  if (USE_PROFI_CURVES) return CALIBRATED[`${key}|${g}`] ?? CALIBRATED[key] ?? CURVES[key];
  return PNHL[`${key}|${g}`] ?? PNHL[key] ?? OWN_GROUP_CURVES[`${key}|${g}`] ?? CURVES[key];
}
export const isCalibrated = Object.keys(PNHL).length > 0;
export const curveSource = Object.keys(PNHL).length > 0 ? "workbook PNHL_CURVES + DF v2" : "hand-tuned";

// ── Final blend + absolute scale ─────────────────────────────────────────────
export const BLEND_QUANTILE = 0.85;
export const BLEND_ABSOLUTE = 0.15;
/** Absolute historical rating from a composite z-score (fixed, not percentile). */
export const absoluteFromZ = (z: number) => 63 + 8.5 * z;

// ── FO / faceoffs ────────────────────────────────────────────────────────────
export const LEAGUE_FO = 0.5;
export const FO_K = 300;
export const FO_POS_FALLBACK: Record<string, number> = { C: 0.5, LW: 0.42, RW: 0.42, D: 0.3, G: 0.3 };

// ── PS / shootout ──────────────────────────────────────────────────────────
export const LEAGUE_SO = 0.33;

// ── AHL → NHL league-equivalency regression: NHLmetric = α + β·AHL + γ·age ────
// Per-60 metrics. Coefficients are illustrative NHLe-style translations, tune with real pairs.
export interface EqCoef { alpha: number; beta: number; gamma: number }
export const LEAGUE_EQ: Record<string, EqCoef> = {
  g60: { alpha: 0.02, beta: 0.55, gamma: -0.004 },
  a1_60: { alpha: 0.02, beta: 0.58, gamma: -0.003 },
  a2_60: { alpha: 0.02, beta: 0.6, gamma: -0.002 },
  sog60: { alpha: 0.4, beta: 0.72, gamma: -0.02 },
  hits60: { alpha: 0.3, beta: 0.85, gamma: 0 }, // physical style translates well
  xg60: { alpha: 0.02, beta: 0.5, gamma: -0.003 },
};

// DU inter-year clamp (spec: normal max ±8; chronic injuries may exceed).
export const DU_MAX_YOY = 8;
