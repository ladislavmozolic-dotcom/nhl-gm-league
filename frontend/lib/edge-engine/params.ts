// Per-parameter raw calculators. Two families:
//  • percentile-pipeline (CK, FG, DI, SK, ST, EN, PH, PA, SC, DF): weighted sub-metrics →
//    Bayesian shrink → z → weight-combine → percentile → PNHL curve + absolute blend.
//  • direct-formula (FO, DU, EX, LD, PS, MO): bespoke, each documented inline.
//
// Every function returns a partial RatingCell; engine.ts does the final blend, overrides,
// clamps and DU year-over-year limiting.

import {
  BLEND_ABSOLUTE, BLEND_QUANTILE, FO_K, FO_POS_FALLBACK, INVERSE, K, LEAGUE_FO,
  LEAGUE_SO, REF, WEIGHTS, absoluteFromZ, curveFor, refFor,
} from "./config";
import {
  applyCurve, clamp, confidence, normalCdf, percentileVsRef, shrink, weightedOnIce, weightedPer60,
} from "./math";
import type { PlayerInput, RatingCell, RatingKey, SituationLine } from "./types";
import { groupOf } from "./types";

type WR = { value: number; exposureMin: number };
const zero: WR = { value: 0, exposureMin: 0 };

// ── generic helpers ──────────────────────────────────────────────────────────
const evGet = (s: PlayerInput["seasons"], f: (l: SituationLine) => number | undefined) =>
  weightedPer60(s, "ev5v5", f);
const allGet = (s: PlayerInput["seasons"], f: (l: SituationLine) => number | undefined) =>
  weightedPer60(s, "all", f);
const ppGet = (s: PlayerInput["seasons"], f: (l: SituationLine) => number | undefined) =>
  weightedPer60(s, "pp", f);

/** Weighted all-situations TOI in minutes — the exposure that drives most confidences. */
function totalToiMin(p: PlayerInput): number {
  return weightedPer60(p.seasons, "all", () => 1).exposureMin; // exposureMin = Σ w·icetime/60
}

/** z-score of a sub-metric after shrinking toward its league prior; negated if inverse. */
function subZ(metric: string, value: number, exposureMin: number, Kp: number, g: "F" | "D") {
  const r = refFor(metric, g);
  const { adjusted } = shrink(value, r.mean, exposureMin, Kp);
  let z = (adjusted - r.mean) / (r.sd || 1);
  if (INVERSE.has(metric)) z = -z;
  // safeguard: never let one noisy/mis-scaled sub-metric dominate the composite
  return clamp(z, -3.5, 3.5);
}

/** Combine weighted sub-metric z-scores → percentile → curve + absolute blend → cell. */
function pipeline(
  key: RatingKey,
  subs: { metric: string; w: number; z: number }[],
  exposureMin: number,
  g: "F" | "D",
  reason: string,
  confScale = 1,
): RatingCell {
  const z = subs.reduce((a, s) => a + s.w * s.z, 0);
  const percentile = normalCdf(z);
  const curveRating = applyCurve(percentile, curveFor(key, g));
  const absoluteRating = absoluteFromZ(z);
  const final = BLEND_QUANTILE * curveRating + BLEND_ABSOLUTE * absoluteRating;
  const conf = Math.round(confidence(exposureMin, K[key] ?? K.default) * confScale);
  return { raw: +z.toFixed(3), percentile: +percentile.toFixed(3), curveRating, absoluteRating, confidence: conf, final, reason };
}

// ── CK — checking (hits/60) ───────────────────────────────────────────────────
export function ck(p: PlayerInput, confScale = 1): RatingCell {
  const g = groupOf(p.bio.pos);
  const ev = evGet(p.seasons, (l) => l.hits);
  const all = allGet(p.seasons, (l) => l.hits);
  const exposure = ev.exposureMin || all.exposureMin;
  return pipeline("CK", [
    { metric: "hits60", w: WEIGHTS.CK.hits60, z: subZ("hits60", ev.per60, exposure, K.CK, g) },
    { metric: "hitsAll60", w: WEIGHTS.CK.hitsAll60, z: subZ("hitsAll60", all.per60, exposure, K.CK, g) },
  ], exposure, g, `hits/60 ${ev.per60.toFixed(1)}`, confScale);
}

