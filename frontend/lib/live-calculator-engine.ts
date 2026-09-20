import { prisma } from "./prisma";
import { getLiveCalculatorConfig, LiveCalcConfigData, CustomMetricConfig } from "./live-calculator-config";
import {
  getBaselinePlayer,
  lookupRatingFromPercentile,
  calculateSimonTOverall,
  ParamKey,
} from "./live-calculator-baseline";
import { percentileOf } from "./edge-params";
import { METRIC_BY_KEY } from "./live-calculator-catalog";

export const SKATER_PARAMS: ParamKey[] = [
  "ck", "fg", "di", "sk", "st",
  "en", "du", "ph", "fo", "pa",
  "sc", "df", "ps", "ex", "ld",
];

export type SkaterLiveRatingBlob = {
  classification: "NHL" | "AHL/FARM";
  status: string;
  nhlGpLatest: number;
  nhlGpPrevious: number;
  ahlGpLatest: number;
  ahlGpPrevious: number;
  calculatedAt: string;
  actual: Record<ParamKey, number | null>;
  projected: Record<ParamKey, number | null>;
  delta: Record<ParamKey, number>;
  overallActual: number | null;
  overallProjected: number | null;
  overallDelta: number;
  components?: Record<string, number | null>;
};

const isDefenseman = (pos = ""): boolean =>
  pos.trim().toUpperCase() === "D" ||
  pos.toUpperCase().includes("/D") ||
  pos.toUpperCase().includes("D/");

function safePer60(count: number, toiSec: number): number | null {
  if (!toiSec || toiSec <= 0) return null;
  return (count / toiSec) * 3600;
}

function safeRate(count: number, gp: number): number | null {
  if (!gp || gp <= 0) return null;
  return count / gp;
}

/**
 * Execute the Live Calculator recalculation for all skaters.
 * Replicates the exact formulas from NextGen_Player_Ratings_AHL_PA_SC_V10_NHL_GP.xlsx.
 */
