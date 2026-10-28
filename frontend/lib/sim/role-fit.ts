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
import { playerType } from "../player-type";

export type RoleFitAttrs = {
  pa?: number | null; sk?: number | null; sc?: number | null;
  ck?: number | null; fo?: number | null; st?: number | null; df?: number | null; ph?: number | null;
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
  // A grinder only counts as a real complement to the extent he can also play offence;
  // otherwise any weak 4th-liner with high CK/DF would look like the "ideal" third man on a top line.
  // a role is what a player is GOOD at: below-average play/snipe/grind doesn't make him a "different" role, just a
  // weaker player (otherwise a checker with no offence read as the perfect complement to two skill forwards)
  const up = (v: number) => Math.max(0, v);
  const pl = up(play - F_PLAY_CENTRE), sn = up(snipe - F_SNIPE_CENTRE);
  // a Dual-Threat (the league's own player type: creates AND finishes, with the skating/puck handling to carry it) wins
  // pucks by puck control (skating, puck handling) rather than physically — he carries part of the third job himself,
  // so a line of such stars isn't marked down as hard for lacking a hitter, but a real checker with offence covers it better
  const dual = playerType({ position: "LW", sc: a.sc, pa: a.pa, df: a.df, ck: a.ck, st: a.st, sk: a.sk, ph: a.ph }) === "Dual-Threat";
  const control = dual ? DUAL_CONTROL * F_COVER[2] : 0;
  return [pl, sn, Math.max(control, up(grind - F_GRIND_CENTRE) * (scoringLine ? offenceGate(a) : 0.35 + 0.65 * offenceGate(a)))];
}

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

// Floor for a unit that covers none of its jobs — hand-tuned against real rosters, same spirit as
// lib/sim/tactics.ts's fitDim centre/spread constants.
const FLOOR = { def: 0.4, fwd: 0.25 };
// forward lean (points above the position's league average) at which a job counts as fully covered: play, snipe, grind
const F_COVER = [12, 14, 12];
const D_COVER = { off: 12, def: 6.5 }; // D lean (points above the D average) at which a job counts as fully covered
const DUAL_CONTROL = 0.6; // share of the puck-winning job a Dual-Threat covers by puck control (skating/puck handling), NOT by checking — measured: CK 62 on average, none above 75

/** 0..1 role diversity of a unit (forward trio/pair or D pair) — how far apart
 *  its members sit in role-space relative to the league average, continuous
 *  (not just same/different). 1 = ideally complementary (STHS rewards this
 *  in-sim via chemFactor); a unit of one member is neutral (1). */
/** `scoringLine`: a 1st/2nd line — a checker adds NOTHING to the grind job unless he clears the 105 SC+PA bar. */
export function roleFitOf(members: RoleFitAttrs[], isDef: boolean, scoringLine = false): number {
  if (members.length < 2) return 1;
  if (!isDef) {
    // Forwards: COVERAGE of the three jobs (create / finish / win pucks) by the unit's best man at each — not
    // the distance between members, which handed a no-offence checker the "perfect complement" score just for
    // being far from two skill players. A hitter with real offence covers the grind job properly.
    const vecs = members.map((m) => roleVector(m, false, scoringLine));
    const cover = [0, 1, 2].map((k) => Math.min(1, Math.max(...vecs.map((v) => v[k])) / F_COVER[k]));
    return FLOOR.fwd + ((cover[0] + cover[1] + cover[2]) / 3) * (1 - FLOOR.fwd);
  }
  // D pairs: COVERAGE of the two jobs (move the puck / defend) by the pair's best man at each — a pair of two
  // genuine two-way D covers both, an offensive D beside a stay-at-home D covers both, two of the same kind don't.
  // (Defensive ratings cluster tightly league-wide, so that job saturates at a smaller lean than the offensive one.)
  const lean = (m: RoleFitAttrs) => ({
    off: Math.max(0, 0.5 * (m.pa ?? 50) + 0.3 * (m.sk ?? 50) + 0.2 * (m.sc ?? 50) - D_OFF_CENTRE),
    def: Math.max(0, 0.5 * (m.df ?? 50) + 0.3 * (m.st ?? 50) + 0.2 * (m.ck ?? 50) - D_DEF_CENTRE),
  });
  const ls = members.map(lean);
  const cover = (Math.min(1, Math.max(...ls.map((l) => l.off)) / D_COVER.off) + Math.min(1, Math.max(...ls.map((l) => l.def)) / D_COVER.def)) / 2;
  return FLOOR.def + cover * (1 - FLOOR.def);
}

export const ROLE_LABEL: Record<Role, string> = {
  OFD: "Offensive Defenceman", DFD: "Defensive Defenceman", PLAY: "Playmaker", SNIPE: "Sniper", GRIND: "Grinder",
};
