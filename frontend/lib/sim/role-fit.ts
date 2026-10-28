// Role diversity of a line/pair — pure, client-safe (mirrors chemistry.ts).
//
// STHS rewards complementary roles: a forward line wants a playmaking C + a
// sniper + a grinder; a D pair wants an offensive quarterback + a stay-at-home
// defender. Used by BOTH the sim (lib/sim/ratings.ts — feeds chemFactor, a real
// offensive-output multiplier) and the UI (Line Editor's live badge, and the
// Line Builder's numeric "tactical fit" via lib/line-builder-server.ts) — same
// formula everywhere, so what a GM sees always matches what the sim rewards.
//
// A defenseman's off/def blend (and a forward's play/snipe/grind blend) is
// compared against the LEAGUE-AVERAGE blend for his position (lib/ratingBands.ts's
// AVG table — the same baseline already used to colour ratings elsewhere), not
// against the OTHER side's raw score. Raw comparison was the original bug: every
// defenseman's defensive attributes (DF/ST) cluster far higher than his offensive
// ones (PA/SK/SC) league-wide, so an off>=def check called nearly every D
// "defensive" even genuinely offensive ones — Evan Bouchard (a real Offensive
// Defenseman by the player-profile-page formula) still lost every off>=def
// comparison to his own DF/ST. Centring each side on its position's average
// fixes that: a player only counts as offense-leaning if he's MORE offensive
// than a typical D, not merely less defensive than he is offensive.
//
// Fit is then a CONTINUOUS 0..1 score — how far apart (in role-space) the unit's
// members sit relative to the league-average player, not just a same/different
// role flag — so a strongly complementary pair (e.g. a true shutdown D next to a
// true offensive-QB D) scores meaningfully higher than a barely-complementary one,
// instead of both landing on the same flat "mixed" value.

import { AVG } from "../ratingBands";

export type RoleFitAttrs = {
  pa?: number | null; sk?: number | null; sc?: number | null;
  ck?: number | null; fo?: number | null; st?: number | null; df?: number | null;
};

export type Role = "OFD" | "DFD" | "PLAY" | "SNIPE" | "GRIND";

// League-average off/def (D) and play/snipe/grind (F) blends, from the SAME
// weights roleOf uses below — the "centre" a player's own blend is measured
// against. Computed once at module load, not per call.
const D_OFF_CENTRE = 0.5 * AVG.D.pa + 0.3 * AVG.D.sk + 0.2 * AVG.D.sc;
const D_DEF_CENTRE = 0.5 * AVG.D.df + 0.3 * AVG.D.st + 0.2 * AVG.D.ck;
const F_PLAY_CENTRE = 0.6 * AVG.F.pa + 0.4 * AVG.F.fo;
const F_SNIPE_CENTRE = 0.6 * AVG.F.sc + 0.4 * AVG.F.sk;
const F_GRIND_CENTRE = 0.5 * AVG.F.ck + 0.3 * AVG.F.df + 0.2 * AVG.F.st;

/** 0..1: how much real offence (SC+PA) a forward brings — 0 at/below 98, 1 at 105+. 105 is the bar for a power forward to add anything on a scoring line (league median ~112). */
export function offenceGate(a: RoleFitAttrs): number {
  return Math.max(0, Math.min(1, ((a.sc ?? 50) + (a.pa ?? 50) - 98) / 7));
}

/** This player's position in "role-space", relative to his position's league
 *  average: for a D, a single signed lean (>0 offense-leaning, <0 defense-leaning);
 *  for a forward, a 3-axis vector (play, snipe, grind), each relative to average. */
