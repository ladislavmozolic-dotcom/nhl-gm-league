// STHS-style simulation — core types.
// The engine is DB-agnostic: it operates on plain SimTeam/SimPlayer objects.
// A loader (index.ts) builds these from Prisma rows.

import type { SimEvent } from "./events";
import type { TacticsEffect, RosterProfile, TeamTactics } from "./tactics";

export type SkaterAttrs = {
  ck: number; fg: number; di: number; sk: number; st: number; en: number;
  du: number; ph: number; fo: number; pa: number; sc: number; df: number;
  ps: number; ex: number; ld: number; mo: number;
};

export type GoalieAttrs = {
  sk: number; du: number; en: number; sz: number; ag: number; rb: number;
  sc: number; hs: number; rt: number; ph: number; ps: number; ex: number;
  ld: number; mo: number;
};

export type SimSkater = {
  id: number;
  name: string;
  position: string;      // raw, e.g. "C/RW", "D"
  isDefense: boolean;
  isCenter: boolean;
  overall: number;
  attrs: SkaterAttrs;
  // derived per-game weights
  offense: number;       // finishing ability
  playmaking: number;    // assist ability
  defense: number;       // suppresses opponent chances
  faceoff: number;
  discipline: number;    // higher = fewer penalties
  hitting: number;       // checking-driven
  blocking: number;      // shot-blocking
  iceTime: number;       // relative share of ice time (0..1, normalized within unit)
  con: number;           // post-game condition 1..100 (fatigue carried between games)
  chem: number;          // line-chemistry of this player's unit (0..100; 100 = no penalty)
  roleFit: number;       // 0..1 role diversity of the unit (1 = ideal C/sniper/grinder mix)
  morale: number;        // persistent mood 1..100 (wins/ice-time/production drive it)
  goalDrought?: number;  // games since this forward last scored (feeds morale)
  weight: number;        // lbs — physicality (hits, board/net-front battles)
  shoots: string | null; // "L" | "R" — natural side (L-shot D = LD, R-shot D = RD)
  offSide: boolean;      // deployed off his natural position/side
  posPenalty: number;    // off-position skill multiplier already baked in (<=1); 1 = in position
};

/** A forward trio or defense pair, keyed by a stable signature (sorted ids). */
export type LineUnit = { sig: string; members: number[]; isDef: boolean };

export type SimGoalie = {
  id: number;
  name: string;
  overall: number;
  attrs: GoalieAttrs;
  quality: number;       // derived save skill (~40..99)
  con: number;           // condition 1..100 (fatigue); lower = weaker + tires faster
  du: number;            // durability — affects daily CON recovery
  fatigued: boolean;     // playing a back-to-back (no rest since last start)
  morale: number;        // MO 1..100 — low = soft goals on easy shots, high = steals games
};

export type StratWeights = { phy: number; df: number; of: number };
/** Per-line deployment tactic (PHY physical/forecheck, DF defensive, OF offensive; 0-5). */
export type LineTactic = { phy: number; df: number; of: number };
export type GameStrategy = {
  winning2: StratWeights; winning1: StratWeights; tied: StratWeights;
  losing1: StratWeights; losing2: StratWeights;
  goaliePull: { minGoals: number; savePctUnder: number; pullSec: number };
};

