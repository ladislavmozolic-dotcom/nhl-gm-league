// Roster size rules (shared by the roster-mover UI and its server action).

export type MoveRow = { id: number; side: "pro" | "farm"; contractType: "ONE_WAY" | "TWO_WAY" | null };

export const ROSTER_LIMITS = {
  proMax: 23, proMinSkaters: 18, proMinGoalies: 2,
  orgMax: 55, orgMaxGoalies: 8, // NHL + AHL combined
};
