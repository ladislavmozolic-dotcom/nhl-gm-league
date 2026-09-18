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

test("a scoreless overtime still records OT units and on-ice action", () => {
  const result = simulateGame(makeTeam(1, "HOM"), makeTeam(2, "AWY"), {
    seed: 12345,
    engineVersion: ENGINE_V2,
    settings: {
      ...DEFAULT_SETTINGS,
      goalsPct: 0,
      penaltiesEnabled: false,
      fightsEnabled: false,
      injuriesEnabled: false,
    },
  });

  assert.equal(result.endedIn, "SO");
  const overtime = result.playByPlay.filter((event) => event.period === 4);
  assert.ok(overtime.some((event) => event.kind === "change" && event.text.includes("OT1 on:")));
  assert.ok(overtime.some((event) => event.kind === "shot"));
  assert.ok(overtime.some((event) => event.kind === "save"));
  assert.ok(overtime.some((event) => event.text === "End of the overtime."));
});

test("all situation stats have valid TOI and match shot/point involvement", () => {
  const SIT_KEYS = ["5V5", "4V4", "3V3", "PP", "PK", "EN_OWN", "EN_OPP"] as const;
  for (let seed = 1; seed <= 50; seed++) {
    const result = simulateGame(makeTeam(1, "HOM"), makeTeam(2, "AWY"), {
      seed,
      engineVersion: ENGINE_V2,
      settings: {
        ...DEFAULT_SETTINGS,
        penaltiesPct: 200,
      },
    });

    for (const sk of [...result.home.skaters, ...result.away.skaters]) {
      for (const sit of SIT_KEYS) {
        const s = sk.situations[sit];
        if (!s) continue;
        if (s.shots > 0 || s.goals > 0 || s.assists > 0) {
          assert.ok(s.toi > 0, `Player ${sk.name} in situation ${sit} had shots=${s.shots}, goals=${s.goals}, assists=${s.assists} but toi=${s.toi}`);
        }
      }
    }
  }
});