export type SimTeam = {
  id: number;
  name: string;
  code: string | null;
  forwards: SimSkater[];
  defense: SimSkater[];
  goalie: SimGoalie;        // active starter for this game
  backup: SimGoalie | null; // dressed but (usually) not playing
  goalies: SimGoalie[];     // all available goalies, best first
  strategy: GameStrategy | null; // manager tactics (null = auto)
  // aggregate team strengths (0..~100 scale)
  offenseRating: number;
  defenseRating: number;
  avgOV: number;          // ice-time-weighted roster overall (+ starter) — team quality
  // line chemistry
  units: LineUnit[];               // forward trios + defense pairs from the set lines
  stUnits: LineUnit[];             // PP1 + PK1 as their own chemistry units (grown separately)
  chemistry: Record<string, number>; // unit signature -> chemistry value (mutable across a season)
  slowChem: string[];              // unit signatures that gel 20% slower (an off-side player)
  ppChem: number;                  // power-play unit chemistry factor (~1; >1 = gelled PP1 → deadly)
  pkChem: number;                  // penalty-kill unit chemistry factor (~1; >1 = gelled PK1 → shields)
  rivalTeamIds: number[];          // declared rivals — heated games when these teams meet
  shootoutOrder: number[];         // manager-set shootout shooter order (player ids)
  // head-coach global modifiers (1.0 = neutral coach); coachEx is a 0..99 rating
  coachOff: number;                // team offense multiplier (coach OF + offensive style)
  coachDef: number;                // team defense multiplier (coach DF + defensive style)
  coachDisc: number;               // penalty-rate multiplier (<1 = disciplined bench, fewer PIM)
  coachEx: number;                 // experience 0..99 — steadies momentum / clutch late
  fwdTactics: LineTactic[];        // per forward-line tactic (aligned to the 4 lines)
  defTactics: LineTactic[];        // per defense-pair tactic (aligned to the 3 pairs)
  tactics: TacticsEffect;          // Phase 3 team-system multipliers (resolved from dials + roster fit)
  teamTactics: TeamTactics;        // the raw dials the GM set (for display / scouting)
  profile: RosterProfile;          // ice-weighted roster attribute averages (drives system fit)
  fwdLineFx: TacticsEffect[];      // per forward-line effect (team system + the line's own Puck Style override)
  defPairFx: TacticsEffect[];      // per defence-pair effect (team system + the pair's own D-Zone override)
};

/** Raw coach card passed into buildTeam. */
export type CoachInput = { style: string; ph: number; df: number; of: number; pd: number; ex: number; ld: number } | null;

export type ShootoutAttempt = {
  round: number;
  teamId: number;
  shooterId: number;
  shooterName: string;
  result: "goal" | "save" | "miss"; // scored / stopped by goalie / missed the net
};

export type PlayerLine = {
  id: number;
  name: string;
  position: string;
  goals: number;
  assists: number;
  points: number;
  shots: number;
  pim: number;
  plusMinus: number;
  ppGoals: number;
  shGoals: number;
  ppAssists: number;     // assists on power-play goals
  shAssists: number;     // assists on short-handed goals
  gwg: number;           // game-winning goal (0/1)
  hits: number;
  blocks: number;
  faceoffWins: number;
  faceoffLosses: number;
  toi: number;           // time on ice, seconds
  ppToi: number;         // power-play time on ice, seconds (real per-tick, PP unit)
  pkToi: number;         // penalty-kill time on ice, seconds (real per-tick, PK unit)
  conBefore: number;     // condition at puck drop
  conAfter: number;      // condition after the game (post workload drop)
  xg: number;            // individual expected goals (shot quality generated)
  hdShots: number;       // high-danger shots (slot / net-front)
  topShotSpeed: number;  // fastest shot fired (mph) — EDGE
  shifts: number;        // shifts taken (Shift Quality)
  positiveShifts: number;// shifts with a positive on-ice xG differential
  shotZones: number[];   // ALL shots by rink zone [POINT,PERIMETER,CIRCLE,SLOT,NET_FRONT]
};

export type GoalieLine = {
  id: number;
  name: string;
  started: boolean;      // true if this goalie played
  shotsAgainst: number;
  saves: number;
  goalsAgainst: number;
  savePct: number;       // 0..1
  toi: number;           // seconds
  conBefore: number;     // condition at puck drop
  conAfter: number;      // condition after the game (post shot-load drop)
  fatigued: boolean;     // started on a back-to-back
  decision: "W" | "L" | "OTL" | null;
  xga: number;           // expected goals against (sum of faced shots' xG) → GSAx = xga - goalsAgainst
  // EDGE: saves by shot danger (HD = slot/net-front, MD = circle, LD = point/perimeter)
  hdShotsAg: number; hdSaves: number;
  mdShotsAg: number; mdSaves: number;
  ldShotsAg: number; ldSaves: number;
  faceZones: number[];   // ALL shots faced by rink zone [POINT,PERIMETER,CIRCLE,SLOT,NET_FRONT]
  saveZones: number[];   // ALL saves by rink zone — full save map
};

