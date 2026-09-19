import { prisma } from "./prisma";

export type LiveCalcWeights = {
  pa: { apg: number; a60All: number; a60_5v5: number };
  sc: { gpg: number; g60: number; xg60: number; g_xg60: number };
  dfD: { pkToiPg: number; xga5: number; relXga5: number; ga5: number; relXgaPk: number; blk60: number; xgfPct: number };
  dfF: { pkToiPg: number; relXgaPk: number; relXga5: number; xga5: number; ga5: number; xgfPct: number; blk60: number };
  ck: { hit60: number; hitPg: number };
  di: { penaltyBalance: number; invPim60: number };
  sk: { edgeBursts20: number };
  st: { weightPct: number };
  ex: { careerRegGP: number; careerPoGP: number };
  ahl: {
    scEqGpg: number;
    scShots: number;
    scShPct: number;
    paEqApg: number;
    paRank: number;
    dfOldPrior: number;
    dfPlusMinus: number;
    dfPim: number;
    dfSh: number;
    diOldPrior: number;
    diPim: number;
  };
};

export const DEFAULT_LIVE_CALC_WEIGHTS: LiveCalcWeights = {
  pa: { apg: 0.45, a60All: 0.30, a60_5v5: 0.25 },
  sc: { gpg: 0.45, g60: 0.25, xg60: 0.20, g_xg60: 0.10 },
  dfD: { pkToiPg: 0.25, xga5: 0.15, relXga5: 0.10, ga5: 0.20, relXgaPk: 0.10, blk60: 0.10, xgfPct: 0.10 },
  dfF: { pkToiPg: 0.30, relXgaPk: 0.15, relXga5: 0.15, xga5: 0.15, ga5: 0.10, xgfPct: 0.10, blk60: 0.05 },
  ck: { hit60: 0.60, hitPg: 0.40 },
  di: { penaltyBalance: 0.60, invPim60: 0.40 },
  sk: { edgeBursts20: 1.0 },
  st: { weightPct: 1.0 },
  ex: { careerRegGP: 0.70, careerPoGP: 0.30 },
  ahl: {
    scEqGpg: 0.80,
    scShots: 0.10,
    scShPct: 0.10,
    paEqApg: 0.85,
    paRank: 0.15,
    dfOldPrior: 0.60,
    dfPlusMinus: 0.25,
    dfPim: 0.10,
    dfSh: 0.05,
    diOldPrior: 0.60,
    diPim: 0.40,
  },
};

export type LiveCalcConfigData = {
  latestSeason: string;
  previousSeason: string;
  latestMpYear: number;
  previousMpYear: number;
  latestWeight: number;
  previousWeight: number;
  nhlGpLatestMin: number;
  nhlGpPrevMin: number;
  ahlNhleLatest: number;
  ahlNhlePrevious: number;
  weights: LiveCalcWeights;
  lastCalculatedAt: Date | null;
  lastSyncedAt: Date | null;
};

export const DEFAULT_CONFIG: LiveCalcConfigData = {
  latestSeason: "20252026",
  previousSeason: "20242025",
  latestMpYear: 2025,
  previousMpYear: 2024,
  latestWeight: 0.8,
  previousWeight: 0.2,
  nhlGpLatestMin: 10,
  nhlGpPrevMin: 10,
  ahlNhleLatest: 0.446,
  ahlNhlePrevious: 0.448,
  weights: DEFAULT_LIVE_CALC_WEIGHTS,
  lastCalculatedAt: null,
  lastSyncedAt: null,
};

/** Load the current Live Calculator configuration, falling back to defaults if not yet created. */
export async function getLiveCalculatorConfig(): Promise<LiveCalcConfigData> {
  try {
    const row = await prisma.liveCalcConfig.findUnique({ where: { id: 1 } });
    if (!row) return DEFAULT_CONFIG;

    let weights = DEFAULT_LIVE_CALC_WEIGHTS;
    if (row.weightsJson && typeof row.weightsJson === "object") {
      weights = {
        ...DEFAULT_LIVE_CALC_WEIGHTS,
        ...(row.weightsJson as Partial<LiveCalcWeights>),
      };
    }

    return {
      latestSeason: row.latestSeason || DEFAULT_CONFIG.latestSeason,
      previousSeason: row.previousSeason || DEFAULT_CONFIG.previousSeason,
      latestMpYear: row.latestMpYear || DEFAULT_CONFIG.latestMpYear,
      previousMpYear: row.previousMpYear || DEFAULT_CONFIG.previousMpYear,
      latestWeight: row.latestWeight ?? DEFAULT_CONFIG.latestWeight,
      previousWeight: row.previousWeight ?? DEFAULT_CONFIG.previousWeight,
      nhlGpLatestMin: row.nhlGpLatestMin ?? DEFAULT_CONFIG.nhlGpLatestMin,
      nhlGpPrevMin: row.nhlGpPrevMin ?? DEFAULT_CONFIG.nhlGpPrevMin,
      ahlNhleLatest: row.ahlNhleLatest ?? DEFAULT_CONFIG.ahlNhleLatest,
      ahlNhlePrevious: row.ahlNhlePrevious ?? DEFAULT_CONFIG.ahlNhlePrevious,
      weights,
      lastCalculatedAt: row.lastCalculatedAt,
      lastSyncedAt: row.lastSyncedAt,
    };
  } catch (err) {
    console.error("[LiveCalculatorConfig] Failed to load config, using defaults:", err);
    return DEFAULT_CONFIG;
  }
}

/** Update Live Calculator configuration. */
export async function updateLiveCalculatorConfig(data: Partial<LiveCalcConfigData>): Promise<LiveCalcConfigData> {
  const current = await getLiveCalculatorConfig();
  const merged: LiveCalcConfigData = {
    ...current,
    ...data,
    weights: {
      ...current.weights,
      ...(data.weights ?? {}),
    },
  };

  await prisma.liveCalcConfig.upsert({
    where: { id: 1 },
    update: {
      latestSeason: merged.latestSeason,
      previousSeason: merged.previousSeason,
      latestMpYear: merged.latestMpYear,
      previousMpYear: merged.previousMpYear,
      latestWeight: merged.latestWeight,
      previousWeight: merged.previousWeight,
      nhlGpLatestMin: merged.nhlGpLatestMin,
      nhlGpPrevMin: merged.nhlGpPrevMin,
      ahlNhleLatest: merged.ahlNhleLatest,
      ahlNhlePrevious: merged.ahlNhlePrevious,
      weightsJson: merged.weights as any,
    },
    create: {
      id: 1,
      latestSeason: merged.latestSeason,
      previousSeason: merged.previousSeason,
      latestMpYear: merged.latestMpYear,
      previousMpYear: merged.previousMpYear,
      latestWeight: merged.latestWeight,
      previousWeight: merged.previousWeight,
      nhlGpLatestMin: merged.nhlGpLatestMin,
      nhlGpPrevMin: merged.nhlGpPrevMin,
      ahlNhleLatest: merged.ahlNhleLatest,
      ahlNhlePrevious: merged.ahlNhlePrevious,
      weightsJson: merged.weights as any,
    },
  });

  return merged;
}
