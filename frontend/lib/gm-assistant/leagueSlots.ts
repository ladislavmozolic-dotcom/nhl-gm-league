import { prisma } from "@/lib/prisma";
import { autoLines } from "@/lib/sim/lines-core";

// Shared slot model for UNHL Intelligence's roster-shape tools (Analyze My Roster,
// Find Trade Partner). Every slot below — forward lines, D pairs, the starting
// goalie tandem, and the top PP/PK units — is read from a club's own saved
// Team Lines wherever it has one set. Whatever a club HASN'T set (missing
// forward lines, an unset PP1, no goalie tandem chosen, ...) is filled in
// per-slot with the sim's own autoLines() fallback (lib/sim/lines-core.ts) —
// never written back, never shown on that club's own Lines page, only held in
// memory for this comparison — so every ranking always covers all 32 clubs.
// Which exact slots used the fallback for a given club is tracked per-slot
// (not per-club): a club can have real forward lines but no PP1 set, and
// that's shown as auto only on the PP1 finding, not the whole club.

type ForwardSide = "lw" | "c" | "rw";
type DefenseSide = "ld" | "rd";

// A player's peer pool for percentile normalization (see ROLE_WEIGHTS below) —
// Centers, Wingers, Defensemen. Goalies have their own separate pool (G),
// tracked outside this type since they never share a role/weight table with skaters.
type RoleGroup = "C" | "W" | "D";
type RoleKey =
  | "top6C" | "top6W" | "bottom6C" | "bottom6W"
  | "ppForward" | "pkCenter" | "pkWinger"
  | "offensiveD" | "twoWayD" | "shutdownD" | "bottomPairD" | "ppDefenseman" | "pkDefenseman";

export interface SlotDef {
  id: string;
  label: string;
  kind: "forward" | "defense" | "special" | "goalie";
  lineIdxs?: number[]; // forward/defense: 0-based indexes into forwardLines / defensePairs
  side?: ForwardSide | DefenseSide; // forward/defense
  situationsKey?: "pp" | "pk4"; // special
  unitIdx?: 0 | 1; // special: which of the club's 2 saved PP/PK units (0 = first, 1 = second)
  goalieRole?: "starter" | "backup"; // goalie
  // forward/defense only: which role-score formula and percentile peer group
  // (see ROLE_WEIGHTS) rates a player in this slot. Special-teams slots don't
  // set this — PP1/PP2/PK1/PK2 pick a forward-vs-D (and C-vs-W) formula per
  // player at score time instead, since one unit mixes positions.
  role?: { group: RoleGroup; key: RoleKey };
}

// Top slot vs. depth slot, per side — mirrors how GMs actually talk about a
// lineup ("top-line C", "bottom-pair RD") and is exactly granular enough to
// reproduce findings like "2nd/3rd-pair RD". Plus the starting goalie tandem
// and each club's two PP/PK units. Role/group per slot follows the "UNHL
// Intelligence / Analyze My Roster" spec doc (2026-09, supplied by the user) —
// see ROLE_WEIGHTS for the exact weight tables.
export const SLOTS: SlotDef[] = [
  { id: "lw-top", label: "Top-line LW", kind: "forward", lineIdxs: [0], side: "lw", role: { group: "W", key: "top6W" } },
  { id: "lw-depth", label: "Depth LW (2.–4. formácia)", kind: "forward", lineIdxs: [1, 2, 3], side: "lw", role: { group: "W", key: "bottom6W" } },
  { id: "c-top", label: "Top-line C", kind: "forward", lineIdxs: [0], side: "c", role: { group: "C", key: "top6C" } },
  { id: "c-depth", label: "Depth C (2.–4. formácia)", kind: "forward", lineIdxs: [1, 2, 3], side: "c", role: { group: "C", key: "bottom6C" } },
  { id: "rw-top", label: "Top-line RW", kind: "forward", lineIdxs: [0], side: "rw", role: { group: "W", key: "top6W" } },
  { id: "rw-depth", label: "Depth RW (2.–4. formácia)", kind: "forward", lineIdxs: [1, 2, 3], side: "rw", role: { group: "W", key: "bottom6W" } },
  { id: "ld-top", label: "Top-pár LD", kind: "defense", lineIdxs: [0], side: "ld", role: { group: "D", key: "twoWayD" } },
  { id: "ld-bottom", label: "2.–3. pár LD", kind: "defense", lineIdxs: [1, 2], side: "ld", role: { group: "D", key: "bottomPairD" } },
  { id: "rd-top", label: "Top-pár RD", kind: "defense", lineIdxs: [0], side: "rd", role: { group: "D", key: "twoWayD" } },
  { id: "rd-bottom", label: "2.–3. pár RD", kind: "defense", lineIdxs: [1, 2], side: "rd", role: { group: "D", key: "bottomPairD" } },
  { id: "goalie-starter", label: "Štartujúci brankár", kind: "goalie", goalieRole: "starter" },
  { id: "goalie-backup", label: "Náhradný brankár", kind: "goalie", goalieRole: "backup" },
  { id: "pp1", label: "PP1 (presilovka č.1)", kind: "special", situationsKey: "pp", unitIdx: 0 },
  { id: "pp2", label: "PP2 (presilovka č.2)", kind: "special", situationsKey: "pp", unitIdx: 1 },
  { id: "pk1", label: "PK1 (oslabenie č.1)", kind: "special", situationsKey: "pk4", unitIdx: 0 },
  { id: "pk2", label: "PK2 (oslabenie č.2)", kind: "special", situationsKey: "pk4", unitIdx: 1 },
];