// ── FG — fighting frequency (fights/82, 3 seasons) ─────────────────────────────
export function fg(p: PlayerInput): RatingCell {
  const g = groupOf(p.bio.pos);
  let fights = 0, gp = 0, hasFeed = false;
  p.seasons.forEach((s) => { if (s.fights != null) hasFeed = true; fights += s.fights ?? 0; gp += s.gamesPlayed; });
  if (!hasFeed) return { raw: 0, percentile: 0.2, curveRating: 25, absoluteRating: 25, confidence: 5, final: 25, reason: "NEEDS fights feed — unrated (non-fighter default)" };
  const per82 = gp > 0 ? (fights / gp) * 82 : 0;
  const z = (per82 - REF.fights82.mean) / REF.fights82.sd;
  const percentile = normalCdf(z);
  const curveRating = applyCurve(percentile, curveFor("FG", g));
  return { raw: +per82.toFixed(2), percentile: +percentile.toFixed(3), curveRating, absoluteRating: curveRating, confidence: confidence(gp, K.FG), final: curveRating, reason: `${fights} fights / ${gp} GP` };
}

// ── DI — discipline (penalties taken/60, inverse) ─────────────────────────────
export function di(p: PlayerInput, confScale = 1): RatingCell {
  const g = groupOf(p.bio.pos);
  const minors = allGet(p.seasons, (l) => l.minorsTaken);
  const majors = allGet(p.seasons, (l) => l.majorsTaken);
  const exposure = minors.exposureMin;
  return pipeline("DI", [
    { metric: "minors60", w: WEIGHTS.DI.minors60, z: subZ("minors60", minors.per60, exposure, K.DI, g) },
    { metric: "majors60", w: WEIGHTS.DI.majors60, z: subZ("majors60", majors.per60, exposure, K.DI, g) },
  ], exposure, g, `minors/60 ${minors.per60.toFixed(2)}`, confScale);
}

// ── SK — skating (NHL EDGE). Falls back to a prior when no tracking data. ──────
export function sk(p: PlayerInput, confScale = 1): RatingCell {
  const g = groupOf(p.bio.pos);
  const e = p.edge;
  // EDGE bursts are a single-season total → normalise by that season's games, not the 3-yr sum
  const gp = p.seasons[0]?.gamesPlayed || 82;
  if (!e || e.maxSpeedMph == null) {
    // spec tier-3: no EDGE tracking → unrated neutral base, flagged for a scouting/manual SK.
    return { raw: 0, percentile: 0.5, curveRating: 50, absoluteRating: 50, confidence: 5, final: 50, reason: "NEEDS EDGE/scouting — no skating tracking" };
  }
  const b20 = (e.bursts20 ?? 0) / gp;
  const b22 = (e.bursts22 ?? 0) / gp;
  const exposure = 800; // EDGE speed is stable within a season → high confidence
  return pipeline("SK", [
    { metric: "maxSpeed", w: WEIGHTS.SK.maxSpeed, z: subZ("maxSpeed", e.maxSpeedMph, exposure, K.SK, g) },
    { metric: "bursts20pg", w: WEIGHTS.SK.bursts20pg, z: subZ("bursts20pg", b20, exposure, K.SK, g) },
    { metric: "bursts22pg", w: WEIGHTS.SK.bursts22pg, z: subZ("bursts22pg", b22, exposure, K.SK, g) },
  ], exposure, g, `top ${e.maxSpeedMph.toFixed(1)} mph`, confScale);
}

