// STHS-style game simulation engine (v2 — chronological / event-based).
// Produces a full box score with timestamped goals & penalties, per-period
// shots/goals, power plays tied to real penalty times, and rich per-player
// stats (hits, blocks, faceoffs, TOI). Tuned to NHL-realistic output.

import { RNG, fixtureSeed } from "./rng";
import { generatePlayByPlay } from "./playbyplay";
import { DEFAULT_SETTINGS, type EngineSettings } from "./settings";
import { EventSink, type SimEvent } from "./events";
import { shotProfile, expectedGoal, isHighDanger, shotSpeed, sectorIndex, type ShotStrength } from "./shot-quality";
import type {
  SimTeam, SimSkater, SimGoalie, GameResult, TeamBox, PlayerLine, GoalieLine,
  GoalEvent, PenaltyEvent, InjuryEvent, ShootoutAttempt, LineTactic,
  InjuryMechanism, InjurySeverity,
} from "./types";

// Engine version stamped on every simulated Game (for reproducibility, history and
// calibration). The current (stable v1) engine is "1.0.0"; the next-gen rework will
// ship as "2.x" behind the LeagueConfig.simEngine flag. See lib/sim/version.ts.
export const ENGINE_VERSION = "1.0.0";

const BODY_PARTS = ["Upper Body", "Lower Body", "Knee", "Shoulder", "Ankle", "Hand", "Groin", "Concussion"];
const INJURY_BASE = 0.22; // expected injuries per team per game at 100% (~1 in 5 games) — keeps the farm call-up pipeline busy

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

