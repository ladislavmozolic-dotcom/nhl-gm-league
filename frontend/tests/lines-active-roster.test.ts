import assert from "node:assert/strict";
import test from "node:test";
import { autoFill, autoLines, deployConfiguredLines, normalize } from "../lib/sim/lines-core";
import { buildStUnits } from "../lib/sim/chemistry";

const skaters = [
  ...Array.from({ length: 13 }, (_, i) => ({ id: i + 1, position: i % 3 === 0 ? "C" : i % 3 === 1 ? "LW" : "RW", overall: 90 - i, df: 50 + i })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: 101 + i, position: "D", overall: 80 - i, df: 70 - i })),
];
const goalies = [{ id: 201, overall: 80 }, { id: 202, overall: 75 }];

const dressedIds = (lines: ReturnType<typeof autoLines>) => new Set([
  ...lines.forwardLines.flatMap((l) => [l.lw, l.c, l.rw]),
  ...lines.defensePairs.flatMap((p) => [p.ld, p.rd]),
].filter((id): id is number => id != null));

test("special teams only use skaters dressed in the 12F + 6D lineup", () => {
  const lines = autoLines(skaters, goalies);
  const dressed = dressedIds(lines);
  const situational = [
    ...lines.situations.pp,
    ...lines.situations.pp4,
    ...lines.situations.fourVFour,
    ...lines.situations.pk4,
    ...lines.situations.pk3,
    ...lines.situations.overtime,
  ].flatMap((u) => u.players).filter((id): id is number => id != null);

  assert.equal(dressed.size, 18);
  assert.ok(situational.every((id) => dressed.has(id)));
});

test("a stale PK player outside the game lineup is removed and replaced", () => {
  const lines = autoLines(skaters, goalies);
  const dressed = dressedIds(lines);
  const extra = skaters.find((p) => !dressed.has(p.id));
  assert.ok(extra);

  lines.situations.pk4[1].players[1] = extra.id;
  const safe = autoFill(lines, skaters, goalies);

  assert.ok(!safe.situations.pk4.flatMap((u) => u.players).includes(extra.id));
  assert.ok(safe.situations.pk4.flatMap((u) => u.players).filter((id): id is number => id != null).every((id) => dressed.has(id)));
});

test("legacy lines gain two valid 4-on-3 power-play units", () => {
  const lines = autoLines(skaters, goalies);
  const dressed = dressedIds(lines);

  const legacy = structuredClone(lines);
  delete (legacy.situations as Partial<typeof legacy.situations>).pp4;
  const safe = autoFill(normalize(legacy), skaters, goalies);

  assert.equal(safe.situations.pp4.length, 2);
  assert.deepEqual(safe.situations.pp4.map((u) => u.players.length), [4, 4]);
  assert.ok(safe.situations.pp4.flatMap((u) => u.players).filter((id): id is number => id != null).every((id) => dressed.has(id)));
  assert.ok(buildStUnits(safe).some((u) => u.sig.startsWith("pp4:")));
  assert.ok(buildStUnits(safe).some((u) => u.sig.startsWith("pp4-2:")));
});

test("a GM double-shift across lines is preserved but a duplicate inside one line is repaired", () => {
  const lines = autoLines(skaters, goalies);
  const star = lines.forwardLines[0].c!;
  lines.forwardLines[3].c = star;
  const dressedF = skaters.filter((p) => p.id < 100).slice(0, 12).map((p) => p.id);
  const dressedD = skaters.filter((p) => p.id >= 100).map((p) => p.id);

  deployConfiguredLines(lines, dressedF, dressedD);
  assert.equal(lines.forwardLines[0].c, star);
  assert.equal(lines.forwardLines[3].c, star);

  lines.forwardLines[3].lw = star;
  deployConfiguredLines(lines, dressedF, dressedD);
  assert.equal([lines.forwardLines[3].lw, lines.forwardLines[3].c, lines.forwardLines[3].rw].filter((id) => id === star).length, 1);
});