// ── ST — strength (physical model) ─────────────────────────────────────────────
const expectedWeightForHeight = (cm?: number) => (cm ? 90 + 0.9 * (cm - 185) : 91);
export function st(p: PlayerInput): RatingCell {
  const g = groupOf(p.bio.pos);
  const w = p.bio.weightKg ?? REF.weightKg.mean;
  const residual = w - expectedWeightForHeight(p.bio.heightCm);
  const shot = p.edge?.shotSpeedMph;
  const exposure = 900; // physical → stable
  const subs: { metric: string; w: number; z: number }[] = [
    { metric: "weightKg", w: WEIGHTS.ST.weightKg, z: subZ("weightKg", w, exposure, K.ST, g) },
    { metric: "massResidual", w: WEIGHTS.ST.massResidual, z: subZ("massResidual", residual, exposure, K.ST, g) },
  ];
  if (shot != null) subs.push({ metric: "shotSpeed", w: WEIGHTS.ST.shotSpeed, z: subZ("shotSpeed", shot, exposure, K.ST, g) });
  else { // no shot speed → renormalise weight & residual to 50/50
    subs[0].w = 0.5; subs[1].w = 0.5;
  }
  return pipeline("ST", subs, exposure, g, `${w}kg, mass resid ${residual.toFixed(0)}`);
}

// ── EN — endurance / workload ──────────────────────────────────────────────────
export function en(p: PlayerInput, confScale = 1): RatingCell {
  const g = groupOf(p.bio.pos);
  // weighted TOI/GP (minutes)
  let num = 0, den = 0;
  p.seasons.forEach((s, i) => {
    if (!s.all?.icetime || !s.gamesPlayed) return;
    const wt = [1, 0.55, 0.3, 0.15][i] ?? 0.1;
    num += wt * (s.all.icetime / 60);
    den += wt * s.gamesPlayed;
  });
  const toiPerGP = den > 0 ? num / den : 0;
  const thr = g === "D" ? 23 : 19; // high-workload threshold (min)
  const highPct = normalCdf((toiPerGP - thr) / 2.2); // smooth proxy (no per-game data)
  const dist60 = p.edge?.skatingMiles && p.seasons[0]?.all?.icetime
    ? p.edge.skatingMiles / (p.seasons[0].all.icetime / 3600) : REF.dist60.mean;
  const exposure = totalToiMin(p);
  return pipeline("EN", [
    { metric: "toiPerGP", w: WEIGHTS.EN.toiPerGP, z: subZ("toiPerGP", toiPerGP, exposure, K.EN, g) },
    { metric: "highWorkloadPct", w: WEIGHTS.EN.highWorkloadPct, z: subZ("highWorkloadPct", highPct, exposure, K.EN, g) },
    { metric: "dist60", w: WEIGHTS.EN.dist60, z: subZ("dist60", dist60, exposure, K.EN, g) },
  ], exposure, g, `${toiPerGP.toFixed(1)} TOI/GP`, confScale);
}

// ── DU — durability (injury availability, 50/30/20; not GP) ────────────────────
export function du(p: PlayerInput): RatingCell {
  const inj = p.injuries ?? [];
  if (inj.length === 0) return { raw: 1, percentile: 0.5, curveRating: 60, absoluteRating: 60, confidence: 5, final: 60, reason: "NEEDS injury feed — unrated durability" };
  const wts = [0.5, 0.3, 0.2];
  let num = 0, den = 0, missed = 0, longTerm = 0, elig = 0;
  inj.forEach((s, i) => {
    const wt = wts[i] ?? 0.1;
    const avail = s.eligibleGames > 0 ? 1 - s.gamesMissedInjury / s.eligibleGames : 1;
    num += wt * avail; den += wt;
    missed += s.gamesMissedInjury; elig += s.eligibleGames; longTerm += s.longTermEvents ?? 0;
  });
  const availability = den > 0 ? num / den : 1;
  const ltPenalty = clamp(longTerm * 0.06, 0, 0.25); // chronic long-term events sting more
  const pct = percentileVsRef(availability - ltPenalty, 0.82, 0.15);
  const curveRating = applyCurve(pct, curveFor("DU", groupOf(p.bio.pos)));
  return { raw: +availability.toFixed(3), percentile: +pct.toFixed(3), curveRating, absoluteRating: curveRating, confidence: confidence(elig, K.DU * 3), final: curveRating, reason: `${missed} inj games / ${elig} eligible (3Y)` };
}