export function slotById(id: string): SlotDef | undefined {
  return SLOTS.find((s) => s.id === id);
}

/** Maps a slot to the Find Player position filter that fills it — "ALL" for
 *  PP1/PK1, which draw from multiple positions and have no single fit. */
export function slotPositionFilter(slot: SlotDef): "C" | "LW" | "RW" | "D" | "G" | "ALL" {
  if (slot.kind === "goalie") return "G";
  if (slot.kind === "forward") return slot.side!.toUpperCase() as "LW" | "C" | "RW";
  if (slot.kind === "defense") return "D";
  return "ALL";
}

export interface SlotPlayer {
  id: number;
  name: string;
  slug: string;
  overall: number | null; // OV — orientational only, shown as secondary reference
  // The rating this player is actually ranked/averaged by: for skaters, the
  // role-and-percentile score for whatever slot they're shown in (see
  // ROLE_WEIGHTS/weightedPercentile below — OV is never an input, per the
  // spec doc's core rule); for goalies, the Goalie Quality Score (also
  // percentile-based — see GOALIE_QUALITY_WEIGHTS). See memory: ov-vs-specific-params.
  rating: number | null;
  // Raw params behind the general-purpose compositeRating() fallback (used
  // only if a slot has no role mapping) — null for goalies.
  raw: RawSkaterParams | null;
  // Needed to pick a role formula for special-teams slots (PP1/PP2/PK1/PK2),
  // which mix forwards and D in one unit — null for goalies.
  position: string | null;
}

