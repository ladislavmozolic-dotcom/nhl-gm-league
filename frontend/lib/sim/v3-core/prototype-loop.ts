// V3 Core step 4: an offline-only causal prototype loop. This does not share
// routing with the existing simulator and never writes a game to the database.
import { RNG } from "../rng";
import { decideCoreAction, type CoreAction, type CorePlayerProfile } from "./decision-engine";
import { resolveCoreAction } from "./action-resolver";
import type { CoreGoalieProfile } from "./goalie-resolver";
import { resolveCoreShotResult, type CoreShotOutcome } from "./shot-result";
import { consumeReboundOpportunity, createMatchState, opponentId, viewForTeam, withPossession, withReboundOpportunity, withScore, type CoreOnIce, type CoreZone, type RelativeZone, type V3CoreMatchState } from "./match-state";
import { applyCoreTickState, withCoreLineChange } from "./state-transition";

export type CorePrototypeLines = { forwards: number[][]; defense: number[][] };
export type CorePrototypeTeam = { id: number; players: CorePlayerProfile[]; goalie?: CoreGoalieProfile; lines?: CorePrototypeLines; tactics?: { risk?: number; forecheck?: number } };
export type CorePrototypeEvent = { tick: number; teamId: number; action: CoreAction | CoreShotOutcome | "TURNOVER"; outcome: "SUCCESS" | "FAILURE" | "GOAL" | "SAVE" | "MISS" | "BLOCK" | "REBOUND"; reason: string };
export type CorePrototypeResult = { state: V3CoreMatchState; events: CorePrototypeEvent[] };

const zoneFor = (state: V3CoreMatchState, teamId: number, relative: RelativeZone): CoreZone => {
  if (relative === "NEUTRAL") return "NEUTRAL";
  const home = teamId === state.homeTeamId;
  return relative === "OFFENSIVE" ? (home ? "AWAY_DEFENSIVE" : "HOME_DEFENSIVE") : (home ? "HOME_DEFENSIVE" : "AWAY_DEFENSIVE");
};
const choose = (rng: RNG, players: CorePlayerProfile[]) => players[rng.int(players.length)];
const averageGoalie: CoreGoalieProfile = { id: 0, quality: 84.16, reflexes: 88.88, reboundControl: 89.66, condition: 99.03 };
const lineForShift = (team: CorePrototypeTeam, shift: number): CoreOnIce => ({
  forwards: team.lines?.forwards.length ? team.lines.forwards[shift % team.lines.forwards.length] : [],
  defense: team.lines?.defense.length ? team.lines.defense[shift % team.lines.defense.length] : [],
});
const playersOnIce = (team: CorePrototypeTeam, onIce: CoreOnIce) => {
  const selected = new Set([...onIce.forwards, ...onIce.defense]);
  const players = selected.size ? team.players.filter((player) => selected.has(player.id)) : team.players;
  return players.length ? players : team.players;
};

/** Runs a compact seedable prototype for architecture tests and event-chain review. */
export function runCorePrototype(input: { home: CorePrototypeTeam; away: CorePrototypeTeam; seed: number; ticks?: number }): CorePrototypeResult {
  if (!input.home.players.length || !input.away.players.length) throw new Error("Both prototype teams need at least one player.");
  const rng = new RNG(input.seed);
  const teams = new Map([[input.home.id, input.home], [input.away.id, input.away]]);
  let state = createMatchState({ homeTeamId: input.home.id, awayTeamId: input.away.id });
  state = withPossession(state, rng.chance(0.5) ? input.home.id : input.away.id);
  const events: CorePrototypeEvent[] = [];
  let activeShift = -1;

  for (let tick = 0; tick < (input.ticks ?? 120); tick++) {
    if (state.totalSeconds >= 3600) break;
    const shift = Math.floor(state.totalSeconds / 45);
    if (shift !== activeShift) {
      activeShift = shift;
      state = withCoreLineChange(state, input.home.id, lineForShift(input.home, shift));
      state = withCoreLineChange(state, input.away.id, lineForShift(input.away, shift));
    }
    const teamId = state.possessionTeamId ?? (rng.chance(0.5) ? input.home.id : input.away.id);
    const team = teams.get(teamId)!;
    const opponent = teams.get(opponentId(state, teamId))!;
    const actor = choose(rng, playersOnIce(team, state.onIce[teamId]));
    const defender = choose(rng, playersOnIce(opponent, state.onIce[opponent.id]));
    const view = viewForTeam(state, teamId);
    const decision = decideCoreAction({ hasPossession: view.hasPossession, zone: view.relativeZone, pressure: view.pressure, fatigue: view.fatigue, scoreMargin: view.scoreMargin, secondsRemaining: Math.max(0, 3600 - state.totalSeconds), rebound: view.hasRebound, carrier: actor, tactics: team.tactics });
    if (view.hasRebound) state = consumeReboundOpportunity(state, teamId);
    // The decision layer ranks intent; a live game samples that ranked spectrum
    // with the seeded RNG. Always taking rank #1 made every average O-zone
    // possession a pass and produced an unrealistically sterile prototype.
    const action = decision.candidates[rng.weighted(decision.candidates.map((candidate) => candidate.score))].action;
    const resolution = resolveCoreAction({ action, zone: view.relativeZone, pressure: view.pressure, fatigue: view.fatigue, actor, primaryDefender: { skating: defender.skating, defense: defender.defense, physical: defender.physical } });
    const success = rng.chance(resolution.successChance);
    events.push({ tick, teamId, action, outcome: success ? "SUCCESS" : "FAILURE", reason: resolution.reason });
    state = applyCoreTickState(state, { attackingTeamId: teamId, action, success, relativeZone: view.relativeZone });

    if (!success) {
      const other = opponentId(state, teamId);
      state = withPossession(state, other, zoneFor(state, other, "DEFENSIVE"));
      events.push({ tick, teamId: other, action: "TURNOVER", outcome: "SUCCESS", reason: `${action.toLowerCase()} fails` });
      continue;
    }
    if (action === "SHOOT") {
      const shot = resolveCoreShotResult({
        shooter: actor,
        defender: { defense: defender.defense, physical: defender.physical },
        goalie: opponent.goalie ?? averageGoalie,
        shotQuality: resolution.shotQuality ?? "LOW",
        pressure: view.pressure,
      });
      const outcome = rng.weighted((["MISS", "BLOCK", "GOAL", "SAVE", "REBOUND"] as const).map((kind) => shot.chances[kind]));
      const kind = (["MISS", "BLOCK", "GOAL", "SAVE", "REBOUND"] as const)[outcome];
      if (kind === "GOAL") {
        state = withScore(state, teamId, state.score[teamId] + 1);
        events.push({ tick, teamId, action: "GOAL", outcome: "GOAL", reason: shot.reason });
      } else if (kind === "REBOUND") {
        events.push({ tick, teamId, action: "REBOUND", outcome: "REBOUND", reason: shot.reason });
        state = withReboundOpportunity(withPossession(state, teamId, zoneFor(state, teamId, "OFFENSIVE")), teamId);
      } else {
        events.push({ tick, teamId: kind === "BLOCK" ? opponent.id : teamId, action: kind, outcome: kind, reason: shot.reason });
        const other = opponentId(state, teamId);
        state = withPossession(state, other, zoneFor(state, other, "DEFENSIVE"));
      }
    } else {
      state = withPossession(state, teamId, zoneFor(state, teamId, resolution.nextZone));
    }
  }
  return { state, events };
}
