// EdgeNHL Rating Engine 2.0 — orchestrator.
//
// REAL DATA → 3-SEASON WEIGHTING → SAMPLE REGRESSION → RAW SKILL → PERCENTILE →
// PNHL CURVE → (blend w/ absolute) → FINAL RATING. AHL players are first translated to
// NHL-equivalent seasons; PS is computed after SC & PH; EX/LD/MO are direct; overrides and
// the DU year-over-year clamp are applied last. PO and OV are intentionally NOT produced.

import { BLEND_ABSOLUTE, BLEND_QUANTILE, DU_MAX_YOY } from "./config";
import { AHL_CONFIDENCE_FACTOR, ahlToNhlEquivalent } from "./leagueEq";
import { clamp } from "./math";
import * as P from "./params";
import { RATING_KEYS, type PlayerInput, type RatingBundle, type RatingCell, type RatingKey } from "./types";

export function rate(input: PlayerInput): RatingBundle {
  const notes: string[] = [];
  // AHL branch: translate to NHL-equivalent production, damp confidence.
  let p = input;
  let cs = 1;
  if (input.bio.isAhl && input.ahl?.length) {
    p = { ...input, seasons: ahlToNhlEquivalent(input.ahl, input.bio.age) };
    cs = AHL_CONFIDENCE_FACTOR;
    notes.push("AHL player — stats translated to NHL-equivalent via league-EQ; SK/DF/PH fall back to priors.");
  }

  const cells = {} as Record<RatingKey, RatingCell>;
  cells.CK = P.ck(p, cs);
  cells.FG = P.fg(p);
  cells.DI = P.di(p, cs);
  cells.SK = P.sk(p, cs);
  cells.ST = P.st(p);
  cells.EN = P.en(p, cs);
  cells.DU = P.du(p);
  cells.PH = P.ph(p, cs);
  cells.FO = P.fo(p);
  cells.PA = P.pa(p, cs);
  cells.SC = P.sc(p, cs);
  cells.DF = P.df(p, cs);
  cells.EX = P.ex(p);
  cells.LD = P.ld(p);
  cells.PS = P.ps(p, cells.SC.final, cells.PH.final);
  cells.MO = P.mo();

  // DU year-over-year clamp (spec: normally ±8; chronic injuries may exceed → skip clamp
  // only when this season's availability is genuinely far worse, i.e. large drop is real).
  const prevDU = input.previous?.DU;
  if (prevDU != null) {
    const drop = prevDU - cells.DU.final;
    if (Math.abs(drop) > DU_MAX_YOY && drop < 15) {
      const clamped = clamp(cells.DU.final, prevDU - DU_MAX_YOY, prevDU + DU_MAX_YOY);
      cells.DU.reason += ` (clamped ±${DU_MAX_YOY} vs prev ${prevDU})`;
      cells.DU.final = clamped;
    }
  }

  // Finalise: round, clamp 1-99, apply manual overrides last.
  const final = {} as Record<RatingKey, number>;
  for (const k of RATING_KEYS) {
    let v = cells[k].final;
    const ov = input.overrides?.[k];
    if (ov != null) {
      v += ov;
      const why = input.overrideReasons?.[k];
      cells[k].reason = `${cells[k].reason ?? ""} · override ${ov > 0 ? "+" : ""}${ov}${why ? ` (${why})` : ""}`.trim();
    }
    v = Math.round(clamp(v, 1, 99));
    cells[k].final = v;
    final[k] = v;
  }

  return { id: input.bio.id, name: input.bio.name, pos: input.bio.pos, cells, final, notes };
}

/** Rate a whole roster. */
export const rateRoster = (players: PlayerInput[]): RatingBundle[] => players.map(rate);

export { BLEND_QUANTILE, BLEND_ABSOLUTE };
