import { prisma } from "./prisma";
import { CURRENT_SEASON_START } from "./finance";
import { type RookieTuningConfig, DEFAULT_ROOKIE_TUNING } from "./edge-params";

/** The real NHL season ids ("20262027") for the current and prior season, derived
 *  from today's date (CURRENT_SEASON_START itself rolls over every July 1) — NOT
 *  a stored, admin-set value. The whole point of a "Live" calculator is that it
 *  always tracks the real, current season without anyone having to remember to
 *  bump a setting once a year; MoneyPuck's own year (latestMpYear/previousMpYear
 *  below) stays admin-editable separately, since MoneyPuck's CSV for a brand new
 *  season can lag behind the real calendar by days/weeks. */
function deriveNhlSeasons(): { latestSeason: string; previousSeason: string } {
  return {
    latestSeason: `${CURRENT_SEASON_START}${CURRENT_SEASON_START + 1}`,
    previousSeason: `${CURRENT_SEASON_START - 1}${CURRENT_SEASON_START}`,
  };
}

export type CustomMetricConfig = {
  id: string;
  metricKey: string;
  label: string;
  source: string;
  weight: number;
  invert: boolean;
};

export type LiveCalcWeights = {
  pa: { apg: number; a60All: number; a60_5v5: number };
  sc: { gpg: number; g60: number; xg60: number; g_xg60: number };
  dfD: { pkToiPg: number; xga5: number; relXga5: number; ga5: number; relXgaPk: number; blk60: number; xgfPct: number };
  dfF: { pkToiPg: number; relXgaPk: number; relXga5: number; xga5: number; ga5: number; xgfPct: number; blk60: number };
  ck: { hit60: number; hitPg: number };
  di: { penaltyBalance: number; invPim60: number };
  /** PH is position-specific: defenders' zone time is far less indicative of
   * individual puck skill than it is for forwards. */
  phF: { turnoverProtection: number; offensiveZoneTime: number; takeaways60: number };
  phD: { turnoverProtection: number; offensiveZoneTime: number; takeaways60: number };
  sk: { edgeBursts20: number };
  st: { weightPct: number };
  ex: { careerRegGP: number; careerPoGP: number };
  customMetrics?: Record<string, CustomMetricConfig[]>;
  /** Rookie Calculator's own tuning knobs (small-sample penalty bands/params/floor,
   *  debutant scanner GP filter — see RookieTuningConfig in lib/edge-params.ts),
   *  admin-tunable from the Rookie Calculator's own "Tuning" panel, independent of
   *  every other Live Calculator weight above and never touching the shared Next
   *  Gen/Edge engine used by the league-wide Next Gen Parameters calculator. */
  rookie?: RookieTuningConfig;
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
  phF: { turnoverProtection: 0.55, offensiveZoneTime: 0.30, takeaways60: 0.15 },
  phD: { turnoverProtection: 0.70, offensiveZoneTime: 0.10, takeaways60: 0.20 },
  sk: { edgeBursts20: 1.0 },
  st: { weightPct: 1.0 },
  ex: { careerRegGP: 0.70, careerPoGP: 0.30 },
  customMetrics: {},
  rookie: DEFAULT_ROOKIE_TUNING,
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

export type LiveCalcGoalieWeights = {
  sc: { ldSv: number; mdSv: number; gsax60: number };
  rt: { hdSv: number; hdGsax: number };
  hs: { hdSv: number; gsax60: number };
  ag: { mdSv: number; hdSv: number };
  rb: { rebCtrl: number };
  en: { icetime: number };
  sz: { sz: number };
  ex: { careerRegGP: number; careerPoGP: number };
  du: { availability: number };
  ph: { freezePct: number };
  sk: { agility: number };
  ps: { hdSv: number };
  ld: { experience: number };
  customMetrics?: Record<string, CustomMetricConfig[]>;
};

export const DEFAULT_GOALIE_WEIGHTS: LiveCalcGoalieWeights = {
  sc: { ldSv: 0.40, mdSv: 0.35, gsax60: 0.25 },
  rt: { hdSv: 0.60, hdGsax: 0.40 },
  hs: { hdSv: 0.50, gsax60: 0.50 },
  ag: { mdSv: 0.50, hdSv: 0.50 },
  rb: { rebCtrl: 1.0 },
  en: { icetime: 1.0 },
  sz: { sz: 1.0 },
  ex: { careerRegGP: 0.70, careerPoGP: 0.30 },
  du: { availability: 1.0 },
  ph: { freezePct: 1.0 },
  sk: { agility: 1.0 },
  ps: { hdSv: 1.0 },
  ld: { experience: 1.0 },
  customMetrics: {},
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
  goalieWeights: LiveCalcGoalieWeights;
  managerTeamIds?: number[];
  lastCalculatedAt: Date | null;
  lastSyncedAt: Date | null;
};

export const DEFAULT_CONFIG: LiveCalcConfigData = {
  latestSeason: "20262027",
  previousSeason: "20252026",
  latestMpYear: 2026,
  previousMpYear: 2025,
  latestWeight: 0.8,
  previousWeight: 0.2,
  nhlGpLatestMin: 1,
  nhlGpPrevMin: 10,
  ahlNhleLatest: 0.446,
  ahlNhlePrevious: 0.448,
  weights: DEFAULT_LIVE_CALC_WEIGHTS,
  goalieWeights: DEFAULT_GOALIE_WEIGHTS,
  managerTeamIds: [],
  lastCalculatedAt: null,
  lastSyncedAt: null,
};

/** Load the current Live Calculator configuration, falling back to defaults if not yet created. */
export async function getLiveCalculatorConfig(): Promise<LiveCalcConfigData> {
  try {
    const row = await prisma.liveCalcConfig.findUnique({ where: { id: 1 } });
    if (!row) return { ...DEFAULT_CONFIG, ...deriveNhlSeasons() };

    let weights = DEFAULT_LIVE_CALC_WEIGHTS;
    let goalieWeights = DEFAULT_GOALIE_WEIGHTS;
    if (row.weightsJson && typeof row.weightsJson === "object") {
      const wj = row.weightsJson as any;
      weights = {
        ...DEFAULT_LIVE_CALC_WEIGHTS,
        ...(wj as Partial<LiveCalcWeights>),
      };
      if (wj.goalieWeights && typeof wj.goalieWeights === "object") {
        goalieWeights = {
          ...DEFAULT_GOALIE_WEIGHTS,
          ...wj.goalieWeights,
        };
      }
    }

    return {
      ...deriveNhlSeasons(),
      latestMpYear: row.latestMpYear || DEFAULT_CONFIG.latestMpYear,
      previousMpYear: row.previousMpYear || DEFAULT_CONFIG.previousMpYear,
      latestWeight: row.latestWeight ?? DEFAULT_CONFIG.latestWeight,
      previousWeight: row.previousWeight ?? DEFAULT_CONFIG.previousWeight,
      nhlGpLatestMin: row.nhlGpLatestMin ?? DEFAULT_CONFIG.nhlGpLatestMin,
      nhlGpPrevMin: row.nhlGpPrevMin ?? DEFAULT_CONFIG.nhlGpPrevMin,
      ahlNhleLatest: row.ahlNhleLatest ?? DEFAULT_CONFIG.ahlNhleLatest,
      ahlNhlePrevious: row.ahlNhlePrevious ?? DEFAULT_CONFIG.ahlNhlePrevious,
      weights,
      goalieWeights,
      managerTeamIds: row.managerTeamIds ?? [],
      lastCalculatedAt: row.lastCalculatedAt,
      lastSyncedAt: row.lastSyncedAt,
    };
  } catch (err) {
    console.error("[LiveCalculatorConfig] Failed to load config, using defaults:", err);
    return { ...DEFAULT_CONFIG, ...deriveNhlSeasons() };
  }
}

/** Same as Partial<LiveCalcConfigData>, but weights/goalieWeights only need to
 *  carry the sub-keys actually being changed (e.g. just `rookie`) — the merge
 *  below is shallow at the top level of `weights`, so a caller updating one
 *  group (pa/sc/rookie/...) doesn't have to round-trip every other group too. */
export type LiveCalcConfigUpdate = Omit<Partial<LiveCalcConfigData>, "weights" | "goalieWeights"> & {
  weights?: Partial<LiveCalcWeights>;
  goalieWeights?: Partial<LiveCalcGoalieWeights>;
};

/** Update Live Calculator configuration. */
export async function updateLiveCalculatorConfig(data: LiveCalcConfigUpdate): Promise<LiveCalcConfigData> {
  const current = await getLiveCalculatorConfig();
  const merged: LiveCalcConfigData = {
    ...current,
    ...data,
    managerTeamIds: data.managerTeamIds ?? current.managerTeamIds ?? [],
    weights: {
      ...current.weights,
      ...(data.weights ?? {}),
    },
    goalieWeights: {
      ...current.goalieWeights,
      ...(data.goalieWeights ?? {}),
    },
  };

  const weightsJsonToSave = {
    ...merged.weights,
    goalieWeights: merged.goalieWeights,
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
      weightsJson: weightsJsonToSave as any,
      managerTeamIds: merged.managerTeamIds ?? [],
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
      weightsJson: weightsJsonToSave as any,
      managerTeamIds: merged.managerTeamIds ?? [],
    },
  });

  return merged;
}
