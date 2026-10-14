import type { SimTeam } from "../types";
import { corePrototypeTeamFromSimTeam } from "./adapter";
import { runCorePrototype } from "./prototype-loop";

export type CoreDiagnostic = {
  score: { home: number; away: number };
  actionMix: Record<string, number>;
  turnovers: number;
  shots: number;
  goals: number;
  eventLog: string[];
};

/** Read-only adapter for inspecting how real rosters behave in the V3 Core prototype. */
export function diagnoseCorePrototype(home: SimTeam, away: SimTeam, seed: number, ticks = 720): CoreDiagnostic {
  const result = runCorePrototype({ home: corePrototypeTeamFromSimTeam(home), away: corePrototypeTeamFromSimTeam(away), seed, ticks });
  const actionMix: Record<string, number> = {};
  for (const event of result.events) actionMix[event.action] = (actionMix[event.action] ?? 0) + 1;
  return {
    score: { home: result.state.score[home.id], away: result.state.score[away.id] },
    actionMix,
    turnovers: actionMix.TURNOVER ?? 0,
    shots: actionMix.SHOOT ?? 0,
    goals: actionMix.GOAL ?? 0,
    eventLog: result.events.slice(0, 24).map((e) => `#${e.tick} T${e.teamId} ${e.action} → ${e.outcome} (${e.reason})`),
  };
}
