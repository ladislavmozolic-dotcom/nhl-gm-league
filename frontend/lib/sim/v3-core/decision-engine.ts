// V3 Core step 2: deterministic intent selection. Resolution (whether an
// action succeeds) deliberately belongs to a later layer.
import type { RelativeZone } from "./match-state";

export type CoreAction = "CARRY" | "PASS" | "SHOOT" | "DUMP_IN" | "CLEAR" | "FORECHECK" | "BLOCK" | "CONTAIN";
export type CorePlayerProfile = {
  id: number;
  skating: number;
  puckHandling: number;
  passing: number;
  shooting: number;
  defense: number;
  physical: number;
  type?: string | null;
};
export type CoreDecisionInput = {
  hasPossession: boolean;
  zone: RelativeZone;
  pressure: number; // 0..1, pressure applied by the opponent to this team
  fatigue: number; // 0..1
  scoreMargin: number;
  secondsRemaining: number;
  rebound?: boolean; // a loose puck is available after a save
  carrier: CorePlayerProfile;
  tactics?: { risk?: number; forecheck?: number }; // 0..1
};
export type CoreDecision = { action: CoreAction; score: number; candidates: Array<{ action: CoreAction; score: number }> };

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const norm = (n: number) => clamp((n - 40) / 60);
const profileBoost = (type: string | null | undefined, action: CoreAction) => {
  const t = (type ?? "").toLowerCase();
  if ((t.includes("playmaker") || t.includes("two-way")) && action === "PASS") return 0.08;
  if (t.includes("sniper") && action === "SHOOT") return 0.1;
  if ((t.includes("forechecker") || t.includes("grinder")) && action === "FORECHECK") return 0.1;
  if (t.includes("defensive") && (action === "CLEAR" || action === "CONTAIN" || action === "BLOCK")) return 0.08;
  return 0;
};

/**
 * Picks intent with no RNG. The future resolver can sample these scores, but
 * tests and coaching AI can already explain *why* a particular play is favoured.
 */
export function decideCoreAction(input: CoreDecisionInput): CoreDecision {
  const risk = clamp(input.tactics?.risk ?? 0.5);
  const forecheck = clamp(input.tactics?.forecheck ?? 0.5);
  const lateDesperation = input.scoreMargin < 0 && input.secondsRemaining < 300 ? 0.12 : 0;
  const safeLead = input.scoreMargin > 0 && input.secondsRemaining < 300 ? 0.1 : 0;
  const rebound = input.rebound ? 0.26 : 0;
  const skill = {
    sk: norm(input.carrier.skating), ph: norm(input.carrier.puckHandling), pa: norm(input.carrier.passing),
    sc: norm(input.carrier.shooting), df: norm(input.carrier.defense), st: norm(input.carrier.physical),
  };
  const add = (action: CoreAction, score: number) => ({ action, score: Math.max(0.001, score + profileBoost(input.carrier.type, action)) });
  const candidates: Array<{ action: CoreAction; score: number }> = [];

  if (!input.hasPossession) {
    candidates.push(
      add("FORECHECK", 0.18 + forecheck * 0.25 + skill.st * 0.2 + skill.sk * 0.12 - input.fatigue * 0.2),
      add("BLOCK", 0.15 + skill.df * 0.3 + input.pressure * 0.15),
      add("CONTAIN", 0.2 + skill.df * 0.2 + safeLead * 1.4 - lateDesperation * 0.5),
    );
  } else if (input.zone === "DEFENSIVE") {
    candidates.push(
      add("CLEAR", 0.25 + input.pressure * 0.4 + input.fatigue * 0.2 + safeLead * 0.25),
      add("PASS", 0.2 + skill.pa * 0.32 + skill.ph * 0.1 - input.pressure * 0.18),
      add("CARRY", 0.14 + skill.sk * 0.3 + skill.ph * 0.12 - input.pressure * 0.22 - input.fatigue * 0.12),
    );
  } else if (input.zone === "NEUTRAL") {
    candidates.push(
      add("CARRY", 0.2 + skill.sk * 0.34 + skill.ph * 0.14 + risk * 0.1 + lateDesperation),
      add("PASS", 0.2 + skill.pa * 0.34 + risk * 0.05),
      add("DUMP_IN", 0.14 + input.pressure * 0.14 + input.fatigue * 0.13 + (1 - risk) * 0.1),
    );
  } else {
    candidates.push(
      // A legitimate shooting lane must compete with the extra-pass option.
      // The later resolver and goalie layer decide whether the shot is good.
      add("SHOOT", 0.4 + skill.sc * 0.38 + lateDesperation * 1.2 + risk * 0.08 + rebound),
      add("PASS", 0.21 + skill.pa * 0.34 + input.pressure * 0.08 - rebound * 0.15),
      add("CARRY", 0.13 + skill.sk * 0.25 + skill.ph * 0.12 - input.pressure * 0.08),
    );
  }
  candidates.sort((a, b) => b.score - a.score || a.action.localeCompare(b.action));
  return { action: candidates[0].action, score: candidates[0].score, candidates };
}