// ── PH — puck handling (turnovers adjusted for involvement, inverse) ───────────
export function ph(p: PlayerInput, confScale = 1): RatingCell {
  const g = groupOf(p.bio.pos);
  // involvement = iCF(≈1.9·SOG) + 1.5·A1 + 0.75·A2, all-situations weighted counts
  const sog = allGet(p.seasons, (l) => l.shotsOnGoal);
  const a1 = allGet(p.seasons, (l) => l.primaryAssists);
  const a2 = allGet(p.seasons, (l) => l.secondaryAssists);
  const gaRate = allGet(p.seasons, (l) => l.giveaways);
  const involvement = 1.9 * sog.totalCount + 1.5 * a1.totalCount + 0.75 * a2.totalCount;
  const advTurnover = involvement > 0 ? gaRate.totalCount / involvement : REF.advTurnover.mean;
  const dz = allGet(p.seasons, (l) => l.dzGiveaways);
  const pen = allGet(p.seasons, (l) => l.penaltiesDrawn);
  const rush = allGet(p.seasons, (l) => l.rushAttempts);
  const exposure = totalToiMin(p);
  return pipeline("PH", [
    { metric: "advTurnover", w: WEIGHTS.PH.advTurnover, z: subZ("advTurnover", advTurnover, exposure, K.PH, g) },
    { metric: "dzGiveaway60", w: WEIGHTS.PH.dzGiveaway60, z: subZ("dzGiveaway60", dz.per60, exposure, K.PH, g) },
    { metric: "penDrawn60", w: WEIGHTS.PH.penDrawn60, z: subZ("penDrawn60", pen.per60, exposure, K.PH, g) },
    { metric: "rush60", w: WEIGHTS.PH.rush60, z: subZ("rush60", rush.per60, exposure, K.PH, g) },
  ], exposure, g, `adj TO ${advTurnover.toFixed(3)}`, confScale);
}

// ── FO — faceoffs (Bayesian-regressed FO%, position fallback) ──────────────────
export function fo(p: PlayerInput): RatingCell {
  const g = groupOf(p.bio.pos);
  let fw = 0, fl = 0;
  p.seasons.forEach((s, i) => {
    const wt = [1, 0.55, 0.3, 0.15][i] ?? 0.1;
    fw += wt * (s.all?.faceoffsWon ?? 0);
    fl += wt * (s.all?.faceoffsLost ?? 0);
  });
  const fot = fw + fl;
  const prior = FO_POS_FALLBACK[p.bio.pos] ?? LEAGUE_FO;
  const regFO = (fw + prior * FO_K) / (fot + FO_K);
  const pct = percentileVsRef(regFO, 0.5, 0.045);
  const curveRating = applyCurve(pct, curveFor("FO", g));
  return { raw: +regFO.toFixed(3), percentile: +pct.toFixed(3), curveRating, absoluteRating: curveRating, confidence: confidence(fot, FO_K), final: curveRating, reason: `reg FO% ${(regFO * 100).toFixed(1)} (${Math.round(fot)} FO)` };
}

// ── PA — passing (primary/secondary assists per 60, 5v5 + PP) ──────────────────
export function pa(p: PlayerInput, confScale = 1): RatingCell {
  const g = groupOf(p.bio.pos);
  const a1 = evGet(p.seasons, (l) => l.primaryAssists);
  const a2 = evGet(p.seasons, (l) => l.secondaryAssists);
  const pa1 = ppGet(p.seasons, (l) => l.primaryAssists);
  const pa2 = ppGet(p.seasons, (l) => l.secondaryAssists);
  const exposure = evGet(p.seasons, () => 1).exposureMin;
  return pipeline("PA", [
    { metric: "a1_5v5", w: WEIGHTS.PA.a1_5v5, z: subZ("a1_5v5", a1.per60, exposure, K.PA, g) },
    { metric: "a2_5v5", w: WEIGHTS.PA.a2_5v5, z: subZ("a2_5v5", a2.per60, exposure, K.PA, g) },
    { metric: "ppa1", w: WEIGHTS.PA.ppa1, z: subZ("ppa1", pa1.per60, ppGet(p.seasons, () => 1).exposureMin, K.PA, g) },
    { metric: "ppa2", w: WEIGHTS.PA.ppa2, z: subZ("ppa2", pa2.per60, ppGet(p.seasons, () => 1).exposureMin, K.PA, g) },
  ], exposure, g, `5v5 A1/60 ${a1.per60.toFixed(2)}`, confScale);
}