// These six don't share a scale: across the current NHL skater pool, CK and
// DF sit centered around ~69 (players reach the high 90s), while PA and SC
// sit centered around ~54-55 and rarely clear ~78, and SK/PH sit lower still
// (~51-52) with a wide spread. A plain average of the raw numbers would give
// "high CK" more weight than "high SC" for no reason other than CK's ceiling
// being higher — a checking/defense-heavy grinder would out-rate an elite
// scorer/skater on that measure alone, regardless of which one actually
// helps a given slot more. Fixed calibration snapshot (mean, sd) per param,
// taken from the live NHL skater pool — not refit automatically, so
// recompute these pairs if the edge-engine ratings ever get rebalanced
// league-wide (see memory: local-db-stale-vs-production — always recompute
// from production, never local dev).
//
// CK/PA/SC/DF plus SK (skating) and PH (puckhandling) — the parameters that
// feed a skater's actual on-ice production and puck skill. PS (penalty
// shot/shootout conversion) was considered and left out: it only matters in
// a handful of shootouts a season and barely differentiates most players, so
// it would mostly add scale-unrelated noise rather than a real quality
// signal. FG/DI/ST/EN/DU/FO/EX/LD/MO are also left out — they're
// fitness/intangible/situational ratings (fighting, discipline, faceoffs,
// endurance, durability, clutch, morale), not "how good is this player at
// hockey" skill parameters, which is what this composite is for.
const PARAM_STATS: Record<"ck" | "pa" | "sc" | "df" | "sk" | "ph", { mean: number; sd: number }> = {
  ck: { mean: 69.1, sd: 7.6 },
  pa: { mean: 55.4, sd: 5.7 },
  sc: { mean: 53.4, sd: 6.4 },
  df: { mean: 69.5, sd: 6.5 },
  sk: { mean: 51.4, sd: 9.3 },
  ph: { mean: 51.5, sd: 9.7 },
};
const PARAM_KEYS = Object.keys(PARAM_STATS) as (keyof typeof PARAM_STATS)[];
// Re-centers the composite back onto a familiar ~0-100 scale (the average of
// the raw means/sds above) so it still reads like "a rating", not a bare
// z-score, while the z-scoring itself is what actually makes the average fair.
const COMPOSITE_CENTER = PARAM_KEYS.reduce((s, k) => s + PARAM_STATS[k].mean, 0) / PARAM_KEYS.length;
const COMPOSITE_SPREAD = PARAM_KEYS.reduce((s, k) => s + PARAM_STATS[k].sd, 0) / PARAM_KEYS.length;

type ParamKey = keyof typeof PARAM_STATS;
type RawSkaterParams = { ck: number | null; pa: number | null; sc: number | null; df: number | null; sk?: number | null; ph?: number | null };

/** Shared z-score-and-rescale step behind every composite below: standardizes
 *  each given param against its own league-wide mean/sd (PARAM_STATS) so a
 *  player 2 sd above average in one param counts the same as 2 sd above
 *  average in another, then averages and rescales back onto a ~0-100 rating
 *  centered on the mean of just the params actually used. */
function zComposite(p: RawSkaterParams, keys: ParamKey[]): number | null {
  const zs: number[] = [];
  for (const key of keys) {
    const v = p[key];
    if (v == null) continue;
    const { mean, sd } = PARAM_STATS[key];
    zs.push((v - mean) / sd);
  }
  if (!zs.length) return null;
  const avgZ = zs.reduce((s, v) => s + v, 0) / zs.length;
  const center = keys.reduce((s, k) => s + PARAM_STATS[k].mean, 0) / keys.length;
  const spread = keys.reduce((s, k) => s + PARAM_STATS[k].sd, 0) / keys.length;
  return Math.round((center + avgZ * spread) * 100) / 100;
}

/** Composite of whichever of CK/PA/SC/DF/SK/PH a skater has (null if none) —
 *  the general-purpose "how good is this player at hockey" rating used by
 *  Draft Intelligence, Player Fit, Ideal Role, Commissioner Intelligence and
 *  Similar Players (none of which have a specific line/pair/PP/PK role to
 *  score against). The SLOTS in this file use the role-specific percentile
 *  scores further down instead (see ROLE_WEIGHTS) — this stays only as their
 *  fallback if a slot is ever missing a role mapping. No single param
 *  dominates by design — same "no magic weighting" rule the rest of the sim follows. */
export function compositeRating(p: RawSkaterParams): number | null {
  return zComposite(p, PARAM_KEYS);
}

// ============================================================================
// Role-based percentile scoring — "UNHL Intelligence / Analyze My Roster"
// spec doc (2026-09, PDF supplied by the user). Every line/pair/special-teams
// slot below is scored with its OWN weighted mix of STHS parameters, and each
// parameter is first converted to a PERCENTILE within its own C/W/D (skater)
// or G (goalie) peer pool — not a raw number, and not standardized against
// the whole league at once like compositeRating() above. This is a stronger
// version of the same "don't let one param's scale dominate" idea: percentile
// is scale-free by construction (always 0-100, always relative to the actual
// peer pool a player is being judged against), so a shutdown center's DF/FO
// strength and a top-line winger's SC/PA strength are judged on a level
// field, and a bottom-pair D is judged against OTHER bottom-pair-caliber D,
// not against the league's elite. OV is never an input, per the doc's rule.
//
// compositeRating() above is kept as-is and still used by Draft Intelligence,
// Commissioner Intelligence and Similar Players, which need one generic "how
// good is this player at hockey" number, not a role-specific one. It also
// remains the fallback inside slotPlayers() below if a slot is ever missing a
// role mapping. Ideal Role and Player Fit hold ONE player up against these
// SLOTS' own team averages (rankSlot() below), so they need the matching
// role-weighted number for that comparison to mean anything — see
// roleRatingFor() further down, and don't reach for compositeRating() there.

