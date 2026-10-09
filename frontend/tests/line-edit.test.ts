import test from "node:test";
import assert from "node:assert/strict";
import { placePlayer, placedIds } from "../lib/sim/line-edit";
import type { ForwardLine, DefensePair } from "../lib/sim/lines-core";

const F = (a: number, b: number, c: number): ForwardLine => ({ lw: a, c: b, rw: c, timePct: 25 });
const D = (a: number, b: number): DefensePair => ({ ld: a, rd: b, timePct: 33 });
const fwd = () => [F(1, 2, 3), F(4, 5, 6), F(7, 8, 9), F(10, 11, 12)];
const def = () => [D(21, 22), D(23, 24), D(25, 26)];

test("picking a player who is already in the lineup swaps the two", () => {
  const r = placePlayer(fwd(), def(), { kind: "F", line: 0, pos: "c" }, 8);
  assert.equal(r.forwards[0].c, 8);
  assert.equal(r.forwards[2].c, 2, "the displaced player takes the other player's old slot");
});

test("a scratch replaces the occupant, who then sits", () => {
  const r = placePlayer(fwd(), def(), { kind: "D", line: 1, pos: "rd" }, 99);
  assert.equal(r.defense[1].rd, 99);
  assert.ok(!placedIds(r.forwards, r.defense).includes(24));
});

test("inputs are never mutated, and re-picking the same player is a no-op", () => {
  const f = fwd(), d = def();
  const before = JSON.stringify([f, d]);
  placePlayer(f, d, { kind: "F", line: 3, pos: "lw" }, 1);
  assert.equal(JSON.stringify([f, d]), before);
  const same = placePlayer(f, d, { kind: "F", line: 0, pos: "lw" }, 1);
  assert.equal(JSON.stringify([same.forwards, same.defense]), before);
});

test("any sequence of picks keeps every skater in the lineup at most once", () => {
  let f = fwd(), d = def();
  const pool = [...placedIds(f, d), 98, 99];
  let seed = 12345;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let i = 0; i < 500; i++) {
    const slot = rnd(2) === 0
      ? { kind: "F" as const, line: rnd(4), pos: (["lw", "c", "rw"] as const)[rnd(3)] }
      : { kind: "D" as const, line: rnd(3), pos: (["ld", "rd"] as const)[rnd(2)] };
    const r = placePlayer(f, d, slot, pool[rnd(pool.length)]);
    f = r.forwards; d = r.defense;
    const ids = placedIds(f, d);
    assert.equal(new Set(ids).size, ids.length, `duplicate skater after pick #${i}`);
    assert.equal(ids.length, 18, "swaps must never lose a slot's occupant (only a scratch may displace one)");
  }
});
