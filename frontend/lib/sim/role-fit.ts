// Role diversity of a line/pair — pure, client-safe (mirrors chemistry.ts).
//
// STHS rewards complementary roles: a forward line wants a playmaking C + a
// sniper + a grinder; a D pair wants an offensive quarterback + a stay-at-home
// defender. Three (or two) of the same type clash — low fit. Used by BOTH the
// sim (lib/sim/ratings.ts — feeds chemFactor, a real offensive-output multiplier)
// and the Line Editor UI (a live badge so a GM can see fit while dragging
// players between lines, before saving — same pattern as the chemistry badge).

export type RoleFitAttrs = {
  pa?: number | null; sk?: number | null; sc?: number | null;
  ck?: number | null; fo?: number | null; st?: number | null; df?: number | null;
};

export type Role = "OFD" | "DFD" | "PLAY" | "SNIPE" | "GRIND";

/** This player's role within a line/pair, from his raw attributes. */
export function roleOf(a: RoleFitAttrs, isDef: boolean): Role {
  if (isDef) {
    const off = 0.5 * (a.pa ?? 50) + 0.3 * (a.sk ?? 50) + 0.2 * (a.sc ?? 50);
    const def = 0.5 * (a.df ?? 50) + 0.3 * (a.st ?? 50) + 0.2 * (a.ck ?? 50);
    return off >= def ? "OFD" : "DFD";
  }
  const play = 0.6 * (a.pa ?? 50) + 0.4 * (a.fo ?? 50);
  const snipe = 0.6 * (a.sc ?? 50) + 0.4 * (a.sk ?? 50);
  const grind = 0.5 * (a.ck ?? 50) + 0.3 * (a.df ?? 50) + 0.2 * (a.st ?? 50);
  return play >= snipe && play >= grind ? "PLAY" : snipe >= grind ? "SNIPE" : "GRIND";
}

/** 0..1 role diversity of a unit (forward trio or D pair). 1 = ideal complementary
 *  mix (STHS rewards this in-sim via chemFactor); a unit of one member is neutral. */
export function roleFitOf(members: RoleFitAttrs[], isDef: boolean): number {
  if (members.length < 2) return 1;
  const distinct = new Set(members.map((m) => roleOf(m, isDef))).size;
  if (isDef) return distinct >= 2 ? 1 : 0.4;                // pair: mixed = 1, redundant = 0.4
  return distinct >= 3 ? 1 : distinct === 2 ? 0.6 : 0.25;    // trio: 3 roles = 1, 2 = 0.6, 1 = 0.25
}

export const ROLE_LABEL: Record<Role, string> = {
  OFD: "Offensive D", DFD: "Defensive D", PLAY: "Playmaker", SNIPE: "Sniper", GRIND: "Grinder",
};
