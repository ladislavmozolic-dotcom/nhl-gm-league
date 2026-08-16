// Tunable simulation-engine settings — the STHS-style "Game Options" plus our
// CON/fatigue and points knobs. Stored as one JSON row (SimSettings id=1) and
// editable from the Admin > Simulation page. The engine reads these; when none
// are stored, DEFAULT_SETTINGS reproduces the calibrated baseline.

import { prisma } from "../prisma";

export type EngineSettings = {
  // Which simulation model to run:
  //   "volume"     — the calibrated shot-volume model (default, proven)
  //   "possession" — the STHS-style sequential possession decision-tree (newer)
  engineModel: "volume" | "possession";
  // Possession model: in-game fatigue — a long shift drains a player's effective
  // attributes (EN slows the drain). 0 disables it. Only used by the possession engine.
  inGameFatiguePct: number;
  // How strongly team quality drives puck control (0..1). Low = coin-flip games
  // (many upsets, random standings); high = the better team dominates and the
  // stronger clubs reliably climb the standings over a season.
  possessionSkillPct: number;
  // How much the DEFENCE in front of the goalie (on-ice defenders' DF) suppresses shot
  // quality, on top of the goalie. 0 = goalie carries GA alone (old behaviour); higher =
  // a strong blue line lowers goals-against even with an average keeper, and a weak one
  // exposes an elite one. Calibration-neutral (centred on the league-average defender).
  defenseTalentPct: number;
  catchUpStrength: number; // per-goal score-effect that pulls trailing teams back (curbs blowouts)
  // Game Options — percentage multipliers (100 = calibrated default)
  goalsPct: number;
  shotsPct: number;
  penaltiesPct: number;
  hitsPct: number;
  fightsPct: number;
  powerPlayPct: number;
  homeAdvPct: number;
  homeLastChangePct: number;   // home last-change: how much the home side's matchups suppress opponent chance danger
  // Pull a shelled starter mid-game and bring in the backup
  pullGoalieEnabled: boolean;
  pullGoalieMinGoals: number; // starter must have conceded at least this many
  pullGoalieMinShots: number; // ...and faced at least this many shots
  pullGoalieSvPct: number;    // ...with a save % under this (0..1)
  // Rivalry games — heated matchups between declared rivals
  rivalryEnabled: boolean;
  rivalryFightMult: number;    // fight-rate multiplier in a rivalry game
  rivalryPenaltyMult: number;  // penalty-rate multiplier in a rivalry game
  scrumChance: number;         // chance of a net-front scrum (several roughing minors at once) per rivalry game
  brawlChance: number;         // chance of a full line brawl / donnybrook (100+ PIM night) per rivalry game
  abuseOfficialChance: number; // chance a frustrated player draws a 10-min misconduct (abuse of official)
  coachFinePimThreshold: number; // team PIM in a game above which the coach is fined
  coachFineAmount: number;     // bank fine deducted when the threshold is exceeded
  // Feature toggles
  fightsEnabled: boolean;
  penaltiesEnabled: boolean;
  playByPlayEnabled: boolean;
  injuriesEnabled: boolean;
  injuryChancePct: number;   // scales the base injury rate
  // Star separation (higher = more concentrated scoring)
  starExponent: number;
  // Points system
  winPts: number;
  otWinPts: number;
  otLossPts: number;
  lossPts: number;
  // Playoffs
  playoffFormat: "conference" | "division"; // top-8-by-points vs NHL division+wildcards
  playoffTeamsPerConf: number;
  playoffBestOf: number;
  // Finance
  salaryCapUpper: number;
  salaryCapLower: number;
  buyoutPctSeason: number;    // % of salary as buyout dead-money (in-season)
  buyoutPctOffseason: number; // ... in the off-season
  retentionMaxPct: number;    // max salary a team can retain in a trade
  retentionMinSalary: number; // new team must carry at least this
  retentionMaxPlayers: number;// max retained players per team
  rosterOverFinePerDay: number; // fine per excess player per day
  rewardPlayoff: number;      // to bank on making the playoffs
  rewardCup: number;          // Stanley Cup winner bonus
  rewardAhlCup: number;       // Calder Cup winner
  rewardAhlFinalist: number;  // Calder Cup finalist
  // Goalie CON / fatigue
  duHighThreshold: number;   // DU at/above which the workhorse table applies
  conRecovery: number;       // CON regained per rest day
  conRecoveryHighDu: number; // ... if DU >= duHighThreshold
  conSlope: number;          // save quality lost per CON point below 100
  b2bFatigue: number;        // save quality multiplier on a back-to-back
  // "Any given night" variance — one form draw per team per game (survives the
  // law of large numbers, unlike per-tick noise) so favourites don't run away.
  gameVariancePct: number;   // 0 = deterministic, 100 = default spread, 200 = wild
  nightSigmaGoalie: number;  // base sd of a goalie's hot/cold night (goals-against mult)
  nightSigmaOff: number;     // base sd of a team's offensive night (goals-for mult)
  // Parity — how far a talent gap runs away. 0 = raw talent (blowouts, long streaks),
  // 100 = NHL-like (best beats worst ~72%, not 96%). Compresses shot volume + the
  // goalie/defence/coaching conversion edge toward the mean; leaves shooter finishing
  // alone so the scoring race keeps its spread.
  parityPct: number;
  // Shot-load -> CON drop thresholds (<=t1 => -1, <=t2 => -2, else -3)
  conShotsLow1: number;      // normal goalie (DU < duHighThreshold)
  conShotsLow2: number;
  conShotsHigh1: number;     // workhorse (DU >= duHighThreshold)
  conShotsHigh2: number;
  // Skater CON / fatigue (post-game conditioning, 1..100)
  skaterFwdConMinutes: number; // forward TOI (min) at/above which post-game CON drops
  skaterDefConMinutes: number; // defenseman TOI (min) at/above which post-game CON drops
  skaterConDrop: number;       // CON lost when a skater is overworked in a game
  skaterOtDrop: number;        // extra CON lost per full (playoff) OT period played
  skaterConRecovery: number;   // CON regained per rest day
  skaterConSlope: number;      // rating lost per CON point below 100 (0 = tracked only, no gameplay effect)
  // Momentum (goals come in bunches — a scoring team rides a short hot streak)
  momentumEnabled: boolean;
  momentumBoostPct: number;    // conversion boost at 1.0 momentum (a fresh goal)
  momentumGoalSpike: number;   // momentum the scoring team gains on a goal
  momentumConcedeDip: number;  // momentum the conceding team loses on a goal
  momentumDecaySec: number;    // exponential decay time-constant (higher = longer swings)
  momentumMax: number;         // clamp on |momentum|
  momentumPkKill: number;      // momentum gained for killing off a penalty
  momentumFlurry: number;      // momentum gained for a sustained shot flurry
  // Clutch (high EX/LD players rise in tight late-game / OT / playoff moments)
  clutchEnabled: boolean;
  clutchBoostPct: number;      // conversion swing for a max-clutch player in the clutch
  clutchWindowSec: number;     // seconds left in the 3rd that count as "clutch" (with <=1 goal margin)
  clutchPlayoffMult: number;   // clutch effect multiplier in playoff games
  // Morale (persistent player mood: wins, ice-time, production) — STHS "MO"
  moraleEnabled: boolean;
  moraleBase: number;          // reset value at season start (league default 50)
  moraleWin: number;           // morale change on a win / loss (±)
  moraleNeutral: number;       // morale at which there's no gameplay effect (league default 50)
  moraleSlope: number;         // skater rating changed per morale point from neutral (0 = tracked only)
  moraleGoalieSlope: number;   // goalie effective-quality change per morale point (soft goals when low, steals when high)
  moraleFrustrationPct: number;// extra penalty likelihood per morale point below neutral
  moraleDroughtGames: number;  // a forward this many games without a goal starts losing morale
  moraleDroughtDrop: number;   // morale lost per game once in a scoring drought
  moraleRoleDrop: number;      // morale lost when a high-overall player is buried in low ice-time (misused elite)
  // Line chemistry
  chemistryEnabled: boolean;   // apply chemistry effects in the sim
  chemistryBase: number;       // starting chemistry of a brand-new line (0..100)
  chemistryGrowth: number;     // chemistry gained per game a unit stays intact
  chemistryDrop: number;       // chemistry lost the game a unit is broken (injury/call-up)
  chemistryNeutral: number;    // chemistry at/above which a unit is fully gelled (no penalty)
  chemistryPenaltyPct: number; // max scoring penalty for a zero-chemistry unit (fades to 0 at neutral)
  chemistryRolePenaltyPct: number; // structural penalty for a role-redundant unit (3 snipers / 2 offensive D)
  // Graduated off-position penalties (STHS): wrong wing or off-hand D side (mild),
  // wing↔center (medium, + faceoff cap), forward↔defense (extreme). Not applied on PP/PK.
  offPosWingPct: number;   // wrong wing / off-hand D side
  offPosCenterPct: number; // wing↔center
  offPosDefPct: number;    // forward↔defense
  offPosChemCap: number;   // an off-position unit's chemistry is capped here (never fully gels)
  // Physicality (weight): board & net-front battles, hit effectiveness
  physicalityEnabled: boolean;
  physicalityMeanLbs: number;  // league-average weight (the zero point, ~zero-sum). NB: DB weight is in kg (~92)
  physicalityPct: number;      // conversion edge per weight-unit from the mean (net-front / rebound presence)
};

