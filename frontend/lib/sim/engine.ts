// STHS-style game simulation engine (v2 — chronological / event-based).
// Produces a full box score with timestamped goals & penalties, per-period
// shots/goals, power plays tied to real penalty times, and rich per-player
// stats (hits, blocks, faceoffs, TOI). Tuned to NHL-realistic output.

import { RNG, fixtureSeed } from "./rng";
import { cleanName } from "../playerName";
import { generatePlayByPlay } from "./playbyplay";
import { DEFAULT_SETTINGS, type EngineSettings } from "./settings";
import { EventSink, type SimEvent } from "./events";
import { shotProfile, expectedGoal, isHighDanger, shotSpeed, sectorIndex, type ShotStrength } from "./shot-quality";
import { ENGINE_V2 } from "./version";
import type {
  SimTeam, SimSkater, SimGoalie, GameResult, TeamBox, PlayerLine, GoalieLine,
  GoalEvent, PenaltyEvent, InjuryEvent, ShootoutAttempt, LineTactic,
  InjuryMechanism, InjurySeverity,
} from "./types";

// Engine version stamped on every simulated Game (for reproducibility, history and
// calibration). The current (stable v1) engine is "1.0.0"; the next-gen rework will
// ship as "2.x" behind the LeagueConfig.simEngine flag. See lib/sim/version.ts.
export const ENGINE_VERSION = "1.0.0";

const INJURY_BASE = 0.24; // expected injuries per team per game at 100% (~1 in 4.2 games) — calibration-lab target is 0.45-0.62/team/game; retuned after the live per-tick rework (was 0.18, landed at 0.40 in the lab)

// Active tunable settings for the current game. Set at the top of simulateGame;
// games run sequentially so a module-level value is safe. Defaults reproduce
// the calibrated baseline.
let CFG: EngineSettings = DEFAULT_SETTINGS;
// The model's LEAGUE baselines are NHL-calibrated. AHL clubs have weaker goalies
// (mean ~60 vs ~73) and weaker offense, and the ^2.2 goalie exponent over-rewards
// shooters against those weaker keepers → inflated AHL scoring. Damp AHL goal
// conversion so AHL point totals land in the real ~90-100 range, not ~130+.
let AHL_GAME = false;
const AHL_GOALS_MULT = 0.88; // tunable — lower = fewer AHL goals (keeps team totals ~2.8/gm, top scorer ~95)

// ---- parity -----------------------------------------------------------------
// Compress a talent gap so favourites don't run away over a season. Two knobs, both
// scaled by CFG.parityPct (0 = raw talent, 100 = NHL-like). Centred on a neutral
// anchor so the league-wide average is preserved — only the SPREAD narrows.
const PARITY_VOL = 0.58;  // how much possession micro-battles flatten toward 50/50
const PARITY_CONV = 0.65; // exponent compression on the goalie/defence conversion edge
const AVG_FINISH = 52.9;  // ice-weighted league-mean shooter.offense — the parity anchor
function parityAmt(): number { return Math.max(0, (CFG?.parityPct ?? 100) / 100); }
// compress x toward `anchor` in log space: k=1 is unchanged, k<1 pulls toward anchor.
function compressToward(x: number, anchor: number, k: number): number {
  if (x <= 0 || anchor <= 0) return x;
  return anchor * Math.pow(x / anchor, k);
}

const PERIOD_SECONDS = 1200; // 20:00
const OT_SECONDS = 300;      // 5:00 sudden death
const EMPTY_NET_WINDOW = 120; // fallback seconds-left window when a team has no strategy.goaliePull.pullSec set
// The shot-attempt trigger rate is scaled up by this so post-MISS on-goal (SOG)
// volume matches the pre-MISS calibrated rate — see the MISS check in the O-zone
// shot-resolution branch. Tune empirically against the Calibration Lab if the
// MISS probability formula there ever changes; not derived from a closed form.
const MISS_COMPENSATION = 1.38;

// League baselines the model is calibrated against (population means of THIS
// dataset's ratings, so an avg-vs-avg matchup centers every factor at 1.0).
const LEAGUE = {
  avgOffense: 55,
  avgDefense: 69.5,
  avgGoalie: 84,
  baseShots: 27.5,          // tuned down (~32 → ~30 shots/team; real NHL ~29-30)
  baseConversion: 0.090,    // tuned up (SV% ~91.5% → ~90.7%, goals ~2.7 → ~2.9/team; real SV% ~90.5-91)
  homeShotBonus: 1.05,
  homeConvBonus: 1.05,
  penaltiesPerTeam: 2.85,  // penalties a team of avg discipline takes per game (tuned: ~3.0 PP opps/team/game, NHL-realistic — was 3.2 giving ~3.6)
  ppConvBoost: 2.85,       // PP conversion multiplier (lowered from 3.1 to keep PP% ~21% after the baseConversion bump)
  shConvPenalty: 0.45,     // conversion multiplier while shorthanded
  hitsPerTeam: 21,
  blocksPerTeam: 14,
  faceoffsPerGame: 46,
  zoneEntriesPerTeam: 50,  // controlled + dump-in entries, real NHL-tracked ballpark
  fwdIcePool: 10800,       // total forward TOI seconds/game (3 on ice * 60min)
  defIcePool: 7200,        // total defense TOI seconds/game (2 on ice * 60min)
};

// Super-linear involvement so elite players take a disproportionate share of
// production (realistic star separation from a narrow rating spread).
const involvement = (r: number) => Math.pow(r / 60, CFG.starExponent);

// Condition (CON) effects on a goalie's effective save quality.
//   e.g. CON 97 on a back-to-back: (1-0.045)*0.885 = 0.845 -> ~15% weaker.
function effGoalieQuality(g: SimGoalie): number {
  const conFactor = 1 - (100 - g.con) * CFG.conSlope;
  // MO: a confident goalie steals games (higher effective quality), a shaky one
  // lets in soft goals. Clamped so morale nudges but never dominates the card.
  const moraleFactor = CFG.moraleEnabled
    ? Math.max(0.95, Math.min(1.05, 1 + ((g.morale ?? CFG.moraleNeutral) - CFG.moraleNeutral) * CFG.moraleGoalieSlope))
    : 1;
  return g.quality * Math.max(0.4, conFactor) * (g.fatigued ? CFG.b2bFatigue : 1) * moraleFactor;
}
// Shot-load rule, driven by the goalie's durability (DU): workhorse (DU >= high)
// goalies tolerate more shots before losing a CON point.
function conDrop(shots: number, du: number): number {
  if (du >= CFG.duHighThreshold) return shots <= CFG.conShotsHigh1 ? 1 : shots <= CFG.conShotsHigh2 ? 2 : 3;
  return shots <= CFG.conShotsLow1 ? 1 : shots <= CFG.conShotsLow2 ? 2 : 3;
}
// Defensemen contribute to offense, but less than forwards. High-PA/SC D still
// rise into the scoring race (a few crack the top 20), just not to the top.
const D_SHOOT = 0.34;
const D_ASSIST = 0.29;

const PENALTY_TYPES: Array<[string, number]> = [
  ["Tripping", 15], ["Hooking", 13], ["Slashing", 10], ["Holding", 10],
  ["Interference", 9], ["Cross-checking", 9], ["Roughing", 8],
  ["High-sticking", 7], ["Boarding", 3], ["Delay of game", 3],
  ["Too many men", 2], ["Elbowing", 2],
];
// severe infractions that carry an added misconduct / game misconduct
const SEVERE_TYPES = ["Boarding", "Cross-checking", "Checking to the head", "Slew-footing"];

type Penalty = { team: number; start: number; end: number; expired: boolean };

type SimState = {
  rng: RNG;
  home: SimTeam;
  away: SimTeam;
  box: Record<number, TeamBox>;
  lines: Record<number, Record<number, PlayerLine>>;
  goals: GoalEvent[];
  penalties: PenaltyEvent[];
  injuries: InjuryEvent[];
  // momentum: a decaying per-team "hot streak" value, updated on goals
  momentum: Record<number, number>;
  momoTime: Record<number, number>; // abs game-seconds of last momentum update
  momoTau: Record<number, number>;  // decay time-constant (LD extends it)
  momoDip: Record<number, number>;  // momentum lost when this team concedes (EX softens it)
  playoff: boolean;                 // playoff game — amplifies clutch
  defChem: Record<number, number>;  // team's avg D-pair chemistry factor (a gelled, mixed pair shields better)
  currentOnIce: Record<number, { f: SimSkater[]; d: SimSkater[] }>; // the line + pair on the ice right now (for goal on-ice sets + accurate +/-)
  carryPenalties: Penalty[]; // penalties still running when a period ends → carry the remaining time into the next period
  misconducts: { playerId: number; teamId: number; period: number; start: number; end: number }[]; // 10/20-min misconducts — player sits (no PP), a sub takes his spot
  shiftXg: Record<number, number>;  // on-ice net xG accrued in a player's CURRENT shift (Shift Quality)
  nightOff: Record<number, number>; // per-game offensive "form" (goals-for mult, mean 1)
  nightDef: Record<number, number>; // per-game goalie "form" facing this team (goals-against mult on opp shots, mean 1)
  rivalry: boolean;                 // heated rivalry game — more fights, scrums, misconducts
  pulled: Record<number, boolean>;  // has this team's starter been yanked for the backup
  emptyNet: Record<number, boolean>; // trailing late in reg. — goalie pulled for the extra attacker (both engines)
  onPp: Record<number, boolean>;    // is this team currently on the power play (for PP_START/PP_END events)
  injured: Set<number>;             // skater ids hurt so far this game — benched for the rest of it, live from the tick they went down
  shootout: ShootoutAttempt[];      // shootout attempts (empty unless the game went to a shootout)
  sink: EventSink;                  // next-gen typed event stream (v2)
  isNextGen: boolean;                // v2 only — gates real (non-narration) gameplay differences like line matchups
};

// Absolute game-clock seconds → period + clock-within-period, for events.
function clockOf(absSeconds: number): { period: number; seconds: number } {
  if (absSeconds < 3600) return { period: Math.floor(absSeconds / 1200) + 1, seconds: absSeconds % 1200 };
  return { period: 4, seconds: absSeconds - 3600 }; // OT
}

