import test from "node:test";
import assert from "node:assert/strict";
import { simulateGame } from "../lib/sim/engine";
import { autoLines } from "../lib/sim/lines-core";
import { buildTeam } from "../lib/sim/ratings";
import { DEFAULT_SETTINGS } from "../lib/sim/settings";
import { ENGINE_V2 } from "../lib/sim/version";
import type { SimGoalie, SimSkater } from "../lib/sim/types";

const attrs = {
  ck: 70, fg: 70, di: 70, sk: 70, st: 70, en: 70, du: 70,
  ph: 70, fo: 70, pa: 70, sc: 70, df: 70, ps: 70, ex: 70, ld: 70, mo: 70,
};

function makeTeam(id: number, code: string) {
  const skaters: Array<Omit<SimSkater, "iceTime">> = Array.from({ length: 18 }, (_, i) => {
    const isDefense = i >= 12;
    const position = isDefense ? "D" : i % 3 === 1 ? "C" : i % 3 === 0 ? "LW" : "RW";
    return {
      id: id * 100 + i + 1,
      name: `${code} Player ${i + 1}`,
      position, isDefense, isCenter: position === "C", overall: 70, attrs: { ...attrs },
      offense: 70, playmaking: 70, defense: 70, faceoff: 70, discipline: 70,
      hitting: 70, blocking: 70, con: 100, chem: 100, roleFit: 1, morale: 70,
      weight: 90, shoots: i % 2 ? "R" : "L", offSide: false, posPenalty: 1,
    };
  });
  const goalies: SimGoalie[] = [0, 1].map((i) => ({
    id: id * 100 + 50 + i,
    name: `${code} Goalie ${i + 1}`,
    overall: 70,
    attrs: { sk: 70, du: 70, en: 70, sz: 70, ag: 70, rb: 70, sc: 70, hs: 70, rt: 70, ph: 70, ps: 70, ex: 70, ld: 70, mo: 70 },
    quality: 70, con: 100, du: 70, fatigued: false, morale: 70,
  }));
  const lines = autoLines(
    skaters.map((s) => ({ id: s.id, position: s.position, overall: s.overall, shoots: s.shoots, df: s.attrs.df })),
    goalies.map((g) => ({ id: g.id, overall: g.overall })),
  );
  return buildTeam({ id, name: code, code, skaters, goalies, lines });
}

test("a player serving a penalty is never called for another one while in the box", () => {
  let checked = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const result = simulateGame(makeTeam(1, "HOM"), makeTeam(2, "AWY"), {
      seed,
      engineVersion: ENGINE_V2,
      settings: { ...DEFAULT_SETTINGS, penaltiesPct: 300, fightsEnabled: false, injuriesEnabled: false },
    });
    const byPlayer = new Map<number, { period: number; seconds: number; minutes: number }[]>();
    for (const p of result.penalties) {
      const prev = byPlayer.get(p.playerId) ?? [];
      for (const q of prev) {
        if (q.period !== p.period) continue;
        // a same-second misconduct add-on belongs to the same infraction
        if (q.seconds === p.seconds) continue;
        // a minor ends early when the other side scores on that power play
        const releasedByPpGoal = q.minutes === 2 && result.goals.some((g) =>
          g.period === p.period && g.team !== p.team && g.strength === "PP" && g.seconds > q.seconds && g.seconds <= p.seconds);
        if (releasedByPpGoal) continue;
        assert.ok(p.seconds >= q.seconds + q.minutes * 60,
          `seed ${seed}: ${p.playerName} penalised at ${p.seconds}s while serving ${q.minutes} min from ${q.seconds}s`);
        checked++;
      }
      prev.push({ period: p.period, seconds: p.seconds, minutes: p.minutes });
      byPlayer.set(p.playerId, prev);
    }
  }
  assert.ok(checked > 0, "expected some players to take multiple penalties in a period");
});