type RoleParam = "ck" | "di" | "df" | "en" | "fo" | "pa" | "ph" | "sc" | "sk" | "st";
const ROLE_PARAM_KEYS: RoleParam[] = ["ck", "di", "df", "en", "fo", "pa", "ph", "sc", "sk", "st"];

// Weight tables straight from the spec doc's tables 2 ("Forward role scores")
// and 3 ("Defense role scores") — percentages there become fractional weights
// here (weightedPercentile() re-normalizes by weight actually used, so a
// missing param just drops out rather than skewing the score).
const ROLE_WEIGHTS: Record<RoleKey, Partial<Record<RoleParam, number>>> = {
  top6C: { sc: 25, pa: 25, fo: 15, ph: 10, sk: 10, df: 8, en: 5, st: 2 },
  top6W: { sc: 30, pa: 25, ph: 15, sk: 10, df: 8, st: 5, en: 5, ck: 2 },
  bottom6C: { df: 25, fo: 20, ck: 12, st: 10, en: 10, di: 8, pa: 7, sk: 5, sc: 3 },
  bottom6W: { df: 25, ck: 20, st: 15, en: 10, di: 10, sk: 8, pa: 5, sc: 5, ph: 2 },
  ppForward: { sc: 35, pa: 30, ph: 20, sk: 10, en: 5 },
  pkCenter: { df: 35, fo: 20, di: 15, en: 15, sk: 10, ck: 5 },
  pkWinger: { df: 45, di: 15, en: 15, ck: 10, sk: 10, st: 5 },
  // offensiveD/shutdownD: defined per the doc but not wired to a SLOT yet — our
  // D-pair slots only distinguish top-pair vs. depth (twoWayD/bottomPairD), not
  // a puck-mover/shutdown split within the top pair. Kept here so that finer
  // D-role slots can use them later without re-deriving the weights.
  offensiveD: { pa: 30, sk: 20, ph: 15, sc: 15, df: 10, en: 5, st: 5 },
  twoWayD: { df: 35, pa: 20, sk: 15, ck: 10, st: 8, ph: 7, en: 5 },
  shutdownD: { df: 45, ck: 20, st: 15, sk: 7, en: 7, di: 6 },
  bottomPairD: { df: 40, ck: 15, st: 15, di: 10, en: 10, sk: 5, pa: 5 },
  ppDefenseman: { pa: 35, sc: 25, ph: 20, sk: 10, en: 10 },
  pkDefenseman: { df: 50, ck: 15, st: 10, di: 10, en: 10, sk: 5 },
};

type GoalieParam = "sc" | "hs" | "rt" | "rb" | "ag" | "sk" | "sz";
const GOALIE_PARAM_KEYS: GoalieParam[] = ["sc", "hs", "rt", "rb", "ag", "sk", "sz"];
// Doc section 5.1 "Goalie Quality Score" — deliberately excludes EN/DU (doc
// treats those as a separate workload/reliability signal, not skill) and PH/PS/EX/LD/MO.
const GOALIE_QUALITY_WEIGHTS: Record<GoalieParam, number> = { sc: 22, hs: 22, rt: 22, rb: 18, ag: 8, sk: 4, sz: 4 };

/** Percentile rank (0-100) of every id's value within the given population —
 *  ties share the average rank of their tie group, the standard "percentile
 *  rank" definition. A population of 1 (or all-null) maps everyone to 50. */