export async function runLiveCalculatorRecompute(): Promise<{
  totalProcessed: number;
  nhlCount: number;
  ahlCount: number;
  timestamp: string;
}> {
  const config = await getLiveCalculatorConfig();
  console.log("[LiveCalcEngine] Starting ratings recalculation with config:", {
    latestWeight: config.latestWeight,
    previousWeight: config.previousWeight,
    nhlGpLatestMin: config.nhlGpLatestMin,
    ahlNhleLatest: config.ahlNhleLatest,
  });

  const players = await prisma.player.findMany({
    where: { isGoalie: false },
    select: {
      id: true,
      name: true,
      nhlId: true,
      position: true,
      weight: true,
      teamId: true,
      rosterType: true,
      age: true,
      overall: true,
      ck: true, fg: true, di: true, sk: true, st: true,
      en: true, du: true, ph: true, fo: true, pa: true,
      sc: true, df: true, ps: true, ex: true, ld: true,
      curSeasonGP: true, curSeasonG: true, curSeasonA: true,
      curSeasonHits: true, curSeasonBlocks: true, curSeasonPM: true,
      curSeasonTK: true, curSeasonGV: true, curSeasonPim: true,
      curSeasonToi: true, curSeasonShots: true, curSeasonShToi: true,
      curSeasonTeamShToi: true,
      lastSeasonGP: true, lastSeasonG: true, lastSeasonA: true,
      lastSeasonHits: true, lastSeasonBlocks: true, lastSeasonPM: true,
      lastSeasonTK: true, lastSeasonGV: true, lastSeasonPim: true,
      lastSeasonToi: true, lastSeasonShots: true, lastSeasonShToi: true,
      mpSkater: true,
      edgeSpeed: true,
      careerGP: true,
      ahlStats: true,
    },
  });

  const sumSeasonW = (config.latestWeight || 0) + (config.previousWeight || 0);
  const REC_CUR = sumSeasonW > 0 ? config.latestWeight / sumSeasonW : 0.8;
  const REC_LAST = sumSeasonW > 0 ? config.previousWeight / sumSeasonW : 0.2;

  // 1. Gather stats and classify each player
  type EnrichedPlayer = {
    p: (typeof players)[number];
    isD: boolean;
    posGroup: "F" | "D";
    nhlGpLatest: number;
    nhlGpPrevious: number;
    ahlGpLatest: number;
    ahlGpPrevious: number;
    isNhl: boolean;
    classGroup: "NHL" | "AHL/FARM";
    // Metrics
    apg: number | null;
    a60: number | null;
    a60_5v5: number | null;
    gpg: number | null;
    g60: number | null;
    xg60: number | null;
    g_xg60: number | null;
    pkToiPg: number | null;
    xga5: number | null;
    relXga5: number | null;
    ga5: number | null;
    relXgaPk: number | null;
    blk60: number | null;
    xgfPct: number | null;
    hit60: number | null;
    hitPg: number | null;
    penBal60: number | null;
    pim60: number | null;
    burst20: number | null;
    weight: number | null;
    careerRegGP: number | null;
    careerPoGP: number | null;
    // AHL stats
    ahlG: number | null;
    ahlA: number | null;
    ahlShots: number | null;
    ahlPim: number | null;
    ahlPlusMinus: number | null;
  };

  const enriched: EnrichedPlayer[] = [];

  for (const p of players) {
    const isD = isDefenseman(p.position);
    const posGroup: "F" | "D" = isD ? "D" : "F";

    const mp = (p.mpSkater as any) ?? {};
    const mpCur = mp[String(config.latestMpYear)] ?? {};
    const mpLast = mp[String(config.previousMpYear)] ?? {};

    const nhlGpLatest = Number(p.curSeasonGP ?? mpCur.gp ?? 0);
    const nhlGpPrevious = Number(p.lastSeasonGP ?? mpLast.gp ?? 0);

    const ahl = (p.ahlStats as any) ?? {};
    const ahlCur = ahl.cur ?? {};
    const ahlLast = ahl.last ?? {};
    const ahlGpLatest = Number(ahlCur.gp ?? 0);
    const ahlGpPrevious = Number(ahlLast.gp ?? 0);

    // Rule: NHL if latest NHL GP >= 10 OR previous NHL GP > 10
    const isNhl =
      nhlGpLatest >= config.nhlGpLatestMin ||
      nhlGpPrevious > config.nhlGpPrevMin;

    const blendVal = (c: number | null | undefined, l: number | null | undefined): number | null => {
      const hasC = c != null && !isNaN(c) && nhlGpLatest > 0;
      const hasL = l != null && !isNaN(l) && nhlGpPrevious > 0;
      if (hasC && hasL) return c! * REC_CUR + l! * REC_LAST;
      if (hasC) return c!;
      if (hasL) return l!;
      return null;
    };

    // A/GP, A/60 all, A/60 5v5
    const apgCur = safeRate(p.curSeasonA ?? mpCur.a1 + mpCur.a2, nhlGpLatest);
    const apgLast = safeRate(p.lastSeasonA ?? mpLast.a1 + mpLast.a2, nhlGpPrevious);
    const apg = blendVal(apgCur, apgLast);

    const a60Cur = safePer60(p.curSeasonA ?? mpCur.a1 + mpCur.a2, (p.curSeasonToi ?? 0) * nhlGpLatest || mpCur.toi);
    const a60Last = safePer60(p.lastSeasonA ?? mpLast.a1 + mpLast.a2, (p.lastSeasonToi ?? 0) * nhlGpPrevious || mpLast.toi);
    const a60 = blendVal(a60Cur, a60Last);

    const a605v5Cur = safePer60((mpCur.a1_5v5 ?? 0) + (mpCur.a2_5v5 ?? 0), mpCur.toi5v5);
    const a605v5Last = safePer60((mpLast.a1_5v5 ?? 0) + (mpLast.a2_5v5 ?? 0), mpLast.toi5v5);
    const a60_5v5 = blendVal(a605v5Cur, a605v5Last);

    // G/GP, G/60, xG/60, (G-xG)/60
    const gpgCur = safeRate(p.curSeasonG ?? mpCur.g, nhlGpLatest);
    const gpgLast = safeRate(p.lastSeasonG ?? mpLast.g, nhlGpPrevious);
    const gpg = blendVal(gpgCur, gpgLast);

    const g60Cur = safePer60(p.curSeasonG ?? mpCur.g, (p.curSeasonToi ?? 0) * nhlGpLatest || mpCur.toi);
    const g60Last = safePer60(p.lastSeasonG ?? mpLast.g, (p.lastSeasonToi ?? 0) * nhlGpPrevious || mpLast.toi);
    const g60 = blendVal(g60Cur, g60Last);

    const xg60Cur = safePer60(mpCur.ixg, mpCur.toi);
    const xg60Last = safePer60(mpLast.ixg, mpLast.toi);
    const xg60 = blendVal(xg60Cur, xg60Last);

    const g_xgCur = mpCur.toi > 0 ? safePer60(mpCur.g - mpCur.ixg, mpCur.toi) : null;
    const g_xgLast = mpLast.toi > 0 ? safePer60(mpLast.g - mpLast.ixg, mpLast.toi) : null;
    const g_xg60 = blendVal(g_xgCur, g_xgLast);

    // DF sub-metrics
    const pkToiCur = p.curSeasonShToi != null ? p.curSeasonShToi / 60 : (mpCur.toi4v5 ? mpCur.toi4v5 / 60 / nhlGpLatest : null);
    const pkToiLast = p.lastSeasonShToi != null ? p.lastSeasonShToi / 60 : (mpLast.toi4v5 ? mpLast.toi4v5 / 60 / nhlGpPrevious : null);
    const pkToiPg = blendVal(pkToiCur, pkToiLast);

    const xga5Cur = safePer60(mpCur.onIceAxg5v5, mpCur.toi5v5);
    const xga5Last = safePer60(mpLast.onIceAxg5v5, mpLast.toi5v5);
    const xga5 = blendVal(xga5Cur, xga5Last);

    const offXga5Cur = safePer60(mpCur.offIceAxg5v5, mpCur.offIceToi5v5);
    const offXga5Last = safePer60(mpLast.offIceAxg5v5, mpLast.offIceToi5v5);
    const relXga5Cur = xga5Cur != null && offXga5Cur != null ? xga5Cur - offXga5Cur : null;
    const relXga5Last = xga5Last != null && offXga5Last != null ? xga5Last - offXga5Last : null;
    const relXga5 = blendVal(relXga5Cur, relXga5Last);

    const ga5Cur = safePer60(mpCur.onIceGa5v5, mpCur.toi5v5);
    const ga5Last = safePer60(mpLast.onIceGa5v5, mpLast.toi5v5);
    const ga5 = blendVal(ga5Cur, ga5Last);

    const pkXgaCur = safePer60(mpCur.onIceAxg4v5, mpCur.toi4v5);
    const offPkXgaCur = safePer60(mpCur.offIceAxg4v5, mpCur.offIceToi4v5);
    const relXgaPkCur = pkXgaCur != null && offPkXgaCur != null ? pkXgaCur - offPkXgaCur : null;
    const pkXgaLast = safePer60(mpLast.onIceAxg4v5, mpLast.toi4v5);
    const offPkXgaLast = safePer60(mpLast.offIceAxg4v5, mpLast.offIceToi4v5);
    const relXgaPkLast = pkXgaLast != null && offPkXgaLast != null ? pkXgaLast - offPkXgaLast : null;
    const relXgaPk = blendVal(relXgaPkCur, relXgaPkLast);

    const blk60Cur = safePer60(p.curSeasonBlocks ?? mpCur.blk, (p.curSeasonToi ?? 0) * nhlGpLatest || mpCur.toi);
    const blk60Last = safePer60(p.lastSeasonBlocks ?? mpLast.blk, (p.lastSeasonToi ?? 0) * nhlGpPrevious || mpLast.toi);
    const blk60 = blendVal(blk60Cur, blk60Last);

    const xgfPctCur = mpCur.onIceFxg5v5 != null && mpCur.onIceAxg5v5 != null && mpCur.onIceFxg5v5 + mpCur.onIceAxg5v5 > 0
      ? mpCur.onIceFxg5v5 / (mpCur.onIceFxg5v5 + mpCur.onIceAxg5v5)
      : null;
    const xgfPctLast = mpLast.onIceFxg5v5 != null && mpLast.onIceAxg5v5 != null && mpLast.onIceFxg5v5 + mpLast.onIceAxg5v5 > 0
      ? mpLast.onIceFxg5v5 / (mpLast.onIceFxg5v5 + mpLast.onIceAxg5v5)
      : null;
    const xgfPct = blendVal(xgfPctCur, xgfPctLast);

    // Hits
    const hit60Cur = safePer60(p.curSeasonHits ?? mpCur.hits, (p.curSeasonToi ?? 0) * nhlGpLatest || mpCur.toi);
    const hit60Last = safePer60(p.lastSeasonHits ?? mpLast.hits, (p.lastSeasonToi ?? 0) * nhlGpPrevious || mpLast.toi);
    const hit60 = blendVal(hit60Cur, hit60Last);

    const hitPgCur = safeRate(p.curSeasonHits ?? mpCur.hits, nhlGpLatest);
    const hitPgLast = safeRate(p.lastSeasonHits ?? mpLast.hits, nhlGpPrevious);
    const hitPg = blendVal(hitPgCur, hitPgLast);

    // Penalties / Discipline
    const pim60Cur = safePer60(p.curSeasonPim ?? 0, (p.curSeasonToi ?? 0) * nhlGpLatest || mpCur.toi);
    const pim60Last = safePer60(p.lastSeasonPim ?? 0, (p.lastSeasonToi ?? 0) * nhlGpPrevious || mpLast.toi);
    const pim60 = blendVal(pim60Cur, pim60Last);

    const penDrawn60Cur = safePer60(mpCur.penaltiesDrawn, mpCur.toi);
    const penTaken60Cur = safePer60(mpCur.penalties, mpCur.toi);
    const penBalCur = penDrawn60Cur != null && penTaken60Cur != null ? penDrawn60Cur - penTaken60Cur : null;
    const penDrawn60Last = safePer60(mpLast.penaltiesDrawn, mpLast.toi);
    const penTaken60Last = safePer60(mpLast.penalties, mpLast.toi);
    const penBalLast = penDrawn60Last != null && penTaken60Last != null ? penDrawn60Last - penTaken60Last : null;
    const penBal60 = blendVal(penBalCur, penBalLast);

    // Speed bursts >20mph
    const es = (p.edgeSpeed as any) ?? {};
    const burstCur = es.cur?.brst ?? null;
    const burstLast = es.last?.brst ?? null;
    const burst20 = blendVal(burstCur, burstLast);

    // Weight
    const weight = p.weight ? Number(p.weight) : null;

    // Career GP
    const cGP = (p.careerGP as any) ?? {};
    const careerRegGP = cGP.reg != null ? Number(cGP.reg) : null;
    const careerPoGP = cGP.po != null ? Number(cGP.po) : null;

    // AHL
    const ahlG = Number(ahlCur.g ?? ahlLast.g ?? 0);
    const ahlA = Number(ahlCur.a ?? ahlLast.a ?? 0);
    const ahlShots = Number(ahlCur.sh ?? ahlLast.sh ?? 0);
    const ahlPim = Number(ahlCur.pim ?? ahlLast.pim ?? 0);
    const ahlPlusMinus = Number(ahlCur.plusMinus ?? ahlLast.plusMinus ?? 0);

    enriched.push({
      p,
      isD,
      posGroup,
      nhlGpLatest,
      nhlGpPrevious,
      ahlGpLatest,
      ahlGpPrevious,
      isNhl,
      classGroup: isNhl ? "NHL" : "AHL/FARM",
      apg, a60, a60_5v5,
      gpg, g60, xg60, g_xg60,
      pkToiPg, xga5, relXga5, ga5, relXgaPk, blk60, xgfPct,
      hit60, hitPg, penBal60, pim60,
      burst20, weight, careerRegGP, careerPoGP,
      ahlG, ahlA, ahlShots, ahlPim, ahlPlusMinus,
    });
  }

  // 2. Build population distribution arrays for percentile rankings
  const pools = {
    F: {
      apg: [] as number[], a60: [] as number[], a60_5v5: [] as number[],
      gpg: [] as number[], g60: [] as number[], xg60: [] as number[], g_xg60: [] as number[],
      pkToiPg: [] as number[], xga5: [] as number[], relXga5: [] as number[], ga5: [] as number[],
      relXgaPk: [] as number[], blk60: [] as number[], xgfPct: [] as number[],
      hit60: [] as number[], hitPg: [] as number[], penBal60: [] as number[], pim60: [] as number[],
      burst20: [] as number[], weight: [] as number[], careerTotal: [] as number[],
    },
    D: {
      apg: [] as number[], a60: [] as number[], a60_5v5: [] as number[],
      gpg: [] as number[], g60: [] as number[], xg60: [] as number[], g_xg60: [] as number[],
      pkToiPg: [] as number[], xga5: [] as number[], relXga5: [] as number[], ga5: [] as number[],
      relXgaPk: [] as number[], blk60: [] as number[], xgfPct: [] as number[],
      hit60: [] as number[], hitPg: [] as number[], penBal60: [] as number[], pim60: [] as number[],
      burst20: [] as number[], weight: [] as number[], careerTotal: [] as number[],
    },
    AHL: {
      apg: [] as number[], gpg: [] as number[], shotsPg: [] as number[], shPct: [] as number[],
      pmPg: [] as number[], pimPg: [] as number[],
    },
  };

  for (const e of enriched) {
    const targetPool = pools[e.posGroup];
    if (e.apg != null) targetPool.apg.push(e.apg);
    if (e.a60 != null) targetPool.a60.push(e.a60);
    if (e.a60_5v5 != null) targetPool.a60_5v5.push(e.a60_5v5);
    if (e.gpg != null) targetPool.gpg.push(e.gpg);
    if (e.g60 != null) targetPool.g60.push(e.g60);
    if (e.xg60 != null) targetPool.xg60.push(e.xg60);
    if (e.g_xg60 != null) targetPool.g_xg60.push(e.g_xg60);
    if (e.pkToiPg != null) targetPool.pkToiPg.push(e.pkToiPg);
    if (e.xga5 != null) targetPool.xga5.push(e.xga5);
    if (e.relXga5 != null) targetPool.relXga5.push(e.relXga5);
    if (e.ga5 != null) targetPool.ga5.push(e.ga5);
    if (e.relXgaPk != null) targetPool.relXgaPk.push(e.relXgaPk);
    if (e.blk60 != null) targetPool.blk60.push(e.blk60);
    if (e.xgfPct != null) targetPool.xgfPct.push(e.xgfPct);
    if (e.hit60 != null) targetPool.hit60.push(e.hit60);
    if (e.hitPg != null) targetPool.hitPg.push(e.hitPg);
    if (e.penBal60 != null) targetPool.penBal60.push(e.penBal60);
    if (e.pim60 != null) targetPool.pim60.push(e.pim60);
    if (e.burst20 != null) targetPool.burst20.push(e.burst20);
    if (e.weight != null) targetPool.weight.push(e.weight);
    if (e.careerRegGP != null) {
      targetPool.careerTotal.push(e.careerRegGP * config.weights.ex.careerRegGP + (e.careerPoGP ?? 0) * config.weights.ex.careerPoGP);
    }

    if (!e.isNhl && (e.ahlGpLatest > 0 || e.ahlGpPrevious > 0)) {
      const ahlGp = e.ahlGpLatest || e.ahlGpPrevious;
      if (e.ahlA != null) pools.AHL.apg.push(e.ahlA / ahlGp);
      if (e.ahlG != null) pools.AHL.gpg.push(e.ahlG / ahlGp);
      if (e.ahlShots != null) {
        pools.AHL.shotsPg.push(e.ahlShots / ahlGp);
        if (e.ahlShots > 0 && e.ahlG != null) pools.AHL.shPct.push(e.ahlG / e.ahlShots);
      }
      if (e.ahlPlusMinus != null) pools.AHL.pmPg.push(e.ahlPlusMinus / ahlGp);
      if (e.ahlPim != null) pools.AHL.pimPg.push(e.ahlPim / ahlGp);
    }
  }

  // Sort pools ascending for percentile ranking
  for (const grp of [pools.F, pools.D, pools.AHL]) {
    for (const arr of Object.values(grp)) {
      arr.sort((a, b) => a - b);
    }
  }

  // 2b. Collect custom metrics pools (for both F and D)
  const allCustomMetrics: CustomMetricConfig[] = Object.values(config.weights.customMetrics ?? {}).flat();
  const customPools: Record<"F" | "D", Record<string, number[]>> = { F: {}, D: {} };

  for (const cm of allCustomMetrics) {
    if (!customPools.F[cm.metricKey]) customPools.F[cm.metricKey] = [];
    if (!customPools.D[cm.metricKey]) customPools.D[cm.metricKey] = [];
  }

  for (const e of enriched) {
    for (const cm of allCustomMetrics) {
      const metricDef = METRIC_BY_KEY[cm.metricKey];
      if (metricDef) {
        const val = metricDef.getValue(e.p, config);
        if (val != null && !isNaN(val)) {
          customPools[e.posGroup][cm.metricKey].push(val);
        }
      }
    }
  }

  for (const g of ["F", "D"] as const) {
    for (const arr of Object.values(customPools[g])) {
      arr.sort((a, b) => a - b);
    }
  }

  const evalCustom = (groupKey: string, posGroup: "F" | "D", pRow: any): { sum: number; weight: number } => {
    const list = config.weights.customMetrics?.[groupKey] ?? [];
    let sum = 0;
    let weight = 0;
    for (const cm of list) {
      if (cm.weight <= 0) continue;
      const def = METRIC_BY_KEY[cm.metricKey];
      if (!def) continue;
      const val = def.getValue(pRow, config);
      const arr = customPools[posGroup][cm.metricKey] ?? [];
      let pct = val != null && arr.length > 0 ? percentileOf(val, arr) : 0.5;
      if (cm.invert) pct = 1 - pct;
      sum += pct * cm.weight;
      weight += cm.weight;
    }
    return { sum, weight };
  };

  const w = config.weights;
  let nhlCount = 0;
  let ahlCount = 0;

  const updates: { id: number; liveRating: SkaterLiveRatingBlob }[] = [];

  for (const e of enriched) {
    const p = e.p;
    const baseline = getBaselinePlayer(p.nhlId, p.name);

    const actual = {} as Record<ParamKey, number | null>;
    const projected = {} as Record<ParamKey, number | null>;
    const delta = {} as Record<ParamKey, number>;

    for (const key of SKATER_PARAMS) {
      const baseVal = (baseline && baseline[key] != null)
        ? baseline[key]
        : (typeof (p as any)[key] === "number" ? (p as any)[key] : null);
      actual[key] = baseVal;
      projected[key] = baseVal; // default to baseline
      delta[key] = 0;
    }

    const pool = pools[e.posGroup];

    if (e.isNhl) {
      nhlCount++;

      // PA (Passing): 45% A/GP + 30% A/60 all + 25% A/60 5v5 + custom
      if (e.apg != null && e.a60 != null) {
        const pctApg = percentileOf(e.apg, pool.apg);
        const pctA60 = percentileOf(e.a60, pool.a60);
        const pctA605v5 = e.a60_5v5 != null ? percentileOf(e.a60_5v5, pool.a60_5v5) : pctA60;
        const stdPA = w.pa.apg * pctApg + w.pa.a60All * pctA60 + w.pa.a60_5v5 * pctA605v5;
        const { sum: cSumPA, weight: cWeightPA } = evalCustom("pa", e.posGroup, e.p);
        const totW_PA = (w.pa.apg + w.pa.a60All + w.pa.a60_5v5) + cWeightPA;
        const compPA = totW_PA > 0 ? (stdPA + cSumPA) / totW_PA : 0.5;
        projected.pa = lookupRatingFromPercentile("PA", e.posGroup, compPA);
      }

      // SC (Scoring): 45% G/GP + 25% G/60 + 20% xG/60 + 10% (G-xG)/60 + custom
      if (e.gpg != null && e.g60 != null) {
        const pctGpg = percentileOf(e.gpg, pool.gpg);
        const pctG60 = percentileOf(e.g60, pool.g60);
        const pctXg60 = e.xg60 != null ? percentileOf(e.xg60, pool.xg60) : pctG60;
        const pctGxg = e.g_xg60 != null ? percentileOf(e.g_xg60, pool.g_xg60) : 0.5;
        const stdSC = w.sc.gpg * pctGpg + w.sc.g60 * pctG60 + w.sc.xg60 * pctXg60 + w.sc.g_xg60 * pctGxg;
        const { sum: cSumSC, weight: cWeightSC } = evalCustom("sc", e.posGroup, e.p);
        const totW_SC = (w.sc.gpg + w.sc.g60 + w.sc.xg60 + w.sc.g_xg60) + cWeightSC;
        const compSC = totW_SC > 0 ? (stdSC + cSumSC) / totW_SC : 0.5;
        projected.sc = lookupRatingFromPercentile("SC", e.posGroup, compSC);
      }

      // DF (Defense): Position specific + custom
      if (e.isD) {
        // D: 25% PK TOI/GP + 15% inv xGA5 + 10% inv RelxGA5 + 20% inv GA5 + 10% inv RelxGA PK + 10% Blocks/60 + 10% xGF% + custom
        const pctPk = e.pkToiPg != null ? percentileOf(e.pkToiPg, pool.pkToiPg) : 0.5;
        const pctXga5 = e.xga5 != null ? 1 - percentileOf(e.xga5, pool.xga5) : 0.5;
        const pctRelXga5 = e.relXga5 != null ? 1 - percentileOf(e.relXga5, pool.relXga5) : 0.5;
        const pctGa5 = e.ga5 != null ? 1 - percentileOf(e.ga5, pool.ga5) : 0.5;
        const pctRelXgaPk = e.relXgaPk != null ? 1 - percentileOf(e.relXgaPk, pool.relXgaPk) : 0.5;
        const pctBlk = e.blk60 != null ? percentileOf(e.blk60, pool.blk60) : 0.5;
        const pctXgf = e.xgfPct != null ? percentileOf(e.xgfPct, pool.xgfPct) : 0.5;

        const stdDF =
          w.dfD.pkToiPg * pctPk +
          w.dfD.xga5 * pctXga5 +
          w.dfD.relXga5 * pctRelXga5 +
          w.dfD.ga5 * pctGa5 +
          w.dfD.relXgaPk * pctRelXgaPk +
          w.dfD.blk60 * pctBlk +
          w.dfD.xgfPct * pctXgf;
        const { sum: cSumDF, weight: cWeightDF } = evalCustom("dfD", "D", e.p);
        const totW_DF =
          (w.dfD.pkToiPg + w.dfD.xga5 + w.dfD.relXga5 + w.dfD.ga5 + w.dfD.relXgaPk + w.dfD.blk60 + w.dfD.xgfPct) +
          cWeightDF;
        const compDF = totW_DF > 0 ? (stdDF + cSumDF) / totW_DF : 0.5;
        projected.df = lookupRatingFromPercentile("DF", "D", compDF);
      } else {
        // F: 30% PK TOI/GP + 15% inv RelxGA PK + 15% inv RelxGA5 + 15% inv xGA5 + 10% inv GA5 + 10% xGF% + 5% Blocks/60 + custom
        const pctPk = e.pkToiPg != null ? percentileOf(e.pkToiPg, pool.pkToiPg) : 0.5;
        const pctRelXgaPk = e.relXgaPk != null ? 1 - percentileOf(e.relXgaPk, pool.relXgaPk) : 0.5;
        const pctRelXga5 = e.relXga5 != null ? 1 - percentileOf(e.relXga5, pool.relXga5) : 0.5;
        const pctXga5 = e.xga5 != null ? 1 - percentileOf(e.xga5, pool.xga5) : 0.5;
        const pctGa5 = e.ga5 != null ? 1 - percentileOf(e.ga5, pool.ga5) : 0.5;
        const pctXgf = e.xgfPct != null ? percentileOf(e.xgfPct, pool.xgfPct) : 0.5;
        const pctBlk = e.blk60 != null ? percentileOf(e.blk60, pool.blk60) : 0.5;

        const stdDF =
          w.dfF.pkToiPg * pctPk +
          w.dfF.relXgaPk * pctRelXgaPk +
          w.dfF.relXga5 * pctRelXga5 +
          w.dfF.xga5 * pctXga5 +
          w.dfF.ga5 * pctGa5 +
          w.dfF.xgfPct * pctXgf +
          w.dfF.blk60 * pctBlk;
        const { sum: cSumDF, weight: cWeightDF } = evalCustom("dfF", "F", e.p);
        const totW_DF =
          (w.dfF.pkToiPg + w.dfF.relXgaPk + w.dfF.relXga5 + w.dfF.xga5 + w.dfF.ga5 + w.dfF.xgfPct + w.dfF.blk60) +
          cWeightDF;
        const compDF = totW_DF > 0 ? (stdDF + cSumDF) / totW_DF : 0.5;
        projected.df = lookupRatingFromPercentile("DF", "F", compDF);
      }

      // CK (Checking): 60% Hits/60 + 40% Hits/GP + custom
      if (e.hit60 != null && e.hitPg != null) {
        const pctHit60 = percentileOf(e.hit60, pool.hit60);
        const pctHitPg = percentileOf(e.hitPg, pool.hitPg);
        const stdCK = w.ck.hit60 * pctHit60 + w.ck.hitPg * pctHitPg;
        const { sum: cSumCK, weight: cWeightCK } = evalCustom("ck", e.posGroup, e.p);
        const totW_CK = (w.ck.hit60 + w.ck.hitPg) + cWeightCK;
        const compCK = totW_CK > 0 ? (stdCK + cSumCK) / totW_CK : 0.5;
        projected.ck = lookupRatingFromPercentile("CK", e.posGroup, compCK);
      }

      // DI (Discipline): 60% Penalty Balance/60 + 40% inv penalties/60 + custom
      if (e.pim60 != null) {
        const pctPim = 1 - percentileOf(e.pim60, pool.pim60);
        const pctBal = e.penBal60 != null ? percentileOf(e.penBal60, pool.penBal60) : pctPim;
        const stdDI = w.di.penaltyBalance * pctBal + w.di.invPim60 * pctPim;
        const { sum: cSumDI, weight: cWeightDI } = evalCustom("di", e.posGroup, e.p);
        const totW_DI = (w.di.penaltyBalance + w.di.invPim60) + cWeightDI;
        const compDI = totW_DI > 0 ? (stdDI + cSumDI) / totW_DI : 0.5;
        projected.di = lookupRatingFromPercentile("DI", e.posGroup, compDI);
      }

      // SK (Skating): EDGE speed bursts >20mph + custom
      if (e.burst20 != null) {
        const pctBurst = percentileOf(e.burst20, pool.burst20);
        const stdSK = w.sk.edgeBursts20 * pctBurst;
        const { sum: cSumSK, weight: cWeightSK } = evalCustom("sk", e.posGroup, e.p);
        const totW_SK = w.sk.edgeBursts20 + cWeightSK;
        const compSK = totW_SK > 0 ? (stdSK + cSumSK) / totW_SK : 0.5;
        projected.sk = lookupRatingFromPercentile("SK", e.posGroup, compSK);
      }

      // ST (Strength): Weight + custom
      if (e.weight != null) {
        const pctWeight = percentileOf(e.weight, pool.weight);
        const stdST = w.st.weightPct * pctWeight;
        const { sum: cSumST, weight: cWeightST } = evalCustom("st", e.posGroup, e.p);
        const totW_ST = w.st.weightPct + cWeightST;
        const compST = totW_ST > 0 ? (stdST + cSumST) / totW_ST : 0.5;
        projected.st = lookupRatingFromPercentile("ST", e.posGroup, compST);
      }

      // EX (Experience): Career GP + custom
      if (e.careerRegGP != null) {
        const tot = e.careerRegGP * w.ex.careerRegGP + (e.careerPoGP ?? 0) * w.ex.careerPoGP;
        const pctEx = percentileOf(tot, pool.careerTotal);
        const stdEX = 1.0 * pctEx;
        const { sum: cSumEX, weight: cWeightEX } = evalCustom("ex", e.posGroup, e.p);
        const totW_EX = 1.0 + cWeightEX;
        const compEX = totW_EX > 0 ? (stdEX + cSumEX) / totW_EX : 0.5;
        projected.ex = lookupRatingFromPercentile("EX", e.posGroup, compEX);
      }
    } else {
      // AHL / FARM Skater
      ahlCount++;
      const ahlGp = e.ahlGpLatest || e.ahlGpPrevious;

      // 1. AHL PA: NHLe A/GP + AHL rank
      if (ahlGp > 0 && e.ahlA != null) {
        const nhleApg = (e.ahlA / ahlGp) * config.ahlNhleLatest;
        const pctEqApg = percentileOf(nhleApg, pool.apg);
        const pctAhlRank = percentileOf(e.ahlA / ahlGp, pools.AHL.apg);
        const compPA = w.ahl.paEqApg * pctEqApg + w.ahl.paRank * pctAhlRank;
        projected.pa = lookupRatingFromPercentile("PA", e.posGroup, compPA);
      }

      // 2. AHL SC: NHLe G/GP + shots + shooting%
      if (ahlGp > 0 && e.ahlG != null) {
        const nhleGpg = (e.ahlG / ahlGp) * config.ahlNhleLatest;
        const pctEqGpg = percentileOf(nhleGpg, pool.gpg);
        const pctShots = e.ahlShots != null ? percentileOf(e.ahlShots / ahlGp, pools.AHL.shotsPg) : 0.5;
        const pctShPct = e.ahlShots && e.ahlShots > 0 ? percentileOf(e.ahlG / e.ahlShots, pools.AHL.shPct) : 0.5;
        const compSC = w.ahl.scEqGpg * pctEqGpg + w.ahl.scShots * pctShots + w.ahl.scShPct * pctShPct;
        projected.sc = lookupRatingFromPercentile("SC", e.posGroup, compSC);
      }

      // 3. AHL DF: Baseline DF + +/- rank + inv PIM + SH
      if (ahlGp > 0 && actual.df != null) {
        const pctPm = e.ahlPlusMinus != null ? percentileOf(e.ahlPlusMinus / ahlGp, pools.AHL.pmPg) : 0.5;
        const pctPim = e.ahlPim != null ? 1 - percentileOf(e.ahlPim / ahlGp, pools.AHL.pimPg) : 0.5;
        const normBaseDF = Math.max(0, Math.min(1, (actual.df - 40) / 45));
        const compDF = w.ahl.dfOldPrior * normBaseDF + w.ahl.dfPlusMinus * pctPm + w.ahl.dfPim * pctPim;
        projected.df = lookupRatingFromPercentile("DF", e.posGroup, compDF);
      }

      // 4. AHL DI: Baseline DI + inv PIM
      if (ahlGp > 0 && actual.di != null) {
        const pctPim = e.ahlPim != null ? 1 - percentileOf(e.ahlPim / ahlGp, pools.AHL.pimPg) : 0.5;
        const normBaseDI = Math.max(0, Math.min(1, (actual.di - 50) / 48));
        const compDI = w.ahl.diOldPrior * normBaseDI + w.ahl.diPim * pctPim;
        projected.di = lookupRatingFromPercentile("DI", e.posGroup, compDI);
      }

      // 5. V10 Protection Rules (AHL_PA_SC_BALANCE)
      // If player has verified NHL GP, do not penalize them
      let tier = "UNKNOWN_GP";
      let paRed = 0, scRed = 0, paCap = 99, scCap = 99;

      if (e.nhlGpLatest >= 10) {
        tier = "NHL_LATEST_10";
      } else if (e.nhlGpLatest > 0 && e.nhlGpPrevious > 0) {
        tier = "NHL_BOTH_SEASONS";
      } else if (e.nhlGpPrevious >= 10) {
        tier = "NHL_PREVIOUS_10";
      } else if (e.nhlGpLatest === 0 && e.nhlGpPrevious === 0) {
        if (e.careerRegGP === 0) {
          tier = "FARM_CAREER_0";
          paRed = 7; scRed = 8; paCap = 43; scCap = 42;
        } else if (e.careerRegGP != null && e.careerRegGP >= 10) {
          tier = "FARM_LEGACY_10";
          paRed = 2; scRed = 3; paCap = 51; scCap = 50;
        } else if (e.careerRegGP != null && e.careerRegGP > 0) {
          tier = "FARM_CAREER_1_9";
          paRed = 5; scRed = 6; paCap = 46; scCap = 45;
        } else {
          tier = "FARM_0_0";
          paRed = 5; scRed = 6; paCap = 46; scCap = 45;
        }
      } else if (e.nhlGpLatest >= 1 && e.nhlGpLatest <= 3) {
        tier = "FARM_RECENT_1_3";
        paRed = 5; scRed = 6; paCap = 46; scCap = 45;
      } else if (e.nhlGpLatest >= 4 && e.nhlGpLatest <= 9) {
        tier = "FARM_RECENT_4_9";
        paRed = 4; scRed = 5; paCap = 48; scCap = 47;
      } else if (e.nhlGpLatest === 0 && e.nhlGpPrevious > 0) {
        tier = "FARM_PREV_1_9_ONLY";
        paRed = 3; scRed = 4; paCap = 49; scCap = 48;
      }

      if (paRed > 0 || paCap < 99) {
        if (projected.pa != null) {
          projected.pa = Math.max(30, Math.min(projected.pa - paRed, paCap));
        }
        if (projected.sc != null) {
          projected.sc = Math.max(30, Math.min(projected.sc - scRed, scCap));
        }
      }
    }

    // Compute deltas
    for (const key of SKATER_PARAMS) {
      const act = actual[key] ?? 50;
      const proj = projected[key] ?? act;
      delta[key] = proj - act;
    }

    // Compute overall ratings
    const overallActual = baseline?.ov ?? p.overall ?? calculateSimonTOverall(actual);
    const overallProjected = calculateSimonTOverall(projected);
    const overallDelta = overallProjected - overallActual;

    const liveRating: SkaterLiveRatingBlob = {
      classification: e.classGroup,
      status: e.isNhl ? `NHL rule: latest=${e.nhlGpLatest}, prev=${e.nhlGpPrevious}` : `AHL / Farm: latest=${e.ahlGpLatest}, prev=${e.ahlGpPrevious}`,
      nhlGpLatest: e.nhlGpLatest,
      nhlGpPrevious: e.nhlGpPrevious,
      ahlGpLatest: e.ahlGpLatest,
      ahlGpPrevious: e.ahlGpPrevious,
      calculatedAt: new Date().toISOString(),
      actual,
      projected,
      delta,
      overallActual,
      overallProjected,
      overallDelta,
    };

    updates.push({ id: p.id, liveRating });
  }

  // Batch persist updates to DB
  console.log(`[LiveCalcEngine] Persisting ${updates.length} player live ratings to DB...`);
  const BATCH = 50;
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    await Promise.all(
      chunk.map((item) =>
        prisma.player.update({
          where: { id: item.id },
          data: { liveCalculatorRatings: item.liveRating as any },
        })
      )
    );
  }

  const now = new Date();
  await prisma.liveCalcConfig.upsert({
    where: { id: 1 },
    update: { lastCalculatedAt: now },
    create: { id: 1, lastCalculatedAt: now },
  });

  console.log(`[LiveCalcEngine] Recalculation complete: ${nhlCount} NHL, ${ahlCount} AHL skaters.`);
  return {
    totalProcessed: updates.length,
    nhlCount,
    ahlCount,
    timestamp: now.toISOString(),
  };
}
