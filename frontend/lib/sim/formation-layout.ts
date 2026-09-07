// Visual + role-fit layout for the PP/PK formation diagrams (Line Editor).
// Positions are illustrative percentages on an offensive-zone rink (y=0 the
// goal line, y=100 the blue line). Each role's `fit` weighs the attributes
// (0..99 scale) that make a player suit it, matching the flavor already
// established in tactics.ts's systemFit/DIAL_DESC (SC = shot/finishing,
// PA = passing/vision, ST = strength/net-front). Role ASSIGNMENT (which of
// the GM's 5 chosen players plays which spot) is computed fresh from their
// attributes every render — not stored — so it always reflects the actual
// personnel, and mirrors the same "automatic fit" idea the engine itself now
// uses for the PP shot's location/type mix (ppShotProfile).
import type { PpStyle, PkStyle } from "./tactics";

export type FormationRole = { key: string; label: string; x: number; y: number; fit: (a: RoleAttrs) => number };
export type RoleAttrs = { sc: number; pa: number; st: number };

const w = (sc: number, pa: number, st: number) => (a: RoleAttrs) => a.sc * sc + a.pa * pa + a.st * st;

export const PP_LAYOUTS: Record<PpStyle, FormationRole[]> = {
  balanced: [
    { key: "r1", label: "Left Wing", x: 26, y: 55, fit: w(0.5, 0.5, 0) },
    { key: "r2", label: "Slot", x: 50, y: 38, fit: w(0.6, 0.4, 0) },
    { key: "r3", label: "Right Wing", x: 74, y: 55, fit: w(0.5, 0.5, 0) },
    { key: "r4", label: "Left Point", x: 30, y: 84, fit: w(0.6, 0.2, 0.2) },
    { key: "r5", label: "Right Point", x: 70, y: 84, fit: w(0.6, 0.2, 0.2) },
  ],
  umbrella: [
    { key: "r1", label: "Point", x: 50, y: 84, fit: w(0.8, 0.2, 0) },
    { key: "r2", label: "Left Wing", x: 26, y: 62, fit: w(0.5, 0.5, 0) },
    { key: "r3", label: "Right Wing", x: 74, y: 62, fit: w(0.5, 0.5, 0) },
    { key: "r4", label: "Bumper", x: 50, y: 46, fit: w(0.5, 0.5, 0) },
    { key: "r5", label: "Net-Front", x: 50, y: 18, fit: w(0, 0.2, 0.8) },
  ],
  "131": [
    { key: "r1", label: "Point", x: 50, y: 84, fit: w(0.2, 0.8, 0) },
    { key: "r2", label: "Left Half-Wall", x: 22, y: 58, fit: w(0.5, 0.5, 0) },
    { key: "r3", label: "Right Half-Wall", x: 78, y: 58, fit: w(0.5, 0.5, 0) },
    { key: "r4", label: "Bumper (one-timer)", x: 50, y: 40, fit: w(0.75, 0.25, 0) },
    { key: "r5", label: "Net-Front", x: 50, y: 16, fit: w(0, 0.2, 0.8) },
  ],
  overload: [
    { key: "r1", label: "Point", x: 62, y: 82, fit: w(0.2, 0.6, 0.2) },
    { key: "r2", label: "Half-Boards", x: 28, y: 60, fit: w(0.2, 0.6, 0.2) },
    { key: "r3", label: "Corner", x: 16, y: 34, fit: w(0.2, 0.5, 0.5) },
    { key: "r4", label: "Net-Front", x: 50, y: 18, fit: w(0, 0.2, 0.8) },
    { key: "r5", label: "Backdoor", x: 78, y: 30, fit: w(0.75, 0.15, 0) },
  ],
};

export const PK_LAYOUTS: Record<PkStyle, FormationRole[]> = {
  balanced: [
    { key: "r1", label: "Forward", x: 32, y: 52, fit: w(0, 0.3, 0.3) },
    { key: "r2", label: "Forward", x: 68, y: 52, fit: w(0, 0.3, 0.3) },
    { key: "r3", label: "Left D", x: 32, y: 80, fit: w(0, 0, 0.6) },
    { key: "r4", label: "Right D", x: 68, y: 80, fit: w(0, 0, 0.6) },
  ],
  box: [
    { key: "r1", label: "Left Top", x: 34, y: 40, fit: w(0, 0.2, 0.4) },
    { key: "r2", label: "Right Top", x: 66, y: 40, fit: w(0, 0.2, 0.4) },
    { key: "r3", label: "Left D", x: 34, y: 78, fit: w(0, 0, 0.6) },
    { key: "r4", label: "Right D", x: 66, y: 78, fit: w(0, 0, 0.6) },
  ],
  diamond: [
    { key: "r1", label: "Top (pressure)", x: 50, y: 32, fit: w(0.1, 0.2, 0.2) },
    { key: "r2", label: "Left Wing", x: 24, y: 60, fit: w(0, 0.2, 0.4) },
    { key: "r3", label: "Right Wing", x: 76, y: 60, fit: w(0, 0.2, 0.4) },
    { key: "r4", label: "Bottom (net)", x: 50, y: 82, fit: w(0, 0, 0.6) },
  ],
  aggressive: [
    { key: "r1", label: "Pressure F", x: 40, y: 26, fit: w(0.1, 0, 0.2) },
    { key: "r2", label: "Pressure F", x: 60, y: 26, fit: w(0.1, 0, 0.2) },
    { key: "r3", label: "Left D", x: 32, y: 70, fit: w(0, 0, 0.5) },
    { key: "r4", label: "Right D", x: 68, y: 70, fit: w(0, 0, 0.5) },
  ],
};

/** Greedy best-fit assignment: for each role (in order), give it the best
 *  remaining player. Fine for 4-5 items — an illustration, not an optimizer. */
export function assignRoles<T extends { id: number }>(
  roles: FormationRole[],
  players: (T & RoleAttrs)[],
): { role: FormationRole; player: (T & RoleAttrs) | null }[] {
  const pool = [...players];
  return roles.map((role) => {
    if (!pool.length) return { role, player: null };
    let bestIdx = 0, bestScore = -Infinity;
    pool.forEach((p, i) => { const s = role.fit(p); if (s > bestScore) { bestScore = s; bestIdx = i; } });
    const [player] = pool.splice(bestIdx, 1);
    return { role, player };
  });
}
