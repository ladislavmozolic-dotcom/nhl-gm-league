import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGINE_V1,
  ENGINE_V2,
  ENGINE_V3,
  engineVersionFor,
  isExperimentalEngine,
  isNextGenEngine,
  resolveSimEngine,
} from "../lib/sim/version";
import { v3CheckingMatchupDangerMult, v3CoachAdaptation, v3DefenseAssistWeight, v3FinishingExponent, v3BlockSkillMult, V3_OT_STAR_EXPONENT, V3_PP_CENTER, v3PpPuckMovementMult, v3GoalieComposureMult, v3GoalieRhythmMult, v3ShiftLimit } from "../lib/sim/engine";
import type { SimSkater } from "../lib/sim/types";

test("V3 is a next-gen workbench version, not a league-selectable engine", () => {
  assert.equal(ENGINE_V3, "3.0.0-wip");
  assert.equal(isNextGenEngine(ENGINE_V1), false);
  assert.equal(isNextGenEngine(ENGINE_V2), true);
  assert.equal(isNextGenEngine(ENGINE_V3), true);
  assert.equal(isExperimentalEngine(ENGINE_V2), false);
  assert.equal(isExperimentalEngine(ENGINE_V3), true);
  assert.equal(engineVersionFor("current"), ENGINE_V1);
  assert.equal(engineVersionFor("nextgen"), ENGINE_V2);
});

test("V3 is reachable only on the sandbox instance — a stored v3 value never activates it on live", () => {
  assert.equal(resolveSimEngine("v3", false), "nextgen");
  assert.equal(resolveSimEngine("v3", true), "v3");
  assert.equal(resolveSimEngine("nextgen", true), "nextgen");
  assert.equal(resolveSimEngine("current", true), "nextgen");
  assert.equal(resolveSimEngine(null, true), "nextgen");
  assert.equal(engineVersionFor("v3"), ENGINE_V3);
});

function skater(en: number, con: number): SimSkater {
  return {
    id: 1, name: "Test", position: "C", isDefense: false, isCenter: true, overall: 60,
    attrs: { ck: 50, fg: 50, di: 50, sk: 50, st: 50, en, du: 50, ph: 50, fo: 50, pa: 50, sc: 50, df: 50, ps: 50, ex: 50, ld: 50, mo: 50 },
    offense: 50, playmaking: 50, defense: 50, faceoff: 50, discipline: 50, hitting: 50, blocking: 50,
    iceTime: 1, con, chem: 100, roleFit: 1, morale: 50, weight: 190, shoots: "L", offSide: false, posPenalty: 1,
  };
}

test("V3 only shortens shifts for a genuinely depleted unit and keeps its effect bounded", () => {
  const base = 48;
  assert.equal(v3ShiftLimit(base, [skater(50, 100), skater(50, 100), skater(50, 100)]), base);
  assert.equal(v3ShiftLimit(base, [skater(90, 100), skater(90, 100), skater(90, 100)]), base);
  assert.equal(v3ShiftLimit(base, [skater(20, 40), skater(20, 40), skater(20, 40)]), 38);
  assert.equal(v3ShiftLimit(base, []), base);
});

test("V3 coach adaptation is late, profile-sensitive, and bounded", () => {
  const offensive = { coachOff: 1.08, coachDef: 0.94, coachEx: 85 };
  const defensive = { coachOff: 0.94, coachDef: 1.08, coachEx: 85 };
  assert.deepEqual(v3CoachAdaptation(offensive, 2, 1100, -1), { shots: 1, allow: 1 });
  assert.deepEqual(v3CoachAdaptation(offensive, 3, 500, 0), { shots: 1, allow: 1 });
  const earlyThird = v3CoachAdaptation(offensive, 3, 650, -1);
  const lateThird = v3CoachAdaptation(offensive, 3, 1100, -1);
  assert.ok(earlyThird.shots > 1 && lateThird.shots > earlyThird.shots);
  assert.ok(lateThird.shots > v3CoachAdaptation(defensive, 3, 1100, -1).shots);
  const defensiveShell = v3CoachAdaptation(defensive, 3, 1100, 1);
  assert.ok(defensiveShell.shots < 1 && defensiveShell.allow < 1);
  assert.ok(defensiveShell.shots >= 0.95 && defensiveShell.allow >= 0.88);
});

