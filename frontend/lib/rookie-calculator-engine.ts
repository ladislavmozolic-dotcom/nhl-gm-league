/**
 * Rookie Calculator Engine
 *
 * Computes rookie and prospect attributes directly from the live data metrics
 * configured in Parameters / Live Calculator (rates per 60, rates per game,
 * MoneyPuck advanced stats, NHL Edge tracking, AHL HockeyTech via NHLe, TOI,
 * faceoffs, shooting %, and custom metrics).
 *
 * Implements Bayesian sample-size shrinkage toward rookie baseline to prevent
 * small-sample statistical explosions (e.g. 1 goal in 2 games giving 90+ SC or 92 DI),
 * ensuring rookie ratings land realistically in the STHS range (OV 46-56).
 */

import { posOf } from "./param-projection";
import { lookupRatingFromPercentile, calculateSimonTOverall } from "./live-calculator-baseline";
import { DEFAULT_LIVE_CALC_WEIGHTS, type LiveCalcWeights } from "./live-calculator-config";
import { METRIC_BY_KEY } from "./live-calculator-catalog";

export type RookiePlayerInput = {
  id: number;
  name: string;
  slug: string;
  position?: string | null;
  weight?: number | null;
  age?: number | null;
  teamId?: number | null;
  curSeasonGP?: number | null;
  curSeasonG?: number | null;
  curSeasonA?: number | null;
  curSeasonHits?: number | null;
  curSeasonBlocks?: number | null;
  curSeasonPM?: number | null;
  curSeasonTK?: number | null;
  curSeasonGV?: number | null;
  curSeasonPim?: number | null;
  curSeasonToi?: number | null;
  curSeasonShots?: number | null;
  curSeasonShToi?: number | null;
  curSeasonTeamShToi?: number | null;
  curSeasonFoPct?: number | null;
  lastSeasonGP?: number | null;
  lastSeasonG?: number | null;
  lastSeasonA?: number | null;
  lastSeasonHits?: number | null;
  lastSeasonBlocks?: number | null;
  lastSeasonPM?: number | null;
  lastSeasonTK?: number | null;
  lastSeasonGV?: number | null;
  lastSeasonPim?: number | null;
  lastSeasonToi?: number | null;
  lastSeasonShots?: number | null;
  lastSeasonShToi?: number | null;
  lastSeasonFoPct?: number | null;
  ahlStats?: unknown;
  edgeSpeed?: unknown;
  careerGP?: unknown;
  mpSkater?: unknown;
};

export type RookieCalculatedRow = {
  playerId: number;
  name: string;
  slug: string;
  position: string;
  teamCode: string | null;
  age: number | null;
  curSeasonGP: number;
  lastSeasonGP: number;
  ahlGP: number;
  g: number;
  a: number;
  source: "NHL" | "AHL";
  ratings: Record<string, number>;
};

const clamp = (min: number, max: number, val: number) => Math.max(min, Math.min(max, val));

/**
 * Calculate ratings for one rookie or prospect using the live metrics and weights
 * configured in Parameters Calculator, stabilized by Bayesian sample shrinkage.
 */
