// V3 Core foundation: an explicit, immutable description of a live hockey game.
// It is intentionally not wired into the V2/V3 workbench yet. The next layer
// (decision engine) will consume this state rather than reaching into engine locals.

export type CoreZone = "HOME_DEFENSIVE" | "NEUTRAL" | "AWAY_DEFENSIVE";
export type RelativeZone = "DEFENSIVE" | "NEUTRAL" | "OFFENSIVE";
export type CoreStrength = "EVEN" | "POWER_PLAY" | "SHORT_HANDED";

export type CoreOnIce = { forwards: number[]; defense: number[] };

export type V3CoreMatchState = {
  homeTeamId: number;
  awayTeamId: number;
  period: number;
  secondsIntoPeriod: number;
  totalSeconds: number;
  score: Record<number, number>;
  possessionTeamId: number | null;
  puckZone: CoreZone;
  strength: Record<number, CoreStrength>;
  onIce: Record<number, CoreOnIce>;
  fatigue: Record<number, number>; // 0..1; 0 fresh, 1 exhausted
  pressure: Record<number, number>; // 0..1; pressure currently applied to this team
  momentum: Record<number, number>; // -1..1; team-relative game flow
};

export type MatchStateInit = Pick<V3CoreMatchState, "homeTeamId" | "awayTeamId"> & Partial<Pick<V3CoreMatchState, "period" | "secondsIntoPeriod" | "score" | "onIce" | "fatigue" | "pressure" | "momentum">>;

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const blankOnIce = (): CoreOnIce => ({ forwards: [], defense: [] });

/** Creates a neutral, deterministic snapshot. No RNG and no database access. */
export function createMatchState(init: MatchStateInit): V3CoreMatchState {
  if (init.homeTeamId === init.awayTeamId) throw new Error("Match state requires two distinct teams.");
  const home = init.homeTeamId, away = init.awayTeamId;
  const period = init.period ?? 1;
  const secondsIntoPeriod = init.secondsIntoPeriod ?? 0;
  return {
    homeTeamId: home,
    awayTeamId: away,
    period,
    secondsIntoPeriod,
    totalSeconds: (period - 1) * 1200 + secondsIntoPeriod,
    score: { [home]: init.score?.[home] ?? 0, [away]: init.score?.[away] ?? 0 },
    possessionTeamId: null,
    puckZone: "NEUTRAL",
    strength: { [home]: "EVEN", [away]: "EVEN" },
    onIce: { [home]: init.onIce?.[home] ?? blankOnIce(), [away]: init.onIce?.[away] ?? blankOnIce() },
    fatigue: { [home]: clamp(init.fatigue?.[home] ?? 0, 0, 1), [away]: clamp(init.fatigue?.[away] ?? 0, 0, 1) },
    pressure: { [home]: clamp(init.pressure?.[home] ?? 0, 0, 1), [away]: clamp(init.pressure?.[away] ?? 0, 0, 1) },
    momentum: { [home]: clamp(init.momentum?.[home] ?? 0, -1, 1), [away]: clamp(init.momentum?.[away] ?? 0, -1, 1) },
  };
}

export function opponentId(state: V3CoreMatchState, teamId: number): number {
  if (teamId === state.homeTeamId) return state.awayTeamId;
  if (teamId === state.awayTeamId) return state.homeTeamId;
  throw new Error(`Team ${teamId} is not in this match state.`);
}

/** Changes possession and location together, preventing impossible one-sided views. */
export function withPossession(state: V3CoreMatchState, teamId: number | null, puckZone: CoreZone = "NEUTRAL"): V3CoreMatchState {
  if (teamId != null) opponentId(state, teamId);
  return { ...state, possessionTeamId: teamId, puckZone, pressure: teamId == null ? state.pressure : { ...state.pressure, [teamId]: 0 } };
}

export function withScore(state: V3CoreMatchState, teamId: number, goals: number): V3CoreMatchState {
  opponentId(state, teamId);
  return { ...state, score: { ...state.score, [teamId]: Math.max(0, goals) } };
}

/** Perspective consumed by the future decision engine. */
export function viewForTeam(state: V3CoreMatchState, teamId: number) {
  const opponent = opponentId(state, teamId);
  const relativeZone: RelativeZone = state.puckZone === "NEUTRAL" ? "NEUTRAL"
    : (state.puckZone === "HOME_DEFENSIVE") === (teamId === state.homeTeamId) ? "DEFENSIVE" : "OFFENSIVE";
  return {
    teamId,
    opponentId: opponent,
    hasPossession: state.possessionTeamId === teamId,
    relativeZone,
    scoreMargin: state.score[teamId] - state.score[opponent],
    strength: state.strength[teamId],
    fatigue: state.fatigue[teamId],
    pressure: state.pressure[teamId],
    momentum: state.momentum[teamId],
    onIce: state.onIce[teamId],
  };
}
