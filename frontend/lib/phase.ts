// Season phases. Each phase is its own Game.season string, so scoreboard /
// standings / stats for Pre-season, Regular Season and (via seriesId) Playoffs
// stay cleanly separated, and pre-season never leaks into profiles/careers.
// Light module (no sim imports) so page components can import it freely.

export const REGULAR_SEASON = "2026-27";
export const PRE_SEASON = "2026-27-PRE";

export type Phase = "pre" | "regular" | "playoffs";

/** The Game.season string a phase reads from (playoffs live inside the regular
 *  season string, separated by seriesId). */
export function seasonForPhase(phase: string | undefined): string {
  return phase === "pre" ? PRE_SEASON : REGULAR_SEASON;
}

export function normalizePhase(phase: string | undefined): Phase {
  return phase === "pre" ? "pre" : phase === "playoffs" ? "playoffs" : "regular";
}
