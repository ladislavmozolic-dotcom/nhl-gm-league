/**
 * Unified Metric Catalog for Live Calculator.
 * Supports dynamic addition of metrics from multiple data servers:
 * - NHL API / Boxscore
 * - MoneyPuck Advanced Analytics
 * - NHL EDGE Tracking
 * - AHL HockeyTech
 * - Biometrics / Profile
 */

export type MetricSource = "nhl" | "moneypuck" | "edge" | "ahl" | "bio";

export type MetricSourceMeta = {
  id: MetricSource;
  name: string;
  badge: string;
  color: string;
  description: string;
};

export const METRIC_SOURCES: Record<MetricSource, MetricSourceMeta> = {
  nhl: {
    id: "nhl",
    name: "NHL API / Boxscore",
    badge: "NHL",
    color: "text-sky-400 bg-sky-500/10 border-sky-500/30",
    description: "Official game statistics and game situations (TOI, penalty kills, faceoffs, hits, blocks, +/-).",
  },
  moneypuck: {
    id: "moneypuck",
    name: "MoneyPuck Analytics",
    badge: "MoneyPuck",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    description: "Advanced analytics (xG, relative xGA 5v5/PK, finishing, primary assists).",
  },
  edge: {
    id: "edge",
    name: "NHL EDGE Tracking",
    badge: "EDGE",
    color: "text-teal-400 bg-teal-500/10 border-teal-500/30",
    description: "Sensor movement measurements (speed bursts > 20 mph, top speed, distance).",
  },
  ahl: {
    id: "ahl",
    name: "AHL HockeyTech",
    badge: "AHL",
    color: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    description: "Official AHL data with the option to apply NHLe coefficients.",
  },
  bio: {
    id: "bio",
    name: "Biometrics & Career",
    badge: "BIO",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    description: "Physical and career attributes (weight, age, regular-season and playoff games played).",
  },
};

export type CatalogMetricItem = {
  key: string;
  label: string;
  source: MetricSource;
  description: string;
  defaultInvert: boolean;
  unit?: string;
  getValue: (
    player: any,
    config: {
      latestMpYear: number;
      previousMpYear: number;
      latestWeight: number;
      previousWeight: number;
      ahlNhleLatest?: number;
      ahlNhlePrevious?: number;
    }
  ) => number | null;
};

// Safe helper utilities
const safeRate = (val: number | null | undefined, gp: number): number | null =>
  val != null && gp > 0 ? val / gp : null;

const safePer60 = (count: number | null | undefined, toiSec: number | null | undefined): number | null =>
  count != null && toiSec != null && toiSec > 0 ? (count / toiSec) * 3600 : null;

const blend = (
  curVal: number | null | undefined,
  lastVal: number | null | undefined,
  curGP: number,
  lastGP: number,
  wCur: number,
  wLast: number
): number | null => {
  const hasC = curVal != null && !isNaN(curVal) && curGP > 0;
  const hasL = lastVal != null && !isNaN(lastVal) && lastGP > 0;
  if (hasC && hasL) {
    const sumW = (wCur || 0) + (wLast || 0);
    const normCur = sumW > 0 ? wCur / sumW : 0.8;
    const normLast = sumW > 0 ? wLast / sumW : 0.2;
    return curVal! * normCur + lastVal! * normLast;
  }
  if (hasC) return curVal!;
  if (hasL) return lastVal!;
  return null;
};

