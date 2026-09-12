// Roster size rules (shared by the roster-mover UI and its server action).

// pro = NHL dressed · pro-scratched = NHL roster healthy scratch (extras of a 23-man
// roster) · farm = AHL active · farm-scratched = AHL healthy scratch. NHL side (pro +
// pro-scratched) counts against the cap; the dressed 20 for a game are the "pro" bucket.
export type RosterSide = "pro" | "pro-scratched" | "farm" | "farm-scratched";
export type MoveRow = { id: number; side: RosterSide; contractType: "ONE_WAY" | "TWO_WAY" | null };
export const isNhlSide = (s: RosterSide) => s === "pro" || s === "pro-scratched";
export const isScratchSide = (s: RosterSide) => s === "pro-scratched" || s === "farm-scratched";

export const ROSTER_LIMITS = {
  proMax: 23, proMinSkaters: 18, proMinGoalies: 2,
  ahlMax: 20, // active AHL roster (18 skaters + 2 goalies); extra bodies go to Scratched
  orgMax: 55, orgMaxGoalies: 8, // NHL + AHL combined
};

// Flat cap-hit ceiling for a waiver placement (lib/waivers-server.ts) — a
// simple stand-in for real NHL waiver-exemption rules until something more
// nuanced is built. A player above this is too valuable to realistically
// clear waivers to the farm, so placeOnWaivers blocks it outright server-side
// — and the roster-mover UI (RosterMover.tsx) reads this SAME constant to
// disable the Farm/Waivers button for him instead of offering an action
// that's always going to fail.
export const WAIVER_CAP_HIT_LIMIT = 1_500_000;

// "Rule 30/10" — a recall pass. A player called up from the AHL can be sent back
// down without clearing waivers again as long as, since that call-up, he hasn't
// spent more than RECALL_EXEMPT_DAYS cumulative days on the NHL roster AND hasn't
// played more than RECALL_EXEMPT_GAMES NHL games. Cross either limit and the pass
// expires — his next trip to the farm needs to clear waivers like normal. Only
// matters for a non-exempt (one-way, non-AHL-only) player; ELC/two-way players
// never needed this in the first place. See lib/waivers-server.ts recallExemptions.
export const RECALL_EXEMPT_DAYS = 30;
export const RECALL_EXEMPT_GAMES = 10;