function percentileMap(entries: { id: number; v: number | null }[]): Map<number, number> {
  const valid = entries
    .filter((e): e is { id: number; v: number } => e.v != null)
    .sort((a, b) => a.v - b.v);
  const n = valid.length;
  const map = new Map<number, number>();
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && valid[j].v === valid[i].v) j++;
    const pct = n > 1 ? (((i + j - 1) / 2) / (n - 1)) * 100 : 50;
    for (let k = i; k < j; k++) map.set(valid[k].id, pct);
    i = j;
  }
  return map;
}

/** Weighted average of a player's percentiles for whichever weighted params
 *  they have a percentile for (missing ones drop out and the rest re-normalize,
 *  same tolerance-for-missing-data rule as zComposite above). null if none. */
function weightedPercentile<K extends string>(playerId: number, table: Record<K, Map<number, number>>, weights: Partial<Record<K, number>>): number | null {
  let sum = 0;
  let wUsed = 0;
  for (const key of Object.keys(weights) as K[]) {
    const w = weights[key];
    if (w == null) continue;
    const pct = table[key]?.get(playerId);
    if (pct == null) continue;
    sum += pct * w;
    wUsed += w;
  }
  return wUsed > 0 ? Math.round((sum / wUsed) * 100) / 100 : null;
}

function isCenter(position: string): boolean { return position.includes("C"); }
function isWinger(position: string): boolean { return position.includes("LW") || position.includes("RW"); }
function isDefenseman(position: string): boolean { return position.includes("D"); }

interface RolePercentiles {
  C: Record<RoleParam, Map<number, number>>;
  W: Record<RoleParam, Map<number, number>>;
  D: Record<RoleParam, Map<number, number>>;
}

interface RoleParamRow {
  id: number;
  position: string;
  ck: number | null; di: number | null; df: number | null; en: number | null; fo: number | null;
  pa: number | null; ph: number | null; sc: number | null; sk: number | null; st: number | null;
}

function buildRolePercentileGroup(rows: RoleParamRow[]): Record<RoleParam, Map<number, number>> {
  const out = {} as Record<RoleParam, Map<number, number>>;
  for (const key of ROLE_PARAM_KEYS) out[key] = percentileMap(rows.map((p) => ({ id: p.id, v: p[key] })));
  return out;
}

/** Builds the C/W/D percentile pools from the full NHL-rostered skater
 *  population — a player with a dual-eligible position (e.g. "C/LW") appears
 *  in BOTH pools, since which one applies depends on which slot they're being
 *  judged for (a C/LW playing top-line C is judged against centers; the same
 *  player on a wing is judged against wingers), same as real scouting. */
function buildRolePercentiles(rows: RoleParamRow[]): RolePercentiles {
  return {
    C: buildRolePercentileGroup(rows.filter((p) => isCenter(p.position))),
    W: buildRolePercentileGroup(rows.filter((p) => isWinger(p.position))),
    D: buildRolePercentileGroup(rows.filter((p) => isDefenseman(p.position))),
  };
}

function buildGoaliePercentiles(rows: { id: number; goalieRating: Record<GoalieParam, number | null> | null }[]): Record<GoalieParam, Map<number, number>> {
  const out = {} as Record<GoalieParam, Map<number, number>>;
  for (const key of GOALIE_PARAM_KEYS) out[key] = percentileMap(rows.map((g) => ({ id: g.id, v: g.goalieRating?.[key] ?? null })));
  return out;
}

/** Which role formula + peer group rates a player in a PP/PK unit — these mix
 *  forwards and D in one unit, so (unlike a fixed line/pair slot) the role is
 *  picked per player from their own position, not from the SlotDef. */
function specialRoleFor(situationsKey: "pp" | "pk4", position: string): { group: RoleGroup; key: RoleKey } {
  if (isDefenseman(position)) return { group: "D", key: situationsKey === "pp" ? "ppDefenseman" : "pkDefenseman" };
  const group: RoleGroup = isCenter(position) ? "C" : "W";
  if (situationsKey === "pp") return { group, key: "ppForward" };
  return { group, key: group === "C" ? "pkCenter" : "pkWinger" };
}

interface ResolvedLines {
  forwardLines: { lw: number | null; c: number | null; rw: number | null }[];
  defensePairs: { ld: number | null; rd: number | null }[];
  ppUnits: (number | null)[][]; // [PP1, PP2]
  pkUnits: (number | null)[][]; // [PK1, PK2]
  starter: number | null;
  backup: number | null;
}