// The goalie currently in net for a team (backup if the starter was pulled).
function liveGoalie(st: SimState, team: SimTeam): SimGoalie {
  return st.pulled[team.id] && team.backup ? team.backup : team.goalie;
}
function liveGoalieLine(st: SimState, teamId: number): GoalieLine {
  const box = st.box[teamId];
  return st.pulled[teamId] && box.backupGoalie ? box.backupGoalie : box.goalie;
}
// After a goal, yank a shelled starter (enough goals + shots, save% too low).
// minGoals/savePctUnder come from the team's own GameStrategy.goaliePull dial when
// set (GM's call); minShots (sample-size floor) stays a league-wide CFG setting —
// there's no per-team dial for it.
function maybePullGoalie(st: SimState, team: SimTeam) {
  const teamId = team.id;
  if (!CFG.pullGoalieEnabled || st.pulled[teamId]) return;
  const box = st.box[teamId];
  if (!box.backupGoalie) return;
  const s = box.goalie;
  const gp = team.strategy?.goaliePull;
  const minGoals = gp?.minGoals ?? CFG.pullGoalieMinGoals;
  const svPct = gp ? gp.savePctUnder / 100 : CFG.pullGoalieSvPct;
  if (s.goalsAgainst >= minGoals && s.shotsAgainst >= CFG.pullGoalieMinShots
      && s.saves / Math.max(1, s.shotsAgainst) < svPct) {
    st.pulled[teamId] = true;
    box.backupGoalie.started = true;
  }
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function newPlayerLine(s: SimSkater): PlayerLine {
  return {
    id: s.id, name: s.name, position: s.position,
    goals: 0, assists: 0, points: 0, shots: 0, pim: 0, plusMinus: 0,
    ppGoals: 0, shGoals: 0, ppAssists: 0, shAssists: 0, gwg: 0, hits: 0, blocks: 0,
    faceoffWins: 0, faceoffLosses: 0, toi: 0, ppToi: 0, pkToi: 0,
    conBefore: s.con ?? 100, conAfter: s.con ?? 100,
    xg: 0, hdShots: 0, topShotSpeed: 0,
    shifts: 0, positiveShifts: 0,
    shotZones: [0, 0, 0, 0, 0],
  };
}

// Post-game skater conditioning. A heavy regulation workload shaves 1 CON point
// (F >= fwdConMinutes, D >= defConMinutes). A playoff OT game is a marathon —
// everyone is overworked, and each extra OT period costs another point, so a game
// ending in the 1st OT leaves the value at 98, the 2nd OT at 97, and so on.
function skaterConAfter(conBefore: number, toiSec: number, isDefense: boolean, otPeriods: number, pkUnits = 0): number {
  const mins = toiSec / 60;
  const threshold = isDefense ? CFG.skaterDefConMinutes : CFG.skaterFwdConMinutes;
  const overworked = otPeriods > 0 || mins >= threshold;
  let drop = (overworked ? CFG.skaterConDrop : 0) + otPeriods * CFG.skaterOtDrop;
  // Penalty-kill is high-effort → it costs extra CON: +10% for a player on one PK unit,
  // +30% if he's stacked on BOTH PK units. Felt even when he's not otherwise overworked.
  const pkExtra = pkUnits >= 2 ? 0.30 : pkUnits === 1 ? 0.10 : 0;
  if (pkExtra > 0) drop = drop > 0 ? drop * (1 + pkExtra) : CFG.skaterConDrop * pkExtra;
  return Math.max(1, Math.min(100, conBefore - drop));
}

function initTeamBox(team: SimTeam): TeamBox {
  const goalie: GoalieLine = {
    id: team.goalie.id, name: team.goalie.name, started: true,
    shotsAgainst: 0, saves: 0, goalsAgainst: 0, savePct: 0, toi: 0,
    conBefore: team.goalie.con, conAfter: team.goalie.con, fatigued: team.goalie.fatigued,
    decision: null, xga: 0,
    hdShotsAg: 0, hdSaves: 0, mdShotsAg: 0, mdSaves: 0, ldShotsAg: 0, ldSaves: 0,
    faceZones: [0, 0, 0, 0, 0], saveZones: [0, 0, 0, 0, 0],
  };
  const backupGoalie: GoalieLine | null = team.backup ? {
    id: team.backup.id, name: team.backup.name, started: false,
    shotsAgainst: 0, saves: 0, goalsAgainst: 0, savePct: 0, toi: 0,
    conBefore: team.backup.con, conAfter: team.backup.con, fatigued: false,
    decision: null, xga: 0,
    hdShotsAg: 0, hdSaves: 0, mdShotsAg: 0, mdSaves: 0, ldShotsAg: 0, ldSaves: 0,
    faceZones: [0, 0, 0, 0, 0], saveZones: [0, 0, 0, 0, 0],
  } : null;
  return {
    teamId: team.id, name: team.name, code: team.code,
    goals: 0, shots: 0, pim: 0, ppGoals: 0, ppOpp: 0,
    faceoffWins: 0, faceoffLosses: 0, hits: 0, blocks: 0,
    goalsByPeriod: [0, 0, 0, 0], shotsByPeriod: [0, 0, 0, 0],
    xgFor: 0, hdFor: 0,
    ozTime: 0, nzTime: 0, dzTime: 0, shotSectors: [0, 0, 0, 0, 0], topShotSpeed: 0, topShotBy: "", shotSpeedSum: 0,
    skaters: [], goalie, backupGoalie,
  };
}

// ---- team strength -> expected volume ---------------------------------------

function expectedShots(off: SimTeam, def: SimTeam, isHome: boolean): number {
  const offFactor = off.offenseRating / LEAGUE.avgOffense;
  const defFactor = LEAGUE.avgDefense / def.defenseRating;
  let shots = LEAGUE.baseShots * (0.55 + 0.45 * offFactor) * (0.6 + 0.4 * defFactor);
  if (isHome) shots *= 1 + (LEAGUE.homeShotBonus - 1) * (CFG.homeAdvPct / 100);
  return shots * (CFG.shotsPct / 100);
}

function conversion(
  shooterFinishing: number, goalieQuality: number, isHome: boolean,
  strength: "EV" | "PP" | "SH",
): number {
  // finishing amplified around the league mean so an elite finisher clearly out-scores
  // a similar-looking one — the compressed ratings still separate the snipers.
  const shooterMod = Math.pow(shooterFinishing / 60, 1.7);
  // goalie spread (^1.7): tightens the top so an elite keeper tops out ~92.5% SV over a
  // season (real ceiling) instead of running to ~94%, and slightly narrows the band.
  // (2.2 → elite too good; 1.9 still let mid-season elites reach 94%; now 1.7.)
  const goalieMod = Math.pow(LEAGUE.avgGoalie / goalieQuality, 1.7);
  let p = LEAGUE.baseConversion * shooterMod * goalieMod * (CFG.goalsPct / 100) * (AHL_GAME ? AHL_GOALS_MULT : 1);
  if (isHome) p *= 1 + (LEAGUE.homeConvBonus - 1) * (CFG.homeAdvPct / 100);
  if (strength === "PP") p *= 1 + (LEAGUE.ppConvBoost - 1) * (CFG.powerPlayPct / 100);
  else if (strength === "SH") p *= LEAGUE.shConvPenalty;
  return Math.max(0.01, Math.min(0.6, p));
}

// ---- selection weights ------------------------------------------------------

// Fatigue feedback: a skater below full CON loses a little effectiveness.
// Default skaterConSlope is 0 (CON is tracked/shown only) — raise it in Admin to
// make chronic overuse bite. e.g. slope 0.006 @ CON 95 => ~3% weaker.
const conFactor = (con: number) => Math.max(0.5, 1 - (100 - (con ?? 100)) * CFG.skaterConSlope);

// Line chemistry: penalty-only. A fully gelled unit (>= neutral) sims at full
// strength (factor 1); a fresh or disrupted unit is scaled down toward
// (1 - chemistryPenaltyPct). This suppresses new lines without inflating anyone,
// so league-wide scoring stays calibrated.
// Two penalties, both fading to 1 for an ideal unit: a STABILITY penalty that
// shrinks as the line gels (chem -> neutral), and a structural ROLE penalty for
// a role-redundant unit (three snipers / two offensive D) that never goes away.
const chemFactor = (chem: number, roleFit = 1) => {
  if (!CFG.chemistryEnabled) return 1;
  const stability = (Math.max(0, CFG.chemistryNeutral - (chem ?? 100)) / Math.max(1, CFG.chemistryNeutral)) * CFG.chemistryPenaltyPct;
  const role = (1 - (roleFit ?? 1)) * CFG.chemistryRolePenaltyPct;
  return 1 - stability - role;
};

// ---- momentum ---------------------------------------------------------------
// Ice-time-weighted average of a skater attribute (for team LD / EX).
function iceAvgAttr(team: SimTeam, sel: (s: SimSkater) => number): number {
  let sum = 0, wt = 0;
  for (const s of [...team.forwards, ...team.defense]) { const it = s.iceTime || 0.05; sum += sel(s) * it; wt += it; }
  return wt ? sum / wt : 50;
}
// Decay a team's momentum to the current game time (lazy, exponential) and return it.
function momoNow(st: SimState, teamId: number, absT: number): number {
  const tau = st.momoTau[teamId] || CFG.momentumDecaySec;
  const last = st.momoTime[teamId] ?? absT;
  const decayed = (st.momentum[teamId] ?? 0) * Math.exp(-Math.max(0, absT - last) / Math.max(1, tau));
  st.momentum[teamId] = decayed;
  st.momoTime[teamId] = absT;
  return decayed;
}
// Conversion multiplier from the shooting team's current momentum.
function momoBoost(st: SimState, teamId: number, absT: number): number {
  if (!CFG.momentumEnabled) return 1;
  const m = Math.max(-CFG.momentumMax, Math.min(CFG.momentumMax, momoNow(st, teamId, absT)));
  return 1 + m * CFG.momentumBoostPct;
}
// A goal swings momentum: the scorer surges, the team that conceded sags.
function momoOnGoal(st: SimState, scorerId: number, concederId: number, absT: number) {
  if (!CFG.momentumEnabled) return;
  const clamp = (v: number) => Math.max(-CFG.momentumMax, Math.min(CFG.momentumMax, v));
  st.momentum[scorerId] = clamp(momoNow(st, scorerId, absT) + CFG.momentumGoalSpike);
  st.momentum[concederId] = clamp(momoNow(st, concederId, absT) - (st.momoDip[concederId] ?? CFG.momentumConcedeDip));
}
// A smaller momentum bump for the swing plays that aren't goals — killing a
// penalty, a sustained shot flurry, winning a fight. Energises the bench.
function momoSwing(st: SimState, teamId: number, absT: number, amount: number) {
  if (!CFG.momentumEnabled) return;
  const clamp = (v: number) => Math.max(-CFG.momentumMax, Math.min(CFG.momentumMax, v));
  st.momentum[teamId] = clamp(momoNow(st, teamId, absT) + amount);
}

// ---- clutch & morale --------------------------------------------------------
// Clutch = poise in decisive moments, from experience + leadership + composure.
const CLUTCH_MEAN = 68; // ~league mean of the EX/LD/PS blend → keeps clutch ~zero-sum
const clutchRating = (s: SimSkater) =>
  Math.max(20, Math.min(99, 0.45 * (s.attrs.ex ?? 50) + 0.30 * (s.attrs.ld ?? 50) + 0.25 * (s.attrs.ps ?? 50)));
// Conversion multiplier for a shooter in a clutch situation (last minutes of a
// tight 3rd, or overtime). Centered at the league-mean rating so high-clutch
// players gain and low-clutch players lose without changing total scoring.
function clutchFactor(st: SimState, shooter: SimSkater, period: number, tInPeriod: number, margin: number): number {
  if (!CFG.clutchEnabled) return 1;
  const inClutch = period >= 4 || (period === 3 && tInPeriod >= PERIOD_SECONDS - CFG.clutchWindowSec && Math.abs(margin) <= 1);
  if (!inClutch) return 1;
  const mult = CFG.clutchBoostPct * (st.playoff ? CFG.clutchPlayoffMult : 1);
  return 1 + ((clutchRating(shooter) - CLUTCH_MEAN) / 40) * mult;
}
// Morale factor on a skater's effective offense (centered at moraleNeutral).
// Hard-clamped to ±5% so a hot streak nudges but can never run away (morale also
// feeds the shoot decision, so the effective swing is a touch larger than this).
const moraleFactor = (morale: number) =>
  CFG.moraleEnabled ? Math.max(0.95, Math.min(1.05, 1 + ((morale ?? CFG.moraleNeutral) - CFG.moraleNeutral) * CFG.moraleSlope)) : 1;
// Physicality: a heavier body wins net-front / board battles → small conversion
// edge. Centered on the league-mean weight so it's ~zero-sum across the league.
const physFactor = (weight: number) =>
  CFG.physicalityEnabled ? 1 + ((weight ?? CFG.physicalityMeanLbs) - CFG.physicalityMeanLbs) * CFG.physicalityPct : 1;

function pickShooter(rng: RNG, team: SimTeam): SimSkater {
  const pool = [...team.forwards, ...team.defense];
  const weights = pool.map((s) =>
    involvement((s.offense * 0.7 + s.playmaking * 0.3) * conFactor(s.con)) * s.iceTime * (s.isDefense ? D_SHOOT : 1));
  return pool[rng.weighted(weights)];
}

function pickAssists(rng: RNG, onIce: SimSkater[], scorerId: number): number[] {
  const roll = rng.next();
  // ~1.6 assists per goal (NHL-realistic): mostly 2, occasionally unassisted
  const n = roll < 0.08 ? 0 : roll < 0.30 ? 1 : 2;
  if (n === 0) return [];
  // assists come ONLY from the players who were on the ice for the goal
  const pool = onIce.filter((s) => s.id !== scorerId);
  const picked: number[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const weights = pool.map((s) =>
      involvement(s.playmaking * conFactor(s.con)) * s.iceTime * (s.isDefense ? D_ASSIST : 1));
    const idx = rng.weighted(weights);
    picked.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return picked;
}

function pickOnIce(rng: RNG, team: SimTeam): SimSkater[] {
  const takeF = weightedSample(rng, team.forwards, 3);
  const takeD = weightedSample(rng, team.defense, 2);
  return [...takeF, ...takeD];
}

/** Snapshot a fresh weighted on-ice unit for a team into st.currentOnIce. Used by the
 *  endgame / OT simple models, which don't run the shift loop, so recordGoal doesn't
 *  reuse the stale end-of-3rd unit for their goals + +/-. */
function setFreshUnit(st: SimState, team: SimTeam) {
  // simulateEndgame's extra empty-net attempts don't run through the tick loop's
  // onIceF/onIceD/subMis, so they need their own exclusion of anyone hurt this game.
  const fwd = team.forwards.filter((s) => !st.injured.has(s.id));
  const def = team.defense.filter((s) => !st.injured.has(s.id));
  st.currentOnIce[team.id] = {
    f: weightedSample(st.rng, fwd.length ? fwd : team.forwards, 3),
    d: weightedSample(st.rng, def.length ? def : team.defense, 2),
  };
}

/** Overtime is 3-on-3: a fresh unit of THREE skaters (~2F + 1D), not the regulation five.
 *  Includes `keep` (the scorer) so the play-by-play on-ice set matches the goal. */
function setFreshUnitOT(st: SimState, team: SimTeam, keep?: SimSkater) {
  const fwd = team.forwards.filter((s) => !st.injured.has(s.id));
  const def = team.defense.filter((s) => !st.injured.has(s.id));
  let f = weightedSample(st.rng, fwd.length ? fwd : team.forwards, 2);
  let d = weightedSample(st.rng, def.length ? def : team.defense, 1);
  if (keep) {
    if (keep.isDefense) { if (!d.some((s) => s.id === keep.id)) d = [keep]; }
    else if (!f.some((s) => s.id === keep.id)) f = [keep, ...f].slice(0, 2);
  }
  st.currentOnIce[team.id] = { f, d };
}

type StUnit = { f: SimSkater[]; d: SimSkater[] };
/** Resolve a club's special-teams personnel — TWO PP units and TWO PK units, split
 *  into forwards + defence — so the sim can rotate PP1↔PP2 and PK1↔PK2 on ~35s shifts
 *  (nobody kills a 2-minute penalty for the full two minutes). Uses the manager-set /
 *  auto-filled units (team.stUnits: pp/pp2/pk/pk2) when present, else builds sensible
 *  tiers from the roster: PP by playmaking, PK by defensive rating. */
function resolveStUnits(team: SimTeam): { pp: StUnit[]; pk: StUnit[] } {
  const byId = new Map([...team.forwards, ...team.defense].map((s) => [s.id, s]));
  const isD = (s: SimSkater) => team.defense.some((d) => d.id === s.id);
  const split = (ids: number[]): StUnit => {
    const players = ids.map((id) => byId.get(id)).filter((s): s is SimSkater => !!s);
    return { f: players.filter((s) => !isD(s)), d: players.filter(isD) };
  };
  const skill = (s: SimSkater) => (s.attrs.sc ?? 50) + (s.attrs.pa ?? 50);
  const df = (s: SimSkater) => s.attrs.df ?? 50;
  const ppF = [...team.forwards].sort((a, b) => (b.offense ?? skill(b)) - (a.offense ?? skill(a)));
  const ppD = [...team.defense].sort((a, b) => skill(b) - skill(a));
  // PK forwards: the most DEFENSIVE forwards, and NOT the power-play forwards (both PP
  // units), so the same line never plays both the PP and the PK. Fall back to PP bodies
  // only on a roster too thin to staff a separate kill.
  const ppFwdUsed = new Set(ppF.slice(0, 6).map((s) => s.id));
  const byDf = (a: SimSkater, b: SimSkater) => df(b) - df(a);
  const pkF = [
    ...[...team.forwards].filter((s) => !ppFwdUsed.has(s.id)).sort(byDf),
    ...[...team.forwards].filter((s) => ppFwdUsed.has(s.id)).sort(byDf),
  ];
  const pkD = [...team.defense].sort(byDf);
  const ppTier = (t: number): StUnit => ({ f: ppF.slice(t * 3, t * 3 + 3), d: ppD.slice(t * 2, t * 2 + 2) });
  const pkTier = (t: number): StUnit => ({ f: pkF.slice(t * 2, t * 2 + 2), d: pkD.slice(t * 2, t * 2 + 2) });
  const findU = (prefix: string): StUnit | null => { const u = team.stUnits.find((x) => x.sig.startsWith(prefix)); return u ? split(u.members) : null; };
  const nonEmpty = (u: StUnit) => u.f.length > 0 || u.d.length > 0;
  const ids = (u: StUnit | null) => (u ? [...u.f, ...u.d].map((s) => s.id).sort((a, b) => a - b).join(",") : "");
  const sameIds = (a: StUnit | null, b: StUnit | null) => ids(a).length > 0 && ids(a) === ids(b);
  // honour manager-set units ONLY when they're genuinely distinct — the auto-fill made
  // PP1===PP2 and PK===PP for every non-hand-set club, so those fall back to sensible,
  // distinct roster tiers (PP by playmaking, PK by defence).
  const pp1s = findU("pp:"), pp2s = findU("pp2:"), pk1s = findU("pk:"), pk2s = findU("pk2:");
  const ppOk = !!pp1s && !!pp2s && nonEmpty(pp1s) && nonEmpty(pp2s) && !sameIds(pp1s, pp2s);
  const pp1 = ppOk ? pp1s! : ppTier(0);
  const pp2 = ppOk ? pp2s! : (nonEmpty(ppTier(1)) ? ppTier(1) : ppTier(0));
  const pkOk = !!pk1s && !!pk2s && nonEmpty(pk1s) && nonEmpty(pk2s) && !sameIds(pk1s, pk2s) && !sameIds(pk1s, pp1s);
  const pk1 = pkOk ? pk1s! : pkTier(0);
  const pk2 = pkOk ? pk2s! : (nonEmpty(pkTier(1)) ? pkTier(1) : pkTier(0));
  return { pp: [pp1, pp2], pk: [pk1, pk2] };
}

function weightedSample(rng: RNG, pool: SimSkater[], n: number): SimSkater[] {
  const avail = [...pool];
  const out: SimSkater[] = [];
  for (let i = 0; i < n && avail.length; i++) {
    const idx = rng.weighted(avail.map((s) => s.iceTime));
    out.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return out;
}

// ---- goal recording ---------------------------------------------------------

function recordGoal(
  st: SimState, off: SimTeam, def: SimTeam, period: number, seconds: number,
  strength: GoalEvent["strength"], emptyNet = false, explicitScorer?: SimSkater,
  shot?: { sector: string; shotType: string; xg: number },
) {
  // when no explicit scorer is passed (the endgame's synthetic extra-attempt
  // model — OT always passes one), fall back to a shooter excluding anyone
  // hurt this game, so a benched player can't be the one who scores.
  const healthyOff = st.injured.size
    ? { ...off, forwards: off.forwards.filter((s) => !st.injured.has(s.id)), defense: off.defense.filter((s) => !st.injured.has(s.id)) }
    : off;
  const scorer = explicitScorer ?? pickShooter(st.rng, (healthyOff.forwards.length || healthyOff.defense.length) ? healthyOff : off);
  // The on-ice set for this goal IS the actual unit that was on the ice (from the shift
  // model — the same players the play-by-play shows). Assists come only from them, and
  // this drives the +/-. So nobody off the ice is ever credited or shown on the goal.
  const offIce = st.currentOnIce[off.id];
  let onFor: SimSkater[] = offIce && (offIce.f.length || offIce.d.length) ? [...offIce.f, ...offIce.d] : pickOnIce(st.rng, off);
  if (!onFor.some((s) => s.id === scorer.id)) onFor = [scorer, ...onFor].slice(0, 5); // guarantee the scorer is on the ice
  const assists = strength === "SO" ? [] : pickAssists(st.rng, onFor, scorer.id);
  const offLines = st.lines[off.id];
  const sl = offLines[scorer.id];
  sl.goals++; sl.points++;
  if (strength === "PP") sl.ppGoals++;
  if (strength === "SH") sl.shGoals++;
  const assistNames: string[] = [];
  for (const aId of assists) {
    offLines[aId].assists++; offLines[aId].points++;
    if (strength === "PP") offLines[aId].ppAssists++;
    else if (strength === "SH") offLines[aId].shAssists++;
    assistNames.push(offLines[aId].name);
  }
  st.box[off.id].goals++;
  if (strength === "PP") st.box[off.id].ppGoals++;
  if (period <= 4) st.box[off.id].goalsByPeriod[period - 1]++;

  // conceding side: the real unit that was on the ice against (PK unit on a PP goal, etc.).
  const defIce = st.currentOnIce[def.id];
  const onAgainst: SimSkater[] = defIce && (defIce.f.length || defIce.d.length) ? [...defIce.f, ...defIce.d] : pickOnIce(st.rng, def);

  // +/- : even-strength AND short-handed goals count (real NHL rule); PP and SO don't.
  if (strength === "EV" || strength === "SH") {
    for (const s of onFor) st.lines[off.id][s.id].plusMinus += 1;
    for (const s of onAgainst) st.lines[def.id][s.id].plusMinus -= 1;
  }

  st.goals.push({
    period, seconds, time: fmt(seconds),
    team: off.id, teamCode: off.code,
    scorer: scorer.id, scorerName: scorer.name, scorerSeasonGoal: sl.goals,
    assists, assistNames, strength, emptyNet,
    onIceForIds: strength === "SO" ? [] : onFor.map((s) => s.id),
    onIceForNames: strength === "SO" ? [] : onFor.map((s) => s.name),
    onIceAgainstIds: strength === "SO" ? [] : onAgainst.map((s) => s.id),
    onIceAgainstNames: strength === "SO" ? [] : onAgainst.map((s) => s.name),
  });

  st.sink.emit({
    period, seconds, type: "GOAL",
    teamId: off.id, teamCode: off.code ?? undefined,
    playerId: scorer.id, playerName: scorer.name,
    targetId: liveGoalie(st, def).id, targetName: liveGoalie(st, def).name,
    zone: "OFF", sector: shot?.sector, shotType: shot?.shotType, xg: shot?.xg,
    strength: strength === "SO" ? "EV" : (strength === "PP" ? "PP" : strength === "SH" ? "SH" : "EV"),
    importance: "HIGHLIGHT",
    meta: { emptyNet, assistIds: assists, assistNames, seasonGoal: sl.goals, so: strength === "SO" },
  });
}

// ---- penalties --------------------------------------------------------------

function avgDiscipline(team: SimTeam): number {
  const all = [...team.forwards, ...team.defense];
  let sum = 0, wt = 0;
  for (const s of all) { sum += s.discipline * s.iceTime; wt += s.iceTime; }
  return wt ? sum / wt : 50;
}

function avgHitting(team: SimTeam): number {
  const all = [...team.forwards, ...team.defense];
  let sum = 0, wt = 0;
  for (const s of all) { sum += s.hitting * s.iceTime; wt += s.iceTime; }
  return wt ? sum / wt : 50;
}

function avgMorale(team: SimTeam): number {
  const all = [...team.forwards, ...team.defense];
  let sum = 0, wt = 0;
  for (const s of all) { sum += (s.morale ?? CFG.moraleNeutral) * s.iceTime; wt += s.iceTime; }
  return wt ? sum / wt : CFG.moraleNeutral;
}

/** Record a single penalty (adds PIM, and — unless offsetting — a PP for the opponent). */
function addPenalty(
  st: SimState, team: SimTeam, offender: SimSkater, period: number, at: number,
  type: string, minutes: number, severity: string, givesPP = true,
) {
  st.lines[team.id][offender.id].pim += minutes;
  st.box[team.id].pim += minutes;
  if (givesPP) {
    const opp = team.id === st.home.id ? st.away : st.home;
    st.box[opp.id].ppOpp += 1;
    active_push(st, { team: team.id, start: at, end: at + minutes * 60, expired: false });
  }
  // a misconduct (10) / game misconduct (20) puts the player in the box — no PP, but he
  // can't take the ice for that time, so a teammate rotates into his spot.
  if (/Misconduct/i.test(type)) {
    st.misconducts.push({ playerId: offender.id, teamId: team.id, period, start: at, end: at + minutes * 60 });
  }
  st.penalties.push({
    period, seconds: at, time: fmt(at), team: team.id, teamCode: team.code,
    playerId: offender.id, playerName: offender.name, type, minutes, severity,
  });
  st.sink.emit({
    period, seconds: at, type: "PENALTY",
    teamId: team.id, teamCode: team.code ?? undefined,
    playerId: offender.id, playerName: offender.name,
    importance: minutes >= 5 ? "MAJOR" : "NOTABLE",
    meta: { penalty: type, minutes, severity, givesPP },
  });
}
// active list is period-local; addPenalty pushes to it via a per-period ref
let _activeRef: Penalty[] | null = null;
function active_push(_st: SimState, p: Penalty) { _activeRef?.push(p); }

function generatePenalties(st: SimState, team: SimTeam, period: number, active: Penalty[]) {
  _activeRef = active;
  if (!CFG.penaltiesEnabled) return;
  // physicality raises the penalty rate (proxy for a high-PHY strategy)
  const phyFactor = 0.85 + 0.3 * (avgHitting(team) / 65);
  // frustration: a team down by two-plus reaches, hooks and slashes more (hidden DI drop)
  const opp = st.home === team ? st.away : st.home;
  const margin = st.box[team.id].goals - st.box[opp.id].goals;
  const frustration = margin <= -3 ? 1.35 : margin <= -2 ? 1.15 : 1;
  // MO: a low-morale room is frustrated and undisciplined → more penalty minutes
  const moraleFrust = CFG.moraleEnabled ? 1 + Math.max(0, CFG.moraleNeutral - avgMorale(team)) * CFG.moraleFrustrationPct : 1;
  const rival = st.rivalry ? CFG.rivalryPenaltyMult : 1;
  // coach discipline: a disciplined bench (high PD) takes fewer penalties; a
  // physical-style coach's team takes more.
  const lambda = (LEAGUE.penaltiesPerTeam / 3) * (LEAGUE.avgDefense / Math.max(30, avgDiscipline(team))) * phyFactor * frustration * moraleFrust * team.coachDisc * rival * team.tactics.penaltyMult * (CFG.penaltiesPct / 100);
  const count = st.rng.poisson(lambda);
  // exclude anyone already hurt (from an earlier period) — can't take a penalty
  // once he's out of the game. A player hurt LATER in this same period can still
  // be picked here (this runs before that period's ticks — unavoidable, same as
  // any other pre-period generation), but the cross-period case is now closed.
  const pool = [...team.forwards, ...team.defense].filter((s) => !st.injured.has(s.id));
  if (!pool.length) return;
  for (let i = 0; i < count; i++) {
    const at = st.rng.int(PERIOD_SECONDS - 130);
    const offender = pool[st.rng.weighted(pool.map((s) => (105 - s.discipline) * (0.5 + s.iceTime)))];
    const type = PENALTY_TYPES[st.rng.weighted(PENALTY_TYPES.map((p) => p[1]))][0];
    const roll = st.rng.next();
    const minutes = type === "Slashing" && roll < 0.05 ? 4 : roll < 0.02 ? 5 : 2;
    const severity = minutes === 4 ? "Double Minor" : minutes === 5 ? "Major" : "Minor";
    addPenalty(st, team, offender, period, at, type, minutes, severity, true);
    // severe infractions can carry an added misconduct (10) or game misconduct
    if (SEVERE_TYPES.includes(type) && roll < 0.08) {
      const gm = roll < 0.02;
      addPenalty(st, team, offender, period, at, gm ? "Game Misconduct" : "Misconduct",
        gm ? 20 : 10, gm ? "Game Misconduct" : "Misconduct", false);
    }
  }
}

/**
 * Fights: driven by both teams' fighting (FG). Both combatants take a 5-minute
 * major (offsetting — no power play). Occasionally a second bout breaks out at
 * the same stoppage (a line brawl), adding roughing minors and a misconduct.
 */
// Scoped to ONE period (called once per period, right after that period's tick
// loop) rather than a single once-per-game roll — so a fight's injury (see
// generateFightInjuries) can actually bench the player for the periods still to
// come, instead of being decided after the whole game is already simulated.
// A chippy game can now produce more than one bout across different periods,
// which is realistic (previously capped at exactly one fight, ever).
function generateFights(st: SimState, period: number) {
  // st.injured reflects everyone hurt in EARLIER periods (this period's tick loop
  // just ran) — a player already hurt can't be the one who drops the gloves.
  const active = (t: SimTeam) => [...t.forwards, ...t.defense].filter((s) => !st.injured.has(s.id));
  const topFG = (t: SimTeam) => Math.max(0, ...active(t).map((s) => s.attrs.fg ?? 30));
  const enforcerPick = (t: SimTeam) => {
    const pool = active(t);
    return pool[st.rng.weighted(pool.map((s) => Math.pow(Math.max(1, (s.attrs.fg ?? 30) - 40), 2)))];
  };
  if (!CFG.fightsEnabled || !active(st.home).length || !active(st.away).length) return;
  const fgHome = topFG(st.home), fgAway = topFG(st.away);
  // base fight chance scales with the lower of the two teams' willingness; a
  // rivalry game runs hot (far more likely to drop the gloves). Divided by 3 —
  // rolled independently each period now instead of once for the whole game —
  // so the per-GAME rate stays roughly the same as before this rework.
  let p = (0.06 + 0.5 * Math.max(0, Math.min(fgHome, fgAway) - 55) / 45) * (CFG.fightsPct / 100) / 3;
  if (st.rivalry) p *= CFG.rivalryFightMult;
  if (!st.rng.chance(Math.min(0.85, p))) return;

  const at = 60 + st.rng.int(PERIOD_SECONDS - 120);
  const h = enforcerPick(st.home), a = enforcerPick(st.away);
  addPenalty(st, st.home, h, period, at, "Fighting", 5, "Major", false);
  addPenalty(st, st.away, a, period, at, "Fighting", 5, "Major", false);

  // line brawl: a second simultaneous bout + roughing minors + a misconduct (far likelier in a rivalry)
  if (st.rng.chance(st.rivalry ? 0.4 : 0.12)) {
    const h2 = enforcerPick(st.home), a2 = enforcerPick(st.away);
    addPenalty(st, st.home, h2, period, at, "Fighting", 5, "Major", false);
    addPenalty(st, st.away, a2, period, at, "Fighting", 5, "Major", false);
    addPenalty(st, st.home, h2, period, at, "Roughing", 2, "Minor", false);
    addPenalty(st, st.away, a2, period, at, "Roughing", 2, "Minor", false);
    const instigator = st.rng.chance(0.5) ? st.home : st.away;
    addPenalty(st, instigator, instigator.id === st.home.id ? h : a, period, at,
      "Misconduct", 10, "Misconduct", false);
  }
}

// Shared by maybeStartFight and generateHeatEvents' donnybrook — rolls a
// fighter's injury chance immediately (real period+seconds), so st.injured
// updates live instead of waiting for a separate post-hoc pass.
function maybeInjureFighter(st: SimState, team: SimTeam, fighter: SimSkater, period: number, seconds: number) {
  if (!CFG.injuriesEnabled || st.injured.has(fighter.id)) return;
  const cal = INJURY_BASE / 0.55;
  const scale = (CFG.injuryChancePct / 100) * cal;
  if (st.rng.chance(0.06 * scale)) {
    addInjury(st, team, fighter, "Fight", period, seconds);
    st.injured.add(fighter.id);
  }
}

// ~4.7 organic FACEOFF-state stoppages/period, measured empirically (varies with
// how much whistle-stopping play a game has) — ~14/game, the anchor for
// converting the per-game fight probability below into a per-stoppage hazard.
const STOPPAGES_PER_GAME = 14;

/**
 * The main fight/line-brawl path (possession model only) — checked at every
 * organic stoppage (a real tick-loop FACEOFF-state moment) instead of once per
 * game or once per period, so it's a genuinely live event: the resulting
 * Fighting major AND injury (rolled inline via maybeInjureFighter, using the
 * REAL period+tick) take effect immediately — st.injured excludes the hurt
 * fighter starting the very next on-ice selection, for the REST of this same
 * period too, not just the ones still to come.
 */
function maybeStartFight(st: SimState, home: SimTeam, away: SimTeam, period: number, tick: number) {
  if (!CFG.fightsEnabled) return;
  const active = (t: SimTeam) => [...t.forwards, ...t.defense].filter((s) => !st.injured.has(s.id));
  if (!active(home).length || !active(away).length) return;
  const topFG = (t: SimTeam) => Math.max(0, ...active(t).map((s) => s.attrs.fg ?? 30));
  const enforcerPick = (t: SimTeam) => {
    const pool = active(t);
    return pool[st.rng.weighted(pool.map((s) => Math.pow(Math.max(1, (s.attrs.fg ?? 30) - 40), 2)))];
  };
  // base fight chance scales with the lower of the two teams' willingness; a
  // rivalry game runs hot (far more likely to drop the gloves).
  let pGame = (0.06 + 0.5 * Math.max(0, Math.min(topFG(home), topFG(away)) - 55) / 45) * (CFG.fightsPct / 100);
  if (st.rivalry) pGame *= CFG.rivalryFightMult;
  pGame = Math.min(0.85, pGame);
  const perStoppage = 1 - Math.pow(1 - pGame, 1 / STOPPAGES_PER_GAME);
  if (!st.rng.chance(perStoppage)) return;

  const h = enforcerPick(home), a = enforcerPick(away);
  addPenalty(st, home, h, period, tick, "Fighting", 5, "Major", false);
  addPenalty(st, away, a, period, tick, "Fighting", 5, "Major", false);
  maybeInjureFighter(st, home, h, period, tick);
  maybeInjureFighter(st, away, a, period, tick);

  // line brawl: a second simultaneous bout + roughing minors + a misconduct (far likelier in a rivalry)
  if (active(home).length && active(away).length && st.rng.chance(st.rivalry ? 0.4 : 0.12)) {
    const h2 = enforcerPick(home), a2 = enforcerPick(away);
    addPenalty(st, home, h2, period, tick, "Fighting", 5, "Major", false);
    addPenalty(st, away, a2, period, tick, "Fighting", 5, "Major", false);
    addPenalty(st, home, h2, period, tick, "Roughing", 2, "Minor", false);
    addPenalty(st, away, a2, period, tick, "Roughing", 2, "Minor", false);
    maybeInjureFighter(st, home, h2, period, tick);
    maybeInjureFighter(st, away, a2, period, tick);
    const instigator = st.rng.chance(0.5) ? home : away;
    addPenalty(st, instigator, instigator.id === home.id ? h : a, period, tick,
      "Misconduct", 10, "Misconduct", false);
  }
}

/**
 * Extra emotional penalties. Scoped to ONE period (called once per period, right
 * after that period's tick loop — see generateFights' header comment for why):
 *  - a net-front scrum in a heated rivalry game → several roughing minors at once
 *    for both teams, sometimes a 10-minute misconduct in the pileup;
 *  - a donnybrook → several simultaneous fights (each rolls its own injury inline
 *    via maybeInjureFighter, same as maybeStartFight — no separate pass needed);
 *  - "abuse of official" — a frustrated player on a struggling team blows up and
 *    draws a 10-minute misconduct (likelier the more his team is losing by).
 *    Kept as a period-3-only, late-game event (its original intent), using the
 *    score AS OF this period rather than the final score (which isn't final yet
 *    at this point in period 3 — after simulatePeriodPossession, so it's already
 *    the effectively-final regulation score by then anyway).
 */
function generateHeatEvents(st: SimState, period: number) {
  // st.injured reflects everyone hurt in EARLIER periods (and this one's tick loop).
  const active = (t: SimTeam) => [...t.forwards, ...t.defense].filter((s) => !st.injured.has(s.id));
  if (!CFG.penaltiesEnabled || !active(st.home).length || !active(st.away).length) return;
  const scrummer = (t: SimTeam) => { const pool = active(t); return pool[st.rng.weighted(pool.map((s) => (s.attrs.fg ?? 30) + (105 - s.discipline)))]; };

  // /3 — rolled independently each period now instead of once for the whole game.
  if (st.rivalry && st.rng.chance(CFG.scrumChance / 3)) {
    const at = 60 + st.rng.int(PERIOD_SECONDS - 120);
    const nPer = 1 + st.rng.int(2); // 1–2 roughing minors per side
    for (let k = 0; k < nPer; k++) {
      addPenalty(st, st.home, scrummer(st.home), period, at, "Roughing", 2, "Minor", false);
      addPenalty(st, st.away, scrummer(st.away), period, at, "Roughing", 2, "Minor", false);
    }
    if (st.rng.chance(0.4)) { const t = st.rng.chance(0.5) ? st.home : st.away; addPenalty(st, t, scrummer(t), period, at, "Misconduct", 10, "Misconduct", false); }
  }

  // donnybrook: a full line brawl erupts — several simultaneous fights, roughing
  // minors and game misconducts. These are the rare 100+ PIM nights.
  if (st.rivalry && st.rng.chance(CFG.brawlChance / 3)) {
    const at = 120 + st.rng.int(PERIOD_SECONDS - 240);
    const bouts = 3 + st.rng.int(2); // 3–4 fighting majors per side
    for (let k = 0; k < bouts; k++) {
      const hf = scrummer(st.home), af = scrummer(st.away);
      addPenalty(st, st.home, hf, period, at, "Fighting", 5, "Major", false);
      addPenalty(st, st.away, af, period, at, "Fighting", 5, "Major", false);
      maybeInjureFighter(st, st.home, hf, period, at);
      maybeInjureFighter(st, st.away, af, period, at);
    }
    for (let k = 0; k < 2; k++) {
      addPenalty(st, st.home, scrummer(st.home), period, at, "Roughing", 2, "Minor", false);
      addPenalty(st, st.away, scrummer(st.away), period, at, "Roughing", 2, "Minor", false);
    }
    // game misconducts (20) to the instigators on each side
    addPenalty(st, st.home, scrummer(st.home), period, at, "Game Misconduct", 20, "Game Misconduct", false);
    addPenalty(st, st.away, scrummer(st.away), period, at, "Game Misconduct", 20, "Game Misconduct", false);
    if (st.rng.chance(0.5)) { const t = st.rng.chance(0.5) ? st.home : st.away; addPenalty(st, t, scrummer(t), period, at, "Misconduct", 10, "Misconduct", false); }
  }

  if (period !== 3) return;
  for (const team of [st.home, st.away]) {
    const opp = team === st.home ? st.away : st.home;
    const trailBy = st.box[opp.id].goals - st.box[team.id].goals;
    const frustration = trailBy >= 3 ? 2.5 : trailBy >= 2 ? 1.5 : 1;
    if (st.rng.chance(CFG.abuseOfficialChance * frustration)) {
      const pool = active(team);
      const off = pool[st.rng.weighted(pool.map((s) => 105 - s.discipline))];
      const at = PERIOD_SECONDS - 60 - st.rng.int(600);
      addPenalty(st, team, off, 3, at, "Misconduct (Abuse of official)", 10, "Misconduct", false);
    }
  }
}

/** Manpower situation for `team` at time t (within-period seconds). */
function strengthAt(team: SimTeam, opp: SimTeam, t: number, active: Penalty[]): "EV" | "PP" | "SH" {
  let mine = 0, theirs = 0;
  for (const p of active) {
    if (p.expired || t < p.start || t >= p.end) continue;
    if (p.team === team.id) mine++; else if (p.team === opp.id) theirs++;
  }
  if (theirs > mine) return "PP";
  if (mine > theirs) return "SH";
  return "EV";
}

/** Expire the earliest-ending active penalty on `penalizedTeam` (PP goal ends it). */
function expireOnePenalty(penalizedTeamId: number, t: number, active: Penalty[]) {
  let best: Penalty | null = null;
  for (const p of active) {
    if (p.expired || p.team !== penalizedTeamId || t < p.start || t >= p.end) continue;
    if (!best || p.end < best.end) best = p;
  }
  if (best) best.expired = true;
}

// ---- period simulation ------------------------------------------------------

function simulatePeriod(st: SimState, period: number, homeShots: number, awayShots: number) {
  const { home, away, rng } = st;
  const active: Penalty[] = [];
  generatePenalties(st, home, period, active);
  generatePenalties(st, away, period, active);

  type Shot = { team: SimTeam; opp: SimTeam; isHome: boolean; t: number };
  const shots: Shot[] = [];
  for (let i = 0; i < homeShots; i++) shots.push({ team: home, opp: away, isHome: true, t: rng.int(PERIOD_SECONDS) });
  for (let i = 0; i < awayShots; i++) shots.push({ team: away, opp: home, isHome: false, t: rng.int(PERIOD_SECONDS) });
  shots.sort((a, b) => a.t - b.t);

  for (const shot of shots) {
    const shooter = pickShooter(rng, shot.team);
    const strength = strengthAt(shot.team, shot.opp, shot.t, active);
    const absT = (period - 1) * PERIOD_SECONDS + shot.t;
    const box = st.box[shot.team.id];
    box.shots++;
    if (period <= 4) box.shotsByPeriod[period - 1]++;
    st.lines[shot.team.id][shooter.id].shots++;
    st.box[shot.opp.id].goalie.shotsAgainst++;
    const margin = st.box[shot.team.id].goals - st.box[shot.opp.id].goals;
    // offense chemistry + morale and defense chemistry are symmetric direct factors
    // on the final probability (offMult<=1, defShield>=1) so they cancel league-wide.
    const offMult = chemFactor(shooter.chem, shooter.roleFit) * moraleFactor(shooter.morale) * physFactor(shooter.weight) * shot.team.coachOff;
    const defShield = (2 - (st.defChem[shot.opp.id] ?? 1)) * shot.opp.coachDef; // poor/redundant D → opponent converts more
    const ppMod = strength === "PP" ? (shot.team.ppChem / shot.opp.pkChem) * shot.team.tactics.ppConv * shot.opp.tactics.pkSuppress : 1; // gelled PP1 + formation vs PK
    // off-position penalty is waived on special teams (STHS) — restore full offense
    const shOff = strength !== "EV" ? shooter.offense / shooter.posPenalty : shooter.offense;
    const p = conversion(shOff, effGoalieQuality(shot.opp.goalie), shot.isHome, strength)
      * momoBoost(st, shot.team.id, absT)
      * clutchFactor(st, shooter, period, shot.t, margin)
      * offMult * defShield * ppMod
      * (st.nightOff[shot.team.id] ?? 1) * (st.nightDef[shot.opp.id] ?? 1); // any-given-night form
    if (rng.chance(p)) {
      st.box[shot.opp.id].goalie.goalsAgainst++;
      recordGoal(st, shot.team, shot.opp, period, shot.t, strength);
      momoOnGoal(st, shot.team.id, shot.opp.id, absT);
      if (strength === "PP") expireOnePenalty(shot.opp.id, shot.t, active);
    } else {
      st.box[shot.opp.id].goalie.saves++;
    }
  }
}

// ---- possession model (STHS-style sequential decision tree) -----------------
// An opt-in alternative to the shot-volume model (CFG.engineModel === "possession").
// Each possession is a chain of attribute micro-battles: zone entry (carrier SK
// vs defender DF), a shoot/pass choice (SC vs PA), a block check (D DF vs SC), the
// shot itself (SC vs goalie), and a rebound roll (goalie RB). Shots and goals are
// EMERGENT. All the emotional/chemistry modifiers feed the same conversion step.
function pickByAttr(rng: RNG, pool: SimSkater[], sel: (s: SimSkater) => number): SimSkater {
  return pool[rng.weighted(pool.map((s) => Math.max(1, sel(s)) * (0.4 + s.iceTime)))];
}
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i + n <= arr.length; i += n) out.push(arr.slice(i, i + n));
  return out.length ? out : [arr];
}
// Shift deployment for one team: forward lines & D pairs (manager units, else
// depth-chart chunks), a current on-ice unit, and shift timers for fatigue.
type ShiftState = {
  fLines: SimSkater[][]; dPairs: SimSkater[][];
  fIdx: number; dIdx: number; fElapsed: number; dElapsed: number;
  fTopIdx: number; fCheckIdx: number; // which fLines index is this team's top-scoring / most defensive trio
};
// Classify a team's forward lines by role from real attributes (not manager-set line
// order, which isn't guaranteed to reflect actual skill): the line with the highest
// combined offense+playmaking is "top", the one with the highest combined defense is
// "checking". Feeds the v2-only last-change matchup bias in advanceShift.
function classifyLines(fLines: SimSkater[][]): { topIdx: number; checkIdx: number } {
  if (!fLines.length) return { topIdx: 0, checkIdx: 0 };
  const off = fLines.map((l) => l.reduce((s, p) => s + p.offense + p.playmaking, 0));
  const def = fLines.map((l) => l.reduce((s, p) => s + p.defense, 0));
  let topIdx = 0;
  off.forEach((v, i) => { if (v > off[topIdx]) topIdx = i; });
  // A checking line is a distinct ROLE, not just "second-best overall" — the same
  // stacked line often tops both sums (better players are better at everything), so
  // the best-defense search deliberately excludes the top-offense line. Only
  // collapses to the same index when there's truly one line to work with.
  let checkIdx = topIdx;
  fLines.forEach((_, i) => {
    if (i === topIdx) return;
    if (checkIdx === topIdx || def[i] > def[checkIdx]) checkIdx = i;
  });
  return { topIdx, checkIdx };
}
// Position-valid forward lines from the depth chart: each line gets a center (C or
// M-NTC utility C), then wings fill it to 3 — so no line ices 3 wings with no centre.
function buildForwardLines(fwds: SimSkater[]): SimSkater[][] {
  const sorted = [...fwds].sort((a, b) => b.iceTime - a.iceTime);
  const centers = sorted.filter((s) => s.isCenter);
  const wings = sorted.filter((s) => !s.isCenter);
  const nLines = Math.max(1, Math.min(4, Math.ceil(sorted.length / 3)));
  const lines: SimSkater[][] = Array.from({ length: nLines }, (_, i) => (centers[i] ? [centers[i]] : []));
  const extras = [...wings, ...centers.slice(nLines)].sort((a, b) => b.iceTime - a.iceTime);
  let li = 0;
  for (const s of extras) {
    let guard = 0;
    while (lines[li].length >= 3 && guard++ < nLines) li = (li + 1) % nLines;
    if (lines[li].length < 3) lines[li].push(s);
    li = (li + 1) % nLines;
  }
  return lines.filter((l) => l.length >= 2);
}

function buildShifts(team: SimTeam): ShiftState {
  const byId = new Map([...team.forwards, ...team.defense].map((s) => [s.id, s]));
  const res = (isDef: boolean, size: number, fallback: SimSkater[]) => {
    const u = team.units.filter((x) => x.isDef === isDef)
      .map((x) => x.members.map((id) => byId.get(id)).filter((s): s is SimSkater => !!s))
      .filter((l) => l.length >= size - 1);
    if (u.length) return u;
    return isDef ? chunk([...fallback].sort((a, b) => b.iceTime - a.iceTime), size) : buildForwardLines(fallback);
  };
  const fLines = res(false, 3, team.forwards);
  const { topIdx: fTopIdx, checkIdx: fCheckIdx } = classifyLines(fLines);
  return {
    fLines, dPairs: res(true, 2, team.defense),
    fIdx: 0, dIdx: 0, fElapsed: 0, dElapsed: 0, fTopIdx, fCheckIdx,
  };
}
// Effective-attribute multiplier from a long shift; EN slows the drain. 1 = fresh.
function fatigueMult(shiftSec: number, en: number): number {
  if (CFG.inGameFatiguePct <= 0) return 1;
  const over = Math.max(0, shiftSec - 40);           // legs stay fresh ~40s
  const drop = Math.min(0.28, over / 65 * 0.28) * (1.3 - (en ?? 50) / 100) * (CFG.inGameFatiguePct / 100);
  return Math.max(0.55, 1 - drop);
}
// v2-only: how hard the home coach's "last change" reacts to the away team's
// currently-deployed line — a flat multiplier on that line's rotation weight, on top
// of the existing depth-chart weighting. Not absolute (real matching isn't perfect
// either — defensive-zone draws, fatigue, etc. all still compete for the next unit).
const LAST_CHANGE_MATCHUP_BOOST = 2.4;

// Advance a team's shift timers by `dur`; rotate a unit off when its shift is up
// (new unit weighted toward the top of the depth chart). Accrues TOI on the ice.
// `matchup` (v2/home only): lets the home coach react to whichever forward line the
// away team currently has out — send the checking line vs their top trio, or the top
// trio vs their checking line — mirroring real "last change" home-ice advantage.
function advanceShift(st: SimState, teamId: number, sh: ShiftState, dur: number, rng: RNG, hold = false, matchup?: { oppSh: ShiftState; isHome: boolean }) {
  sh.fElapsed += dur; sh.dElapsed += dur;
  // TOI is accrued in the possession tick loop against the ACTUAL on-ice unit (which
  // is the PP/PK unit during a man-advantage) — not here against the rotating line.
  const pick = (lines: SimSkater[][], cur: number, biasIdx?: number) => {
    if (lines.length <= 1) return 0;
    const w = lines.map((_, i) => (i === cur ? 0 : [0.34, 0.28, 0.22, 0.16][i] ?? 0.1));
    if (biasIdx !== undefined && biasIdx !== cur && biasIdx < w.length) w[biasIdx] *= LAST_CHANGE_MATCHUP_BOOST;
    return rng.weighted(w);
  };
  // `hold` = this team is carrying the puck up ice — real teams don't change lines
  // mid-rush. Keep the shift out (elapsed still climbs, so it swaps the instant the
  // puck is away) so the scorer always matches the line on the ice for the goal.
  if (hold) return;
  if (sh.fElapsed >= 38 + rng.int(18)) {
    flushShift(st, teamId, sh.fLines[sh.fIdx] ?? []);
    let bias: number | undefined;
    if (st.isNextGen && matchup?.isHome) {
      const oppFIdx = matchup.oppSh.fIdx;
      if (oppFIdx === matchup.oppSh.fTopIdx && sh.fCheckIdx !== sh.fTopIdx) bias = sh.fCheckIdx;
      else if (oppFIdx === matchup.oppSh.fCheckIdx) bias = sh.fTopIdx;
    }
    sh.fIdx = pick(sh.fLines, sh.fIdx, bias);
    sh.fElapsed = 0;
  }
  if (sh.dElapsed >= 42 + rng.int(20)) { flushShift(st, teamId, sh.dPairs[sh.dIdx] ?? []); sh.dIdx = pick(sh.dPairs, sh.dIdx); sh.dElapsed = 0; }
}
// A shift ends for these players: record it, and whether their on-ice xG differential
// over the shift was positive (Shift Quality → Positive Shift %). Resets the accrual.
function flushShift(st: SimState, teamId: number, players: SimSkater[]) {
  for (const s of players) {
    const line = st.lines[teamId]?.[s.id]; if (!line) continue;
    const net = st.shiftXg[s.id] ?? 0;
    // only "decisive" shifts (a chance went one way or the other) count toward the
    // rate — quiet shifts with no chances are neutral, neither positive nor negative.
    if (Math.abs(net) >= 0.01) { line.shifts++; if (net > 0) line.positiveShifts++; }
    st.shiftXg[s.id] = 0;
  }
}
// Credit a shot's xG to everyone on the ice: + for the shooting team, − for the
// defending team (their current-shift accrual).
function creditShiftXg(st: SimState, atk: SimSkater[], def: SimSkater[], xg: number) {
  for (const s of atk) st.shiftXg[s.id] = (st.shiftXg[s.id] ?? 0) + xg;
  for (const s of def) st.shiftXg[s.id] = (st.shiftXg[s.id] ?? 0) - xg;
}
// Attribute match-up as a probability share A/(A+B) (STHS style), nudged toward
// 0.5 so favourites don't run away (keeps upsets alive).
function ratio(a: number, b: number, flatten = 0.55): number {
  const r = a / Math.max(1, a + b);
  // parity narrows the effective skill edge in each possession micro-battle, which
  // (compounded over a game) compresses the shot-volume gap between mismatched teams.
  const eff = flatten * (1 - PARITY_VOL * parityAmt());
  return Math.max(0.04, Math.min(0.96, 0.5 + (r - 0.5) * eff));
}
// Tactics tilt for a team at the current score margin (offense- vs defense-leaning),
// from its GameStrategy. Returns {of, df} multipliers around 1.0.
function tacticsMult(team: SimTeam, margin: number): { of: number; df: number } {
  const s = team.strategy;
  if (!s) return { of: 1, df: 1 };
  const w = margin >= 2 ? s.winning2 : margin === 1 ? s.winning1 : margin <= -2 ? s.losing2 : margin === -1 ? s.losing1 : s.tied;
  const tilt = (w.of + 1) / (w.of + w.df + 2); // 0..1, 0.5 = balanced
  return { of: 0.9 + 0.2 * tilt, df: 0.9 + 0.2 * (1 - tilt) };
}
// Per-line deployment tactic → {of, df} multipliers around 1.0. Neutral CK1/DF2/OF2
// gives exactly 1.0; an offensive line (high OF) presses harder, a checking/defensive
// line (high DF) suppresses. Effect ~±8%, so a good line still needs the players.
function lineTilt(t: LineTactic | undefined): { of: number; df: number } {
  if (!t) return { of: 1, df: 1 };
  const tilt = (t.of + 0.5) / (t.of + t.df + 1); // 0..1, CK1/DF2/OF2 → 2.5/5 = 0.5 (neutral)
  return { of: 0.84 + 0.32 * tilt, df: 0.84 + 0.32 * (1 - tilt) };
}

// STHS-style 1-second tick state machine. Each tick the puck-carrier runs a
// decision tree (keep vs turnover: SK vs DF; then pass vs shoot: SC vs PA; pass:
// PA vs DF; shot: calibrated conversion + rebound RB). "Final skill" at every
// node = base attribute × tactics × chemistry × morale × fatigue.
function simulatePeriodPossession(st: SimState, period: number) {
  const { home, away, rng } = st;
  const active: Penalty[] = [];
  // carry over the remaining time of any penalty still running at the last buzzer
  for (const cp of st.carryPenalties) active.push({ ...cp });
  st.carryPenalties = [];
  generatePenalties(st, home, period, active);
  generatePenalties(st, away, period, active);
  const base = (period - 1) * PERIOD_SECONDS;
  const shifts: Record<number, ShiftState> = { [home.id]: buildShifts(home), [away.id]: buildShifts(away) };
  const other = (t: SimTeam) => (t === home ? away : home);

  type St = "FACEOFF" | "PLAY";
  let state: St = "FACEOFF";
  let carrierTeam: SimTeam = home;
  let carrier: SimSkater = home.forwards[0];
  let zone: "DEF" | "NEU" | "OFF" = "NEU"; // relative to carrierTeam
  let setup: "carry" | "pass" | "rebound" = "carry"; // how the current look arose → shot danger
  let press = 0; // consecutive shots in one sustained possession → screening/rebound pressure

  // special-teams personnel + the live man-advantage state per team. During a PP a
  // club ices its PP unit; shorthanded, its PK unit — so shots, goals, +/- and TOI
  // all go to the RIGHT players, not whatever line happened to be rotating.
  const stUnit: Record<number, { pp: StUnit[]; pk: StUnit[] }> = { [home.id]: resolveStUnits(home), [away.id]: resolveStUnits(away) };
  const curStr: Record<number, "EV" | "PP" | "SH"> = { [home.id]: "EV", [away.id]: "EV" };
  // special-teams shift rotation: which unit (0 = PP1/PK1, 1 = PP2/PK2) is out, and how
  // long it has been out. Real ST shifts run ~35s, so PP1/PP2 (and PK1/PK2) alternate
  // instead of one unit killing the whole penalty. Resets to unit 1 when back to even.
  const ST_SHIFT = 35;
  const stShift: Record<number, { idx: number; elapsed: number }> = { [home.id]: { idx: 0, elapsed: 0 }, [away.id]: { idx: 0, elapsed: 0 } };
  const stIdx = (team: SimTeam, units: StUnit[]) => stShift[team.id].idx % Math.max(1, units.length);
  // a player serving a 10/20-min misconduct, OR already injured this game, can't
  // take the ice — swap in a teammate at his spot (misconducts: for the penalty
  // duration; injuries: permanently, for the rest of the game — checked live every
  // tick, so a player who just went down is excluded starting the very next call).
  let curTick = 0;
  const subMis = (team: SimTeam, unit: SimSkater[], isDefUnit: boolean): SimSkater[] => {
    const misBenched = st.misconducts.length
      ? st.misconducts.filter((m) => m.teamId === team.id && m.period === period && curTick >= m.start && curTick < m.end).map((m) => m.playerId)
      : [];
    if (!misBenched.length && !st.injured.size) return unit;
    const benched = new Set([...misBenched, ...st.injured]);
    if (!benched.size || !unit.some((s) => benched.has(s.id))) return unit;
    const pool = (isDefUnit ? team.defense : team.forwards).filter((s) => !benched.has(s.id) && !unit.some((u) => u.id === s.id));
    let pi = 0;
    return unit.map((s) => (benched.has(s.id) ? (pool[pi++] ?? s) : s));
  };
  const onIceF = (team: SimTeam) => {
    const s = curStr[team.id];
    if (s === "PP") { const u = stUnit[team.id].pp[stIdx(team, stUnit[team.id].pp)]; if (u?.f.length) return subMis(team, u.f, false); }
    if (s === "SH") { const u = stUnit[team.id].pk[stIdx(team, stUnit[team.id].pk)]; if (u?.f.length) return subMis(team, u.f, false); }
    const sh = shifts[team.id]; return subMis(team, sh.fLines[sh.fIdx] ?? team.forwards, false);
  };
  const onIceD = (team: SimTeam) => {
    const s = curStr[team.id];
    if (s === "PP") { const u = stUnit[team.id].pp[stIdx(team, stUnit[team.id].pp)]; if (u?.d.length) return subMis(team, u.d, true); }
    if (s === "SH") { const u = stUnit[team.id].pk[stIdx(team, stUnit[team.id].pk)]; if (u?.d.length) return subMis(team, u.d, true); }
    const sh = shifts[team.id]; return subMis(team, sh.dPairs[sh.dIdx] ?? team.defense, true);
  };
  // team-system tactics multiply into the fatigue drain (fast tempo / aggressive
  // forecheck tire a team faster).
  const fat = (team: SimTeam, s: SimSkater) => fatigueMult(shifts[team.id].fElapsed * team.tactics.fatigue, s.attrs.en ?? 50);
  const dfat = (team: SimTeam, s: SimSkater) => fatigueMult(shifts[team.id].dElapsed * team.tactics.fatigue, s.attrs.en ?? 50);

  const killedPens = new Set<Penalty>(); // penalties that expired without a PP goal → PK momentum

  // remember which unit LABEL was on the ice, so we announce a change when a fresh
  // forward line / D pair / special-teams unit hops the boards. The label folds in
  // the man-advantage state, so a PP1 / PK1 change is announced too.
  const prevUnit: Record<number, { f: string; d: string }> = {
    [home.id]: { f: "", d: "" }, [away.id]: { f: "", d: "" },
  };
  // forwards → LW · C · RW (one designated centre in the middle; extra natural
  // centres show as wings); defence → the pair as-is. Names are cleaned of the
  // captaincy / clause tags baked into the DB name string.
  const fwdNames = (line: SimSkater[]) => {
    const pivot = line.find((s) => s.isCenter) ?? null;
    const wings = line.filter((s) => s !== pivot);
    const order = pivot ? [wings[0], pivot, wings[1], ...wings.slice(2)].filter(Boolean) as SimSkater[] : line;
    return order.map((s) => `${cleanName(s.name)}${s === pivot ? " (C)" : ""}`);
  };
  const defNames = (line: SimSkater[]) => line.map((s) => cleanName(s.name));
  const unitLabel = (team: SimTeam, kind: "F" | "D") => {
    const s = curStr[team.id];
    if (s === "PP") return `PP${stIdx(team, stUnit[team.id].pp) + 1}`;
    if (s === "SH") return `PK${stIdx(team, stUnit[team.id].pk) + 1}`;
    const sh = shifts[team.id];
    return kind === "F" ? `Line ${sh.fIdx + 1}` : `D-pair ${sh.dIdx + 1}`;
  };
  const announceChange = (team: SimTeam, tick: number) => {
    if (!CFG.playByPlayEnabled) return;
    const emit = (kind: "F" | "D", label: string, line: SimSkater[]) => {
      if (!line.length) return;
      st.sink.emit({
        period, seconds: tick, type: "LINE_CHANGE", teamId: team.id, teamCode: team.code ?? undefined,
        importance: "MINOR",
        meta: { unit: kind, label, names: kind === "F" ? fwdNames(line) : defNames(line) },
      });
    };
    // Re-announce on any PERSONNEL change, not just a label/unit change — a mid-shift
    // injury (or misconduct) subs a fresh body into the SAME "Line 2" / "D-pair 3"
    // slot via subMis, and without this the stale pre-injury names would sit in the
    // PBP unchanged until the line next rotates naturally.
    const fUnit = onIceF(team), dUnit = onIceD(team);
    const fLab = unitLabel(team, "F"), dLab = unitLabel(team, "D");
    const fKey = `${fLab}:${fUnit.map((s) => s.id).join(",")}`, dKey = `${dLab}:${dUnit.map((s) => s.id).join(",")}`;
    if (fKey !== prevUnit[team.id].f) { emit("F", fLab, fUnit); prevUnit[team.id].f = fKey; }
    if (dKey !== prevUnit[team.id].d) { emit("D", dLab, dUnit); prevUnit[team.id].d = dKey; }
  };
  // opening units for this period
  announceChange(home, 0); announceChange(away, 0);

  for (let tick = 0; tick < PERIOD_SECONDS; tick++) {
    curTick = tick; // for misconduct-box substitution inside onIceF/onIceD
    // hold a team's line change while it is carrying the puck up ice (not in its own
    // zone) — no mid-rush changes, so the scorer always matches the on-ice unit.
    const carrying = (team: SimTeam) => state === "PLAY" && carrierTeam.id === team.id && zone !== "DEF";
    advanceShift(st, home.id, shifts[home.id], 1, rng, carrying(home), { oppSh: shifts[away.id], isHome: true });
    advanceShift(st, away.id, shifts[away.id], 1, rng, carrying(away), { oppSh: shifts[home.id], isHome: false });
    // resolve the man-advantage FIRST so the on-ice snapshot uses PP/PK units
    curStr[home.id] = strengthAt(home, away, tick, active);
    curStr[away.id] = strengthAt(away, home, tick, active);
    // PP_START/PP_END: fire when a team's strength crosses into/out of "PP". Game-level
    // st.onPp (not reset per period) so a penalty carried into the next period doesn't
    // fire a spurious duplicate pair at the intermission boundary.
    for (const team of [home, away]) {
      const onPp = curStr[team.id] === "PP";
      if (onPp !== !!st.onPp[team.id]) {
        st.onPp[team.id] = onPp;
        st.sink.emit({
          period, seconds: tick, type: onPp ? "PP_START" : "PP_END",
          teamId: team.id, teamCode: team.code ?? undefined, importance: "NOTABLE",
        });
      }
    }
    // rotate special-teams units on ~35s shifts; reset to unit 1 back at even strength
    for (const team of [home, away]) {
      const shf = stShift[team.id];
      if (curStr[team.id] === "EV") { shf.idx = 0; shf.elapsed = 0; }
      else if (++shf.elapsed >= ST_SHIFT) { shf.idx ^= 1; shf.elapsed = 0; }
    }
    st.currentOnIce[home.id] = { f: onIceF(home), d: onIceD(home) };
    st.currentOnIce[away.id] = { f: onIceF(away), d: onIceD(away) };
    // live injury roll against whoever is actually on the ice this tick — see
    // maybeInjureOnIce's header comment for why this replaced the old post-game pass.
    const hurtHome = maybeInjureOnIce(st, home, away, [...st.currentOnIce[home.id].f, ...st.currentOnIce[home.id].d], period, tick);
    const hurtAway = maybeInjureOnIce(st, away, home, [...st.currentOnIce[away.id].f, ...st.currentOnIce[away.id].d], period, tick);
    // if the player who just went down is the one carrying the puck THIS instant,
    // the play can't continue on him — force a stoppage (same reset as after a
    // goal) instead of letting him keep the puck for however long his possession
    // would otherwise have run.
    if (hurtHome.some((s) => s.id === carrier.id) || hurtAway.some((s) => s.id === carrier.id)) {
      state = "FACEOFF"; setup = "carry"; press = 0;
    }
    announceChange(home, tick); announceChange(away, tick);
    // Empty net: a team trailing late in regulation, at even strength, may pull the
    // goalie for an extra attacker. Real mechanic for BOTH engines (not a v2-only
    // presentation choice) — the actual shot-probability effect lives at the SHOT
    // resolution below (attackerEmptyNet / defEmptyNet). Re-evaluated every tick so
    // scoring back or the period ending un-pulls automatically.
    for (const team of [home, away]) {
      const opp = team === home ? away : home;
      const trailBy = st.box[opp.id].goals - st.box[team.id].goals;
      const pullWindow = team.strategy?.goaliePull?.pullSec ?? EMPTY_NET_WINDOW;
      // real coaches pull much more readily down 1 than down 3 — a 2-goal deficit
      // gets pulled later/more cautiously, a 3-goal deficit is a last-minute-only
      // gamble. Taper the window instead of treating all 3 deficits alike: a
      // wide-open down-3 pull for the full 2 minutes was creating a lot of the
      // engine's excess blowout rate (a real, but too-generous, empty-net dagger).
      const trailWindow = trailBy === 1 ? pullWindow : trailBy === 2 ? pullWindow * 0.7 : pullWindow * 0.35;
      const eligible = period === 3 && curStr[team.id] === "EV" && trailBy >= 1 && trailBy <= 3 && PERIOD_SECONDS - tick <= trailWindow;
      if (eligible !== !!st.emptyNet[team.id]) {
        st.emptyNet[team.id] = eligible;
        st.sink.emit({
          period, seconds: tick, type: "GOALIE_PULL", teamId: team.id, teamCode: team.code ?? undefined,
          importance: "NOTABLE", meta: { pulled: eligible },
        });
      }
    }
    // time-on-ice, one second per tick, for the players ACTUALLY out there — total TOI
    // plus the PP / PK split, so TOI = ES + PP + PK and always covers the ST time.
    for (const team of [home, away]) {
      const s = curStr[team.id];
      const oi = st.currentOnIce[team.id];
      for (const p of [...oi.f, ...oi.d]) {
        const pl = st.lines[team.id][p.id]; if (!pl) continue;
        pl.toi += 1;
        if (s === "PP") pl.ppToi += 1; else if (s === "SH") pl.pkToi += 1;
      }
    }
    const absT = base + tick;

    // PK KILL momentum: a penalty that runs its full time (not ended by a PP goal)
    // is a kill — the shorthanded team's bench gets a lift.
    for (const p of active) {
      if (!p.expired && tick >= p.end && !killedPens.has(p)) {
        killedPens.add(p);
        momoSwing(st, p.team, absT, CFG.momentumPkKill); // p.team was shorthanded → they killed it
      }
    }

    if (state === "FACEOFF") {
      // a scrum at the whistle, before the draw — the natural real-hockey moment
      // for a fight to break out (see maybeStartFight's header comment)
      maybeStartFight(st, home, away, period, tick);
      // centers of the on-ice units contest the draw (FO vs FO)
      const hC = onIceF(home).find((s) => s.isCenter) ?? onIceF(home)[0] ?? home.forwards[0] ?? home.defense[0];
      const aC = onIceF(away).find((s) => s.isCenter) ?? onIceF(away)[0] ?? away.forwards[0] ?? away.defense[0];
      const homeWin = rng.chance(ratio((hC.attrs.fo ?? 50) * fat(home, hC), (aC.attrs.fo ?? 50) * fat(away, aC), 0.8));
      if (homeWin) { st.box[home.id].faceoffWins++; st.box[away.id].faceoffLosses++; st.lines[home.id][hC.id].faceoffWins++; st.lines[away.id][aC.id].faceoffLosses++; carrierTeam = home; carrier = hC; }
      else { st.box[away.id].faceoffWins++; st.box[home.id].faceoffLosses++; st.lines[away.id][aC.id].faceoffWins++; st.lines[home.id][hC.id].faceoffLosses++; carrierTeam = away; carrier = aC; }
      const foWinner = homeWin ? hC : aC, foLoser = homeWin ? aC : hC;
      st.sink.emit({
        period, seconds: tick, type: "FACEOFF",
        teamId: carrierTeam.id, teamCode: carrierTeam.code ?? undefined,
        playerId: foWinner.id, playerName: foWinner.name,
        targetId: foLoser.id, targetName: foLoser.name,
        zone: "NEU", importance: "MINOR",
      });
      zone = "NEU"; state = "PLAY"; setup = "carry"; press = 0;
      continue;
    }

    // ---- PLAY: run the decision tree for the carrier this tick ----
    // EDGE zone occupancy: the puck is in one absolute zone this tick. `zone` is
    // relative to the carrier, so the carrier's OFF is the opponent's DEF, etc.
    // Credit both teams so the OZ/NZ/DZ splits sum to play time.
    {
      const opp = other(carrierTeam);
      if (zone === "OFF") { st.box[carrierTeam.id].ozTime++; st.box[opp.id].dzTime++; }
      else if (zone === "DEF") { st.box[carrierTeam.id].dzTime++; st.box[opp.id].ozTime++; }
      else { st.box[carrierTeam.id].nzTime++; st.box[opp.id].nzTime++; }
    }
    const def = other(carrierTeam);
    const isHome = carrierTeam === home;
    const margin = st.box[carrierTeam.id].goals - st.box[def.id].goals;
    const tOff = tacticsMult(carrierTeam, margin), tDef = tacticsMult(def, -margin);
    // per-line tactic: the attacking forward line's OF push and the defending pair's
    // DF commitment tilt the battle (a top offensive line presses; a shut-down pair
    // suppresses). Neutral CK1/DF2/OF2 → 1.0, no effect.
    const atkTilt = lineTilt(carrierTeam.fwdTactics[shifts[carrierTeam.id].fIdx]);
    const defTilt = lineTilt(def.defTactics[shifts[def.id].dIdx]);
    // per-line SYSTEM: the on-ice forward line's Puck Style drives its shot rate &
    // chance quality; the on-ice D pair's D-Zone drives how much danger it allows &
    // its takeaways. Falls back to the team system when a unit has no override.
    const atkFx = carrierTeam.fwdLineFx[shifts[carrierTeam.id].fIdx] ?? carrierTeam.tactics;
    const defFx = def.defPairFx[shifts[def.id].dIdx] ?? def.tactics;
    // pick a defending skater; fall back to forwards if a (thin AHL) roster has no D
    // on ice, and never let it be undefined — an empty pool would otherwise crash.
    const dPool = onIceD(def).length ? onIceD(def) : def.defense.length ? def.defense : def.forwards;
    const dman = pickByAttr(rng, dPool, (s) => s.attrs.df ?? 50) ?? dPool[0] ?? carrier;
    // score-effect: the team in front eases off, the trailing team presses (catch-up → fewer blowouts)
    const catchUp = 1 - CFG.catchUpStrength * Math.max(-3, Math.min(3, margin));
    // team edge: the higher-overall club wins more battles and controls play, so
    // quality reliably tells over a season. Uses roster overall (the metric fans
    // compare) and amplifies the (narrow) OV gap; scaled by possessionSkillPct —
    // turn it down for more upsets, up for chalk.
    const ovGap = carrierTeam.avgOV - def.avgOV;
    const teamMult = Math.max(0.68, Math.min(1.32, 1 + ovGap * 0.035 * CFG.possessionSkillPct));

    // final-skill helper: base × tactics × chemistry × morale × fatigue × score-effect × team edge
    const atkSkill = (v: number, of = true) => v * (of ? tOff.of * atkTilt.of : 1) * chemFactor(carrier.chem, carrier.roleFit) * moraleFactor(carrier.morale) * fat(carrierTeam, carrier) * catchUp * teamMult;
    const defSkill = (v: number) => v * tDef.df * defTilt.df * dfat(def, dman);

    // 1) keep the puck vs. get stripped (SK vs DF) — a real challenge some ticks.
    // the defending team's forecheck aggression (takeaway) forces a few more strips;
    // a passive forecheck concedes possession. Contained to this node so it doesn't
    // over-suppress the opponent (see tactics.ts).
    if (rng.chance(0.09)) {
      const keep = Math.pow(ratio(atkSkill(carrier.attrs.sk ?? 50), defSkill(dman.attrs.df ?? 50)), defFx.takeaway);
      if (!rng.chance(keep)) { // turnover — defenders take over in their own zone
        carrierTeam = def; carrier = pickByAttr(rng, onIceD(def).concat(onIceF(def)), (s) => (s.attrs.df ?? 50) + (s.attrs.pa ?? 50)) ?? dman;
        zone = "DEF"; setup = "carry"; press = 0; continue;
      }
    }

    // 2) advance the puck toward the offensive zone (zone entry: SK vs DF+SK)
    if (zone !== "OFF") {
      if (rng.chance(0.28)) {
        const gap = 0.6 * (dman.attrs.df ?? 50) + 0.4 * (dman.attrs.sk ?? 50);
        if (rng.chance(ratio(atkSkill(carrier.attrs.sk ?? 50), defSkill(gap)))) {
          // a real, live ZONE_ENTRY — NEU->OFF only (matches the real-hockey stat:
          // crossing into the ATTACKING zone; DEF->NEU is a breakout, not tracked).
          if (zone === "NEU") {
            st.sink.emit({
              period, seconds: tick, type: "ZONE_ENTRY", teamId: carrierTeam.id, teamCode: carrierTeam.code ?? undefined,
              playerId: carrier.id, playerName: carrier.name, zone: "OFF", importance: "NOTABLE",
              meta: { entryType: "carry" },
            });
          }
          zone = zone === "DEF" ? "NEU" : "OFF"; setup = "carry";
        }
        else if (rng.chance(0.4)) { carrierTeam = def; carrier = pickByAttr(rng, onIceF(def), (s) => s.attrs.pa ?? 50) ?? dman; zone = "DEF"; setup = "carry"; press = 0; } // stuffed → turnover
      }
      continue;
    }

    // 3) in the O-zone: an offensive action fires some ticks (shoot vs pass: SC vs PA).
    // team-system tempo/style scales HOW OFTEN the carrier generates a chance, and the
    // defender's posture scales how many it allows. Scaled up by MISS_COMPENSATION —
    // a fraction of these attempts now sail wide (see the MISS check below) instead
    // of always reaching the net, so the upstream rate is boosted to keep the actual
    // on-goal (SOG) rate the calibration is tuned against unchanged.
    if (!rng.chance(0.29 * atkFx.shotRate * def.tactics.oppShotRate * MISS_COMPENSATION)) continue;
    // Shoot-or-pass decision FIRST. A forward who elects to SHOOT sometimes walks
    // the puck back to the point for a D one-timer instead — this is how D rack up
    // their goals. But a forward who would PASS keeps the puck (→ his linemate's
    // one-timer and the passer's assist survive), so the point shot only ever
    // cannibalises a forward's own shot, never a scoring-chance pass play.
    const wantsShot = rng.chance(ratio(atkSkill(carrier.attrs.sc ?? 50), (carrier.attrs.pa ?? 50), 0.7));
    // A SNIPER shoots it himself; a lower-skill forward is the one who defers to the
    // QB at the point. So the deferral rate falls with the carrier's shot (SC) — an
    // 82+ sniper (McDavid) never gives it up, a grinder defers up to ~1/3 the time.
    // This keeps the point shots (→ D goals) coming off DEPTH possessions instead of
    // taxing the elite scorers' own looks, so the scoring race stays intact.
    const deferRate = Math.max(0, Math.min(0.40, 0.40 * (85 - (carrier.attrs.sc ?? 50)) / 45));
    // only a plain CARRY defers to the point — a forward who just took a cross-ice
    // feed or a rebound shoots his high-danger look himself (never downgraded to a
    // point shot), so the diversion adds D goals without destroying scoring chances.
    const pointShot = wantsShot && !carrier.isDefense && zone === "OFF" && setup === "carry" && rng.chance(deferRate);
    if (pointShot) { const d = pickByAttr(rng, onIceD(carrierTeam), (s) => Math.pow(involvement(0.62 * (s.attrs.sc ?? 50) + 0.38 * (s.attrs.pa ?? 50)), 3.0) * 60); if (d) carrier = d; } // elite offensive D quarterback the point → they get the goals (steep pick concentrates the top end)
    if (wantsShot) {
      // SHOT — blocked? (DF vs SC). A diverted point shot has traffic/a screen in
      // front, so it's blocked less (and isn't judged by the D's weak SC) — this
      // stops the diversion from leaking goals to blocks and keeps scoring neutral.
      const blockP = pointShot ? 0.32 : 0.5 * ratio(defSkill(dman.attrs.df ?? 50), atkSkill(carrier.attrs.sc ?? 50));
      if (rng.chance(blockP)) { setup = "carry"; continue; } // blocked
      // MISS — sails wide or off the iron, before it ever reaches the net (so it
      // does NOT count toward st.box[...].shots or xG — those stay SOG-only, exactly
      // as calibrated). A longer point shot misses more than an in-tight look; a
      // sharper shooter (SC) hits the target more often. MISS_COMPENSATION above
      // keeps the resulting SOG rate at its pre-MISS calibrated level.
      const missP = pointShot ? 0.34 : Math.max(0.14, 0.27 - ((carrier.attrs.sc ?? 50) - 50) * 0.003);
      if (rng.chance(missP)) {
        st.sink.emit({
          period, seconds: tick, type: "MISS", teamId: carrierTeam.id, teamCode: carrierTeam.code ?? undefined,
          playerId: carrier.id, playerName: carrier.name, zone: "OFF",
          sector: pointShot ? "POINT" : undefined, importance: "NOTABLE",
        });
        setup = "carry"; continue; // stays live off the end boards / behind the net
      }
      // shot danger: a D-man point shot is low, a one-timer off a pass or a rebound
      // is high, a forward's own-rush shot is medium. Chemistry drives more passes
      // → more high-danger looks, so gelled lines get better chances automatically.
      // a D's shot: the low POINT xG already reflects the long-range look, so the
      // danger multiplier is near-neutral (was double-counting at 0.35 → almost no D
      // goals). A pinching / rush-joining D gets a forward-like look.
      // A DIVERTED point shot is a screened / tipped quality look (a forward gave up
      // his own shot for it), so it converts near a forward's carry — the goal just
      // moves from the F to the D, keeping league scoring neutral. An organic D dump
      // from the point stays low.
      const baseDanger = carrier.isDefense ? (pointShot ? 0.92 : 0.63) : setup === "pass" ? 1.75 : setup === "rebound" ? 1.6 : 1.0;
      // team-system: rush raises chance danger, shot-volume lowers it (more but softer);
      // the defending team's D-zone posture (collapse) suppresses danger.
      const dangerBias = atkFx.dangerMix * defFx.oppDangerMult;
      // home-ice last change: the home coach gets the final matchup, smothering some
      // danger when defending (away team carrying → home defends).
      const lastChange = !isHome ? 1 - 0.035 * (CFG.homeLastChangePct / 100) : 1;
      const danger = baseDanger * dangerBias * lastChange;
      const strength = strengthAt(carrierTeam, def, tick, active);
      const gLine = liveGoalieLine(st, def.id);
      const gSim = liveGoalie(st, def);
      st.box[carrierTeam.id].shots++;
      if (period <= 4) st.box[carrierTeam.id].shotsByPeriod[period - 1]++;
      st.lines[carrierTeam.id][carrier.id].shots++;
      gLine.shotsAgainst++;
      // Phase 2 — shot quality: tag the shot with a location, type and expected
      // goals (independent of shooter finishing / goalie quality). Accumulate the
      // xG into the shooter, his team, and the goalie facing it (→ GSAx).
      const strengthKey: ShotStrength = strength === "PP" ? "PP" : strength === "SH" ? "SH" : "EV";
      const { sector, shotType } = shotProfile(rng, { isDefense: carrier.isDefense, setup, danger, dangerBias });
      const xg = expectedGoal(rng, sector, shotType, strengthKey);
      const hd = isHighDanger(sector);
      // Shift Quality: this chance's xG lifts the shooters' on-ice shift, dents the defenders'
      creditShiftXg(st, [...onIceF(carrierTeam), ...onIceD(carrierTeam)], [...onIceF(def), ...onIceD(def)], xg);
      st.lines[carrierTeam.id][carrier.id].xg += xg;
      if (hd) st.lines[carrierTeam.id][carrier.id].hdShots++;
      st.box[carrierTeam.id].xgFor += xg;
      if (hd) st.box[carrierTeam.id].hdFor++;
      gLine.xga += xg;
      // EDGE: shot location distribution + shot speed (fastest + avg tracked per team)
      const zi = sectorIndex(sector);
      st.box[carrierTeam.id].shotSectors[zi]++;
      st.lines[carrierTeam.id][carrier.id].shotZones[zi]++; // per-shooter full shot map (all zones)
      gLine.faceZones[zi]++;                                 // per-goalie full save map (all zones)
      const mph = shotSpeed(rng, shotType, carrier.attrs.sc ?? 50);
      st.box[carrierTeam.id].shotSpeedSum += mph;
      const shooterLine = st.lines[carrierTeam.id][carrier.id];
      if (mph > shooterLine.topShotSpeed) shooterLine.topShotSpeed = mph;
      if (mph > st.box[carrierTeam.id].topShotSpeed) {
        st.box[carrierTeam.id].topShotSpeed = mph;
        st.box[carrierTeam.id].topShotBy = carrier.name;
      }
      // EDGE: goalie shots-faced by danger. Bucket on the ACTUAL chance danger
      // (what drives conversion) so HD save% is realistically the lowest: a slot
      // one-timer / rebound (danger≥1.5) = HD, a forward's carry look = MD, a point
      // shot (danger~0.35) = LD.
      const danger3: "hd" | "md" | "ld" = danger >= 1.5 ? "hd" : danger >= 0.6 ? "md" : "ld";
      if (danger3 === "hd") gLine.hdShotsAg++; else if (danger3 === "md") gLine.mdShotsAg++; else gLine.ldShotsAg++;
      press++; // sustained pressure: screening / traffic / a tiring goalie
      if (press === 3) momoSwing(st, carrierTeam.id, absT, CFG.momentumFlurry); // shot flurry lifts the bench
      const pressBonus = 1 + 0.06 * Math.min(press - 1, 4);
      const offMult = chemFactor(carrier.chem, carrier.roleFit) * moraleFactor(carrier.morale) * physFactor(carrier.weight) * fat(carrierTeam, carrier) * tOff.of * carrierTeam.coachOff;
      const defShield = (2 - (st.defChem[def.id] ?? 1)) * (2 - dfat(def, dman)) * tDef.df * def.coachDef;
      // the DEFENCE in front of the goalie: a high-DF pair on the ice contests the lane
      // and lowers shot quality (fewer goals), a weak pair gives it up — so goals-against
      // reflects the blue line, not just the keeper. Centred on an average pair (~74 DF).
      const dPair = onIceD(def);
      const avgDefDf = dPair.length ? dPair.reduce((s, d) => s + (d.attrs.df ?? 50), 0) / dPair.length : (dman.attrs.df ?? 50);
      const defTalent = Math.max(0.72, Math.min(1.3, 1 - (CFG.defenseTalentPct / 100) * (avgDefDf - 74) / 20));
      const ppMod = strength === "PP" ? (carrierTeam.ppChem / def.pkChem) * atkFx.ppConv * defFx.pkSuppress : 1; // gelled PP1 + PP formation vs gelled PK1 + PK structure
      const shOff = strength !== "EV" ? carrier.offense / carrier.posPenalty : carrier.offense; // off-position waived on ST
      // PARITY: compress the talent mismatch so favourites don't run away. The
      // shooter×goalie conversion is pulled toward the SAME situation with a
      // league-average shooter & keeper (danger/strength/home preserved), and the
      // team defence/coaching/chem edge toward 1. Ranks are kept — only the spread
      // narrows — so the scoring race and elite goalies still stand out.
      const pk = 1 - PARITY_CONV * parityAmt();
      const pTalent = conversion(shOff, effGoalieQuality(gSim), isHome, strength);
      // PARITY compresses only the GOALIE mismatch toward a league-average keeper —
      // a team-level edge — while the SHOOTER's finishing is left FULL, so elite
      // snipers still pile up goals (top scorers reach ~110-120) even as weak teams
      // stay competitive. (Anchor keeps `shOff`, swaps only the goalie.)
      const pAnchor = conversion(shOff, LEAGUE.avgGoalie, isHome, strength);
      const pConv = compressToward(pTalent, pAnchor, pk);
      const teamEdge = compressToward(offMult * defShield * defTalent, 1, pk);
      // a booming point shot rewards the D's SHOT rating (SC): an elite offensive D
      // beats the keeper cleanly, a stay-at-home D rarely does. Centred so the mean
      // D keeps the same total (only the SPREAD widens → a few elite D reach 20-25).
      const pointFinish = pointShot ? Math.max(0.75, Math.min(1.5, 1 + 0.016 * ((carrier.attrs.sc ?? 50) - 58))) : 1;
      let p = pConv * danger * pressBonus * pointFinish
        * momoBoost(st, carrierTeam.id, absT) * clutchFactor(st, carrier, period, tick, margin)
        * teamEdge * catchUp * ppMod
        * (st.nightOff[carrierTeam.id] ?? 1) * (st.nightDef[def.id] ?? 1); // any-given-night form
      // Empty net (both engines — a real missing mechanic, not a v2 presentation
      // choice; see st.emptyNet below). carrierTeam pulled: 6-on-5 pressure. def
      // pulled: an open net — a shot on target goes in almost every time.
      const attackerEmptyNet = st.emptyNet[carrierTeam.id] === true;
      const defEmptyNet = st.emptyNet[def.id] === true;
      if (attackerEmptyNet) p *= 1.22;
      if (defEmptyNet) p = 0.82;
      st.sink.emit({
        period, seconds: tick, type: "SHOT",
        teamId: carrierTeam.id, teamCode: carrierTeam.code ?? undefined,
        playerId: carrier.id, playerName: carrier.name,
        targetId: gSim.id, targetName: gSim.name,
        zone: "OFF", sector, shotType,
        strength: strength as SimEvent["strength"], xg,
        importance: hd ? "NOTABLE" : "MINOR",
        meta: { danger, setup, mph: Math.round(mph) },
      });
      if (rng.chance(p)) {
        gLine.goalsAgainst++;
        recordGoal(st, carrierTeam, def, period, tick, strength, defEmptyNet, carrier, { sector, shotType, xg });
        momoOnGoal(st, carrierTeam.id, def.id, absT);
        maybePullGoalie(st, def); // yank the starter if he's been shelled
        if (strength === "PP") expireOnePenalty(def.id, tick, active);
        state = "FACEOFF"; setup = "carry"; continue;
      }
      gLine.saves++;
      gLine.saveZones[zi]++; // per-goalie full save map (all zones)
      if (danger3 === "hd") gLine.hdSaves++; else if (danger3 === "md") gLine.mdSaves++; else gLine.ldSaves++;
      st.sink.emit({
        period, seconds: tick, type: "SAVE",
        teamId: def.id, teamCode: def.code ?? undefined,
        playerId: gSim.id, playerName: gSim.name,
        targetId: carrier.id, targetName: carrier.name,
        zone: "OFF", sector, shotType, xg,
        importance: hd ? "NOTABLE" : "MINOR",
        meta: { danger, setup },
      });
      const rb = gSim.attrs.rb ?? 50;
      if (rng.chance(Math.max(0.05, 0.32 - rb / 300))) {
        carrier = pickByAttr(rng, onIceF(carrierTeam), (s) => involvement(s.attrs.sc ?? 50) * 60) ?? carrier; setup = "rebound"; // rebound in the slot (press stays → escalating danger)
        st.sink.emit({
          period, seconds: tick, type: "REBOUND", teamId: carrierTeam.id, teamCode: carrierTeam.code ?? undefined,
          playerId: carrier.id, playerName: carrier.name, zone: "OFF", importance: "NOTABLE",
        });
      }
      else if (rng.chance(0.12)) { state = "FACEOFF"; setup = "carry"; press = 0; } // goalie freezes it → whistle
      else { carrierTeam = def; carrier = pickByAttr(rng, onIceD(def).concat(onIceF(def)), (s) => s.attrs.pa ?? 50) ?? dman; zone = "DEF"; setup = "carry"; press = 0; } // covered & cleared, play on
      continue;
    }
    // PASS — completed (PA vs DF) → puck to a linemate (sets up a one-timer); else intercepted
    if (rng.chance(ratio(atkSkill(carrier.attrs.pa ?? 50), defSkill(dman.attrs.df ?? 50), 0.7))) {
      carrier = pickByAttr(rng, onIceF(carrierTeam), (s) => involvement(0.6 * (s.attrs.sc ?? 50) + 0.4 * (s.attrs.sk ?? 50)) * 60) ?? carrier;
      setup = "pass";
    } else {
      carrierTeam = def; carrier = pickByAttr(rng, onIceD(def).concat(onIceF(def)), (s) => s.attrs.df ?? 50) ?? dman; zone = "DEF"; setup = "carry"; press = 0;
    }
  }
  // period over — close out the on-ice players' final shift
  for (const team of [home, away]) { flushShift(st, team.id, onIceF(team)); flushShift(st, team.id, onIceD(team)); }
  // any penalty still running at the buzzer carries its remaining time to next period
  st.carryPenalties = active
    .filter((p) => !p.expired && p.end > PERIOD_SECONDS)
    .map((p) => ({ team: p.team, start: 0, end: p.end - PERIOD_SECONDS, expired: false }));
}

// ---- injuries ---------------------------------------------------------------

/**
 * Roll in-game injuries. Rate scales with the injury setting; a player's risk
 * rises with ice time (exposure) and falls with durability (DU). Duration is
 * mostly short, occasionally long-term (concussions skew longer).
 */
// Phase 4 — body parts by injury mechanism (contact injuries hit the upper body /
// head; blocks hurt hands & feet; overuse is groin/knee/hip).
const INJ_PARTS: Record<InjuryMechanism, string[]> = {
  "Hit": ["Shoulder", "Upper Body", "Concussion", "Collarbone", "Ribs"],
  "Blocked shot": ["Hand", "Foot", "Ankle", "Lower Body"],
  "Fight": ["Hand", "Facial", "Upper Body"],
  "Collision": ["Knee", "Concussion", "Upper Body", "Ankle"],
  "Fatigue": ["Groin", "Lower Body", "Hip", "Lower Body"],
  "Non-contact": ["Lower Body", "Upper Body", "Lower Body"], // NHL-style vague report
};

function severityOf(days: number): InjurySeverity {
  if (days >= 120) return "Season-ending";
  if (days >= 45) return "Long-term";
  if (days >= 20) return "Multi-week";
  if (days >= 7) return "Week-to-Week";
  return "Day-to-Day";
}

// Mechanism-specific duration skew, applied on top of the base curve below. A
// fight tweak (cut, sore hand) is almost always short — real tilts rarely put a
// guy out long-term; a soft-tissue fatigue knock heals faster than blunt trauma;
// a full-speed collision runs slightly WORSE than a standard open-ice hit.
const MECH_DAYS_SKEW: Record<InjuryMechanism, number> = {
  "Hit": 1, "Collision": 1.05, "Blocked shot": 0.9, "Fight": 0.45, "Fatigue": 0.8, "Non-contact": 0.95,
};

// Roll a duration. Calibrated to real NHL: MOST injuries are day-to-day (miss a
// game or two), a chunk are week-to-week, few are multi-week, and season-enders
// are rare. Avg ~11 days (~7 games missed at our schedule density).
function injuryDays(st: SimState, mech: InjuryMechanism, part: string): number {
  const roll = st.rng.next();
  let days = roll < 0.70 ? 1 + st.rng.int(6)          // day-to-day (1-6)
    : roll < 0.93 ? 7 + st.rng.int(13)                 // week-to-week (7-19)
    : roll < 0.99 ? 20 + st.rng.int(20)                // multi-week (20-39)
    : 42 + st.rng.int(38);                             // long / season-ending (42-79)
  days = Math.max(1, Math.round(days * MECH_DAYS_SKEW[mech]));
  if (part === "Concussion") days = Math.max(days, 8 + st.rng.int(24));
  return days;
}

// A physical checker on the opponent — the guy who threw the hit that hurt someone.
function pickHitter(st: SimState, team: SimTeam): SimSkater {
  const pool = [...team.forwards, ...team.defense];
  return pool[st.rng.weighted(pool.map((s) => s.hitting * s.iceTime * physFactor(s.weight)))] ?? pool[0];
}

function addInjury(st: SimState, team: SimTeam, victim: SimSkater, mech: InjuryMechanism, period: number, seconds: number, by?: SimSkater) {
  // a player already hurt this game is out — he can't pick up a second injury
  if (st.injuries.some((i) => i.playerId === victim.id)) return;
  const part = INJ_PARTS[mech][st.rng.int(INJ_PARTS[mech].length)];
  const days = injuryDays(st, mech, part);
  st.injuries.push({
    period, seconds, time: fmt(seconds), teamId: team.id,
    playerId: victim.id, playerName: victim.name, days, desc: part,
    mechanism: mech, severity: severityOf(days), byId: by?.id, byName: by?.name,
  });
  st.sink.emit({
    period, seconds, type: "INJURY", teamId: team.id,
    playerId: victim.id, playerName: victim.name, targetId: by?.id, targetName: by?.name,
    importance: days >= 20 ? "MAJOR" : "NOTABLE",
    meta: { part, days, mechanism: mech, severity: severityOf(days) },
  });
}

// Injuries are driven by the physical play, not a flat random roll: a heavy,
// chippy opponent injures more of your players (STHS's light-vs-heavy hit calc);
// blocking hard shots hurts D more; the rest is overuse (fatigue/durability).
// Rolled LIVE, every tick, against the skaters actually on the ice right now —
// NOT a post-game statistical pass — so the moment a player goes down, subMis
// (checked on every onIceF/onIceD call) excludes him starting the very next
// tick. Ice time falls out of this for free: a player who's out there more
// racks up more per-tick rolls, same as real injury-exposure risk.
function maybeInjureOnIce(st: SimState, team: SimTeam, opp: SimTeam, onIce: SimSkater[], period: number, tick: number, intervalSec = 1): SimSkater[] {
  const hurt: SimSkater[] = [];
  if (!CFG.injuriesEnabled || !onIce.length) return hurt;
  // Same calibration anchor the old per-game model used: the three shares below
  // (contact 0.26, blocked-shot 0.09, wear 0.20) sum to ~0.55/team/game at a
  // neutral matchup — rescaled to INJURY_BASE so 100% injuryChancePct still means
  // ~1 injury per 5 games per team, same target as before this rework.
  const cal = INJURY_BASE / 0.55;
  const scale = (CFG.injuryChancePct / 100) * cal;
  const physPressure = (opp.profile.ck / 66) * (opp.profile.weight / 92);
  const ticksPerGame = PERIOD_SECONDS * 3;
  for (const s of onIce) {
    if (st.injured.has(s.id)) continue;
    const rust = s.con < 96 ? 1 + (96 - s.con) * (0.9 - s.attrs.du / 200) : 1;
    const light = Math.max(0.7, (100 - Math.max(0, s.weight - 82)) / 100 + 0.15); // a light frame absorbs a big hit worse
    const duFactor = (115 - s.attrs.du) / 65; // DU 50→1.0x, DU 90→0.38x, DU 20→1.46x
    const contactShare = 0.26 * physPressure * light; // Hit/Collision — opponent's chippiness
    const blockShare = s.isDefense ? 0.09 * 1.6 : 0.09 * 0.5; // Blocked shot — D block most
    const wearShare = 0.20; // Non-contact / Fatigue — flat, overuse-driven
    const lambdaPerGame = (contactShare + blockShare + wearShare) * scale * duFactor;
    // intervalSec > 1 for callers that don't have a real 1-second tick loop (OT's
    // 3-on-3 model samples a fresh on-ice trio every 15 game-seconds instead) —
    // scale the per-second hazard up by however much real time this call covers.
    const hazard = Math.min(0.02 * intervalSec, (lambdaPerGame / ticksPerGame) * rust * intervalSec);
    if (!st.rng.chance(hazard)) continue;
    const total = contactShare + blockShare + wearShare;
    const r = st.rng.next() * total;
    let mech: InjuryMechanism;
    let by: SimSkater | undefined;
    if (r < contactShare) { mech = st.rng.chance(0.15) ? "Collision" : "Hit"; by = pickHitter(st, opp); }
    else if (r < contactShare + blockShare) { mech = "Blocked shot"; }
    else {
      const toi = st.lines[team.id][s.id]?.toi ?? 0;
      // "Fatigue" only when he's genuinely logged heavy minutes THIS game so far
      // (≥20 min — overplayed workhorse); everyone else is a generic vague knock.
      mech = toi >= 1200 ? "Fatigue" : "Non-contact";
    }
    addInjury(st, team, s, mech, period, tick, by);
    st.injured.add(s.id);
    hurt.push(s);
  }
  return hurt;
}

// FIGHT injuries stay a post-hoc pass, tied to generateFights() (itself a
// post-hoc, end-of-game system) — a combatant (rare) tweaks a hand.
function generateFightInjuries(st: SimState, period: number) {
  if (!CFG.injuriesEnabled) return;
  const cal = INJURY_BASE / 0.55;
  const scale = (CFG.injuryChancePct / 100) * cal;
  for (const team of [st.home, st.away]) {
    const pool = [...team.forwards, ...team.defense];
    if (!pool.length) continue;
    const fighters = st.penalties.filter((p) => p.team === team.id && p.type === "Fighting" && p.period === period);
    for (const f of fighters) {
      if (st.injured.has(f.playerId)) continue;
      if (st.rng.chance(0.06 * scale)) {
        const victim = pool.find((s) => s.id === f.playerId) ?? pool[0];
        addInjury(st, team, victim, "Fight", f.period, f.seconds);
        st.injured.add(victim.id);
      }
    }
  }
}

// ---- endgame (pulled goalie) ------------------------------------------------

/**
 * Final ~90s of regulation. A team trailing by 1–2 pulls its goalie for a 6th
 * attacker: better odds to tie, but the leader can score into the empty net.
 * Lifts the OT rate and produces realistic empty-net goals.
 */
function simulateEndgame(st: SimState) {
  const { home, away, rng } = st;
  let margin = st.box[home.id].goals - st.box[away.id].goals;
  if (margin === 0 || Math.abs(margin) > 2) return;

  const oneGoal = Math.abs(margin) === 1;
  const trailing = margin < 0 ? home : away;
  const leading = margin < 0 ? away : home;
  const attempts = 2;
  const tieP = (oneGoal ? 0.075 : 0.025) * (trailing.offenseRating / LEAGUE.avgOffense);
  const engP = oneGoal ? 0.11 : 0.13;

  for (let i = 0; i < attempts; i++) {
    const t = 1120 + i * 30; // ~18:40 and ~19:10 of the 3rd
    // empty-net goal for the leader (trailing team's net is empty)
    if (rng.chance(engP)) {
      st.box[leading.id].shots++;
      st.box[leading.id].shotsByPeriod[2]++;
      setFreshUnit(st, leading); setFreshUnit(st, trailing);
      recordGoal(st, leading, trailing, 3, t, "EV", true);
      return; // game iced
    }
    // 6-on-5 push for the trailing team
    const shooter = pickShooter(rng, trailing);
    st.box[trailing.id].shots++;
    st.box[trailing.id].shotsByPeriod[2]++;
    st.lines[trailing.id][shooter.id].shots++;
    st.box[leading.id].goalie.shotsAgainst++;
    if (rng.chance(tieP)) {
      st.box[leading.id].goalie.goalsAgainst++;
      setFreshUnit(st, trailing); setFreshUnit(st, leading);
      recordGoal(st, trailing, leading, 3, t, "EV");
      margin = st.box[home.id].goals - st.box[away.id].goals;
      if (margin === 0) return; // tied it up -> heading to OT
    } else {
      st.box[leading.id].goalie.saves++;
    }
  }
}

// ---- overtime / shootout ----------------------------------------------------

function simulateOvertime(st: SimState): { winner: number | null; seconds: number } {
  const { home, away, rng } = st;
  const step = 15;
  // healthy(team): a team's forwards/defense minus anyone hurt this game — OT has
  // no persistent on-ice unit the way 5-on-5 does (each shot draws from the whole
  // roster), so this is the injury guard for shooter/unit selection below.
  const healthy = (team: SimTeam): SimTeam => (!st.injured.size ? team : {
    ...team, forwards: team.forwards.filter((s) => !st.injured.has(s.id)), defense: team.defense.filter((s) => !st.injured.has(s.id)),
  });
  for (let t = step; t <= OT_SECONDS; t += step) {
    // live injuries in OT too: no persistent on-ice unit exists to check every
    // tick against (unlike 5-on-5's onIceF/onIceD), so sample a plausible on-ice
    // trio each 15-second interval and roll it the same way — intervalSec scales
    // the hazard to cover the real time this call represents.
    for (const team of [home, away]) {
      const opp = team === home ? away : home;
      const sampleF = weightedSample(rng, healthy(team).forwards, 2);
      const sampleD = weightedSample(rng, healthy(team).defense, 1);
      maybeInjureOnIce(st, team, opp, [...sampleF, ...sampleD], 4, t, step);
    }
    for (const [att, def, isHome] of [[home, away, true], [away, home, false]] as const) {
      // 3-on-3 is wide open: elevated chance rate scaled by offense
      const rate = 0.055 * (att.offenseRating / LEAGUE.avgOffense);
      if (!rng.chance(rate)) continue;
      const attHealthy = healthy(att);
      if (!attHealthy.forwards.length && !attHealthy.defense.length) continue;
      const shooter = pickShooter(rng, attHealthy);
      const gLine = liveGoalieLine(st, def.id);
      st.box[att.id].shots++;
      st.box[att.id].shotsByPeriod[3]++;
      st.lines[att.id][shooter.id].shots++;
      gLine.shotsAgainst++;
      const p = conversion(shooter.offense, effGoalieQuality(liveGoalie(st, def)), isHome, "EV") * 2.2;
      if (rng.chance(p)) {
        gLine.goalsAgainst++;
        setFreshUnitOT(st, att, shooter); setFreshUnitOT(st, def); // 3-on-3 on-ice sets
        recordGoal(st, att, def, 4, t, "EV", false, shooter);
        return { winner: att.id, seconds: t };
      }
      gLine.saves++;
    }
  }
  return { winner: null, seconds: OT_SECONDS };
}

function simulateShootout(st: SimState): number {
  const { home, away, rng } = st;
  // shooter order: the manager's list first (resolved to on-roster forwards),
  // then the best remaining by penalty-shot + finishing.
  const shooters = (t: SimTeam) => {
    const byId = new Map([...t.forwards, ...t.defense].map((s) => [s.id, s]));
    // a player hurt earlier this game can't take a shootout attempt, even if the
    // manager's pre-set order still lists him.
    const picked = t.shootoutOrder.map((id) => byId.get(id)).filter((s): s is SimSkater => !!s && !st.injured.has(s.id));
    const rest = [...t.forwards].filter((s) => !picked.includes(s) && !st.injured.has(s.id)).sort((a, b) => (b.attrs.ps + b.offense) - (a.attrs.ps + a.offense));
    const pool = [...picked, ...rest].slice(0, 12);
    return pool.length ? pool : t.forwards; // extreme edge case: whole forward corps hurt — fall back rather than crash
  };
  const hS = shooters(home), aS = shooters(away);
  let hG = 0, aG = 0;
  // record an attempt: goal, save, or missed the net
  const attempt = (shooter: SimSkater, def: SimTeam, round: number, team: SimTeam) => {
    const p = 0.33 * (0.6 + 0.4 * (shooter.attrs.ps + shooter.offense) / 130)
      * (LEAGUE.avgGoalie / effGoalieQuality(liveGoalie(st, def)));
    const scored = rng.chance(Math.max(0.1, Math.min(0.6, p)));
    const result: ShootoutAttempt["result"] = scored ? "goal" : rng.chance(0.28) ? "miss" : "save";
    st.shootout.push({ round, teamId: team.id, shooterId: shooter.id, shooterName: shooter.name, result });
    return scored;
  };
  for (let r = 0; r < 3; r++) {
    if (attempt(hS[r % hS.length], away, r + 1, home)) hG++;
    if (attempt(aS[r % aS.length], home, r + 1, away)) aG++;
  }
  let r = 3;
  while (hG === aG && r < 20) {
    if (attempt(hS[r % hS.length], away, r + 1, home)) hG++;
    if (attempt(aS[r % aS.length], home, r + 1, away)) aG++;
    r++;
  }
  const winner = hG >= aG ? home : away;
  // the shootout winner is credited one goal for the final score
  st.box[winner.id].goals++;
  return winner.id;
}

// ---- faceoffs, hits, blocks, TOI -------------------------------------------

function simulateFaceoffs(st: SimState) {
  const centers = (t: SimTeam) => {
    const c = t.forwards.filter((f) => f.isCenter);
    return c.length ? c : t.forwards;
  };
  const hC = centers(st.home), aC = centers(st.away);
  for (let i = 0; i < LEAGUE.faceoffsPerGame; i++) {
    const h = hC[st.rng.weighted(hC.map((s) => s.iceTime))];
    const a = aC[st.rng.weighted(aC.map((s) => s.iceTime))];
    const pHome = h.faceoff / (h.faceoff + a.faceoff);
    if (st.rng.chance(pHome)) {
      st.box[st.home.id].faceoffWins++; st.box[st.away.id].faceoffLosses++;
      st.lines[st.home.id][h.id].faceoffWins++; st.lines[st.away.id][a.id].faceoffLosses++;
    } else {
      st.box[st.away.id].faceoffWins++; st.box[st.home.id].faceoffLosses++;
      st.lines[st.away.id][a.id].faceoffWins++; st.lines[st.home.id][h.id].faceoffLosses++;
    }
  }
}

// modeled rink-zone tendencies for defensive actions (not centimetre tracking):
// where hits/blocks/takeaways typically happen. Per-player maps then vary by volume
// and position (D block the point/slot; forwards hit along the boards).
const HIT_ZONES: [string, number][] = [["PERIMETER", 46], ["NET_FRONT", 20], ["CIRCLE", 20], ["POINT", 8], ["SLOT", 6]];
const BLOCK_ZONES: [string, number][] = [["SLOT", 35], ["POINT", 30], ["NET_FRONT", 20], ["PERIMETER", 10], ["CIRCLE", 5]];
const TAKE_ZONES: [string, number][] = [["PERIMETER", 35], ["CIRCLE", 25], ["POINT", 20], ["SLOT", 10], ["NET_FRONT", 10]];
// missed shots skew farther out than the general shot mix (a point shot or a bad-angle
// perimeter look is far likelier to sail wide than a tap-in from the slot).
const MISS_ZONES: [string, number][] = [["PERIMETER", 38], ["POINT", 27], ["CIRCLE", 20], ["SLOT", 11], ["NET_FRONT", 4]];
const ENTRY_LANES: [string, number][] = [["LEFT WING", 33], ["RIGHT WING", 33], ["CENTER", 34]];
const ENTRY_TYPES: [string, number][] = [["carry", 50], ["dump", 35], ["pass", 15]];
const pickZone = (rng: RNG, table: [string, number][]) => table[rng.weighted(table.map((z) => z[1]))][0];

function distributeCounting(st: SimState) {
  for (const team of [st.home, st.away]) {
    // exclude anyone hurt this game — he can't rack up a HIT/BLOCK/TAKEAWAY/MISS/
    // ZONE_ENTRY after leaving the ice (this runs post-game, so st.injured is final).
    const roster = [...team.forwards, ...team.defense].filter((s) => !st.injured.has(s.id));
    // emit a located defensive-action event (for the player heat maps). Counts stay
    // exactly as calibrated below — only a modeled rink zone + time are attached.
    const emitAction = (type: "HIT" | "BLOCK" | "TAKEAWAY" | "MISS" | "ZONE_ENTRY", s: SimSkater, sector: string, meta?: Record<string, unknown>) => {
      st.sink.emit({
        period: 1 + st.rng.int(3), seconds: st.rng.int(PERIOD_SECONDS), type,
        teamId: team.id, teamCode: team.code ?? undefined, playerId: s.id, playerName: s.name,
        zone: "OFF", sector, importance: "NOTABLE", meta,
      });
    };
    // hits — a physical team (high CK / heavy) throws noticeably more; centred on
    // an average-checking club so the league total stays NHL-realistic (~21/team).
    let hw = 0, wt = 0;
    for (const r of roster) { hw += r.hitting * r.iceTime; wt += r.iceTime; }
    const avgHit = wt ? hw / wt : 71;
    // centred on the league-mean checking (~71 ice-weighted) so the average club
    // sits at ~21 hits and physical/finesse teams spread ~16–27.
    const hitFactor = Math.max(0.78, Math.min(1.4, 1 + (avgHit - 71) / 60));
    const hits = st.rng.poisson(LEAGUE.hitsPerTeam * (CFG.hitsPct / 100) * hitFactor * team.coachPhy);
    for (let i = 0; i < hits; i++) {
      // heavier bodies throw more of the hits (physicality)
      const s = roster[st.rng.weighted(roster.map((r) => r.hitting * r.iceTime * physFactor(r.weight)))];
      st.lines[team.id][s.id].hits++; st.box[team.id].hits++;
      emitAction("HIT", s, pickZone(st.rng, HIT_ZONES));
    }
    // blocks (defense-heavy)
    const blocks = st.rng.poisson(LEAGUE.blocksPerTeam);
    for (let i = 0; i < blocks; i++) {
      const s = roster[st.rng.weighted(roster.map((r) => r.blocking * r.iceTime * (r.isDefense ? 1.8 : 1)))];
      st.lines[team.id][s.id].blocks++; st.box[team.id].blocks++;
      emitAction("BLOCK", s, pickZone(st.rng, BLOCK_ZONES));
    }
    // takeaways (event-only, for the defensive map) — stick-checking, smart D/centres
    const takeaways = st.rng.poisson(7); // ~7/team
    for (let i = 0; i < takeaways; i++) {
      const s = roster[st.rng.weighted(roster.map((r) => ((r.attrs.df ?? 50) + (r.attrs.sk ?? 50)) * r.iceTime))];
      emitAction("TAKEAWAY", s, pickZone(st.rng, TAKE_ZONES));
    }
    // missed shots (wide / off the iron) — the possession model now emits these for
    // REAL, live, from the O-zone shot-resolution branch (see MISS_COMPENSATION and
    // the MISS check right after the block-check above). This statistical fallback
    // only fires for the legacy "volume" engine model, same as ZONE_ENTRY below.
    if (CFG.engineModel !== "possession") {
      const misses = st.rng.poisson(st.box[team.id].shots * 0.38);
      for (let i = 0; i < misses; i++) {
        const s = roster[st.rng.weighted(roster.map((r) => Math.pow((r.offense * 0.7 + r.playmaking * 0.3) / 60, 2) * r.iceTime * (r.isDefense ? 0.35 : 1)))];
        emitAction("MISS", s, pickZone(st.rng, MISS_ZONES));
      }
    }
    // controlled offensive-zone entries — the possession model now emits these for
    // REAL, live, from the actual NEU->OFF transition in the tick loop's zone-entry
    // decision (see the "advance the puck toward the offensive zone" block above).
    // This statistical fallback only fires for the legacy "volume" engine model,
    // which has no tick loop / zone concept of its own to hook a live version into.
    if (CFG.engineModel !== "possession") {
      const entries = st.rng.poisson(LEAGUE.zoneEntriesPerTeam);
      for (let i = 0; i < entries; i++) {
        const s = roster[st.rng.weighted(roster.map((r) => ((r.attrs.sk ?? 50) * 0.6 + r.offense * 0.4) * r.iceTime * (r.isDefense ? 0.3 : 1)))];
        emitAction("ZONE_ENTRY", s, pickZone(st.rng, ENTRY_LANES), { entryType: pickZone(st.rng, ENTRY_TYPES) });
      }
    }
    // TOI from ice-time share — ONLY as a fallback for the volume model. The possession
    // engine already accrued real per-second TOI (= ES + PP + PK) in the tick loop, so
    // don't clobber it (that made TOI come in under a player's PK time).
    for (const s of team.forwards) { const pl = st.lines[team.id][s.id]; if (!pl.toi) pl.toi = Math.round(s.iceTime * LEAGUE.fwdIcePool); }
    for (const s of team.defense) { const pl = st.lines[team.id][s.id]; if (!pl.toi) pl.toi = Math.round(s.iceTime * LEAGUE.defIcePool); }
    st.box[team.id].goalie.toi = PERIOD_SECONDS * 3;
  }
}

// ---- main -------------------------------------------------------------------

export type SimOptions = { seed?: number; settings?: EngineSettings; noShootout?: boolean; rivalry?: boolean; league?: "NHL" | "AHL"; engineVersion?: string };

export function simulateGame(home: SimTeam, away: SimTeam, opts: SimOptions = {}): GameResult {
  CFG = opts.settings ?? DEFAULT_SETTINGS;
  AHL_GAME = opts.league === "AHL";
  const seed = opts.seed ?? fixtureSeed(home.id, away.id);
  const rng = new RNG(seed);

  const st: SimState = {
    rng, home, away,
    box: { [home.id]: initTeamBox(home), [away.id]: initTeamBox(away) },
    lines: { [home.id]: {}, [away.id]: {} },
    goals: [], penalties: [], injuries: [],
    momentum: {}, momoTime: {}, momoTau: {}, momoDip: {},
    playoff: !!opts.noShootout, // playoff series sim OT until a goal — amplifies clutch
    defChem: {}, currentOnIce: {}, carryPenalties: [], misconducts: [], shiftXg: {}, nightOff: {}, nightDef: {},
    rivalry: CFG.rivalryEnabled && !!opts.rivalry,
    pulled: {},
    emptyNet: {},
    onPp: {},
    injured: new Set(),
    shootout: [],
    sink: new EventSink(),
    isNextGen: (opts.engineVersion ?? ENGINE_VERSION) === ENGINE_V2,
  };
  for (const team of [home, away]) {
    for (const s of [...team.forwards, ...team.defense]) {
      st.lines[team.id][s.id] = newPlayerLine(s);
    }
    // leadership stretches a hot streak; experience steadies a team that concedes
    const ld = iceAvgAttr(team, (s) => s.attrs.ld ?? 50);
    const ex = iceAvgAttr(team, (s) => s.attrs.ex ?? 50);
    st.momentum[team.id] = 0;
    st.momoTime[team.id] = 0;
    st.momoTau[team.id] = CFG.momentumDecaySec * (0.75 + ld / 200);          // LD 50→1.0x, 90→1.2x
    st.momoDip[team.id] = CFG.momentumConcedeDip * (1 - (ex - 50) / 250) * team.coachLd; // EX 90→0.84x, 25→1.1x; coach LD softens further
    // defensive shield: a gelled, role-diverse D pair suppresses goals against
    const dc = team.defense.length
      ? team.defense.reduce((t, d) => t + chemFactor(d.chem, d.roleFit), 0) / team.defense.length : 1;
    st.defChem[team.id] = dc;
    // "any given night": one form draw per team per game. Correlated across every
    // shot in the game (unlike per-tick noise, which averages out), so a hot goalie
    // or a cold offence swings the whole result — that's where upsets come from.
    const vScale = CFG.gameVariancePct / 100;
    st.nightOff[team.id] = Math.max(0.76, Math.min(1.24, 1 + rng.gauss() * CFG.nightSigmaOff * vScale));
    // A tired starter (on a back-to-back, or worn-down CON) doesn't get a flat rating
    // cut — instead his night is more VOLATILE (wider swing): rebound control, reads
    // and positioning execution waver, so he's likelier to have an off night. That's
    // the GM's cue to rest him / start the backup. CON still feeds effGoalieQuality.
    const g = team.goalie;
    const tired = (g?.fatigued ? 1.5 : 1) * (g && (g.con ?? 100) < 95 ? 1.35 : 1);
    st.nightDef[team.id] = Math.max(0.66, Math.min(1.28, 1 - rng.gauss() * CFG.nightSigmaGoalie * vScale * tired)); // <1 = goalie stole it; tired = wider boom/bust
  }

  simulateFaceoffs(st);

  const homeShotsTotal = Math.max(12, Math.round(rng.poisson(expectedShots(home, away, true))));
  const awayShotsTotal = Math.max(12, Math.round(rng.poisson(expectedShots(away, home, false))));

  for (let period = 1; period <= 3; period++) {
    if (CFG.engineModel === "possession") {
      // the main fight/line-brawl path now lives INSIDE simulatePeriodPossession's
      // tick loop (maybeStartFight, hooked to real stoppages) — genuinely live, not
      // a per-period post-hoc roll, so a fight-injury benches the player for the
      // REST of the same period too, not just the ones still to come.
      simulatePeriodPossession(st, period);
      // scrums/donnybrooks/abuse-of-official stay a per-period post-hoc roll (rare
      // enough that the same-period residual this leaves is a non-issue) — but
      // donnybrook Fighting majors resolve their own injury inline now too (see
      // generateHeatEvents), so no separate generateFightInjuries pass is needed
      // for the possession model any more.
      generateHeatEvents(st, period);
      continue;
    }
    let hShare = period === 3 ? 0.34 : 0.33;
    let hp = Math.round(homeShotsTotal * hShare);
    let ap = Math.round(awayShotsTotal * hShare);

    // Score effects in the 3rd: the trailing team presses, the leader sits back.
    if (period === 3) {
      const margin = st.box[home.id].goals - st.box[away.id].goals;
      if (margin !== 0) {
        const trailingIsHome = margin < 0;
        const boost = Math.min(0.4, 0.17 + 0.06 * Math.abs(margin));
        if (trailingIsHome) { hp = Math.round(hp * (1 + boost)); ap = Math.round(ap * (1 - boost * 0.5)); }
        else { ap = Math.round(ap * (1 + boost)); hp = Math.round(hp * (1 - boost * 0.5)); }
      }
    }
    simulatePeriod(st, period, hp, ap);
  }

  simulateEndgame(st);
  // legacy "volume" model only — the possession model already generated these
  // per-period, live, inside the loop above (including their injuries).
  if (CFG.engineModel !== "possession") {
    for (let p = 1; p <= 3; p++) { generateFights(st, p); generateHeatEvents(st, p); generateFightInjuries(st, p); }
  }

  let winnerId: number;
  let endedIn: GameResult["endedIn"] = "REG";
  let periods = 3;
  let otPeriods = 0; // full sudden-death OT periods (playoff marathons)
  const hG = st.box[home.id].goals, aG = st.box[away.id].goals;

  if (hG === aG) {
    if (opts.noShootout) {
      // playoff sudden death: keep playing OT periods until someone scores
      let w: number | null = null, guard = 0;
      while (w == null && guard++ < 12) { w = simulateOvertime(st).winner; otPeriods++; }
      winnerId = w ?? home.id; endedIn = "OT"; periods = 4;
    } else {
      const ot = simulateOvertime(st);
      if (ot.winner != null) { winnerId = ot.winner; endedIn = "OT"; periods = 4; }
      else { winnerId = simulateShootout(st); endedIn = "SO"; periods = 5; }
    }
  } else {
    winnerId = hG > aG ? home.id : away.id;
  }
  const loserId = winnerId === home.id ? away.id : home.id;

  distributeCounting(st);
  finalizeBoxes(st, winnerId, endedIn, otPeriods);

  st.goals.sort((a, b) => a.period - b.period || a.seconds - b.seconds);
  st.penalties.sort((a, b) => a.period - b.period || a.seconds - b.seconds);

  st.injuries.sort((a, b) => a.period - b.period || a.seconds - b.seconds);
  const result: GameResult = {
    home: st.box[home.id], away: st.box[away.id],
    winner: winnerId, loser: loserId, endedIn, periods, otPeriods,
    goals: st.goals, penalties: st.penalties, injuries: st.injuries, playByPlay: [], shootout: st.shootout, seed,
    engineVersion: opts.engineVersion ?? ENGINE_VERSION,
    events: st.sink.notable(),
    homeSystem: home.teamTactics,
    awaySystem: away.teamTactics,
  };
  if (CFG.playByPlayEnabled) result.playByPlay = generatePlayByPlay(result, home, away, st.sink.all(), result.engineVersion === ENGINE_V2);
  return result;
}

function finalizeBoxes(st: SimState, winnerId: number, endedIn: GameResult["endedIn"], otPeriods: number) {
  // game-winning goal: the goal that put the winner ahead to stay.
  const winnerGoals = st.goals.filter((g) => g.team === winnerId && g.strength !== "SO");
  const loserFinal = st.box[winnerId === st.home.id ? st.away.id : st.home.id].goals;
  const gwgIndex = loserFinal; // the (loserFinal+1)-th winner goal is the GWG
  const gwg = winnerGoals[gwgIndex];
  if (gwg) st.lines[winnerId][gwg.scorer].gwg = 1;

  for (const teamId of [st.home.id, st.away.id]) {
    const team = teamId === st.home.id ? st.home : st.away;
    const box = st.box[teamId];
    box.skaters = Object.values(st.lines[teamId])
      .sort((a, b) => b.points - a.points || b.goals - a.goals);
    // post-game skater conditioning: heavy TOI (or a playoff OT marathon) drops CON,
    // plus an extra hit for penalty-kill duty (more for a player on both PK units).
    const defIds = new Set(team.defense.map((d) => d.id));
    const pkCount = new Map<number, number>();
    for (const u of resolveStUnits(team).pk) for (const s of [...(u.f ?? []), ...(u.d ?? [])]) pkCount.set(s.id, (pkCount.get(s.id) ?? 0) + 1);
    for (const sk of box.skaters) {
      sk.conAfter = skaterConAfter(sk.conBefore, sk.toi, defIds.has(sk.id), otPeriods, pkCount.get(sk.id) ?? 0);
    }
    const g = box.goalie;
    g.savePct = g.shotsAgainst ? g.saves / g.shotsAgainst : 0;
    g.conAfter = Math.max(1, g.conBefore - conDrop(g.shotsAgainst, team.goalie.du));
    // if the starter was pulled, the backup carries the rest of the game and takes
    // the decision (goalie of record); otherwise the starter owns the result.
    const bu = box.backupGoalie;
    const decision: GoalieLine["decision"] = teamId === winnerId ? "W" : endedIn === "REG" ? "L" : "OTL";
    if (st.pulled[teamId] && bu) {
      bu.savePct = bu.shotsAgainst ? bu.saves / bu.shotsAgainst : 0;
      bu.conAfter = Math.max(1, bu.conBefore - conDrop(bu.shotsAgainst, (team.backup ?? team.goalie).du));
      bu.decision = decision;
      g.decision = null; // pulled — no decision
    } else {
      g.decision = decision;
    }
  }
}

export { fmt as formatGameTime };