// League baselines the model is calibrated against (population means of THIS
// dataset's ratings, so an avg-vs-avg matchup centers every factor at 1.0).
const LEAGUE = {
  avgOffense: 55,
  avgDefense: 69.5,
  avgGoalie: 84,
  baseShots: 28.5,
  baseConversion: 0.083,
  homeShotBonus: 1.05,
  homeConvBonus: 1.05,
  penaltiesPerTeam: 3.2,   // penalties a team of avg discipline takes per game
  ppConvBoost: 2.9,        // conversion multiplier on the power play
  shConvPenalty: 0.45,     // conversion multiplier while shorthanded
  hitsPerTeam: 21,
  blocksPerTeam: 14,
  faceoffsPerGame: 46,
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
const D_ASSIST = 0.6;

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
  shiftXg: Record<number, number>;  // on-ice net xG accrued in a player's CURRENT shift (Shift Quality)
  nightOff: Record<number, number>; // per-game offensive "form" (goals-for mult, mean 1)
  nightDef: Record<number, number>; // per-game goalie "form" facing this team (goals-against mult on opp shots, mean 1)
  rivalry: boolean;                 // heated rivalry game — more fights, scrums, misconducts
  pulled: Record<number, boolean>;  // has this team's starter been yanked for the backup
  shootout: ShootoutAttempt[];      // shootout attempts (empty unless the game went to a shootout)
  sink: EventSink;                  // next-gen typed event stream (v2)
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
function maybePullGoalie(st: SimState, teamId: number) {
  if (!CFG.pullGoalieEnabled || st.pulled[teamId]) return;
  const box = st.box[teamId];
  if (!box.backupGoalie) return;
  const s = box.goalie;
  if (s.goalsAgainst >= CFG.pullGoalieMinGoals && s.shotsAgainst >= CFG.pullGoalieMinShots
      && s.saves / Math.max(1, s.shotsAgainst) < CFG.pullGoalieSvPct) {
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
    faceoffWins: 0, faceoffLosses: 0, toi: 0,
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
function skaterConAfter(conBefore: number, toiSec: number, isDefense: boolean, otPeriods: number): number {
  const mins = toiSec / 60;
  const threshold = isDefense ? CFG.skaterDefConMinutes : CFG.skaterFwdConMinutes;
  const overworked = otPeriods > 0 || mins >= threshold;
  const drop = (overworked ? CFG.skaterConDrop : 0) + otPeriods * CFG.skaterOtDrop;
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
  // goalie spread (^1.9): an elite goalie tops out near ~92.5% SV over a season
  // (real-world ceiling) rather than running away to 94%, and a weak one is clearly
  // beatable, while the league average holds. (Was 2.2 → elite keepers too good.)
  const goalieMod = Math.pow(LEAGUE.avgGoalie / goalieQuality, 1.9);
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

function pickAssists(rng: RNG, team: SimTeam, scorerId: number): number[] {
  const roll = rng.next();
  // ~1.6 assists per goal (NHL-realistic): mostly 2, occasionally unassisted
  const n = roll < 0.08 ? 0 : roll < 0.30 ? 1 : 2;
  if (n === 0) return [];
  const pool = [...team.forwards, ...team.defense].filter((s) => s.id !== scorerId);
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
  const scorer = explicitScorer ?? pickShooter(st.rng, off);
  const assists = strength === "SO" ? [] : pickAssists(st.rng, off, scorer.id);
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

  if (strength === "EV") {
    for (const s of pickOnIce(st.rng, off)) st.lines[off.id][s.id].plusMinus += 1;
    for (const s of pickOnIce(st.rng, def)) st.lines[def.id][s.id].plusMinus -= 1;
  }

  st.goals.push({
    period, seconds, time: fmt(seconds),
    team: off.id, teamCode: off.code,
    scorer: scorer.id, scorerName: scorer.name, scorerSeasonGoal: sl.goals,
    assists, assistNames, strength, emptyNet,
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
  const pool = [...team.forwards, ...team.defense];
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
function generateFights(st: SimState) {
  const topFG = (t: SimTeam) => Math.max(...[...t.forwards, ...t.defense].map((s) => s.attrs.fg ?? 30));
  const enforcerPick = (t: SimTeam) => {
    const pool = [...t.forwards, ...t.defense];
    return pool[st.rng.weighted(pool.map((s) => Math.pow(Math.max(1, (s.attrs.fg ?? 30) - 40), 2)))];
  };
  if (!CFG.fightsEnabled) return;
  const fgHome = topFG(st.home), fgAway = topFG(st.away);
  // base fight chance scales with the lower of the two teams' willingness; a
  // rivalry game runs hot (far more likely to drop the gloves).
  let p = (0.06 + 0.5 * Math.max(0, Math.min(fgHome, fgAway) - 55) / 45) * (CFG.fightsPct / 100);
  if (st.rivalry) p *= CFG.rivalryFightMult;
  if (!st.rng.chance(Math.min(0.85, p))) return;

  const period = 1 + st.rng.int(3);
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

/**
 * Extra emotional penalties (run once the score is final):
 *  - a net-front scrum in a heated rivalry game → several roughing minors at once
 *    for both teams, sometimes a 10-minute misconduct in the pileup;
 *  - "abuse of official" — a frustrated player on a struggling team blows up and
 *    draws a 10-minute misconduct (likelier the more his team is losing by).
 */
function generateHeatEvents(st: SimState) {
  if (!CFG.penaltiesEnabled) return;
  const scrummer = (t: SimTeam) => { const pool = [...t.forwards, ...t.defense]; return pool[st.rng.weighted(pool.map((s) => (s.attrs.fg ?? 30) + (105 - s.discipline)))]; };

  if (st.rivalry && st.rng.chance(CFG.scrumChance)) {
    const period = 1 + st.rng.int(3);
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
  if (st.rivalry && st.rng.chance(CFG.brawlChance)) {
    const period = 1 + st.rng.int(3);
    const at = 120 + st.rng.int(PERIOD_SECONDS - 240);
    const bouts = 3 + st.rng.int(2); // 3–4 fighting majors per side
    for (let k = 0; k < bouts; k++) {
      addPenalty(st, st.home, scrummer(st.home), period, at, "Fighting", 5, "Major", false);
      addPenalty(st, st.away, scrummer(st.away), period, at, "Fighting", 5, "Major", false);
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

  for (const team of [st.home, st.away]) {
    const opp = team === st.home ? st.away : st.home;
    const trailBy = st.box[opp.id].goals - st.box[team.id].goals;
    const frustration = trailBy >= 3 ? 2.5 : trailBy >= 2 ? 1.5 : 1;
    if (st.rng.chance(CFG.abuseOfficialChance * frustration)) {
      const pool = [...team.forwards, ...team.defense];
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
};
function buildShifts(team: SimTeam): ShiftState {
  const byId = new Map([...team.forwards, ...team.defense].map((s) => [s.id, s]));
  const res = (isDef: boolean, size: number, fallback: SimSkater[]) => {
    const u = team.units.filter((x) => x.isDef === isDef)
      .map((x) => x.members.map((id) => byId.get(id)).filter((s): s is SimSkater => !!s))
      .filter((l) => l.length >= size - 1);
    return u.length ? u : chunk([...fallback].sort((a, b) => b.iceTime - a.iceTime), size);
  };
  return {
    fLines: res(false, 3, team.forwards), dPairs: res(true, 2, team.defense),
    fIdx: 0, dIdx: 0, fElapsed: 0, dElapsed: 0,
  };
}
// Effective-attribute multiplier from a long shift; EN slows the drain. 1 = fresh.
function fatigueMult(shiftSec: number, en: number): number {
  if (CFG.inGameFatiguePct <= 0) return 1;
  const over = Math.max(0, shiftSec - 40);           // legs stay fresh ~40s
  const drop = Math.min(0.28, over / 65 * 0.28) * (1.3 - (en ?? 50) / 100) * (CFG.inGameFatiguePct / 100);
  return Math.max(0.55, 1 - drop);
}
// Advance a team's shift timers by `dur`; rotate a unit off when its shift is up
// (new unit weighted toward the top of the depth chart). Accrues TOI on the ice.
function advanceShift(st: SimState, teamId: number, sh: ShiftState, dur: number, rng: RNG) {
  sh.fElapsed += dur; sh.dElapsed += dur;
  for (const s of sh.fLines[sh.fIdx] ?? []) st.lines[teamId][s.id].toi += dur;
  for (const s of sh.dPairs[sh.dIdx] ?? []) st.lines[teamId][s.id].toi += dur;
  const pick = (lines: SimSkater[][], cur: number) => {
    if (lines.length <= 1) return 0;
    const w = lines.map((_, i) => (i === cur ? 0 : [0.34, 0.28, 0.22, 0.16][i] ?? 0.1));
    return rng.weighted(w);
  };
  if (sh.fElapsed >= 38 + rng.int(18)) { flushShift(st, teamId, sh.fLines[sh.fIdx] ?? []); sh.fIdx = pick(sh.fLines, sh.fIdx); sh.fElapsed = 0; }
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

  const onIceF = (team: SimTeam) => { const sh = shifts[team.id]; return sh.fLines[sh.fIdx] ?? team.forwards; };
  const onIceD = (team: SimTeam) => { const sh = shifts[team.id]; return sh.dPairs[sh.dIdx] ?? team.defense; };
  // team-system tactics multiply into the fatigue drain (fast tempo / aggressive
  // forecheck tire a team faster).
  const fat = (team: SimTeam, s: SimSkater) => fatigueMult(shifts[team.id].fElapsed * team.tactics.fatigue, s.attrs.en ?? 50);
  const dfat = (team: SimTeam, s: SimSkater) => fatigueMult(shifts[team.id].dElapsed * team.tactics.fatigue, s.attrs.en ?? 50);

  const killedPens = new Set<Penalty>(); // penalties that expired without a PP goal → PK momentum

  for (let tick = 0; tick < PERIOD_SECONDS; tick++) {
    advanceShift(st, home.id, shifts[home.id], 1, rng);
    advanceShift(st, away.id, shifts[away.id], 1, rng);
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
      // centers of the on-ice units contest the draw (FO vs FO)
      const hC = onIceF(home).find((s) => s.isCenter) ?? onIceF(home)[0] ?? home.forwards[0] ?? home.defense[0];
      const aC = onIceF(away).find((s) => s.isCenter) ?? onIceF(away)[0] ?? away.forwards[0] ?? away.defense[0];
      const homeWin = rng.chance(ratio((hC.attrs.fo ?? 50) * fat(home, hC), (aC.attrs.fo ?? 50) * fat(away, aC), 0.8));
      if (homeWin) { st.box[home.id].faceoffWins++; st.box[away.id].faceoffLosses++; st.lines[home.id][hC.id].faceoffWins++; st.lines[away.id][aC.id].faceoffLosses++; carrierTeam = home; carrier = hC; }
      else { st.box[away.id].faceoffWins++; st.box[home.id].faceoffLosses++; st.lines[away.id][aC.id].faceoffWins++; st.lines[home.id][hC.id].faceoffLosses++; carrierTeam = away; carrier = aC; }
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
        if (rng.chance(ratio(atkSkill(carrier.attrs.sk ?? 50), defSkill(gap)))) { zone = zone === "DEF" ? "NEU" : "OFF"; setup = "carry"; }
        else if (rng.chance(0.4)) { carrierTeam = def; carrier = pickByAttr(rng, onIceF(def), (s) => s.attrs.pa ?? 50) ?? dman; zone = "DEF"; setup = "carry"; press = 0; } // stuffed → turnover
      }
      continue;
    }

    // 3) in the O-zone: an offensive action fires some ticks (shoot vs pass: SC vs PA).
    // team-system tempo/style scales HOW OFTEN the carrier generates a chance, and the
    // defender's posture scales how many it allows.
    if (!rng.chance(0.29 * atkFx.shotRate * def.tactics.oppShotRate)) continue;
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
      const p = pConv * danger * pressBonus * pointFinish
        * momoBoost(st, carrierTeam.id, absT) * clutchFactor(st, carrier, period, tick, margin)
        * teamEdge * catchUp * ppMod
        * (st.nightOff[carrierTeam.id] ?? 1) * (st.nightDef[def.id] ?? 1); // any-given-night form
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
        recordGoal(st, carrierTeam, def, period, tick, strength, false, carrier, { sector, shotType, xg });
        momoOnGoal(st, carrierTeam.id, def.id, absT);
        maybePullGoalie(st, def.id); // yank the starter if he's been shelled
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
      if (rng.chance(Math.max(0.05, 0.32 - rb / 300))) { carrier = pickByAttr(rng, onIceF(carrierTeam), (s) => involvement(s.attrs.sc ?? 50) * 60) ?? carrier; setup = "rebound"; } // rebound in the slot (press stays → escalating danger)
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

// Roll a duration. Calibrated to real NHL: MOST injuries are day-to-day (miss a
// game or two), a chunk are week-to-week, few are multi-week, and season-enders
// are rare. Avg ~11 days (~7 games missed at our schedule density).
function injuryDays(st: SimState, mech: InjuryMechanism, part: string): number {
  const roll = st.rng.next();
  let days = roll < 0.66 ? 1 + st.rng.int(6)          // day-to-day (1-6)
    : roll < 0.92 ? 7 + st.rng.int(13)                 // week-to-week (7-19)
    : roll < 0.985 ? 20 + st.rng.int(24)               // multi-week (20-43)
    : 50 + st.rng.int(85);                             // long / season-ending (50-134)
  if (part === "Concussion") days = Math.max(days, 8 + st.rng.int(24));
  return days;
}

// A physical checker on the opponent — the guy who threw the hit that hurt someone.
function pickHitter(st: SimState, team: SimTeam): SimSkater {
  const pool = [...team.forwards, ...team.defense];
  return pool[st.rng.weighted(pool.map((s) => s.hitting * s.iceTime * physFactor(s.weight)))] ?? pool[0];
}

function addInjury(st: SimState, team: SimTeam, victim: SimSkater, mech: InjuryMechanism, by?: SimSkater) {
  // a player already hurt this game is out — he can't pick up a second injury
  if (st.injuries.some((i) => i.playerId === victim.id)) return;
  const part = INJ_PARTS[mech][st.rng.int(INJ_PARTS[mech].length)];
  const days = injuryDays(st, mech, part);
  const period = 1 + st.rng.int(3);
  const seconds = st.rng.int(PERIOD_SECONDS);
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
// chippy opponent that out-hits you injures more of your players (STHS's
// light-vs-heavy hit calc); blocking hard shots hurts your D; the rest is
// overuse (fatigue/durability). Total rate stays ~INJURY_BASE at a neutral,
// average-physicality matchup so the season-long injury load is unchanged.
function generateInjuries(st: SimState) {
  if (!CFG.injuriesEnabled) return;
  // The neutral-matchup lambdas below (hit 0.26 + block 0.09 + non-contact 0.20)
  // sum to ~0.55/team/game — 2.5× the documented target. Rescale them back to
  // INJURY_BASE so 100% injuryChancePct means ~1 injury per 5 games per team.
  const cal = INJURY_BASE / 0.55;
  const scale = (CFG.injuryChancePct / 100) * cal;
  for (const team of [st.home, st.away]) {
    const opp = team === st.home ? st.away : st.home;
    const fwd = team.forwards, def = team.defense, pool = [...fwd, ...def];
    if (!pool.length) continue;

    // fragility weight: exposure (ice time) × low durability × rusty return × lighter
    // frame (a light player absorbs a big hit worse).
    const fragility = (s: SimSkater, hitTarget = false) => {
      const rust = s.con < 96 ? 1 + (96 - s.con) * (0.9 - s.attrs.du / 200) : 1;
      const light = hitTarget ? Math.max(0.7, (100 - Math.max(0, s.weight - 82)) / 100 + 0.15) : 1;
      return s.iceTime * (115 - s.attrs.du) * rust * light;
    };

    // 1) HIT injuries — scaled by the opponent's physical pressure (their hits ×
    //    how heavy/chippy they are). Contact injuries land on forwards more.
    const oppHits = st.box[opp.id].hits;
    const physPressure = (opp.profile.ck / 66) * (opp.profile.weight / 92);
    const hitLambda = 0.26 * scale * (oppHits / 21) * physPressure;
    for (let i = 0; i < st.rng.poisson(hitLambda); i++) {
      const cPool = fwd.length ? [...fwd, ...fwd, ...def] : pool; // forwards ~2x exposed
      const victim = cPool[st.rng.weighted(cPool.map((s) => fragility(s, true)))];
      addInjury(st, team, victim, st.rng.chance(0.15) ? "Collision" : "Hit", pickHitter(st, opp));
    }

    // 2) BLOCKED-SHOT injuries — blocking hard shots hurts hands/feet; D block most.
    const blockLambda = 0.09 * scale * (st.box[team.id].blocks / 14);
    for (let i = 0; i < st.rng.poisson(blockLambda); i++) {
      const bPool = def.length ? [...def, ...def, ...fwd] : pool;
      const victim = bPool[st.rng.weighted(bPool.map((s) => s.iceTime * (115 - s.attrs.du)))];
      addInjury(st, team, victim, "Blocked shot");
    }

    // 3) NON-CONTACT — a lower/upper-body knock, reported vaguely like the real NHL.
    //    It's labelled "Fatigue" ONLY when the victim is genuinely worn down (CON < 95
    //    from heavy minutes / double-shifts / a back-to-back); otherwise it's just a
    //    generic Lower/Upper Body injury. Victim weighted toward the most-played and
    //    most tired skaters either way.
    const nonContactLambda = 0.20 * scale;
    for (let i = 0; i < st.rng.poisson(nonContactLambda); i++) {
      // spread across the roster by exposure (ice time) + fragility (low DU); NOT
      // over-weighted to the tired, so a non-contact knock can hit anyone. Whoever
      // is bottomed out at the CON floor gets the "Fatigue" label below; the rest
      // are generic body injuries.
      const victim = pool[st.rng.weighted(pool.map((s) => s.iceTime * (115 - s.attrs.du)))];
      // "Fatigue" only when the victim actually logged heavy minutes THIS game
      // (≥25 min — a genuinely overplayed workhorse night); everyone else is a
      // generic Lower/Upper Body knock, reported vaguely like the real NHL. Tied to
      // real ice time (matches "played too many minutes"), not the flaky CON value.
      const victimToi = st.lines[team.id][victim.id]?.toi ?? 0;
      addInjury(st, team, victim, victimToi >= 1200 ? "Fatigue" : "Non-contact");
    }

    // 4) FIGHT injuries — a combatant (rare) tweaks a hand.
    const fighters = st.penalties.filter((p) => p.team === team.id && p.type === "Fighting");
    for (const f of fighters) {
      if (st.rng.chance(0.06 * scale)) {
        const victim = pool.find((s) => s.id === f.playerId) ?? pool[0];
        addInjury(st, team, victim, "Fight");
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
  for (let t = step; t <= OT_SECONDS; t += step) {
    for (const [att, def, isHome] of [[home, away, true], [away, home, false]] as const) {
      // 3-on-3 is wide open: elevated chance rate scaled by offense
      const rate = 0.055 * (att.offenseRating / LEAGUE.avgOffense);
      if (!rng.chance(rate)) continue;
      const shooter = pickShooter(rng, att);
      const gLine = liveGoalieLine(st, def.id);
      st.box[att.id].shots++;
      st.box[att.id].shotsByPeriod[3]++;
      st.lines[att.id][shooter.id].shots++;
      gLine.shotsAgainst++;
      const p = conversion(shooter.offense, effGoalieQuality(liveGoalie(st, def)), isHome, "EV") * 2.2;
      if (rng.chance(p)) {
        gLine.goalsAgainst++;
        recordGoal(st, att, def, 4, t, "EV");
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
    const picked = t.shootoutOrder.map((id) => byId.get(id)).filter((s): s is SimSkater => !!s);
    const rest = [...t.forwards].filter((s) => !picked.includes(s)).sort((a, b) => (b.attrs.ps + b.offense) - (a.attrs.ps + a.offense));
    return [...picked, ...rest].slice(0, 12);
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
const pickZone = (rng: RNG, table: [string, number][]) => table[rng.weighted(table.map((z) => z[1]))][0];

function distributeCounting(st: SimState) {
  for (const team of [st.home, st.away]) {
    const roster = [...team.forwards, ...team.defense];
    // emit a located defensive-action event (for the player heat maps). Counts stay
    // exactly as calibrated below — only a modeled rink zone + time are attached.
    const emitAction = (type: "HIT" | "BLOCK" | "TAKEAWAY", s: SimSkater, sector: string) => {
      st.sink.emit({
        period: 1 + st.rng.int(3), seconds: st.rng.int(PERIOD_SECONDS), type,
        teamId: team.id, teamCode: team.code ?? undefined, playerId: s.id, playerName: s.name,
        zone: "OFF", sector, importance: "NOTABLE",
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
    const hits = st.rng.poisson(LEAGUE.hitsPerTeam * (CFG.hitsPct / 100) * hitFactor);
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
    // TOI from ice-time share
    for (const s of team.forwards) st.lines[team.id][s.id].toi = Math.round(s.iceTime * LEAGUE.fwdIcePool);
    for (const s of team.defense) st.lines[team.id][s.id].toi = Math.round(s.iceTime * LEAGUE.defIcePool);
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
    defChem: {}, shiftXg: {}, nightOff: {}, nightDef: {},
    rivalry: CFG.rivalryEnabled && !!opts.rivalry,
    pulled: {},
    shootout: [],
    sink: new EventSink(),
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
    st.momoDip[team.id] = CFG.momentumConcedeDip * (1 - (ex - 50) / 250);    // EX 90→0.84x, 25→1.1x
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
    if (CFG.engineModel === "possession") { simulatePeriodPossession(st, period); continue; }
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
  generateFights(st);
  generateHeatEvents(st);

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
  generateInjuries(st); // after hits/blocks are tallied — physical play drives injuries (Phase 4)
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
  if (CFG.playByPlayEnabled) result.playByPlay = generatePlayByPlay(result, home, away, st.sink.all());
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
    // post-game skater conditioning: heavy TOI (or a playoff OT marathon) drops CON
    const defIds = new Set(team.defense.map((d) => d.id));
    for (const sk of box.skaters) {
      sk.conAfter = skaterConAfter(sk.conBefore, sk.toi, defIds.has(sk.id), otPeriods);
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