function roleVector(a: RoleFitAttrs, isDef: boolean, scoringLine = false): number[] {
  if (isDef) {
    const off = 0.5 * (a.pa ?? 50) + 0.3 * (a.sk ?? 50) + 0.2 * (a.sc ?? 50);
    const def = 0.5 * (a.df ?? 50) + 0.3 * (a.st ?? 50) + 0.2 * (a.ck ?? 50);
    return [(off - D_OFF_CENTRE) - (def - D_DEF_CENTRE)];
  }
  const play = 0.6 * (a.pa ?? 50) + 0.4 * (a.fo ?? 50);
  const snipe = 0.6 * (a.sc ?? 50) + 0.4 * (a.sk ?? 50);
  const grind = 0.5 * (a.ck ?? 50) + 0.3 * (a.df ?? 50) + 0.2 * (a.st ?? 50);
  // A grinder only counts as a real complement to the extent he can also play offence (a power forward);
  // otherwise any weak 4th-liner with high CK/DF would look like the "ideal" third man on a top line.
  // a role is what a player is GOOD at: below-average play/snipe/grind doesn't make him a "different" role, just a
  // weaker player (otherwise a checker with no offence read as the perfect complement to two skill forwards)
  const up = (v: number) => Math.max(0, v);
  return [up(play - F_PLAY_CENTRE), up(snipe - F_SNIPE_CENTRE), up(grind - F_GRIND_CENTRE) * (scoringLine ? offenceGate(a) : 0.35 + 0.65 * offenceGate(a))];
}

const euclid = (v1: number[], v2: number[]) => Math.sqrt(v1.reduce((s, x, i) => s + (x - v2[i]) ** 2, 0));

/** This player's role LABEL — which way he leans relative to his position's
 *  league average (a genuinely offensive D by league standards, not just "less
 *  defensive than offensive" on his own raw numbers). */
export function roleOf(a: RoleFitAttrs, isDef: boolean): Role {
  if (isDef) {
    const [lean] = roleVector(a, true);
    return lean >= 0 ? "OFD" : "DFD";
  }
  const [play, snipe, grind] = roleVector(a, false);
  return play >= snipe && play >= grind ? "PLAY" : snipe >= grind ? "SNIPE" : "GRIND";
}

// How far apart (in role-space) a unit's members need to sit before fit
// saturates at 1.0, and the floor for a fully role-redundant unit (members
// with an identical role-space position) — hand-tuned against real rosters,
// same spirit as lib/sim/tactics.ts's fitDim centre/spread constants.
const SATURATION = { def: 28, fwd: 24 };
const FLOOR = { def: 0.4, fwd: 0.25 };
// forward lean (points above the position's league average) at which a job counts as fully covered: play, snipe, grind
const F_COVER = [12, 14, 12];

/** 0..1 role diversity of a unit (forward trio/pair or D pair) — how far apart
 *  its members sit in role-space relative to the league average, continuous
 *  (not just same/different). 1 = ideally complementary (STHS rewards this
 *  in-sim via chemFactor); a unit of one member is neutral (1). */
/** `scoringLine`: a 1st/2nd line — a checker adds NOTHING to the grind job unless he clears the 105 SC+PA bar. */
export function roleFitOf(members: RoleFitAttrs[], isDef: boolean, scoringLine = false): number {
  if (members.length < 2) return 1;
  const vecs = members.map((m) => roleVector(m, isDef, scoringLine));
  if (!isDef) {
    // Forwards: COVERAGE of the three jobs (create / finish / win pucks) by the unit's best man at each — not
    // the distance between members, which handed a no-offence checker the "perfect complement" score just for
    // being far from two skill players. A power forward (hits AND scores) covers the grind job with real offence.
    const cover = [0, 1, 2].map((k) => Math.min(1, Math.max(...vecs.map((v) => v[k])) / F_COVER[k]));
    return FLOOR.fwd + ((cover[0] + cover[1] + cover[2]) / 3) * (1 - FLOOR.fwd);
  }
  let total = 0, pairs = 0;
  for (let i = 0; i < vecs.length; i++) {
    for (let j = i + 1; j < vecs.length; j++) { total += euclid(vecs[i], vecs[j]); pairs++; }
  }
  const avgDist = pairs ? total / pairs : 0;
  const sat = isDef ? SATURATION.def : SATURATION.fwd;
  const floor = isDef ? FLOOR.def : FLOOR.fwd;
  return Math.max(floor, Math.min(1, floor + (avgDist / sat) * (1 - floor)));
}

export const ROLE_LABEL: Record<Role, string> = {
  OFD: "Offensive Defenceman", DFD: "Defensive Defenceman", PLAY: "Playmaker", SNIPE: "Sniper", GRIND: "Grinder",
};