// ── SC — scoring (goals + xG + shots + PP + finishing talent) ──────────────────
export function sc(p: PlayerInput, confScale = 1): RatingCell {
  const g = groupOf(p.bio.pos);
  const gg = evGet(p.seasons, (l) => l.goals);
  const xg = evGet(p.seasons, (l) => l.xGoals);
  const sog = evGet(p.seasons, (l) => l.shotsOnGoal);
  const ppg = ppGet(p.seasons, (l) => l.goals);
  // shooting talent = finishing above expected, per shot (5v5)
  const shootTalent = sog.totalCount > 0 ? (gg.totalCount - xg.totalCount) / sog.totalCount : 0;
  const exposure = evGet(p.seasons, () => 1).exposureMin;
  return pipeline("SC", [
    { metric: "g5v5", w: WEIGHTS.SC.g5v5, z: subZ("g5v5", gg.per60, exposure, K.SC, g) },
    { metric: "xg5v5", w: WEIGHTS.SC.xg5v5, z: subZ("xg5v5", xg.per60, exposure, K.SC, g) },
    { metric: "sog5v5", w: WEIGHTS.SC.sog5v5, z: subZ("sog5v5", sog.per60, exposure, K.SC, g) },
    { metric: "ppg", w: WEIGHTS.SC.ppg, z: subZ("ppg", ppg.per60, ppGet(p.seasons, () => 1).exposureMin, K.SC, g) },
    { metric: "shootingTalent", w: WEIGHTS.SC.shootingTalent, z: subZ("shootingTalent", shootTalent, exposure, K.SC, g) },
  ], exposure, g, `5v5 G/60 ${gg.per60.toFixed(2)}, ixG/60 ${xg.per60.toFixed(2)}`, confScale);
}

// ── DF — defensive impact (relative xGA/CA/HD/PK + blocks/takeaways) ────────────
export function df(p: PlayerInput, confScale = 1): RatingCell {
  const g = groupOf(p.bio.pos);
  const W = g === "D" ? WEIGHTS.DF_D : WEIGHTS.DF_F;
  const xga = weightedOnIce(p.seasons, "ev5v5", (l) => l.xGA60Rel);
  const hd = weightedOnIce(p.seasons, "ev5v5", (l) => l.hdXGA60Rel);
  const ca = weightedOnIce(p.seasons, "ev5v5", (l) => l.CA60Rel);
  const pkx = weightedOnIce(p.seasons, "pk", (l) => l.xGA60Rel);
  // PK usage = weighted PK minutes per game
  let pkMin = 0, wsum = 0;
  p.seasons.forEach((s, i) => { const wt = [1, 0.55, 0.3, 0.15][i] ?? 0.1; if (s.pk?.icetime && s.gamesPlayed) { pkMin += wt * (s.pk.icetime / 60) / s.gamesPlayed * s.gamesPlayed; wsum += wt * s.gamesPlayed; } });
  const pkUsage = wsum > 0 ? pkMin / wsum : 0;
  const blocks = allGet(p.seasons, (l) => l.blocks);
  const takes = allGet(p.seasons, (l) => l.takeaways);
  const exposure = totalToiMin(p);
  return pipeline("DF", [
    { metric: "xGA60Rel", w: W.xGA60Rel, z: subZ("xGA60Rel", xga.value, exposure, K.DF, g) },
    { metric: "hdXGA60Rel", w: W.hdXGA60Rel, z: subZ("hdXGA60Rel", hd.value, exposure, K.DF, g) },
    { metric: "CA60Rel", w: W.CA60Rel, z: subZ("CA60Rel", ca.value, exposure, K.DF, g) },
    { metric: "pkXGA60Rel", w: W.pkXGA60Rel, z: subZ("pkXGA60Rel", pkx.value, pkx.exposureMin, K.DF, g) },
    { metric: "pkUsage", w: W.pkUsage, z: subZ("pkUsage", pkUsage, exposure, K.DF, g) },
    { metric: "blocks60", w: W.blocks60, z: subZ("blocks60", blocks.per60, exposure, K.DF, g) },
    { metric: "takeaways60", w: W.takeaways60, z: subZ("takeaways60", takes.per60, exposure, K.DF, g) },
  ], exposure, g, `xGA/60 rel ${xga.value.toFixed(2)}`, confScale);
}

