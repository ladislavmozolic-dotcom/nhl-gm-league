// QA — old vs new comparison with change flags + reasons. Mirrors the "QA" sheet.
//   Δ > 5 → "yellow", Δ > 8 → "red".

import { RATING_KEYS, type RatingBundle, type RatingKey } from "./types";

export type Flag = "" | "yellow" | "red";
export const flagFor = (delta: number): Flag => (Math.abs(delta) > 8 ? "red" : Math.abs(delta) > 5 ? "yellow" : "");

export interface QaRow {
  key: RatingKey;
  old: number | null;
  neu: number;
  delta: number | null;
  flag: Flag;
  confidence: number;
  reason: string;
}

export function qaFor(b: RatingBundle, previous?: Partial<Record<RatingKey, number>>): QaRow[] {
  return RATING_KEYS.map((k) => {
    const neu = b.final[k];
    const old = previous?.[k] ?? null;
    const delta = old != null ? neu - old : null;
    return {
      key: k, old, neu, delta,
      flag: delta != null ? flagFor(delta) : "",
      confidence: b.cells[k].confidence,
      reason: b.cells[k].reason ?? "",
    };
  });
}

/** Compact human summary of the notable moves (used by the CLI). */
export function qaSummary(b: RatingBundle, previous?: Partial<Record<RatingKey, number>>): string[] {
  return qaFor(b, previous)
    .filter((r) => r.flag)
    .map((r) => `${r.key} ${r.delta! > 0 ? "+" : ""}${r.delta} [${r.flag}] — ${r.reason}`);
}