export interface LeagueSlotsData {
  teams: { id: number; name: string }[];
  resolved: Map<number, ResolvedLines>;
  // teamId -> set of slot ids whose value for that team came from the
  // autoLines() fallback rather than the club's own saved Team Lines.
  autoBySlot: Map<number, Set<string>>;
  playerMap: Map<number, SlotPlayer>; // skaters — SlotPlayer.rating is set per-slot by slotPlayers()
  goalieMap: Map<number, SlotPlayer>; // goalies — ditto (Goalie Quality Score, not GoalieRating.overall)
  // C/W/D and goalie percentile pools behind the role scores above — built
  // once from the full NHL-rostered population and reused for every slot/team
  // (and, in Scenario Engine, for hypothetical rosters too: a trade moves a
  // player between teams but never changes their own raw ratings, so the
  // league-wide percentile pool doesn't need to be rebuilt for it).
  rolePercentiles: RolePercentiles;
  goaliePercentiles: Record<GoalieParam, Map<number, number>>;
}

function hasAnyId(arr: unknown): arr is (number | null)[] {
  return Array.isArray(arr) && arr.some((id) => typeof id === "number");
}

/** Loads every NHL club's line/pair/goalie/special-teams assignments (real
 *  where saved, else an in-memory autoLines() best-lineup per slot) plus a
 *  lookup of every rostered skater/goalie's rating — the shared input both
 *  roster-shape tools rank against. */
