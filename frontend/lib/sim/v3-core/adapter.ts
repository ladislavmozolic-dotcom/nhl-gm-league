// V3 Core bridge: translate existing simulator roster data without mutating it.
import type { SimGoalie, SimSkater, SimTeam } from "../types";
import type { CorePlayerProfile } from "./decision-engine";
import type { CoreGoalieProfile } from "./goalie-resolver";
import type { CorePrototypeTeam } from "./prototype-loop";

type CoreSourceSkater = Pick<SimSkater, "id" | "type" | "attrs">;

/** Reuses the existing player card; no new player types or ratings are invented. */
export function coreProfileFromSkater(skater: CoreSourceSkater): CorePlayerProfile {
  return {
    id: skater.id,
    skating: skater.attrs.sk ?? 50,
    puckHandling: skater.attrs.ph ?? 50,
    passing: skater.attrs.pa ?? 50,
    shooting: skater.attrs.sc ?? 50,
    defense: skater.attrs.df ?? 50,
    physical: (0.6 * (skater.attrs.st ?? 50)) + (0.4 * (skater.attrs.ck ?? 50)),
    type: skater.type,
  };
}

/** Reuses the chosen starter; condition carries the existing season fatigue. */
export function coreProfileFromGoalie(goalie: Pick<SimGoalie, "id" | "quality" | "attrs" | "con">): CoreGoalieProfile {
  return {
    id: goalie.id,
    quality: goalie.quality,
    reflexes: goalie.attrs.rt ?? 50,
    reboundControl: goalie.attrs.rb ?? 50,
    condition: goalie.con,
  };
}

const forecheckValue = (value: SimTeam["teamTactics"]["forecheck"]) => value === "aggressive" ? 0.8 : value === "passive" ? 0.25 : 0.5;
const riskValue = (team: SimTeam) => {
  const puck = team.teamTactics.puckStyle;
  const base = puck === "rush" ? 0.78 : puck === "cycle" ? 0.38 : puck === "shotVolume" ? 0.62 : 0.5;
  return Math.max(0, Math.min(1, base + (team.teamTactics.tempo === "fast" ? 0.08 : team.teamTactics.tempo === "slow" ? -0.08 : 0)));
};

/** Turns a real SimTeam into an offline Core prototype side, preserving its tactical identity. */
export function corePrototypeTeamFromSimTeam(team: SimTeam): CorePrototypeTeam {
  return {
    id: team.id,
    players: [...team.forwards, ...team.defense].map(coreProfileFromSkater),
    // Real loaded teams always have a starter.  Keeping this optional makes
    // the offline diagnostic usable with minimal/synthetic roster fixtures.
    goalie: team.goalie ? coreProfileFromGoalie(team.goalie) : undefined,
    lines: {
      forwards: (team.units ?? []).filter((unit) => !unit.isDef).map((unit) => unit.members),
      defense: (team.units ?? []).filter((unit) => unit.isDef).map((unit) => unit.members),
    },
    tactics: { risk: riskValue(team), forecheck: forecheckValue(team.teamTactics.forecheck) },
  };
}