export const DEFAULT_SETTINGS: EngineSettings = {
  engineModel: "possession", inGameFatiguePct: 100, possessionSkillPct: 0.85, defenseTalentPct: 35, catchUpStrength: 0.03,
  goalsPct: 98, shotsPct: 100, penaltiesPct: 100, hitsPct: 100,
  fightsPct: 100, powerPlayPct: 100, homeAdvPct: 100, homeLastChangePct: 100,
  pullGoalieEnabled: true, pullGoalieMinGoals: 6, pullGoalieMinShots: 15, pullGoalieSvPct: 0.80,
  rivalryEnabled: true, rivalryFightMult: 2.6, rivalryPenaltyMult: 1.5,
  scrumChance: 0.5, brawlChance: 0.08, abuseOfficialChance: 0.06, coachFinePimThreshold: 24, coachFineAmount: 100000,
  fightsEnabled: true, penaltiesEnabled: true, playByPlayEnabled: true,
  injuriesEnabled: true, injuryChancePct: 100,
  starExponent: 2.1,
  winPts: 2, otWinPts: 2, otLossPts: 1, lossPts: 0,
  playoffFormat: "division", playoffTeamsPerConf: 8, playoffBestOf: 7,
  salaryCapUpper: 85900000, salaryCapLower: 51500000,
  buyoutPctSeason: 50, buyoutPctOffseason: 35,
  retentionMaxPct: 50, retentionMinSalary: 600000, retentionMaxPlayers: 3,
  rosterOverFinePerDay: 200000,
  rewardPlayoff: 8000000, rewardCup: 3000000, rewardAhlCup: 4000000, rewardAhlFinalist: 2000000,
  duHighThreshold: 90, conRecovery: 1, conRecoveryHighDu: 2,
  conSlope: 0.015, b2bFatigue: 0.885,
  gameVariancePct: 120, nightSigmaGoalie: 0.11, nightSigmaOff: 0.07,
  parityPct: 100,
  conShotsLow1: 23, conShotsLow2: 32, conShotsHigh1: 27, conShotsHigh2: 34,
  skaterFwdConMinutes: 22, skaterDefConMinutes: 25, skaterConDrop: 1, skaterOtDrop: 1,
  skaterConRecovery: 1, skaterConSlope: 0,
  momentumEnabled: true, momentumBoostPct: 0.16, momentumGoalSpike: 1.2,
  momentumConcedeDip: 1.1, momentumDecaySec: 220, momentumMax: 2.4,
  momentumPkKill: 0.5, momentumFlurry: 0.35,
  clutchEnabled: true, clutchBoostPct: 0.22, clutchWindowSec: 300, clutchPlayoffMult: 1.5,
  moraleEnabled: true, moraleBase: 50, moraleWin: 2, moraleNeutral: 50, moraleSlope: 0.0018,
  moraleGoalieSlope: 0.0008, moraleFrustrationPct: 0.006,
  moraleDroughtGames: 10, moraleDroughtDrop: 1.5, moraleRoleDrop: 4,
  chemistryEnabled: true, chemistryBase: 35, chemistryGrowth: 2, chemistryDrop: 25,
  chemistryNeutral: 70, chemistryPenaltyPct: 0.06, chemistryRolePenaltyPct: 0.05,
  offPosWingPct: 0.07, offPosCenterPct: 0.17, offPosDefPct: 0.35, offPosChemCap: 55,
  physicalityEnabled: true, physicalityMeanLbs: 92, physicalityPct: 0.001,
};

/** Merge stored partial settings over the defaults (forward-compatible). */
export function mergeSettings(partial: Partial<EngineSettings> | null | undefined): EngineSettings {
  return { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
}

export async function loadSettings(): Promise<EngineSettings> {
  const row = await prisma.simSettings.findUnique({ where: { id: 1 } });
  return mergeSettings(row?.values as Partial<EngineSettings> | null);
}

export async function saveSettings(values: EngineSettings): Promise<void> {
  await prisma.simSettings.upsert({
    where: { id: 1 },
    create: { id: 1, values },
    update: { values },
  });
}