export async function loadLeagueSlots(): Promise<LeagueSlotsData> {
  const [teams, linesRows, skaterRows, goalieRows] = await Promise.all([
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, name: true } }),
    prisma.teamLines.findMany({
      where: { team: { league: "NHL", isAffiliate: false } },
      select: { teamId: true, forwardLines: true, defensePairs: true, situations: true },
    }),
    // same roster filter teamLineBuilder/the sim use for its own auto-lines fallback —
    // also the population the C/W/D role percentiles below are built from.
    prisma.player.findMany({
      where: { team: { league: "NHL", isAffiliate: false }, rosterType: "NHL", isGoalie: false, scratched: false },
      select: {
        id: true, name: true, slug: true, overall: true, position: true, shoots: true, teamId: true,
        ck: true, pa: true, sc: true, df: true, sk: true, ph: true, di: true, en: true, fo: true, st: true,
      },
    }),
    prisma.player.findMany({
      where: { team: { league: "NHL", isAffiliate: false }, rosterType: "NHL", isGoalie: true, scratched: false },
      select: {
        id: true, name: true, slug: true, teamId: true,
        goalieRating: { select: { overall: true, sc: true, hs: true, rt: true, rb: true, ag: true, sk: true, sz: true } },
      },
    }),
  ]);

  const rolePercentiles = buildRolePercentiles(skaterRows);
  const goaliePercentiles = buildGoaliePercentiles(goalieRows);

  const playerMap = new Map<number, SlotPlayer>(
    skaterRows.map((p) => {
      const raw: RawSkaterParams = { ck: p.ck, pa: p.pa, sc: p.sc, df: p.df, sk: p.sk, ph: p.ph };
      return [p.id, { id: p.id, name: p.name, slug: p.slug, overall: p.overall, rating: compositeRating(raw), raw, position: p.position }];
    })
  );
  const goalieMap = new Map<number, SlotPlayer>(
    goalieRows.map((g) => {
      const overall = g.goalieRating?.overall ?? null;
      return [g.id, { id: g.id, name: g.name, slug: g.slug, overall, rating: overall, raw: null, position: null }];
    })
  );

  const linesByTeam = new Map(linesRows.map((l) => [l.teamId, l]));
  const skatersByTeam = new Map<number, typeof skaterRows>();
  for (const p of skaterRows) { const arr = skatersByTeam.get(p.teamId) ?? []; arr.push(p); skatersByTeam.set(p.teamId, arr); }
  const goaliesByTeam = new Map<number, typeof goalieRows>();
  for (const g of goalieRows) { const arr = goaliesByTeam.get(g.teamId) ?? []; arr.push(g); goaliesByTeam.set(g.teamId, arr); }

  const resolved = new Map<number, ResolvedLines>();
  const autoBySlot = new Map<number, Set<string>>();

  for (const team of teams) {
    const auto = new Set<string>();
    autoBySlot.set(team.id, auto);

    const teamSkaters = skatersByTeam.get(team.id) ?? [];
    const teamGoalies = goaliesByTeam.get(team.id) ?? [];
    // always computed — cheap pure function, used only for whatever this club
    // hasn't set itself (see per-field fallback below)
    const built = autoLines(
      teamSkaters.map((p) => ({ id: p.id, position: p.position, overall: p.overall ?? 0, shoots: p.shoots })),
      teamGoalies.map((g) => ({ id: g.id, overall: g.goalieRating?.overall ?? 0 }))
    );

    const saved = linesByTeam.get(team.id);
    const savedFl = Array.isArray(saved?.forwardLines) ? (saved!.forwardLines as ResolvedLines["forwardLines"]) : [];
    const savedDp = Array.isArray(saved?.defensePairs) ? (saved!.defensePairs as ResolvedLines["defensePairs"]) : [];
    const hasRealSkaterLines = savedFl.length > 0 && savedDp.length > 0;
    if (!hasRealSkaterLines) {
      for (const id of ["lw-top", "lw-depth", "c-top", "c-depth", "rw-top", "rw-depth", "ld-top", "ld-bottom", "rd-top", "rd-bottom"]) auto.add(id);
    }
    const forwardLines = hasRealSkaterLines ? savedFl : built.forwardLines;
    const defensePairs = hasRealSkaterLines ? savedDp : built.defensePairs;

    const sit = saved?.situations as { pp?: { players?: unknown }[]; pk4?: { players?: unknown }[]; others?: { starter?: unknown; backup?: unknown } } | null | undefined;

    const ppUnits = ([0, 1] as const).map((i) => {
      const savedUnit = sit?.pp?.[i]?.players;
      const hasReal = hasAnyId(savedUnit);
      if (!hasReal) auto.add(i === 0 ? "pp1" : "pp2");
      return hasReal ? (savedUnit as (number | null)[]) : built.situations.pp[i].players;
    });

    const pkUnits = ([0, 1] as const).map((i) => {
      const savedUnit = sit?.pk4?.[i]?.players;
      const hasReal = hasAnyId(savedUnit);
      if (!hasReal) auto.add(i === 0 ? "pk1" : "pk2");
      return hasReal ? (savedUnit as (number | null)[]) : built.situations.pk4[i].players;
    });

    const validGoalie = new Set(teamGoalies.map((g) => g.id));
    const savedStarter = sit?.others?.starter;
    const hasRealStarter = typeof savedStarter === "number" && validGoalie.has(savedStarter);
    if (!hasRealStarter) auto.add("goalie-starter");
    const starter = hasRealStarter ? (savedStarter as number) : built.situations.others.starter;

    const savedBackup = sit?.others?.backup;
    const hasRealBackup = typeof savedBackup === "number" && validGoalie.has(savedBackup);
    if (!hasRealBackup) auto.add("goalie-backup");
    const backup = hasRealBackup ? (savedBackup as number) : built.situations.others.backup;

    resolved.set(team.id, { forwardLines, defensePairs, ppUnits, pkUnits, starter, backup });
  }

  return { teams, resolved, autoBySlot, playerMap, goalieMap, rolePercentiles, goaliePercentiles };
}

