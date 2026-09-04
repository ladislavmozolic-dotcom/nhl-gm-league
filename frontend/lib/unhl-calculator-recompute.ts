"use server";

// Recompute UNHL Parameters' CK/SC/PA/DF from the ORIGINAL STHS calculator formulas
// (lib/calc-tables.ts + lib/param-projection.ts — the exact lookup tables extracted
// from the ProfiNHL "Players Calculator" workbook), but blended across THREE real
// seasons instead of the tool's normal cur/last pair: 2023-24 = 5%, 2024-25 = 15%,
// 2025-26 = 80%. Source stats come from the MoneyPuck skater import (Player.mpSkater,
// already fetched for all three seasons for the Next Gen engine). No extra boost is
// applied — this is a straight recompute of the calculator's own params, nothing more.
//
// Every other UNHL field (FG/DI/SK/ST/EN/DU/PH/FO/PS/EX/LD/overall, all goalie
// fields) is untouched: the calculator never covered them, so there's no formula to
// rerun for them.

import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { SPEC, lookup, posOf, projectDFFromRates, type Pos } from "./param-projection";

const SEASON_WEIGHT: Record<string, number> = { "2023": 0.05, "2024": 0.15, "2025": 0.80 };

type MpAll = {
  gp: number; g: number; a1: number; a2: number; hits: number; tk: number; gv: number; blk: number;
  ong: number; onGaAll: number; toi4v5: number; offIceToi4v5: number;
};

function weightedRate(seasons: Record<string, MpAll>, pick: (m: MpAll) => number, byGp: boolean): number | null {
  let wsum = 0, wtot = 0;
  for (const [y, w] of Object.entries(SEASON_WEIGHT)) {
    const m = seasons[y];
    if (!m || m.gp <= 0) continue;
    const v = byGp ? pick(m) / m.gp : pick(m);
    wsum += v * w; wtot += w;
  }
  return wtot > 0 ? wsum / wtot : null;
}

export type RecomputeResult = { updated: number; skipped: number };

/** Recompute unhlCk/unhlSc/unhlPa/unhlDf for every skater with MoneyPuck data,
 *  using the calculator's exact formulas on a 5/15/80-weighted 3-season blend. */
export async function recomputeUnhlFromCalculator(): Promise<RecomputeResult> {
  const players = await prisma.player.findMany({
    where: { isGoalie: false, mpSkater: { not: Prisma.DbNull } },
    select: { id: true, position: true, df: true, mpSkater: true },
  });

  let updated = 0, skipped = 0;
  const CHUNK = 100;
  for (let i = 0; i < players.length; i += CHUNK) {
    const batch = players.slice(i, i + CHUNK);
    const writes = [];
    for (const p of batch) {
      const seasons = (p.mpSkater as unknown as Record<string, MpAll>) ?? {};
      const pos: Pos = posOf(p.position);

      const gRate = weightedRate(seasons, (m) => m.g, true);
      const aRate = weightedRate(seasons, (m) => m.a1 + m.a2, true);
      const hitsRate = weightedRate(seasons, (m) => m.hits, true);

      const data: Record<string, number> = {};
      if (gRate != null) data.unhlSc = lookup(pos === "D" ? SPEC[1].D : SPEC[1].F, gRate);
      if (aRate != null) data.unhlPa = lookup(pos === "D" ? SPEC[2].D : SPEC[2].F, aRate);
      if (hitsRate != null) data.unhlCk = lookup(pos === "D" ? SPEC[0].D : SPEC[0].F, hitsRate);

      // DF: blend the RATE inputs (PK-share, blocks/GP) and the RAW totals
      // (+/-, takeaways, giveaways) across the three weighted seasons, then run
      // the same composite the single-season calculator uses. Team SH-TOI is
      // recovered from the existing Next Gen fields (offIceToi4v5 + toi4v5 —
      // team total minus this player's on-ice time, plus his own).
      const shRatio = weightedRate(seasons, (m) => m.toi4v5 / Math.max(1, m.offIceToi4v5 + m.toi4v5), false);
      const blkPG = weightedRate(seasons, (m) => m.blk, true);
      const plusMinus = weightedRate(seasons, (m) => m.ong - m.onGaAll, false);
      const tk = weightedRate(seasons, (m) => m.tk, false);
      const gv = weightedRate(seasons, (m) => m.gv, false);
      if (shRatio != null && blkPG != null && plusMinus != null && tk != null && gv != null && p.df != null) {
        data.unhlDf = projectDFFromRates(pos, { shRatio, blkPG, plusMinus, tk, gv, currentDF: p.df });
      }

      if (Object.keys(data).length === 0) { skipped++; continue; }
      updated++;
      writes.push(prisma.player.update({ where: { id: p.id }, data }));
    }
    if (writes.length) await prisma.$transaction(writes);
  }
  return { updated, skipped };
}