test("V3 checking matchup uses the existing player types and remains a small effect", () => {
  const checkers = [skater(60, 100), skater(60, 100), skater(60, 100)].map((s) => ({ ...s, type: "Defensive Forward", attrs: { ...s.attrs, df: 80, ck: 80 } }));
  const attackers = [skater(60, 100), skater(60, 100), skater(60, 100)].map((s) => ({ ...s, offense: 75, playmaking: 75 }));
  const mult = v3CheckingMatchupDangerMult(checkers, attackers);
  assert.ok(mult < 1 && mult >= 0.97);
  assert.equal(v3CheckingMatchupDangerMult([], attackers), 1);
});

test("V3 concentrates a defence pair's assist weight without changing its average", () => {
  const elite = { ...skater(60, 100), isDefense: true, offense: 80, playmaking: 80 };
  const depth = { ...skater(60, 100), id: 2, isDefense: true, offense: 45, playmaking: 45 };
  const weights = [v3DefenseAssistWeight(elite, [elite, depth]), v3DefenseAssistWeight(depth, [elite, depth])];
  assert.ok(weights[0] > 1 && weights[1] < 1);
  assert.ok(Math.abs((weights[0] + weights[1]) / 2 - 1) < 0.000001);
});

test("V3 softly compresses only the finishing curve's elite end", () => {
  assert.equal(v3FinishingExponent(1.7), 1.55);
  assert.equal(v3FinishingExponent(1.55), 1.5);
});

test("V3 goalie rhythm only chills a goalie after a long idle stretch and is capped", () => {
  assert.equal(v3GoalieRhythmMult(0), 1);
  assert.equal(v3GoalieRhythmMult(120), 1);
  assert.ok(v3GoalieRhythmMult(200) > 1 && v3GoalieRhythmMult(200) < 1.12);
  assert.ok(Math.abs(v3GoalieRhythmMult(300) - 1.12) < 1e-9);
  assert.ok(Math.abs(v3GoalieRhythmMult(3000) - 1.12) < 1e-9);
});

test("V3 block skill is centred on a typical defenceman and bounded", () => {
  assert.equal(v3BlockSkillMult(71), 1);
  assert.ok(v3BlockSkillMult(80) > 1 && v3BlockSkillMult(60) < 1);
  assert.equal(v3BlockSkillMult(200), 1.1);
  assert.equal(v3BlockSkillMult(0), 0.9);
});

test("V3 goalie composure: rattled after a goal, locked in after a long save streak", () => {
  assert.equal(v3GoalieComposureMult(30, 0), 1.06);
  assert.equal(v3GoalieComposureMult(120, 0), 1.06);
  assert.equal(v3GoalieComposureMult(121, 5), 1);
  assert.equal(v3GoalieComposureMult(500, 12), 0.96);
  assert.equal(v3GoalieComposureMult(60, 12), 1.06);
  assert.equal(v3GoalieComposureMult(1e9, 0), 1);
});

test("V3 overtime stars is a small, positive finishing-exponent bump", () => {
  assert.ok(V3_OT_STAR_EXPONENT > 0 && V3_OT_STAR_EXPONENT <= 0.25);
});

test("V3 PP puck movement is centred, directional and capped", () => {
  const mk = (pa: number, df: number) => ({ ...skater(60, 100), attrs: { ...skater(60, 100).attrs, pa, df } });
  const onCentre = 60 + V3_PP_CENTER; // attacker PA that makes (PA - killer DF) land exactly on the centre
  assert.ok(Math.abs(v3PpPuckMovementMult([mk(onCentre, 0)], [mk(0, 60)]) - 1) < 1e-9);
  assert.ok(v3PpPuckMovementMult([mk(90, 60)], [mk(0, 60)]) > v3PpPuckMovementMult([mk(60, 60)], [mk(0, 60)]));
  assert.equal(v3PpPuckMovementMult([mk(100, 0)], [mk(0, 40)]), 1.12);
  assert.equal(v3PpPuckMovementMult([mk(0, 0)], [mk(0, 100)]), 0.88);
  assert.equal(v3PpPuckMovementMult([], [mk(0, 60)]), 1);
});
