// Phase 3 — team SYSTEM tactics: the strategic identity a GM sets for a club,
// on top of the existing score-state GameStrategy and per-line tactics.
//
// Four dials, each with a neutral "balanced" default so a club that sets nothing
// plays exactly as before (calibration-safe). Every dial has an upside and a
// real cost, and its benefit is scaled by SYSTEM FIT — how well the roster suits
// the system (a fast-tempo team needs skaters; a heavy forecheck needs checkers).
// Pick a system your roster fits and it amplifies; force one it doesn't and you
// pay the cost without the reward.

export type Tempo = "slow" | "balanced" | "fast";
export type Forecheck = "passive" | "balanced" | "aggressive";
export type PuckStyle = "cycle" | "balanced" | "rush" | "shotVolume";
export type DZone = "collapse" | "balanced" | "aggressive";

export type TeamTactics = {
  tempo: Tempo;
  forecheck: Forecheck;
  puckStyle: PuckStyle;
  dZone: DZone;
  preset?: string; // name of the applied preset, if any
};

export const DEFAULT_TACTICS: TeamTactics = {
  tempo: "balanced", forecheck: "balanced", puckStyle: "balanced", dZone: "balanced",
};

// Resolved multipliers the engine reads. All 1.0 = neutral (balanced everything).
export type TacticsEffect = {
  shotRate: number;       // this team's shot generation (tempo, cycle/shot-volume)
  oppShotRate: number;    // opponent's shot generation vs this team (tempo, aggressive forecheck)
  takeaway: number;       // forcing turnovers when forechecking / defending
  dangerMix: number;      // shifts this team's chances toward high-danger (rush) or low (shot-volume)
  oppDangerMult: number;  // opponent shot danger when THIS team defends (D-zone collapse lowers)
  fatigue: number;        // extra shift fatigue drain (fast tempo, aggressive forecheck)
  penaltyMult: number;    // penalty rate (aggressive forecheck)
  fit: number;            // system fit 0.6..1.15 (1 = neutral) — how well the roster suits the system
};

export const NEUTRAL_EFFECT: TacticsEffect = {
  shotRate: 1, oppShotRate: 1, takeaway: 1, dangerMix: 1, oppDangerMult: 1, fatigue: 1, penaltyMult: 1, fit: 1,
};

// --- per-dial raw effects (before fit scaling) ------------------------------
// Benefits are the deltas that fit will scale; costs (fatigue, penalties, extra
// shots against) apply in full regardless of fit.
type Dial = Partial<Omit<TacticsEffect, "fit">>;

const TEMPO_FX: Record<Tempo, Dial> = {
  slow: { shotRate: 0.87, oppShotRate: 0.90, fatigue: 0.91 },
  balanced: {},
  fast: { shotRate: 1.14, oppShotRate: 1.11, fatigue: 1.13 },
};
const FORECHECK_FX: Record<Forecheck, Dial> = {
  passive: { takeaway: 0.82, oppShotRate: 0.91, penaltyMult: 0.85, fatigue: 0.95 },
  balanced: {},
  aggressive: { takeaway: 1.22, shotRate: 1.07, oppShotRate: 1.14, penaltyMult: 1.28, fatigue: 1.14 },
};
const PUCK_FX: Record<PuckStyle, Dial> = {
  cycle: { shotRate: 1.11, dangerMix: 0.93 },
  balanced: {},
  rush: { shotRate: 0.92, dangerMix: 1.18 },
  shotVolume: { shotRate: 1.16, dangerMix: 0.84 },
};
const DZONE_FX: Record<DZone, Dial> = {
  collapse: { oppDangerMult: 0.85, takeaway: 0.90 },
  balanced: {},
  aggressive: { oppDangerMult: 1.10, takeaway: 1.14, penaltyMult: 1.08 },
};

// Which effect keys are BENEFITS (scaled by fit) vs COSTS (always applied).
// A benefit pulls toward winning: more of your shots, fewer/less-dangerous
// theirs, more takeaways. Costs: fatigue, penalties, extra shots against.
const COST_KEYS = new Set<keyof TacticsEffect>(["fatigue", "penaltyMult", "oppShotRate"]);
// For oppDangerMult, <1 is a benefit (you suppress danger); >1 is a cost.

