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
export type RoleAttrs = { sc: number; pa: number; st: number; isD: boolean };

// dPref: +1 = this role wants whoever's in a D personnel slot (LD/RD on PP,
// LD/RD on PK), -1 = wants a forward slot (LW/C/RW on PP, C/W on PK), 0 =
// no preference. The bonus dominates the sc/pa/st spread (0..99 scale, max
// weighted contribution ~99) so e.g. Point reliably goes to whoever's on the
// blue line in the personnel picker, not just whoever has the highest PA —
// a real 1-3-1/Umbrella/Overload point is manned by the unit's D (or the
// forward the GM deliberately dropped into the LD/RD slot for exactly that
// job — the picker already lets a forward play there).
const D_BONUS = 40;
const w = (sc: number, pa: number, st: number, dPref: 0 | 1 | -1 = 0) =>
  (a: RoleAttrs) => a.sc * sc + a.pa * pa + a.st * st + (dPref === 0 ? 0 : dPref * (a.isD ? D_BONUS : -D_BONUS));

// Balanced has no signature (DIAL_DESC: "No signature power play") — it isn't
// a real tactical shape, so it must not pretend to be one. No attribute
// reassignment either (fit is a flat 0 for every role): the 5 slots just show
// each player where he actually sits in the PP personnel picker below
// (LW/C/RW/LD/RD, in that order), in a neutral standard alignment.
const NO_FIT = () => 0;
export const PP_LAYOUTS: Record<PpStyle, FormationRole[]> = {
  balanced: [
    { key: "r1", label: "LW", x: 26, y: 55, fit: NO_FIT },
    { key: "r2", label: "C", x: 50, y: 38, fit: NO_FIT },
    { key: "r3", label: "RW", x: 74, y: 55, fit: NO_FIT },
    { key: "r4", label: "LD", x: 30, y: 84, fit: NO_FIT },
    { key: "r5", label: "RD", x: 70, y: 84, fit: NO_FIT },
  ],
  // Real 1-2-2 shape (per NHL coaching references): one point up top, two
  // half-walls at the tops of the circles, and TWO players low — one at the
  // net front, one working below the goal line/around the crease — not a
  // single "bumper" in the middle.
  umbrella: [
    { key: "r1", label: "Point", x: 50, y: 84, fit: w(0.7, 0.3, 0, 1) },
    { key: "r2", label: "Left Half-Wall", x: 24, y: 58, fit: w(0.5, 0.5, 0, -1) },
    { key: "r3", label: "Right Half-Wall", x: 76, y: 58, fit: w(0.5, 0.5, 0, -1) },
    { key: "r4", label: "Net-Front", x: 34, y: 20, fit: w(0, 0.2, 0.8, -1) },
    { key: "r5", label: "Below the Goal Line", x: 68, y: 14, fit: w(0.3, 0.4, 0.3, -1) },
  ],
  "131": [
    { key: "r1", label: "Point", x: 50, y: 84, fit: w(0.2, 0.8, 0, 1) },
    { key: "r2", label: "Left Half-Wall", x: 22, y: 58, fit: w(0.5, 0.5, 0, -1) },
    { key: "r3", label: "Right Half-Wall", x: 78, y: 58, fit: w(0.5, 0.5, 0, -1) },
    { key: "r4", label: "Bumper (one-timer)", x: 50, y: 40, fit: w(0.75, 0.25, 0, -1) },
    { key: "r5", label: "Net-Front", x: 50, y: 16, fit: w(0, 0.2, 0.8, -1) },
  ],
  overload: [
    { key: "r1", label: "Point", x: 62, y: 82, fit: w(0.2, 0.6, 0.2, 1) },
    { key: "r2", label: "Half-Boards", x: 28, y: 60, fit: w(0.2, 0.6, 0.2, -1) },
    { key: "r3", label: "Corner", x: 16, y: 34, fit: w(0.2, 0.5, 0.5, -1) },
    { key: "r4", label: "Net-Front", x: 50, y: 18, fit: w(0, 0.2, 0.8, -1) },
    { key: "r5", label: "Backdoor", x: 78, y: 30, fit: w(0.75, 0.15, 0, -1) },
  ],
};