// ── EX — experience (career GP + playoff GP + seasons; never really drops) ─────
export function ex(p: PlayerInput): RatingCell {
  const c = p.career;
  if (!c) return { raw: 0, percentile: 0.3, curveRating: 60, absoluteRating: 60, confidence: 10, final: 60, reason: "NEEDS career feed — unrated experience" };
  const gpPart = 28 * (1 - Math.exp(-c.careerNhlGP / 450));
  const poPart = 10 * (1 - Math.exp(-c.careerPlayoffGP / 70));
  const seasonPart = clamp(c.nhlSeasons, 0, 15) * 0.2;
  const rating = clamp(58 + gpPart + poPart + seasonPart, 55, 96);
  return { raw: c.careerNhlGP, percentile: 0, curveRating: rating, absoluteRating: rating, confidence: 90, final: rating, reason: `${c.careerNhlGP} GP, ${c.careerPlayoffGP} PO` };
}

// ── LD — leadership (captaincy history + playoff + tenure) ─────────────────────
export function ld(p: PlayerInput): RatingCell {
  const c = p.career;
  if (!c) return { raw: 0, percentile: 0.3, curveRating: 55, absoluteRating: 55, confidence: 10, final: 55, reason: "NEEDS career/captaincy feed — unrated leadership" };
  const hist = c?.captaincyHistory ?? [];
  const capVals = hist.slice(0, 5).map((h) => (h === "C" ? 100 : h === "A" ? 88 : 60));
  const capScore = capVals.length ? capVals.reduce((a, b) => a + b, 0) / capVals.length : 60;
  const po = c ? clamp(c.careerPlayoffGP / 100, 0, 1) * 100 : 40;
  const gp = c ? clamp(c.careerNhlGP / 900, 0, 1) * 100 : 40;
  const age = clamp((p.bio.age - 20) / 15, 0, 1) * 100;
  const raw = 0.5 * capScore + 0.25 * po + 0.15 * gp + 0.1 * age;
  const rating = clamp(raw, 40, 97);
  return { raw: +capScore.toFixed(0), percentile: 0, curveRating: rating, absoluteRating: rating, confidence: 80, final: rating, reason: `cap ${capScore.toFixed(0)}, ${c?.careerPlayoffGP ?? 0} PO GP` };
}

// ── PS — penalty shot / shootout (career SO regressed, blended w/ SC+PH) ───────
export function ps(p: PlayerInput, scRating: number, phRating: number): RatingCell {
  const c = p.career;
  const att = c?.shootoutAttempts ?? 0;
  const goals = c?.shootoutGoals ?? 0;
  // spec PSraw = w·SOscore + (1-w)·(0.6·SC + 0.4·PH), on the 0-99 rating scale (no re-percentile):
  const skillPS = 0.6 * scRating + 0.4 * phRating;            // breakaway proxy from scoring + handling
  const regSO = (goals + LEAGUE_SO * 20) / (att + 20);        // Bayesian-regressed shootout %
  const soRating = clamp(50 + (regSO - LEAGUE_SO) * 220, 20, 99); // 33%→50, 50%→~87, 25%→~32
  const w = 0.75 * (att / (att + 15));                        // trust the SO score only with a real sample
  const final = w * soRating + (1 - w) * skillPS;
  return { raw: +regSO.toFixed(3), percentile: 0, curveRating: final, absoluteRating: skillPS, confidence: confidence(att, 20), final, reason: att > 0 ? `${goals}/${att} SO (w=${w.toFixed(2)})` : "SC/PH proxy — no shootout feed" };
}

// ── MO — morale (always default 50; STHS drives it in-sim) ─────────────────────
export function mo(): RatingCell {
  return { raw: 50, percentile: 0.5, curveRating: 50, absoluteRating: 50, confidence: 100, final: 50, reason: "default 50 — STHS manages morale" };
}

export const _ignore = { zero, evGet, groupOf }; // keep tree-shaker/linters quiet on shared refs
