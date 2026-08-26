// Core math shared by every parameter: 3-season TOI weighting, sample regression
// (Bayesian shrink toward the league mean), confidence, percentile, and curve mapping.

import type { SeasonStats, SituationLine } from "./types";

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Recency weights for 2026-27 ratings (spec): current 100%, −1yr 55%, −2yr 30%. */
export const SEASON_WEIGHT: Record<string, number> = {
  "2025-26": 1.0,
  "2024-25": 0.55,
  "2023-24": 0.30,
};
/** Fallback when a season string isn't in the table: decay by position in the list. */
const POSITIONAL_DECAY = [1.0, 0.55, 0.3, 0.15];
export const weightForSeason = (season: string, idx: number): number =>
  SEASON_WEIGHT[season] ?? POSITIONAL_DECAY[idx] ?? 0.1;

const pick = (s: SeasonStats, sit: keyof Pick<SeasonStats, "all" | "ev5v5" | "pp" | "pk">) =>
  s[sit] as SituationLine | undefined;

export interface WeightedRate {
  per60: number; // TOI-weighted per-60 rate across seasons
  exposureMin: number; // Σ(weight × icetime) in MINUTES — drives confidence
  totalCount: number; // Σ(weight × raw count) — for absolute-scale use
}

/**
 * TOI-weighted per-60 of a counting stat across seasons. Derivation:
 *   rate_s = X_s / (T_s/3600); weight exposure = w_s · T_s
 *   Σ(rate_s · w_s·T_s) / Σ(w_s·T_s) = 3600 · Σ(w_s·X_s) / Σ(w_s·T_s)
 * so a 14-game season simply contributes little exposure — no GP thresholds needed.
 */
export function weightedPer60(
  seasons: SeasonStats[],
  sit: "all" | "ev5v5" | "pp" | "pk",
  stat: (l: SituationLine) => number | undefined,
): WeightedRate {
  let num = 0; // Σ w·X
  let den = 0; // Σ w·T  (seconds)
  let wCount = 0;
  seasons.forEach((s, idx) => {
    const line = pick(s, sit);
    if (!line || !line.icetime) return;
    const w = weightForSeason(s.season, idx);
    const x = stat(line) ?? 0;
    num += w * x;
    den += w * line.icetime;
    wCount += w * x;
  });
  return {
    per60: den > 0 ? 3600 * (num / den) : 0,
    exposureMin: den / 60,
    totalCount: wCount,
  };
}

/** TOI-weighted mean of an already-relative on-ice rate (xGA/60 rel etc.). */
export function weightedOnIce(
  seasons: SeasonStats[],
  sit: "ev5v5" | "pk",
  stat: (l: SituationLine) => number | undefined,
): { value: number; exposureMin: number } {
  let num = 0, den = 0;
  seasons.forEach((s, idx) => {
    const line = pick(s, sit);
    if (!line || !line.icetime) return;
    const v = stat(line);
    if (v == null) return;
    const w = weightForSeason(s.season, idx);
    num += w * v * line.icetime;
    den += w * line.icetime;
  });
  return { value: den > 0 ? num / den : 0, exposureMin: den / 60 };
}

/** Regression fraction R = exposure/(exposure+K). Small sample → R→0 → pulls to mean. */
export const regFraction = (exposure: number, K: number) => exposure / (exposure + K);

/** Bayesian shrink of a metric toward a prior (league average) by sample size. */
export function shrink(value: number, prior: number, exposure: number, K: number) {
  const R = regFraction(exposure, K);
  return { adjusted: R * value + (1 - R) * prior, R };
}

/** Confidence 0-100 from exposure vs a reference K (≈ the exposure at ~50% confidence). */
export const confidence = (exposure: number, K: number) => Math.round(100 * regFraction(exposure, K));

/** Standard normal CDF (Abramowitz–Stegun 7.1.26), for percentile-from-zscore. */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  p = z > 0 ? 1 - p : p;
  return clamp(p, 0.0001, 0.9999);
}

/** Percentile of a value against a reference normal(mean, sd). `inverse` flips (lower=better). */
export function percentileVsRef(value: number, mean: number, sd: number, inverse = false): number {
  if (sd <= 0) return 0.5;
  const z = (value - mean) / sd;
  return inverse ? normalCdf(-z) : normalCdf(z);
}

/** A PNHL curve: monotone control points mapping percentile (0-1) → rating (0-99). */
export type Curve = { p: number; r: number }[];

/** Piecewise-linear percentile → rating along a curve's control points. */
export function applyCurve(percentile: number, curve: Curve): number {
  const p = clamp(percentile, 0, 1);
  if (p <= curve[0].p) return curve[0].r;
  for (let i = 1; i < curve.length; i++) {
    if (p <= curve[i].p) {
      const t = (p - curve[i - 1].p) / (curve[i].p - curve[i - 1].p || 1);
      return lerp(curve[i - 1].r, curve[i].r, t);
    }
  }
  return curve[curve.length - 1].r;
}
