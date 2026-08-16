// Roster size rules (shared by the roster-mover UI and its server action).

export type RosterSide = "pro" | "farm" | "scratched";
export type MoveRow = { id: number; side: RosterSide; contractType: "ONE_WAY" | "TWO_WAY" | null };

export const ROSTER_LIMITS = {
  proMax: 23, proMinSkaters: 18, proMinGoalies: 2,
  ahlMax: 20, // active AHL roster (18 skaters + 2 goalies); extra bodies go to Scratched
  orgMax: 55, orgMaxGoalies: 8, // NHL + AHL combined
};
