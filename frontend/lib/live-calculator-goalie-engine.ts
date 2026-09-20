import { prisma } from "./prisma";
import { getLiveCalculatorConfig, LiveCalcConfigData, CustomMetricConfig } from "./live-calculator-config";
import { GOALIE_METRIC_BY_KEY } from "./live-calculator-catalog";
import { percentileOf } from "./edge-params";
import { Prisma } from "@prisma/client";

export const GOALIE_PARAMS = [
  "sk", "du", "en", "sz", "ag", "rb", "sc", "hs", "rt", "ph", "ps", "ex", "ld",
] as const;
export type GoalieParamKey = (typeof GOALIE_PARAMS)[number];

const GOALIE_CAL_MAP: Record<string, string> = {
  SC: "sc", RT: "rt", HS: "hs", AG: "ag", RB: "rb", EN: "en", SZ: "sz",
  EX: "ex", DU: "du", LD: "ld", PH: "ph", SK: "sk", PS: "ps", OV: "overall",
};

type Stat = { mean: number; std: number; min: number; max: number };

function statsOf(a: number[]): Stat | null {
  if (!a.length) return null;
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  const std = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / a.length);
  return { mean, std, min: Math.min(...a), max: Math.max(...a) };
}

function affine(raw: number, e: Stat, s: Stat): number {
  const z = e.std > 1e-9 ? (raw - e.mean) / e.std : 0;
  return Math.round(Math.max(s.min, Math.min(s.max, s.mean + z * s.std)));
}

const heightCm = (h: string | null) => {
  const m = (h ?? "").match(/(\d+)\s*cm/);
  return m ? Number(m[1]) : (h ? Number(h) || null : null);
};

const GOALIE_REG_K = 700; // shots faced at which sample reliability = 0.5

/**
 * Execute the Live Calculator recalculation for all goalies.
 */
