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