// --- presets ----------------------------------------------------------------
export const PRESETS: Record<string, TeamTactics> = {
  "Balanced":        { tempo: "balanced", forecheck: "balanced", puckStyle: "balanced", dZone: "balanced", preset: "Balanced" },
  "Run-and-Gun":     { tempo: "fast", forecheck: "aggressive", puckStyle: "rush", dZone: "aggressive", preset: "Run-and-Gun" },
  "Trap":            { tempo: "slow", forecheck: "passive", puckStyle: "rush", dZone: "collapse", preset: "Trap" },
  "Heavy Forecheck": { tempo: "balanced", forecheck: "aggressive", puckStyle: "cycle", dZone: "balanced", preset: "Heavy Forecheck" },
  "Shot Volume":     { tempo: "fast", forecheck: "balanced", puckStyle: "shotVolume", dZone: "balanced", preset: "Shot Volume" },
  "Shutdown":        { tempo: "slow", forecheck: "balanced", puckStyle: "cycle", dZone: "collapse", preset: "Shutdown" },
};

// --- system fit -------------------------------------------------------------
// Ice-weighted roster attribute averages (0..99), computed in buildTeam.
export type RosterProfile = {
  sk: number; en: number; ck: number; sc: number; pa: number; df: number; st: number; weight: number;
};

// League-ish centres so an average roster fits at ~1.0 (data is compressed, so
// slopes are gentle). fitDim maps an attribute to a 0.6..1.15 fit contribution.
const fitDim = (v: number, centre: number, spread = 22) =>
  Math.max(0.6, Math.min(1.15, 1 + (v - centre) / spread * 0.15));

/** How well `p` suits `t` — averaged over the non-neutral dials; 1.0 = neutral. */
export function systemFit(p: RosterProfile, t: TeamTactics): number {
  const parts: number[] = [];
  if (t.tempo === "fast") parts.push((fitDim(p.sk, 70) + fitDim(p.en, 70)) / 2);
  if (t.tempo === "slow") parts.push(fitDim(p.df, 70));
  if (t.forecheck === "aggressive") parts.push((fitDim(p.ck, 66) + fitDim(p.sk, 70)) / 2);
  if (t.puckStyle === "rush") parts.push((fitDim(p.sc, 64) + fitDim(p.pa, 68) + fitDim(p.sk, 70)) / 3);
  if (t.puckStyle === "cycle") parts.push((fitDim(p.pa, 68) + fitDim(p.st, 70)) / 2);
  if (t.puckStyle === "shotVolume") parts.push((fitDim(p.sc, 64) + fitDim(p.weight, 92, 14)) / 2);
  if (t.dZone === "collapse") parts.push(fitDim(p.df, 70));
  if (t.dZone === "aggressive") parts.push((fitDim(p.df, 70) + fitDim(p.sk, 70)) / 2);
  if (!parts.length) return 1; // all balanced
  return parts.reduce((s, v) => s + v, 0) / parts.length;
}

/** Resolve the four dials + roster fit into engine multipliers. A coach's
 *  experience (EX 0..99, ~70 neutral) helps execute the system — a veteran bench
 *  boss lifts a shaky fit, a rookie can't get as much out of a demanding one. */
export function resolveTactics(t: TeamTactics, profile: RosterProfile, coachEx = 70): TacticsEffect {
  const rawFit = systemFit(profile, t);
  const fit = Math.max(0.6, Math.min(1.18, rawFit + (coachEx - 70) * 0.003));
  const eff: TacticsEffect = { ...NEUTRAL_EFFECT, fit };
  const apply = (d: Dial) => {
    for (const k of Object.keys(d) as (keyof Dial)[]) {
      const raw = d[k]!;
      const isCost = COST_KEYS.has(k) || (k === "oppDangerMult" && raw > 1);
      // benefits scale by fit (a bad fit gives less reward); costs apply in full
      const delta = raw - 1;
      const scaled = isCost ? delta : delta * fit;
      eff[k] = eff[k] * (1 + scaled);
    }
  };
  apply(TEMPO_FX[t.tempo]);
  apply(FORECHECK_FX[t.forecheck]);
  apply(PUCK_FX[t.puckStyle]);
  apply(DZONE_FX[t.dZone]);
  return eff;
}

/** Merge a partial/stored tactics object over the defaults (forward-compatible). */
export function mergeTactics(partial: Partial<TeamTactics> | null | undefined): TeamTactics {
  return { ...DEFAULT_TACTICS, ...(partial ?? {}) };
}

// Human-readable labels for the UI.
export const DIAL_LABELS = {
  tempo: { slow: "Slow / Control", balanced: "Balanced", fast: "Fast / Up-tempo" },
  forecheck: { passive: "Passive (1-2-2)", balanced: "Balanced", aggressive: "Aggressive (2-1-2)" },
  puckStyle: { cycle: "Cycle", balanced: "Balanced", rush: "Rush / Transition", shotVolume: "Shot Volume" },
  dZone: { collapse: "Collapse / Box", balanced: "Balanced", aggressive: "Aggressive / Man" },
} as const;