export function slotPlayers(lines: ResolvedLines, slot: SlotDef, data: Pick<LeagueSlotsData, "playerMap" | "goalieMap" | "rolePercentiles" | "goaliePercentiles">): SlotPlayer[] {
  const { playerMap, goalieMap, rolePercentiles, goaliePercentiles } = data;
  if (slot.kind === "goalie") {
    const id = slot.goalieRole === "starter" ? lines.starter : lines.backup;
    if (id == null) return [];
    const g = goalieMap.get(id);
    if (!g) return [];
    // Goalie Quality Score (SC/HS/RT/RB/AG/SK/SZ percentile), not GoalieRating.overall.
    return [{ ...g, rating: weightedPercentile(g.id, goaliePercentiles, GOALIE_QUALITY_WEIGHTS) }];
  }
  if (slot.kind === "special") {
    const units = slot.situationsKey === "pp" ? lines.ppUnits : lines.pkUnits;
    const ids = units[slot.unitIdx ?? 0] ?? [];
    // PP1/PP2/PK1/PK2 mix forwards and D in one unit, so the role formula is
    // picked per player from their own position (see specialRoleFor).
    return ids
      .filter((id): id is number => typeof id === "number")
      .map((id) => playerMap.get(id))
      .filter((p): p is SlotPlayer => !!p)
      .map((p) => {
        if (!p.position) return { ...p, rating: p.rating };
        const { group, key } = specialRoleFor(slot.situationsKey!, p.position);
        return { ...p, rating: weightedPercentile(p.id, rolePercentiles[group], ROLE_WEIGHTS[key]) };
      });
  }
  const rows = slot.kind === "forward" ? lines.forwardLines : lines.defensePairs;
  const picked: SlotPlayer[] = [];
  for (const idx of slot.lineIdxs ?? []) {
    const row = rows[idx] as Record<string, number | null> | undefined;
    const pid = row?.[slot.side!];
    if (typeof pid !== "number") continue;
    const player = playerMap.get(pid);
    if (!player) continue;
    // compositeRating() fallback only kicks in if a slot is ever missing a
    // role mapping — every current forward/defense SlotDef has one.
    const score = slot.role ? weightedPercentile(player.id, rolePercentiles[slot.role.group], ROLE_WEIGHTS[slot.role.key]) : player.rating;
    picked.push({ ...player, rating: score });
  }
  return picked;
}

/** A single player's own rating for one slot, on the SAME role-weighted
 *  percentile scale rankSlot()'s team averages use below (the slot's role
 *  score for skaters, the Goalie Quality Score for goalies) — for holding one
 *  player up against those team averages apples-to-apples (Ideal Role, Player
 *  Fit). Using compositeRating()/GoalieRating.overall for that instead would
 *  compare a raw-stat-scale number against a 0-100 percentile-scale one — two
 *  different scales that only coincidentally overlap, producing a rank/delta
 *  that doesn't mean what it looks like it means. null if this player isn't
 *  in the slot's percentile pool (not an NHL-rostered, non-scratched player,
 *  per loadLeagueSlots()'s population) — callers should fall back to
 *  compositeRating()/GoalieRating.overall in that case. */
export function roleRatingFor(playerId: number, slot: SlotDef, isGoalie: boolean, data: Pick<LeagueSlotsData, "rolePercentiles" | "goaliePercentiles">): number | null {
  if (isGoalie) return weightedPercentile(playerId, data.goaliePercentiles, GOALIE_QUALITY_WEIGHTS);
  if (!slot.role) return null;
  return weightedPercentile(playerId, data.rolePercentiles[slot.role.group], ROLE_WEIGHTS[slot.role.key]);
}

export interface SlotTeamRow {
  teamId: number;
  teamName: string;
  avg: number;
  players: SlotPlayer[];
  isAuto: boolean;
}

/** Every club's average rating for one slot, best first — a role-and-percentile
 *  Role Score for skater slots (see ROLE_WEIGHTS), a Goalie Quality Score for
 *  goalie slots (see GOALIE_QUALITY_WEIGHTS) — never OV (see SlotPlayer.rating).
 *  Clubs with nobody eligible for the slot are left out entirely (nothing to rank). */
export function rankSlot(data: LeagueSlotsData, slot: SlotDef): SlotTeamRow[] {
  return data.teams
    .map((team) => {
      const players = slotPlayers(data.resolved.get(team.id)!, slot, data);
      const rated = players.filter((p) => p.rating != null);
      if (!rated.length) return null;
      const avg = rated.reduce((sum, p) => sum + (p.rating as number), 0) / rated.length;
      return { teamId: team.id, teamName: team.name, avg: Math.round(avg * 10) / 10, players, isAuto: data.autoBySlot.get(team.id)?.has(slot.id) ?? false };
    })
    .filter((r): r is SlotTeamRow => r != null)
    .sort((a, b) => b.avg - a.avg);
}
