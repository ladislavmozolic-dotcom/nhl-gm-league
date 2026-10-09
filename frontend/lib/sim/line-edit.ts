// Pure line-editing rules shared by the live coach panel (and unit-tested without React).

import type { ForwardLine, DefensePair } from "./lines-core";

export type FSlot = { kind: "F"; line: number; pos: "lw" | "c" | "rw" };
export type DSlot = { kind: "D"; line: number; pos: "ld" | "rd" };
export type Slot = FSlot | DSlot;

export const F_POS = ["lw", "c", "rw"] as const;
export const D_POS = ["ld", "rd"] as const;

/** Put `playerId` into `slot`. A skater already placed elsewhere TRADES PLACES with the slot's current
 *  occupant, so a lineup can never end up with the same player twice. A scratch (not placed anywhere)
 *  simply replaces the occupant, who then sits. `null` empties the slot. Inputs are not mutated. */
export function placePlayer(forwards: ForwardLine[], defense: DefensePair[], slot: Slot, playerId: number | null): { forwards: ForwardLine[]; defense: DefensePair[] } {
  const f = forwards.map((l) => ({ ...l })), d = defense.map((p) => ({ ...p }));
  const old = slot.kind === "F" ? f[slot.line][slot.pos] : d[slot.line][slot.pos];
  if (playerId != null) {
    for (let i = 0; i < f.length; i++) for (const pos of F_POS) if (f[i][pos] === playerId && !(slot.kind === "F" && slot.line === i && slot.pos === pos)) f[i][pos] = old;
    for (let i = 0; i < d.length; i++) for (const pos of D_POS) if (d[i][pos] === playerId && !(slot.kind === "D" && slot.line === i && slot.pos === pos)) d[i][pos] = old;
  }
  if (slot.kind === "F") f[slot.line][slot.pos] = playerId; else d[slot.line][slot.pos] = playerId;
  return { forwards: f, defense: d };
}

/** Every skater id currently placed in the 5-on-5 lines. */
export function placedIds(forwards: ForwardLine[], defense: DefensePair[]): number[] {
  return [...forwards.flatMap((l) => [l.lw, l.c, l.rw]), ...defense.flatMap((p) => [p.ld, p.rd])].filter((x): x is number => x != null);
}

/** Put `playerId` into slot `idx` of one special-teams unit. A player already in that unit trades places with the slot's
 *  occupant (a unit never holds the same skater twice); the same skater MAY appear in another unit or the 5-on-5 lines.
 *  `null` empties the slot. Not mutating. */
export function placeInUnit(players: (number | null)[], idx: number, playerId: number | null): (number | null)[] {
  const next = [...players];
  const old = next[idx] ?? null;
  if (playerId != null) {
    const at = next.findIndex((id, i) => i !== idx && id === playerId);
    if (at >= 0) next[at] = old;
  }
  next[idx] = playerId;
  return next;
}