export async function runLiveCalculatorGoalieRecompute(): Promise<{
  totalProcessed: number;
  nhlCount: number;
  ahlCount: number;
  timestamp: string;
}> {
  const config = await getLiveCalculatorConfig();
  console.log("[LiveCalcGoalieEngine] Starting goalie ratings recalculation...");

  const goalies = await prisma.player.findMany({
    where: { isGoalie: true },
    select: {
      id: true,
      name: true,
      slug: true,
      nhlId: true,
      position: true,
      height: true,
      weight: true,
      age: true,
      captaincy: true,
      rosterType: true,
      overall: true,
      curSeasonGP: true,
      lastSeasonGP: true,
      careerGP: true,
      goalieAdvanced: true,
      goalieRating: {
        select: {
          sk: true, du: true, en: true, sz: true, ag: true, rb: true,
          sc: true, hs: true, rt: true, ph: true, ps: true, ex: true,
          ld: true, mo: true, overall: true,
        },
      },
    },
  });

  const sumSeasonW = (config.latestWeight || 0) + (config.previousWeight || 0);
  const REC_CUR = sumSeasonW > 0 ? config.latestWeight / sumSeasonW : 0.8;
  const REC_LAST = sumSeasonW > 0 ? config.previousWeight / sumSeasonW : 0.2;

  const blendVal = (c: number | null | undefined, l: number | null | undefined) => {
    const hasC = c != null && !isNaN(c);
    const hasL = l != null && !isNaN(l);
    if (hasC && hasL) return c * REC_CUR + l * REC_LAST;
    if (hasC) return c;
    if (hasL) return l;
    return null;
  };

  type GoalieRawRow = {
    id: number;
    player: (typeof goalies)[number];
    curGP: number;
    lastGP: number;
    shots: number;
    metrics: Record<string, number | null>;
    stats: {
      svPct: number | null;
      gaa: number | null;
      gsax: number | null;
      gsax60: number | null;
      hdSv: number | null;
      mdSv: number | null;
      ldSv: number | null;
      rebCtrl: number | null;
      freezePct: number | null;
      toi: number | null;
      shots: number | null;
    };
  };

  const rows: GoalieRawRow[] = [];

  for (const g of goalies) {
    const adv = (g.goalieAdvanced as any) ?? {};
    const c = adv.cur;
    const l = adv.last;

    const curGP = c?.gp ?? g.curSeasonGP ?? 0;
    const lastGP = l?.gp ?? g.lastSeasonGP ?? 0;
    const totalShots = (c?.shots ?? 0) + (l?.shots ?? 0);

    const m: Record<string, number | null> = {
      ldSv: blendVal(c?.ldSv, l?.ldSv),
      mdSv: blendVal(c?.mdSv, l?.mdSv),
      hdSv: blendVal(c?.hdSv, l?.hdSv),
      gsax: blendVal(c?.gsax, l?.gsax),
      gsax60: blendVal(c?.gsax60, l?.gsax60),
      hdGsax: blendVal(c?.hdGsax, l?.hdGsax),
      rebCtrl: blendVal(c?.rebCtrl, l?.rebCtrl),
      freezePct: blendVal(c?.freezePct, l?.freezePct),
      icetime: blendVal(c?.icetime, l?.icetime),
      sz: heightCm(g.height),
      weight: g.weight != null && g.weight > 0 ? g.weight : null,
      careerRegGP: (g.careerGP as any)?.reg ?? null,
      careerPoGP: (g.careerGP as any)?.po ?? null,
      age: g.age ?? null,
      svPct: blendVal(c?.svPct, l?.svPct),
      gaa: blendVal(c?.gaa, l?.gaa),
    };

    // Calculate any custom metrics defined in config
    const customList = Object.values(config.goalieWeights.customMetrics ?? {}).flat();
    for (const cm of customList) {
      if (!m[cm.metricKey]) {
        const item = GOALIE_METRIC_BY_KEY[cm.metricKey];
        if (item) {
          m[cm.metricKey] = item.getValue(g, {
            latestMpYear: config.latestMpYear,
            previousMpYear: config.previousMpYear,
            latestWeight: config.latestWeight,
            previousWeight: config.previousWeight,
          });
        }
      }
    }

    rows.push({
      id: g.id,
      player: g,
      curGP,
      lastGP,
      shots: totalShots,
      metrics: m,
      stats: {
        svPct: m.svPct,
        gaa: m.gaa,
        gsax: m.gsax,
        gsax60: m.gsax60,
        hdSv: m.hdSv,
        mdSv: m.mdSv,
        ldSv: m.ldSv,
        rebCtrl: m.rebCtrl,
        freezePct: m.freezePct,
        toi: m.icetime,
        shots: totalShots,
      },
    });
  }

  // Sample regression on rate-based stats
  const perfKeys = new Set(["ldSv", "mdSv", "hdSv", "gsax60", "hdGsax", "rebCtrl", "freezePct", "svPct", "gaa"]);
  const metricKeys = Object.keys(rows[0]?.metrics ?? {});
  const means: Record<string, number> = {};

  for (const k of metricKeys) {
    const vals = rows.map((r) => r.metrics[k]).filter((v): v is number => v != null);
    means[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  const reg = (r: GoalieRawRow, k: string): number | null => {
    const raw = r.metrics[k];
    if (raw == null) return null;
    if (!perfKeys.has(k)) return raw;
    const rel = r.shots / (r.shots + GOALIE_REG_K);
    return raw * rel + means[k] * (1 - rel);
  };

  const pops: Record<string, number[]> = {};
  for (const k of metricKeys) {
    pops[k] = rows.map((r) => reg(r, k)).filter((v): v is number => v != null).sort((a, b) => a - b);
  }

  // Reference distribution from existing GoalieRating table in database
  const sthsRef: Record<string, number[]> = {};
  for (const k of Object.values(GOALIE_CAL_MAP)) sthsRef[k] = [];
  for (const g of goalies) {
    if (!g.goalieRating) continue;
    for (const [P, col] of Object.entries(GOALIE_CAL_MAP)) {
      const v = (g.goalieRating as any)[col];
      if (v != null) sthsRef[col].push(v);
    }
  }
  for (const k of Object.values(GOALIE_CAL_MAP)) sthsRef[k].sort((a, b) => a - b);

  const gw = config.goalieWeights;

  type ProjectedGoalie = {
    id: number;
    classification: "NHL" | "AHL/FARM";
    status: string;
    ratings: Record<string, number>;
    rawRatings: Record<string, number>;
    row: GoalieRawRow;
  };

  const projectedList: ProjectedGoalie[] = rows.map((r) => {
    const ratings: Record<string, number> = {};
    const hasShots = r.shots > 0;
    const isNhl = r.player.rosterType === "NHL" || (r.curGP >= 5 && hasShots);

    // Helper to compute weighted percentile composite for a param
    const comp = (weightsMap: Record<string, number>, paramKey: string): number | null => {
      let wsum = 0;
      let wtot = 0;

      for (const [k, w] of Object.entries(weightsMap)) {
        if (w <= 0) continue;
        const v = reg(r, k);
        if (v == null) continue;
        const pArr = pops[k];
        if (!pArr || !pArr.length) continue;
        let pct = percentileOf(v, pArr);
        if (k === "gaa") pct = 1 - pct;
        wsum += pct * w;
        wtot += w;
      }

      // Add custom metrics if defined for this param
      const customs = gw.customMetrics?.[paramKey.toLowerCase()] ?? [];
      for (const cm of customs) {
        if (cm.weight <= 0) continue;
        const v = reg(r, cm.metricKey);
        if (v == null) continue;
        const pArr = pops[cm.metricKey];
        if (!pArr || !pArr.length) continue;
        let pct = percentileOf(v, pArr);
        if (cm.invert) pct = 1 - pct;
        wsum += pct * cm.weight;
        wtot += cm.weight;
      }

      if (wtot <= 0) return null;
      const finalPct = wsum / wtot;
      return 50 + finalPct * 45; // map 0..1 to 50..95 raw score
    };

    // Style Control (SC)
    ratings.SC = comp(gw.sc, "sc") ?? 70;

    // Reaction Time (RT)
    ratings.RT = comp(gw.rt, "rt") ?? 70;

    // Hand Speed (HS)
    ratings.HS = comp(gw.hs, "hs") ?? 70;

    // Agility (AG)
    ratings.AG = comp(gw.ag, "ag") ?? 70;

    // Rebound Control (RB)
    ratings.RB = comp(gw.rb, "rb") ?? 70;

    // Endurance (EN)
    ratings.EN = comp(gw.en, "en") ?? 70;

    // Size (SZ)
    const szVal = r.metrics.sz;
    if (szVal != null && pops.sz && pops.sz.length) {
      const pct = percentileOf(szVal, pops.sz);
      ratings.SZ = Math.round(60 + pct * 30);
    } else {
      ratings.SZ = r.player.goalieRating?.sz ?? 75;
    }

    // Experience (EX)
    const regGP = (r.player.careerGP as any)?.reg ?? (r.player.age ? Math.max(0, (r.player.age - 21) * 35) : 100);
    const poGP = (r.player.careerGP as any)?.po ?? 0;
    const careerTot = regGP * gw.ex.careerRegGP + poGP * gw.ex.careerPoGP;
    const exPct = Math.min(1, Math.max(0, careerTot / 600));
    ratings.EX = Math.round(50 + exPct * 40);

    // Durability (DU)
    const curAvailability = r.curGP / 82;
    const lastAvailability = r.lastGP / 82;
    const avail = curAvailability * REC_CUR + lastAvailability * REC_LAST;
    ratings.DU = Math.round(55 + Math.min(1, Math.max(0, avail * 1.5)) * 35);

    // Puck Handling (PH)
    ratings.PH = comp(gw.ph, "ph") ?? 65;

    // Skating (SK)
    ratings.SK = comp(gw.sk, "sk") ?? ratings.AG ?? 70;

    // Penalty Shot (PS)
    ratings.PS = comp(gw.ps, "ps") ?? ratings.RT ?? 70;

    // Leadership (LD)
    const isCapt = Boolean(r.player.captaincy);
    ratings.LD = Math.round(Math.min(95, Math.max(50, ratings.EX * 0.85 + (isCapt ? 15 : 0))));

    // Morale (MO) - UNTOUCHED! Retain current or fallback 50
    ratings.MO = r.player.goalieRating?.mo ?? 50;

    // Core Average for Overall (OV)
    const core = [ratings.SC, ratings.RT, ratings.HS, ratings.AG, ratings.RB, ratings.EN, ratings.SZ];
    ratings.OV = Math.round(core.reduce((a, b) => a + b, 0) / core.length);

    return {
      id: r.id,
      classification: isNhl ? "NHL" : "AHL/FARM",
      status: hasShots ? (r.curGP >= 10 ? "V10 Live NHL" : "V10 Low GP") : "STHS Baseline",
      ratings: { ...ratings },
      rawRatings: { ...ratings },
      row: r,
    };
  });

  // Quantile calibration to STHS scale so ratings match the real simulator distribution
  for (const [P, col] of Object.entries(GOALIE_CAL_MAP)) {
    if (P === "MO") continue; // Never touch morale!
    const es = statsOf(projectedList.map((p) => p.rawRatings[P]).filter((v): v is number => v != null));
    const ss = statsOf(sthsRef[col] ?? []);
    if (!es || !ss || ss.std < 1) continue;

    for (const p of projectedList) {
      if (p.rawRatings[P] != null) {
        p.ratings[P] = affine(p.rawRatings[P], es, ss);
      }
    }
  }

  // Recalculate Overall after calibration
  for (const p of projectedList) {
    const core = [p.ratings.SC, p.ratings.RT, p.ratings.HS, p.ratings.AG, p.ratings.RB, p.ratings.EN, p.ratings.SZ];
    p.ratings.OV = Math.round(core.reduce((a, b) => a + b, 0) / core.length);
  }

  // Save results to database in Player.liveCalculatorRatings
  const CHUNK = 100;
  let nhlCount = 0;
  let ahlCount = 0;

  for (let i = 0; i < projectedList.length; i += CHUNK) {
    const chunk = projectedList.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((item) => {
        if (item.classification === "NHL") nhlCount++;
        else ahlCount++;

        const actualRatings: Record<string, number | null> = {
          sk: item.row.player.goalieRating?.sk ?? null,
          du: item.row.player.goalieRating?.du ?? null,
          en: item.row.player.goalieRating?.en ?? null,
          sz: item.row.player.goalieRating?.sz ?? null,
          ag: item.row.player.goalieRating?.ag ?? null,
          rb: item.row.player.goalieRating?.rb ?? null,
          sc: item.row.player.goalieRating?.sc ?? null,
          hs: item.row.player.goalieRating?.hs ?? null,
          rt: item.row.player.goalieRating?.rt ?? null,
          ph: item.row.player.goalieRating?.ph ?? null,
          ps: item.row.player.goalieRating?.ps ?? null,
          ex: item.row.player.goalieRating?.ex ?? null,
          ld: item.row.player.goalieRating?.ld ?? null,
          mo: item.row.player.goalieRating?.mo ?? 50,
          ov: item.row.player.goalieRating?.overall ?? item.row.player.overall ?? null,
        };

        const projectedRatings: Record<string, number | null> = {
          sk: item.ratings.SK ?? actualRatings.sk,
          du: item.ratings.DU ?? actualRatings.du,
          en: item.ratings.EN ?? actualRatings.en,
          sz: item.ratings.SZ ?? actualRatings.sz,
          ag: item.ratings.AG ?? actualRatings.ag,
          rb: item.ratings.RB ?? actualRatings.rb,
          sc: item.ratings.SC ?? actualRatings.sc,
          hs: item.ratings.HS ?? actualRatings.hs,
          rt: item.ratings.RT ?? actualRatings.rt,
          ph: item.ratings.PH ?? actualRatings.ph,
          ps: item.ratings.PS ?? actualRatings.ps,
          ex: item.ratings.EX ?? actualRatings.ex,
          ld: item.ratings.LD ?? actualRatings.ld,
          mo: actualRatings.mo, // Always retain actual morale
          ov: item.ratings.OV ?? actualRatings.ov,
        };

        const deltaRatings: Record<string, number> = {};
        for (const k of GOALIE_PARAMS) {
          const act = actualRatings[k] ?? 50;
          const prj = projectedRatings[k] ?? act;
          deltaRatings[k] = prj - act;
        }

        const actOv = actualRatings.ov ?? 60;
        const prjOv = projectedRatings.ov ?? actOv;

        const blob = {
          classification: item.classification,
          status: item.status,
          nhlGpLatest: item.row.curGP,
          nhlGpPrevious: item.row.lastGP,
          calculatedAt: new Date().toISOString(),
          actual: actualRatings,
          projected: projectedRatings,
          delta: deltaRatings,
          overallActual: actOv,
          overallProjected: prjOv,
          overallDelta: prjOv - actOv,
          stats: item.row.stats,
        };

        return prisma.player.update({
          where: { id: item.id },
          data: { liveCalculatorRatings: blob as any },
        });
      })
    );
  }

  console.log(`[LiveCalcGoalieEngine] Finished. Processed ${projectedList.length} goalies (${nhlCount} NHL, ${ahlCount} AHL).`);

  return {
    totalProcessed: projectedList.length,
    nhlCount,
    ahlCount,
    timestamp: new Date().toISOString(),
  };
}