export function calculateRookieRatings(
  p: RookiePlayerInput,
  weightsConfig?: LiveCalcWeights
): {
  ratings: Record<string, number>;
  source: "NHL" | "AHL";
  gp: number;
  g: number;
  a: number;
  ahlGP: number;
  nhlGP: number;
} {
  const w = weightsConfig ?? DEFAULT_LIVE_CALC_WEIGHTS;

  const pos = p.position ?? "";
  const isD = posOf(pos) === "D";
  const isC = pos.toUpperCase().includes("C");
  const posGroup: "F" | "D" = isD ? "D" : "F";

  const nhlCurGp = Number(p.curSeasonGP ?? 0);
  const nhlLastGp = Number(p.lastSeasonGP ?? 0);
  const nhlGp = nhlCurGp + nhlLastGp;

  // Current season counts 80%, last season 20% (same rule as the Player Calculator).
  // Rates are blended per game; if only one season has games, that one is used as-is.
  const CUR_W = 0.8;
  const LAST_W = 0.2;
  const blendRate = (cur: unknown, last: unknown): number => {
    const cr = nhlCurGp > 0 ? Number(cur ?? 0) / nhlCurGp : null;
    const lr = nhlLastGp > 0 ? Number(last ?? 0) / nhlLastGp : null;
    if (cr != null && lr != null) return CUR_W * cr + LAST_W * lr;
    return cr ?? lr ?? 0;
  };
  const perGame = blendRate;
  const pooledToiSec = blendRate(
    Number(p.curSeasonToi ?? 0) * nhlCurGp,
    Number(p.lastSeasonToi ?? 0) * nhlLastGp
  );

  const ahl = (p.ahlStats as any) ?? {};
  const ahlCur = ahl.cur ?? {};
  const ahlLast = ahl.last ?? {};
  const ahlCurGp = Number(ahlCur.gp ?? 0);
  const ahlLastGp = Number(ahlLast.gp ?? 0);
  const ahlGp = ahlCurGp + ahlLastGp;

  const ahlG = Number(ahlCur.g ?? 0) + Number(ahlLast.g ?? 0);
  const ahlA = Number(ahlCur.a ?? 0) + Number(ahlLast.a ?? 0);

  const nhlG = Number(p.curSeasonG ?? 0) + Number(p.lastSeasonG ?? 0);
  const nhlA = Number(p.curSeasonA ?? 0) + Number(p.lastSeasonA ?? 0);

  const source: "NHL" | "AHL" = nhlGp > 0 ? "NHL" : "AHL";
  const displayG = source === "NHL" ? nhlG : ahlG;
  const displayA = source === "NHL" ? nhlA : ahlA;
  const displayGp = source === "NHL" ? nhlGp : ahlGp;
  const effectiveGp = nhlGp > 0 ? nhlGp + ahlGp * 0.2 : ahlGp * 0.446;

  // Bayesian reliability factor (K = 20):
  const rel = effectiveGp > 0 ? effectiveGp / (effectiveGp + 20) : 0;
  const regress = (livePct: number, prior: number) => rel * livePct + (1 - rel) * prior;

  // Custom metrics helper from config
  const evalCustom = (groupKey: string): { sum: number; weight: number } => {
    const list = w.customMetrics?.[groupKey] ?? [];
    let sum = 0;
    let weight = 0;
    for (const cm of list) {
      if (cm.weight <= 0) continue;
      const def = METRIC_BY_KEY[cm.metricKey];
      if (!def) continue;
      const val = def.getValue(p, {
        latestMpYear: 2026,
        previousMpYear: 2025,
        latestWeight: 0.8,
        previousWeight: 0.2,
      });
      if (val != null && !isNaN(val)) {
        let pct = 0.5;
        if (cm.invert) pct = 1 - pct;
        sum += pct * cm.weight;
        weight += cm.weight;
      }
    }
    return { sum, weight };
  };

  // MoneyPuck skater data if present
  const mp = (p as any).mpSkater ?? {};
  const mpCur = mp["2026"] ?? mp["2025"] ?? {};

  // 1. PA (Passing) — from A/GP, A/60 all, A/60 5v5 + custom
  let livePaPct = isD ? 0.20 : 0.22;
  if (nhlGp > 0) {
    const apg = perGame(p.curSeasonA, p.lastSeasonA);
    const toiSec = pooledToiSec;
    const a60 = toiSec > 0 ? (apg / toiSec) * 3600 : apg * 3.5;
    const a60_5v5 = mpCur.toi5v5 ? ((mpCur.a1_5v5 ?? 0) + (mpCur.a2_5v5 ?? 0)) / mpCur.toi5v5 * 3600 : a60;

    const pctApg = clamp(0, 1, apg / (isD ? 0.45 : 0.65));
    const pctA60 = clamp(0, 1, a60 / (isD ? 1.4 : 2.2));
    const pctA60_5v5 = clamp(0, 1, a60_5v5 / (isD ? 1.2 : 1.8));

    const stdPA = w.pa.apg * pctApg + w.pa.a60All * pctA60 + w.pa.a60_5v5 * pctA60_5v5;
    const { sum: cSumPA, weight: cWeightPA } = evalCustom("pa");
    const totW_PA = (w.pa.apg + w.pa.a60All + w.pa.a60_5v5) + cWeightPA;
    livePaPct = totW_PA > 0 ? (stdPA + cSumPA) / totW_PA : stdPA;
  } else if (ahlGp > 0) {
    const nhleApg = (ahlA / ahlGp) * 0.446;
    livePaPct = clamp(0, 1, nhleApg / (isD ? 0.35 : 0.50));
  }
  const paPct = regress(livePaPct, isD ? 0.20 : 0.22);
  const pa = lookupRatingFromPercentile("PA", posGroup, paPct);

  // 2. SC (Scoring) — from G/GP, G/60, xG/60, (G-xG)/60 + custom
  let liveScPct = isD ? 0.20 : 0.22;
  if (nhlGp > 0) {
    const gpg = perGame(p.curSeasonG, p.lastSeasonG);
    const toiSec = pooledToiSec;
    const g60 = toiSec > 0 ? (gpg / toiSec) * 3600 : gpg * 3.5;
    const xg60 = mpCur.toi ? (mpCur.ixg / mpCur.toi) * 3600 : g60 * 0.9;
    const g_xg60 = mpCur.toi ? ((mpCur.g - mpCur.ixg) / mpCur.toi) * 3600 : 0;

    const pctGpg = clamp(0, 1, gpg / (isD ? 0.20 : 0.45));
    const pctG60 = clamp(0, 1, g60 / (isD ? 0.8 : 1.8));
    const pctXg60 = clamp(0, 1, xg60 / (isD ? 0.7 : 1.6));
    const pctGxg = clamp(0, 1, 0.5 + (g_xg60 / 1.5) * 0.5);

    const stdSC = w.sc.gpg * pctGpg + w.sc.g60 * pctG60 + w.sc.xg60 * pctXg60 + w.sc.g_xg60 * pctGxg;
    const { sum: cSumSC, weight: cWeightSC } = evalCustom("sc");
    const totW_SC = (w.sc.gpg + w.sc.g60 + w.sc.xg60 + w.sc.g_xg60) + cWeightSC;
    liveScPct = totW_SC > 0 ? (stdSC + cSumSC) / totW_SC : stdSC;
  } else if (ahlGp > 0) {
    const nhleGpg = (ahlG / ahlGp) * 0.446;
    const ahlShots = Number(ahlCur.sh ?? ahlLast.sh ?? 0);
    const pctShots = ahlGp > 0 ? clamp(0, 1, (ahlShots / ahlGp) / (isD ? 2.0 : 3.0)) : 0.5;
    liveScPct = w.ahl.scEqGpg * clamp(0, 1, nhleGpg / (isD ? 0.15 : 0.35)) + w.ahl.scShots * pctShots;
  }
  const scPct = regress(liveScPct, isD ? 0.20 : 0.22);
  const sc = lookupRatingFromPercentile("SC", posGroup, scPct);

  // 3. CK (Checking) — Hits/60, Hits/GP + custom
  let liveCkPct = isD ? 0.30 : 0.25;
  if (nhlGp > 0) {
    const hpg = perGame(p.curSeasonHits, p.lastSeasonHits);
    const toiSec = pooledToiSec;
    const h60 = toiSec > 0 ? (hpg / toiSec) * 3600 : hpg * 3.5;
    const pctH60 = clamp(0, 1, h60 / 8.0);
    const pctHpg = clamp(0, 1, hpg / (isD ? 2.5 : 2.0));
    const stdCK = w.ck.hit60 * pctH60 + w.ck.hitPg * pctHpg;
    const { sum: cSumCK, weight: cWeightCK } = evalCustom("ck");
    liveCkPct = (stdCK + cSumCK) / (w.ck.hit60 + w.ck.hitPg + cWeightCK);
  }
  const ckPct = regress(liveCkPct, isD ? 0.30 : 0.25);
  const ck = lookupRatingFromPercentile("CK", posGroup, ckPct);

  // 4. DF (Defense) — PK TOI, blocks, +/- and relative xGA metrics
  let liveDfPct = isD ? 0.28 : 0.22;
  if (nhlGp > 0) {
    const pkToi = blendRate(Number(p.curSeasonShToi ?? 0) * nhlCurGp, Number(p.lastSeasonShToi ?? 0) * nhlLastGp) / 60;
    const blkPg = perGame(p.curSeasonBlocks, p.lastSeasonBlocks);
    const pmPg = blendRate(p.curSeasonPM, p.lastSeasonPM);

    const pctPk = clamp(0, 1, pkToi / (isD ? 2.5 : 1.5));
    const pctBlk = clamp(0, 1, blkPg / (isD ? 2.0 : 0.9));
    const pctPm = clamp(0, 1, 0.5 + pmPg * 0.3);

    const stdDF = (isD ? w.dfD.pkToiPg : w.dfF.pkToiPg) * pctPk +
                  (isD ? w.dfD.blk60 : w.dfF.blk60) * pctBlk +
                  0.5 * pctPm;
    const { sum: cSumDF, weight: cWeightDF } = evalCustom(isD ? "dfD" : "dfF");
    const totW_DF = 1.0 + cWeightDF;
    liveDfPct = totW_DF > 0 ? (stdDF + cSumDF) / totW_DF : stdDF;
  } else if (ahlGp > 0) {
    const ahlPm = Number(ahlCur.plusMinus ?? ahlLast.plusMinus ?? 0);
    liveDfPct = clamp(0, 1, 0.5 + (ahlPm / ahlGp) * 0.35);
  }
  const dfPct = regress(liveDfPct, isD ? 0.28 : 0.22);
  const df = clamp(45, isD ? 70 : 64, lookupRatingFromPercentile("DF", posGroup, dfPct));

  // 5. DI (Discipline) — Penalties, PIM/60, penalty balance
  let liveDiPct = 0.35;
  const pimPg = nhlGp > 0 ? blendRate(p.curSeasonPim, p.lastSeasonPim) : (effectiveGp > 0 ? Number(ahlCur.pim ?? 0) / effectiveGp : 0.3);
  liveDiPct = clamp(0.1, 0.9, 1 - (pimPg / 1.6));
  const diPct = regress(liveDiPct, 0.35);
  const di = clamp(72, 85, lookupRatingFromPercentile("DI", posGroup, diPct));

  // 6. SK (Skating) — NHL Edge speed bursts > 20 mph + custom
  const es = (p.edgeSpeed as any) ?? {};
  const burst = es.cur?.brst ?? es.last?.brst;
  let liveSkPct = isD ? 0.25 : 0.35;
  if (burst != null && Number.isFinite(burst)) {
    liveSkPct = clamp(0, 1, burst / 30);
  }
  const { sum: cSumSK, weight: cWeightSK } = evalCustom("sk");
  if (cWeightSK > 0) liveSkPct = (liveSkPct * w.sk.edgeBursts20 + cSumSK) / (w.sk.edgeBursts20 + cWeightSK);
  const skPct = regress(liveSkPct, isD ? 0.25 : 0.35);
  const sk = clamp(36, 62, lookupRatingFromPercentile("SK", posGroup, skPct));

  // 7. ST (Strength) — Weight (kg) + custom
  const weight = p.weight ? Number(p.weight) : 88;
  let liveStPct = clamp(0, 1, (weight - 75) / 30);
  const { sum: cSumST, weight: cWeightST } = evalCustom("st");
  if (cWeightST > 0) liveStPct = (liveStPct * w.st.weightPct + cSumST) / (w.st.weightPct + cWeightST);
  const st = clamp(68, 86, lookupRatingFromPercentile("ST", posGroup, liveStPct));

  // 8. EX (Experience) — Rookie career GP
  const cGP = p.careerGP as any;
  const career = typeof cGP === "number" ? cGP : (typeof cGP?.reg === "number" ? cGP.reg : nhlGp);
  const ex = clamp(60, 66, 63 + Math.floor((Number.isFinite(career) ? career : 0) / 25));

  // 9. EN (Endurance) — TOI per game
  const toiSec = pooledToiSec;
  const en = toiSec > 0 ? clamp(72, 85, Math.round(74 + (toiSec / 60 - 11) * 1.5)) : 78;

  // 10. DU (Durability) — Realistic rookie baseline
  const du = 82;

  // 11. PH (Puck Handling) — Linked to puck action and skill
  const ph = clamp(40, 56, Math.round(44 + (sc + pa - 98) * 0.3));

  // 12. FO (Faceoffs) — Real faceoff win %
  let fo = isD ? 30 : isC ? 70 : 62;
  const foPct = Number(p.curSeasonFoPct ?? p.lastSeasonFoPct ?? 0);
  if (isC && foPct > 0.25 && foPct < 0.75) {
    fo = clamp(64, 76, Math.round(foPct * 100 * 0.4 + 48));
  }

  // 13. FG (Fighting) — Physical proxy
  const fg = clamp(32, 44, Math.round(36 + (ck - 60) * 0.2));

  // 14. PS (Penalty Shot) — Shooting proxy
  const ps = clamp(48, 62, Math.round(52 + (sc - 48) * 0.4));

  // 15. LD (Leadership) — Rookie baseline
  const ld = 64;

  const ratings: Record<string, number> = {
    CK: ck,
    FG: fg,
    DI: di,
    SK: sk,
    ST: st,
    EN: en,
    DU: du,
    PH: ph,
    FO: fo,
    PA: pa,
    SC: sc,
    DF: df,
    PS: ps,
    EX: ex,
    LD: ld,
  };
  ratings.OV = calculateSimonTOverall(ratings);

  return {
    ratings,
    source,
    gp: displayGp,
    g: displayG,
    a: displayA,
    ahlGP: ahlGp,
    nhlGP: nhlGp,
  };
}