export const PK_LAYOUTS: Record<PkStyle, FormationRole[]> = {
  // Standard penalty kill has no signature either — plain positions, no
  // attribute reassignment, same reasoning as the PP's balanced above.
  balanced: [
    { key: "r1", label: "C", x: 32, y: 52, fit: NO_FIT },
    { key: "r2", label: "W", x: 68, y: 52, fit: NO_FIT },
    { key: "r3", label: "LD", x: 32, y: 80, fit: NO_FIT },
    { key: "r4", label: "RD", x: 68, y: 80, fit: NO_FIT },
  ],
  box: [
    { key: "r1", label: "Left Top", x: 34, y: 40, fit: w(0, 0.2, 0.4, -1) },
    { key: "r2", label: "Right Top", x: 66, y: 40, fit: w(0, 0.2, 0.4, -1) },
    { key: "r3", label: "Left D", x: 34, y: 78, fit: w(0, 0, 0.6, 1) },
    { key: "r4", label: "Right D", x: 66, y: 78, fit: w(0, 0, 0.6, 1) },
  ],
  diamond: [
    { key: "r1", label: "Top (pressure)", x: 50, y: 32, fit: w(0.1, 0.2, 0.2, -1) },
    { key: "r2", label: "Left Wing", x: 24, y: 60, fit: w(0, 0.2, 0.4, -1) },
    { key: "r3", label: "Right Wing", x: 76, y: 60, fit: w(0, 0.2, 0.4, -1) },
    { key: "r4", label: "Bottom (net)", x: 50, y: 82, fit: w(0, 0, 0.6, 1) },
  ],
  aggressive: [
    { key: "r1", label: "Pressure F", x: 40, y: 26, fit: w(0.1, 0, 0.2, -1) },
    { key: "r2", label: "Pressure F", x: 60, y: 26, fit: w(0.1, 0, 0.2, -1) },
    { key: "r3", label: "Left D", x: 32, y: 70, fit: w(0, 0, 0.5, 1) },
    { key: "r4", label: "Right D", x: 68, y: 70, fit: w(0, 0, 0.5, 1) },
  ],
};

/** Optimal role assignment (maximizes TOTAL fit across all roles at once), via
 *  bitmask DP over the player set — cheap at n<=5 (2^5 = 32 states). A simple
 *  greedy that fills roles in array order is order-dependent: whichever role
 *  came LAST always just got whoever was left over, never its own best fit,
 *  even when a much better match for it was available but got claimed by an
 *  earlier role first (e.g. Net-Front, listed last, ending up with a mobile
 *  puck-mover D instead of the unit's most physical player). */
export function assignRoles<T extends { id: number }>(
  roles: FormationRole[],
  players: (T & RoleAttrs)[],
): { role: FormationRole; player: (T & RoleAttrs) | null }[] {
  const n = roles.length, m = players.length;
  if (m === 0) return roles.map((role) => ({ role, player: null }));
  const fitOf = roles.map((role) => players.map((p) => role.fit(p)));
  const full = 1 << m;
  const NEG = -Infinity;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(full).fill(NEG));
  const choice: number[][] = Array.from({ length: n + 1 }, () => new Array(full).fill(-1));
  dp[0][0] = 0;
  for (let r = 0; r < n; r++) {
    for (let mask = 0; mask < full; mask++) {
      if (dp[r][mask] === NEG) continue;
      if (dp[r][mask] > dp[r + 1][mask]) { dp[r + 1][mask] = dp[r][mask]; choice[r + 1][mask] = -1; } // role left unfilled
      for (let p = 0; p < m; p++) {
        if (mask & (1 << p)) continue;
        const nextMask = mask | (1 << p);
        // +EPS: an all-tied fit (e.g. "balanced", where every role scores 0)
        // must still fill every slot rather than the DP settling on leaving
        // everyone unassigned — filling is infinitesimally preferred over
        // leaving a role empty, never enough to override a real fit gap.
        const score = dp[r][mask] + fitOf[r][p] + 1e-6;
        if (score > dp[r + 1][nextMask]) { dp[r + 1][nextMask] = score; choice[r + 1][nextMask] = p; }
      }
    }
  }
  let bestMask = 0, bestScore = NEG;
  for (let mask = 0; mask < full; mask++) if (dp[n][mask] > bestScore) { bestScore = dp[n][mask]; bestMask = mask; }
  const assign: (number | null)[] = new Array(n).fill(null);
  let mask = bestMask;
  for (let r = n; r > 0; r--) {
    const p = choice[r][mask];
    assign[r - 1] = p;
    if (p !== -1 && p != null) mask &= ~(1 << p);
  }
  return roles.map((role, i) => ({ role, player: assign[i] != null ? players[assign[i] as number] : null }));
}