export type GoalEvent = {
  period: number;        // 1,2,3, 4=OT, 5=SO
  seconds: number;       // elapsed seconds WITHIN the period
  time: string;          // "MM:SS" within the period
  team: number;          // team id
  teamCode: string | null;
  scorer: number;        // player id
  scorerName: string;
  scorerSeasonGoal: number; // running goal number for the scorer this game-context (set on persist)
  assists: number[];     // 0..2 player ids
  assistNames: string[];
  strength: "EV" | "PP" | "SH" | "SO";
  emptyNet: boolean;     // scored into an empty net (goalie pulled)
  onIceForIds: number[];      // skaters on ice for the scoring team
  onIceForNames: string[];
  onIceAgainstIds: number[];  // skaters on ice for the conceding team
  onIceAgainstNames: string[];
};

export type PenaltyEvent = {
  period: number;
  seconds: number;       // within period
  time: string;          // "MM:SS"
  team: number;
  teamCode: string | null;
  playerId: number;
  playerName: string;
  type: string;          // e.g. "Tripping"
  minutes: number;       // 2, 4, 5
  severity: string;      // "Minor" | "Double Minor" | "Major"
};

export type TeamBox = {
  teamId: number;
  name: string;
  code: string | null;
  goals: number;
  shots: number;
  pim: number;
  ppGoals: number;
  ppOpp: number;         // power-play opportunities
  faceoffWins: number;
  faceoffLosses: number;
  hits: number;
  blocks: number;
  goalsByPeriod: number[]; // [p1, p2, p3, (ot)]
  shotsByPeriod: number[];
  xgFor: number;         // team expected goals for (sum of its shots' xG)
  hdFor: number;         // high-danger shots for
  // NHL EDGE-style tracking — absolute zone occupancy (ticks), summing to play time
  ozTime: number;        // time the puck was in this team's OFFENSIVE zone
  nzTime: number;        // ... neutral zone
  dzTime: number;        // ... defensive zone
  shotSectors: number[]; // shots by sector [POINT, PERIMETER, CIRCLE, SLOT, NET_FRONT]
  topShotSpeed: number;  // fastest shot (mph)
  topShotBy: string;     // who fired it
  shotSpeedSum: number;  // sum of shot speeds (÷ shots = avg mph)
  skaters: PlayerLine[];
  goalie: GoalieLine;             // the goalie who started
  backupGoalie: GoalieLine | null; // dressed, did not play (shows ending CON)
};

export type PbpKind =
  | "faceoff" | "shot" | "save" | "goal" | "miss" | "block" | "hit"
  | "icing" | "offside" | "penalty" | "fight" | "injury" | "period" | "change";

export type PbpEvent = {
  period: number;
  seconds: number;
  time: string;          // MM:SS within the period
  teamId: number | null;
  kind: PbpKind;
  text: string;
  major: boolean;        // shown in the condensed PLAY-BY-PLAY tab
};

export type InjuryMechanism = "Hit" | "Blocked shot" | "Fight" | "Collision" | "Fatigue" | "Non-contact";
export type InjurySeverity = "Day-to-Day" | "Week-to-Week" | "Multi-week" | "Long-term" | "Season-ending";

export type InjuryEvent = {
  period: number;
  seconds: number;
  time: string;
  teamId: number;
  playerId: number;
  playerName: string;
  days: number;          // games/days out
  desc: string;          // body part, e.g. "Shoulder"
  mechanism: InjuryMechanism; // how it happened (Phase 4)
  severity: InjurySeverity;   // duration tier
  byId?: number;         // the player who caused it (hitter/fighter), if any
  byName?: string;
};

export type GameResult = {
  home: TeamBox;
  away: TeamBox;
  winner: number;        // team id
  loser: number;
  endedIn: "REG" | "OT" | "SO";
  goals: GoalEvent[];
  penalties: PenaltyEvent[];
  injuries: InjuryEvent[];
  playByPlay: PbpEvent[];
  periods: number;       // 3, 4 (OT), or 5 (SO counts as extra)
  otPeriods: number;     // full sudden-death OT periods played (playoff marathons); 0 for REG/reg-season OT
  shootout: ShootoutAttempt[]; // shootout attempts in order (empty unless the game went to a shootout)
  seed: number;
  engineVersion?: string;      // which engine produced this game (stamped on the Game row)
  events?: SimEvent[];         // next-gen notable event stream (persisted to GameEvent)
  homeSystem?: TeamTactics;    // team-system dials each side played with (for scouting)
  awaySystem?: TeamTactics;
};