export const CATALOG_METRICS: CatalogMetricItem[] = [
  // ========================= NHL API =========================
  {
    key: "teamPkToiPg",
    label: "Team PK TOI/GP",
    source: "nhl",
    description: "Average time per game the team spends shorthanded (in seconds or minutes).",
    defaultInvert: false,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = p.curSeasonTeamShToi != null ? p.curSeasonTeamShToi / 60 : null;
      const l = p.lastSeasonShToi != null ? p.lastSeasonShToi / 60 : null; // fallback
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "playerPkToiPg",
    label: "Player PK TOI/GP",
    source: "nhl",
    description: "Average time the player spends on ice shorthanded per game.",
    defaultInvert: false,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = p.curSeasonShToi != null ? p.curSeasonShToi / 60 : null;
      const l = p.lastSeasonShToi != null ? p.lastSeasonShToi / 60 : null;
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "totalToiPg",
    label: "Total TOI/GP",
    source: "nhl",
    description: "Average total time on ice per game in all game situations.",
    defaultInvert: false,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = p.curSeasonToi != null ? p.curSeasonToi / 60 : null;
      const l = p.lastSeasonToi != null ? p.lastSeasonToi / 60 : null;
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "foPct",
    label: "Faceoff %",
    source: "nhl",
    description: "Faceoff win percentage (centers).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      return blend(p.curSeasonFoPct, p.lastSeasonFoPct, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "tk60",
    label: "Takeaways / 60",
    source: "nhl",
    description: "Number of pucks taken from the opponent per 60 minutes on ice.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const cToi = (p.curSeasonToi ?? 0) * cGP;
      const lToi = (p.lastSeasonToi ?? 0) * lGP;
      const c = safePer60(p.curSeasonTK, cToi);
      const l = safePer60(p.lastSeasonTK, lToi);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "gv60",
    label: "Giveaways / 60",
    source: "nhl",
    description: "Number of pucks lost per 60 minutes on ice (lower is better).",
    defaultInvert: true,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const cToi = (p.curSeasonToi ?? 0) * cGP;
      const lToi = (p.lastSeasonToi ?? 0) * lGP;
      const c = safePer60(p.curSeasonGV, cToi);
      const l = safePer60(p.lastSeasonGV, lToi);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "pmPg",
    label: "+/- per Game",
    source: "nhl",
    description: "Balance of involvement in goals scored and allowed per game.",
    defaultInvert: false,
    unit: "+/- / GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonPM, cGP);
      const l = safeRate(p.lastSeasonPM, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "pimPg",
    label: "PIM / GP",
    source: "nhl",
    description: "Penalty minutes per game (less is better).",
    defaultInvert: true,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonPim, cGP);
      const l = safeRate(p.lastSeasonPim, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ppgPg",
    label: "Powerplay Goals / GP",
    source: "nhl",
    description: "Goals scored on the power play per game.",
    defaultInvert: false,
    unit: "G/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonPpG, cGP);
      const l = safeRate(p.lastSeasonPpG, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "shotsPg",
    label: "Shots / GP",
    source: "nhl",
    description: "Average number of shots on goal per game.",
    defaultInvert: false,
    unit: "S/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonShots, cGP);
      const l = safeRate(p.lastSeasonShots, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "hitsPg",
    label: "Hits / GP",
    source: "nhl",
    description: "Average number of hits delivered per game.",
    defaultInvert: false,
    unit: "Hits/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonHits, cGP);
      const l = safeRate(p.lastSeasonHits, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "blocksPg",
    label: "Blocks / GP",
    source: "nhl",
    description: "Average number of opponent shots blocked per game.",
    defaultInvert: false,
    unit: "Blk/GP",
    getValue: (p, cfg) => {
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      const c = safeRate(p.curSeasonBlocks, cGP);
      const l = safeRate(p.lastSeasonBlocks, lGP);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },

  // ========================= MONEYPUCK =========================
  {
    key: "xga5",
    label: "On-Ice xGA/60 5v5",
    source: "moneypuck",
    description: "Opponent's expected goals against per 60 minutes at 5-on-5.",
    defaultInvert: true,
    unit: "xGA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.onIceAxg5v5, c.toi5v5);
      const lVal = safePer60(l.onIceAxg5v5, l.toi5v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "offXga5",
    label: "Off-Ice xGA/60 5v5",
    source: "moneypuck",
    description: "The team's defensive level when the player is off the ice at 5v5.",
    defaultInvert: false,
    unit: "xGA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.offIceAxg5v5, c.offIceToi5v5);
      const lVal = safePer60(l.offIceAxg5v5, l.offIceToi5v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "relXga5",
    label: "Rel xGA/60 5v5",
    source: "moneypuck",
    description: "Difference in the opponent's expected goals with him vs without him at 5v5.",
    defaultInvert: true,
    unit: "Rel xGA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cOn = safePer60(c.onIceAxg5v5, c.toi5v5);
      const cOff = safePer60(c.offIceAxg5v5, c.offIceToi5v5);
      const cVal = cOn != null && cOff != null ? cOn - cOff : null;

      const lOn = safePer60(l.onIceAxg5v5, l.toi5v5);
      const lOff = safePer60(l.offIceAxg5v5, l.offIceToi5v5);
      const lVal = lOn != null && lOff != null ? lOn - lOff : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ga5",
    label: "On-Ice GA/60 5v5",
    source: "moneypuck",
    description: "Actual goals allowed by the team per 60 minutes at 5-on-5.",
    defaultInvert: true,
    unit: "GA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.onIceGa5v5, c.toi5v5);
      const lVal = safePer60(l.onIceGa5v5, l.toi5v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "relGa5",
    label: "Rel GA/60 5v5",
    source: "moneypuck",
    description: "Difference in the opponent's real goals on ice vs off ice.",
    defaultInvert: true,
    unit: "Rel GA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cOn = safePer60(c.onIceGa5v5, c.toi5v5);
      const cOff = safePer60(c.offIceGa5v5, c.offIceToi5v5);
      const cVal = cOn != null && cOff != null ? cOn - cOff : null;

      const lOn = safePer60(l.onIceGa5v5, l.toi5v5);
      const lOff = safePer60(l.offIceGa5v5, l.offIceToi5v5);
      const lVal = lOn != null && lOff != null ? lOn - lOff : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "xgaPk",
    label: "On-Ice xGA/60 PK",
    source: "moneypuck",
    description: "Opponent's expected goals while shorthanded per 60 minutes.",
    defaultInvert: true,
    unit: "xGA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.onIceAxg4v5, c.toi4v5);
      const lVal = safePer60(l.onIceAxg4v5, l.toi4v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "relXgaPk",
    label: "Rel xGA/60 PK",
    source: "moneypuck",
    description: "Difference in the team's penalty-kill xGA with him vs without him.",
    defaultInvert: true,
    unit: "Rel xGA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cOn = safePer60(c.onIceAxg4v5, c.toi4v5);
      const cOff = safePer60(c.offIceAxg4v5, c.offIceToi4v5);
      const cVal = cOn != null && cOff != null ? cOn - cOff : null;

      const lOn = safePer60(l.onIceAxg4v5, l.toi4v5);
      const lOff = safePer60(l.offIceAxg4v5, l.offIceToi4v5);
      const lVal = lOn != null && lOff != null ? lOn - lOff : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "xgfPct",
    label: "xGF% 5v5",
    source: "moneypuck",
    description: "The team's expected-goals share at 5-on-5 (>50% = team dominance).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = c.onIceFxg5v5 != null && c.onIceAxg5v5 != null && c.onIceFxg5v5 + c.onIceAxg5v5 > 0
        ? c.onIceFxg5v5 / (c.onIceFxg5v5 + c.onIceAxg5v5)
        : null;
      const lVal = l.onIceFxg5v5 != null && l.onIceAxg5v5 != null && l.onIceFxg5v5 + l.onIceAxg5v5 > 0
        ? l.onIceFxg5v5 / (l.onIceFxg5v5 + l.onIceAxg5v5)
        : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ixg60",
    label: "ixG/60",
    source: "moneypuck",
    description: "Quality and volume of the player's own scoring chances per 60 minutes.",
    defaultInvert: false,
    unit: "ixG/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.ixg, c.toi);
      const lVal = safePer60(l.ixg, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "g_xg60",
    label: "(G - xG)/60",
    source: "moneypuck",
    description: "Difference between actual and expected goals (finishing efficiency).",
    defaultInvert: false,
    unit: "G-xG/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = c.g != null && c.ixg != null && c.toi > 0 ? ((c.g - c.ixg) / c.toi) * 3600 : null;
      const lVal = l.g != null && l.ixg != null && l.toi > 0 ? ((l.g - l.ixg) / l.toi) * 3600 : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "a1_5v5_60",
    label: "Primary Assists / 60 5v5",
    source: "moneypuck",
    description: "Primary goal passes at even strength 5-on-5 per 60 minutes.",
    defaultInvert: false,
    unit: "A1/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.a1_5v5, c.toi5v5);
      const lVal = safePer60(l.a1_5v5, l.toi5v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "a2_5v5_60",
    label: "Secondary Assists / 60 5v5",
    source: "moneypuck",
    description: "Secondary passes at even strength 5-on-5 per 60 minutes.",
    defaultInvert: false,
    unit: "A2/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.a2_5v5, c.toi5v5);
      const lVal = safePer60(l.a2_5v5, l.toi5v5);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ppa1_60",
    label: "PP Primary Assists / 60",
    source: "moneypuck",
    description: "Primary goal assists on the power play per 60 minutes.",
    defaultInvert: false,
    unit: "PPA1/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.ppa1, c.toi);
      const lVal = safePer60(l.ppa1, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ong60",
    label: "On-Ice Goals For / 60",
    source: "moneypuck",
    description: "Goals scored by the team while the player is on ice (per 60 minutes).",
    defaultInvert: false,
    unit: "GF/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.ong, c.toi);
      const lVal = safePer60(l.ong, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "onga60",
    label: "On-Ice Goals Against / 60",
    source: "moneypuck",
    description: "Goals allowed by the team per 60 minutes while the player is on ice (less is better).",
    defaultInvert: true,
    unit: "GA/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.onGaAll, c.toi);
      const lVal = safePer60(l.onGaAll, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpPenaltiesDrawnPg",
    label: "Penalties Drawn / GP",
    source: "moneypuck",
    description: "Number of penalties/power plays drawn for the team per game.",
    defaultInvert: false,
    unit: "fauly/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.penaltiesDrawn, c.gp ?? 0);
      const lVal = safeRate(l.penaltiesDrawn, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpPenaltiesDrawn60",
    label: "Penalties Drawn / 60",
    source: "moneypuck",
    description: "Frequency of opponent penalties/power plays drawn per 60 minutes on ice.",
    defaultInvert: false,
    unit: "fauly/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.penaltiesDrawn, c.toi);
      const lVal = safePer60(l.penaltiesDrawn, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpPenaltiesTakenPg",
    label: "Penalties Taken / GP",
    source: "moneypuck",
    description: "Number of minor and major penalties assessed to the player per game (less = better).",
    defaultInvert: true,
    unit: "fauly/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.penalties, c.gp ?? 0);
      const lVal = safeRate(l.penalties, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpPenaltiesTaken60",
    label: "Penalties Taken / 60",
    source: "moneypuck",
    description: "Frequency of penalties assessed per 60 minutes on ice (less = better).",
    defaultInvert: true,
    unit: "fauly/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.penalties, c.toi);
      const lVal = safePer60(l.penalties, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpPenaltyBalance",
    label: "Net Penalties / 60",
    source: "moneypuck",
    description: "Difference between penalties drawn and taken per 60 minutes (Penalty Differential).",
    defaultInvert: false,
    unit: "rozdiel/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cD = safePer60(c.penaltiesDrawn, c.toi);
      const cT = safePer60(c.penalties, c.toi);
      const cVal = cD != null && cT != null ? cD - cT : null;

      const lD = safePer60(l.penaltiesDrawn, l.toi);
      const lT = safePer60(l.penalties, l.toi);
      const lVal = lD != null && lT != null ? lD - lT : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpPimDrawnPg",
    label: "PIM Drawn / GP",
    source: "moneypuck",
    description: "How many opponent penalty minutes the player drew for his team per game.",
    defaultInvert: false,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.pimDrawn, c.gp ?? 0);
      const lVal = safeRate(l.pimDrawn, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpGameScorePg",
    label: "Game Score / GP",
    source: "moneypuck",
    description: "Comprehensive evaluation of the player's performance (Dom Luszczyszyn / MoneyPuck model) per game.",
    defaultInvert: false,
    unit: "GS/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.gameScore, c.gp ?? 0);
      const lVal = safeRate(l.gameScore, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpShotAttempts60",
    label: "Shot Attempts / 60",
    source: "moneypuck",
    description: "All of the player's own shot attempts (on goal, wide, blocked) per 60 minutes.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.shotAttempts, c.toi);
      const lVal = safePer60(l.shotAttempts, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpUnblockedAttempts60",
    label: "Unblocked Shot Attempts / 60 (Fenwick For za 60 min)",
    source: "moneypuck",
    description: "The player's own unblocked shots on and off goal per 60 minutes.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.unblockedAttempts, c.toi);
      const lVal = safePer60(l.unblockedAttempts, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpReboundsCreated60",
    label: "Rebounds Created / 60",
    source: "moneypuck",
    description: "Number of rebounds generated from the player's shots per 60 minutes on ice.",
    defaultInvert: false,
    unit: "rebounds/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.reboundsCreated, c.toi);
      const lVal = safePer60(l.reboundsCreated, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpReboundGoalsPg",
    label: "Rebound Goals / GP",
    source: "moneypuck",
    description: "Goals scored from rebounds in front of the crease per game.",
    defaultInvert: false,
    unit: "G/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.reboundGoals, c.gp ?? 0);
      const lVal = safeRate(l.reboundGoals, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpDzoneGiveaways60",
    label: "D-Zone Giveaways / 60",
    source: "moneypuck",
    description: "Turnovers in the own defensive zone per 60 minutes (less = better).",
    defaultInvert: true,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.dZoneGiveaways, c.toi);
      const lVal = safePer60(l.dZoneGiveaways, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpHdShots60",
    label: "High-Danger Shots / 60",
    source: "moneypuck",
    description: "The player's own shots from the dangerous area in front of the net per 60 minutes.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.hdShots, c.toi);
      const lVal = safePer60(l.hdShots, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpHdGoalsPg",
    label: "High-Danger Goals / GP",
    source: "moneypuck",
    description: "Goals scored from close range in front of the net per game.",
    defaultInvert: false,
    unit: "G/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.hdGoals, c.gp ?? 0);
      const lVal = safeRate(l.hdGoals, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpHdXg60",
    label: "High-Danger xG / 60",
    source: "moneypuck",
    description: "Quality of high-danger chances created in the slot per 60 minutes.",
    defaultInvert: false,
    unit: "HD xG/60",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.hdXg, c.toi);
      const lVal = safePer60(l.hdXg, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpMdShots60",
    label: "Medium-Danger Shots / 60 (Strely zo strednej vzdialenosti)",
    source: "moneypuck",
    description: "Shots from the circles and mid-range per 60 minutes.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.mdShots, c.toi);
      const lVal = safePer60(l.mdShots, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpLdShots60",
    label: "Low-Danger Shots / 60",
    source: "moneypuck",
    description: "Shots from long range and from the boards per 60 minutes.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safePer60(c.ldShots, c.toi);
      const lVal = safePer60(l.ldShots, l.toi);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpOzoneStartsPct",
    label: "O-Zone Start %",
    source: "moneypuck",
    description: "Share of shifts started in the offensive zone versus the defensive zone.",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cTot = (c.oZoneShiftStarts ?? 0) + (c.dZoneShiftStarts ?? 0);
      const lTot = (l.oZoneShiftStarts ?? 0) + (l.dZoneShiftStarts ?? 0);
      const cVal = cTot > 0 ? (c.oZoneShiftStarts ?? 0) / cTot : null;
      const lVal = lTot > 0 ? (l.oZoneShiftStarts ?? 0) / lTot : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpOnIceCorsiPct",
    label: "On-Ice Corsi %",
    source: "moneypuck",
    description: "Share of all of the team's shot attempts with the player on ice (>50% = dominance).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = c.onIceCorsiPct != null && c.onIceCorsiPct > 0 ? c.onIceCorsiPct * 100 : null;
      const lVal = l.onIceCorsiPct != null && l.onIceCorsiPct > 0 ? l.onIceCorsiPct * 100 : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpOnIceFenwickPct",
    label: "On-Ice Fenwick %",
    source: "moneypuck",
    description: "Share of the team's unblocked shots while the player is on ice.",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = c.onIceFenwickPct != null && c.onIceFenwickPct > 0 ? c.onIceFenwickPct * 100 : null;
      const lVal = l.onIceFenwickPct != null && l.onIceFenwickPct > 0 ? l.onIceFenwickPct * 100 : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "mpShiftsPg",
    label: "Shifts / GP",
    source: "moneypuck",
    description: "Average number of shifts played per game.",
    defaultInvert: false,
    unit: "striedania/GP",
    getValue: (p, cfg) => {
      const mp = (p.mpSkater as any) ?? {};
      const c = mp[String(cfg.latestMpYear)] ?? {};
      const l = mp[String(cfg.previousMpYear)] ?? {};
      const cVal = safeRate(c.shifts, c.gp ?? 0);
      const lVal = safeRate(l.shifts, l.gp ?? 0);
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },

  // ========================= NHL EDGE =========================
  {
    key: "burst20",
    label: "Speed Bursts > 20 mph / 60",
    source: "edge",
    description: "Frequency of speed bursts above 32 km/h per 60 minutes.",
    defaultInvert: false,
    unit: "/60 min",
    getValue: (p, cfg) => {
      const es = (p.edgeSpeed as any) ?? {};
      const c = es.cur?.brst ?? null;
      const l = es.last?.brst ?? null;
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "edgeMaxSpeed",
    label: "Max Skating Speed",
    source: "edge",
    description: "Highest measured skating speed (mph).",
    defaultInvert: false,
    unit: "mph",
    getValue: (p, cfg) => {
      const es = (p.edgeSpeed as any) ?? {};
      const c = es.cur?.spd ?? null;
      const l = es.last?.spd ?? null;
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "edgeDistance",
    label: "Total Skating Distance / 60",
    source: "edge",
    description: "Distance skated in miles per 60 minutes on ice.",
    defaultInvert: false,
    unit: "mi/60",
    getValue: (p, cfg) => {
      const es = (p.edgeSpeed as any) ?? {};
      const c = es.cur?.dist ?? null;
      const l = es.last?.dist ?? null;
      const cGP = Number(p.curSeasonGP ?? 0);
      const lGP = Number(p.lastSeasonGP ?? 0);
      return blend(c, l, cGP, lGP, cfg.latestWeight, cfg.previousWeight);
    },
  },

  // ========================= AHL HOCKEYTECH =========================
  {
    key: "ahlGpg",
    label: "AHL Goals / GP",
    source: "ahl",
    description: "Goals per game in the AHL with the NHLe conversion.",
    defaultInvert: false,
    unit: "G/GP",
    getValue: (p, cfg) => {
      const a = (p.ahlStats as any) ?? {};
      const c = a.cur ?? {};
      const l = a.last ?? {};
      const nhleC = cfg.ahlNhleLatest ?? 0.446;
      const nhleL = cfg.ahlNhlePrevious ?? 0.448;
      const cVal = c.gp > 0 ? (c.g / c.gp) * nhleC : null;
      const lVal = l.gp > 0 ? (l.g / l.gp) * nhleL : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ahlApg",
    label: "AHL Assists / GP",
    source: "ahl",
    description: "Assists per game in the AHL with the NHLe conversion.",
    defaultInvert: false,
    unit: "A/GP",
    getValue: (p, cfg) => {
      const a = (p.ahlStats as any) ?? {};
      const c = a.cur ?? {};
      const l = a.last ?? {};
      const nhleC = cfg.ahlNhleLatest ?? 0.446;
      const nhleL = cfg.ahlNhlePrevious ?? 0.448;
      const cVal = c.gp > 0 ? (c.a / c.gp) * nhleC : null;
      const lVal = l.gp > 0 ? (l.a / l.gp) * nhleL : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ahlShotsPg",
    label: "AHL Shots / GP",
    source: "ahl",
    description: "Shots per game in the AHL.",
    defaultInvert: false,
    unit: "S/GP",
    getValue: (p, cfg) => {
      const a = (p.ahlStats as any) ?? {};
      const c = a.cur ?? {};
      const l = a.last ?? {};
      const cVal = c.gp > 0 ? c.sh / c.gp : null;
      const lVal = l.gp > 0 ? l.sh / l.gp : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ahlPlusMinusPg",
    label: "AHL +/- per Game",
    source: "ahl",
    description: "Involvement in goals scored and allowed per game in the AHL.",
    defaultInvert: false,
    unit: "+/- / GP",
    getValue: (p, cfg) => {
      const a = (p.ahlStats as any) ?? {};
      const c = a.cur ?? {};
      const l = a.last ?? {};
      const cVal = c.gp > 0 ? c.plusMinus / c.gp : null;
      const lVal = l.gp > 0 ? l.plusMinus / l.gp : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "ahlPimPg",
    label: "AHL PIM / GP",
    source: "ahl",
    description: "Penalty minutes in the AHL (less is better).",
    defaultInvert: true,
    unit: "min/GP",
    getValue: (p, cfg) => {
      const a = (p.ahlStats as any) ?? {};
      const c = a.cur ?? {};
      const l = a.last ?? {};
      const cVal = c.gp > 0 ? c.pim / c.gp : null;
      const lVal = l.gp > 0 ? l.pim / l.gp : null;
      return blend(cVal, lVal, c.gp ?? 0, l.gp ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },

  // ========================= BIOMETRICS & CAREER =========================
  {
    key: "weight",
    label: "Player weight (Weight lbs)",
    source: "bio",
    description: "Player weight in pounds (physical build and strength).",
    defaultInvert: false,
    unit: "lbs",
    getValue: (p) => (p.weight != null && p.weight > 0 ? p.weight : null),
  },
  {
    key: "careerRegGP",
    label: "Career regular-season games (Career Regular GP)",
    source: "bio",
    description: "Total number of NHL regular-season games played.",
    defaultInvert: false,
    unit: "GP",
    getValue: (p) => (p.careerGP as any)?.reg ?? null,
  },
  {
    key: "careerPoGP",
    label: "Career playoff games (Career Playoff GP)",
    source: "bio",
    description: "Total number of NHL playoff games played.",
    defaultInvert: false,
    unit: "GP",
    getValue: (p) => (p.careerGP as any)?.po ?? null,
  },
  {
    key: "age",
    label: "Player age (Age)",
    source: "bio",
    description: "The player's current age.",
    defaultInvert: false,
    unit: "rokov",
    getValue: (p) => (p.age != null && p.age > 0 ? p.age : null),
  },
];

export const METRIC_BY_KEY: Record<string, CatalogMetricItem> = Object.fromEntries(
  CATALOG_METRICS.map((m) => [m.key, m])
);

// ========================= GOALIE METRIC CATALOG =========================
export const GOALIE_CATALOG_METRICS: CatalogMetricItem[] = [
  // ========================= MONEYPUCK GOALIE =========================
  {
    key: "svPct",
    label: "Save %",
    source: "moneypuck",
    description: "The goalie's overall save percentage (SV%).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.svPct,
        adv.last?.svPct,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "gaa",
    label: "GAA",
    source: "moneypuck",
    description: "Average goals against per 60 minutes of play (less is better).",
    defaultInvert: true,
    unit: "GAA",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.gaa,
        adv.last?.gaa,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "gsax",
    label: "GSAx",
    source: "moneypuck",
    description: "Total number of goals the goalie saved above expectation (xG − goals allowed).",
    defaultInvert: false,
    unit: "GSAx",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.gsax,
        adv.last?.gsax,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "gsax60",
    label: "GSAx / 60 min",
    source: "moneypuck",
    description: "GSAx per 60 minutes of the goalie's net time on ice.",
    defaultInvert: false,
    unit: "GSAx/60",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.gsax60,
        adv.last?.gsax60,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "hdSv",
    label: "High-Danger SV%",
    source: "moneypuck",
    description: "Save percentage against shots from close range and the slot (HD SV%).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.hdSv,
        adv.last?.hdSv,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "hdGsax",
    label: "High-Danger GSAx",
    source: "moneypuck",
    description: "GSAx generated exclusively against high-danger shots.",
    defaultInvert: false,
    unit: "HD GSAx",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.hdGsax,
        adv.last?.hdGsax,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "hdGsax60",
    label: "High-Danger GSAx / 60 min",
    source: "moneypuck",
    description: "HD GSAx per 60 minutes of the goalie's net time on ice.",
    defaultInvert: false,
    unit: "HD GSAx/60",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.hdGsax60,
        adv.last?.hdGsax60,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "mdGsax",
    label: "Medium-Danger GSAx",
    source: "moneypuck",
    description: "GSAx generated exclusively against medium-danger shots.",
    defaultInvert: false,
    unit: "MD GSAx",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.mdGsax,
        adv.last?.mdGsax,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "mdGsax60",
    label: "Medium-Danger GSAx / 60 min",
    source: "moneypuck",
    description: "MD GSAx per 60 minutes of the goalie's net time on ice.",
    defaultInvert: false,
    unit: "MD GSAx/60",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.mdGsax60,
        adv.last?.mdGsax60,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "ldGsax",
    label: "Low-Danger GSAx",
    source: "moneypuck",
    description: "GSAx generated exclusively against low-danger shots.",
    defaultInvert: false,
    unit: "LD GSAx",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.ldGsax,
        adv.last?.ldGsax,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "ldGsax60",
    label: "Low-Danger GSAx / 60 min",
    source: "moneypuck",
    description: "LD GSAx per 60 minutes of the goalie's net time on ice.",
    defaultInvert: false,
    unit: "LD GSAx/60",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.ldGsax60,
        adv.last?.ldGsax60,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "mdSv",
    label: "Medium-Danger SV%",
    source: "moneypuck",
    description: "Save percentage on shots from the mid-range and circles (MD SV%).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.mdSv,
        adv.last?.mdSv,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "ldSv",
    label: "Low-Danger SV%",
    source: "moneypuck",
    description: "Save percentage against shots from long range and the boards (LD SV%).",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.ldSv,
        adv.last?.ldSv,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "rebCtrl",
    label: "Rebound Control",
    source: "moneypuck",
    description: "Rate of eliminating dangerous opponent rebounds versus expectation (positive = fewer rebounds).",
    defaultInvert: false,
    unit: "RebCtrl",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.rebCtrl,
        adv.last?.rebCtrl,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "freezePct",
    label: "Freeze %",
    source: "moneypuck",
    description: "Percentage of saves after which the goalie safely covered the puck and stopped play.",
    defaultInvert: false,
    unit: "%",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.freezePct,
        adv.last?.freezePct,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "icetime",
    label: "Ice Time / Goalie workload",
    source: "moneypuck",
    description: "Total time in net in the season expressed in minutes (endurance & team unit).",
    defaultInvert: false,
    unit: "min",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      const c = adv.cur?.icetime != null ? adv.cur.icetime / 60 : null;
      const l = adv.last?.icetime != null ? adv.last.icetime / 60 : null;
      return blend(
        c,
        l,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "gp",
    label: "Games Played",
    source: "nhl",
    description: "Number of games played in the current and previous season.",
    defaultInvert: false,
    unit: "GP",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      const c = adv.cur?.gp ?? p.curSeasonGP ?? null;
      const l = adv.last?.gp ?? p.lastSeasonGP ?? null;
      return blend(c, l, c ?? 0, l ?? 0, cfg.latestWeight, cfg.previousWeight);
    },
  },
  {
    key: "sz",
    label: "Goalie height (Height cm)",
    source: "bio",
    description: "Goalie height in centimeters (size and net coverage).",
    defaultInvert: false,
    unit: "cm",
    getValue: (p) => {
      const m = (p.height ?? "").match(/(\d+)\s*cm/);
      return m ? Number(m[1]) : (p.height ? Number(p.height) : null);
    },
  },
  {
    key: "weight",
    label: "Goalie weight (Weight lbs)",
    source: "bio",
    description: "Goalie weight in pounds.",
    defaultInvert: false,
    unit: "lbs",
    getValue: (p) => (p.weight != null && p.weight > 0 ? p.weight : null),
  },
  {
    key: "careerRegGP",
    label: "Career regular-season games (Career Regular GP)",
    source: "bio",
    description: "Total number of NHL regular-season games played.",
    defaultInvert: false,
    unit: "GP",
    getValue: (p) => (p.careerGP as any)?.reg ?? null,
  },
  {
    key: "careerPoGP",
    label: "Career playoff games (Career Playoff GP)",
    source: "bio",
    description: "Total number of NHL playoff games played.",
    defaultInvert: false,
    unit: "GP",
    getValue: (p) => (p.careerGP as any)?.po ?? null,
  },
  {
    key: "goals",
    label: "Goals allowed (Goals Against)",
    source: "moneypuck",
    description: "Total number of goals allowed by the goalie (less is better).",
    defaultInvert: true,
    unit: "GA",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.goals,
        adv.last?.goals,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "xGoals",
    label: "xGoals",
    source: "moneypuck",
    description: "Sum of the xG of all shots the goalie faced.",
    defaultInvert: false,
    unit: "xGA",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.xGoals,
        adv.last?.xGoals,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "shots",
    label: "Shots Against",
    source: "moneypuck",
    description: "Total number of shots directed at the net.",
    defaultInvert: false,
    unit: "SA",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.shots,
        adv.last?.shots,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "rebounds",
    label: "Rebounds Allowed",
    source: "moneypuck",
    description: "Number of rebounds the opponent got after a goalie save (less is better).",
    defaultInvert: true,
    unit: "Reb",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.rebounds,
        adv.last?.rebounds,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "xRebounds",
    label: "Expected Rebounds",
    source: "moneypuck",
    description: "Expected number of rebounds generated from the quality and trajectory of shots.",
    defaultInvert: false,
    unit: "xReb",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.xRebounds,
        adv.last?.xRebounds,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "freeze",
    label: "Puck covered / Freezes",
    source: "moneypuck",
    description: "Absolute number of stoppages by covering or freezing the puck after a shot.",
    defaultInvert: false,
    unit: "Frz",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.freeze,
        adv.last?.freeze,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "xFreeze",
    label: "Expected Freezes",
    source: "moneypuck",
    description: "Expected number of stoppages by shot trajectory and danger.",
    defaultInvert: false,
    unit: "xFrz",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.xFreeze,
        adv.last?.xFreeze,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "penalties",
    label: "Penalties",
    source: "moneypuck",
    description: "Number of minor or major penalties assessed to the goalie (less is better).",
    defaultInvert: true,
    unit: "Pen",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.penalties,
        adv.last?.penalties,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "pim",
    label: "PIM",
    source: "moneypuck",
    description: "The goalie's total penalty minutes (less is better).",
    defaultInvert: true,
    unit: "min",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.pim,
        adv.last?.pim,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "flurryAxg",
    label: "Flurry-Adjusted xG Against",
    source: "moneypuck",
    description: "Expected goals against after adjusting for quick repeated shots from close range.",
    defaultInvert: false,
    unit: "xGA",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.flurryAxg,
        adv.last?.flurryAxg,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "unblockedShots",
    label: "Unblocked Shot Attempts Against",
    source: "moneypuck",
    description: "Number of shots and shots wide that were not blocked by skaters.",
    defaultInvert: false,
    unit: "USAT",
    getValue: (p, cfg) => {
      const adv = (p.goalieAdvanced as any) ?? {};
      return blend(
        adv.cur?.unblockedShots,
        adv.last?.unblockedShots,
        adv.cur?.gp ?? p.curSeasonGP ?? 0,
        adv.last?.gp ?? p.lastSeasonGP ?? 0,
        cfg.latestWeight,
        cfg.previousWeight
      );
    },
  },
  {
    key: "age",
    label: "Goalie age (Age)",
    source: "bio",
    description: "The goalie's current age.",
    defaultInvert: false,
    unit: "rokov",
    getValue: (p) => (p.age != null && p.age > 0 ? p.age : null),
  },
];

export const GOALIE_METRIC_BY_KEY: Record<string, CatalogMetricItem> = Object.fromEntries(
  GOALIE_CATALOG_METRICS.map((m) => [m.key, m])
);


