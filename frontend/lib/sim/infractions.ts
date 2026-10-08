// Severe in-game infractions that end a player's night and trigger an automatic
// supplementary-discipline suspension. Shared by the engine (lib/sim/engine.ts — draws and
// punishes them live) and Player Safety (lib/discipline-server.ts — turns them into suspensions),
// so the penalty a player takes and the games he sits are always the same table.
//
//  • "Major / Game Misconduct": a 5-minute major (the opponent gets a 5-minute power play) plus a
//    game misconduct — the player is EJECTED for the rest of the game.
//  • "Match": a 5-minute match penalty (attempt / deliberate injury) — also an ejection.
// `games` = the suspension range (inclusive) handed out after the game; a repeat offender sits longer.

export type SevereInfraction = {
  type: string;
  weight: number;               // relative frequency among severe infractions
  match?: boolean;              // match penalty instead of major + game misconduct
  games: [number, number];      // automatic suspension range
};

export const SEVERE_INFRACTIONS: SevereInfraction[] = [
  { type: "Checking from behind", weight: 18, games: [2, 4] },
  { type: "Boarding", weight: 16, games: [1, 3] },
  { type: "Checking to the head", weight: 14, games: [2, 5] },
  { type: "Cross-checking", weight: 12, games: [1, 3] },
  { type: "Elbowing", weight: 8, games: [1, 3] },
  { type: "Charging", weight: 8, games: [1, 2] },
  { type: "Kneeing", weight: 6, games: [2, 4] },
  { type: "Slew-footing", weight: 5, games: [2, 4] },
  { type: "Spearing", weight: 4, games: [3, 6] },
  { type: "Butt-ending", weight: 3, games: [3, 6] },
  { type: "Clipping", weight: 3, games: [2, 4] },
  { type: "Head-butting", weight: 2, games: [3, 5] },
  { type: "Attempt to injure", weight: 1.5, match: true, games: [4, 10] },
  { type: "Deliberate injury", weight: 1, match: true, games: [5, 10] },
];

export const severeInfraction = (type: string | null | undefined) => SEVERE_INFRACTIONS.find((i) => i.type === type);

/** Expected severe infractions per team per game at 100 % (before physicality / discipline / rivalry scaling). */
export const SEVERE_PER_TEAM = 0.05;
