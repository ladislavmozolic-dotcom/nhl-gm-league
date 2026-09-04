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
import { SPEC, lookup, posOf, projectDFFromRates, SEASON_GAMES, type Pos } from "./param-projection";

const SEASON_WEIGHT: Record<string, number> = { "2023": 0.05, "2024": 0.15, "2025": 0.80 };
// A cup-of-coffee season (e.g. 1 GP) produces an unsustainable per-game rate that
// the calculator's lookup tables clamp straight to their ceiling — matches
// param-projection.ts's own ACTIVATE_AT_GP=10 threshold for "enough of a sample to
// trust". Below this many total games across the three seasons combined, skip the
// player entirely rather than publish a rating built on one hot game.
const MIN_GP = 10;
// Sample-size regression toward the position mean, applied PER SEASON before the
// fixed 5/15/80 blend — not on the total across seasons. A player who has full
// 2023-24/2024-25 seasons but only 1 GP in 2025-26 still has that single game
// carrying 80% of the blend weight; regressing it toward what a typical F/D posts
// (reliability = seasonGp/(seasonGp+K)) is what actually tames it, since a
// total-games gate can't tell "104 real games" from "1 hot game + 103 cold ones
// spread across other seasons" apart. K=20 ≈ a quarter-season.
const REGRESS_K = 20;
// A second, outer anchor: the calculator's own output for a player with a real but
// modest combined sample (e.g. 20-40 games spread thin across three seasons) still
// tends toward the LEAGUE-wide position mean once each season gets regressed —
// which systematically pulls a genuine depth player up toward what a full-time
// NHLer posts, since the pool mean doesn't know he's a 4th-liner. His own current
// STHS rating already encodes that role, so blend the calculator's number with it
// (same idea as DF's built-in 80/20 blend with the existing DF, generalized to a
// reliability that scales with how much real sample actually backs the recompute).
const ANCHOR_K = 60;
const anchorToSths = (calc: number, sths: number | null, totalGp: number): number => {
  if (sths == null) return calc;
  const rel = totalGp / (totalGp + ANCHOR_K);
  return Math.round(sths + rel * (calc - sths));
};

type MpAll = {
  gp: number; g: number; a1: number; a2: number; hits: number; tk: number; gv: number; blk: number;
  ong: number; onGaAll: number; toi4v5: number; offIceToi4v5: number;
};

const RATE_KEYS = ["gRate", "aRate", "hitsRate", "blkPG", "pmPG", "tkPG", "gvPG"] as const;
type RateKey = (typeof RATE_KEYS)[number];
type SeasonRates = Record<RateKey, number> & { shRatio: number | null; gp: number };

function seasonRates(m: MpAll): SeasonRates | null {
  if (!m || m.gp <= 0) return null;
  const teamShToi = m.offIceToi4v5 + m.toi4v5;
  return {
    gp: m.gp,
    gRate: m.g / m.gp, aRate: (m.a1 + m.a2) / m.gp, hitsRate: m.hits / m.gp, blkPG: m.blk / m.gp,
    pmPG: (m.ong - m.onGaAll) / m.gp, tkPG: m.tk / m.gp, gvPG: m.gv / m.gp,
    shRatio: teamShToi > 0 ? m.toi4v5 / teamShToi : null,
  };
}

export type RecomputeResult = { updated: number; skipped: number };

/** Recompute unhlCk/unhlSc/unhlPa/unhlDf for every skater with MoneyPuck data, using
 *  the calculator's exact formulas on a 5/15/80-weighted 3-season blend. Each
 *  season's own rate is first regressed toward the position mean by that season's
 *  own games played (see REGRESS_K above), THEN blended with the fixed weights —
 *  regressing only the total combined sample isn't enough to catch a tiny
 *  dominant-weight season sitting alongside real full seasons elsewhere. */
export async function recomputeUnhlFromCalculator(): Promise<RecomputeResult> {
  const players = await prisma.player.findMany({
    where: { isGoalie: false, mpSkater: { not: Prisma.DbNull } },
    select: { id: true, position: true, ck: true, sc: true, pa: true, df: true, mpSkater: true },
  });

  // Pass 1: gather every (player, season) row's raw per-game rates, GP-weighted
  // into F/D position pools (Σstat / Σgp — so a 1-game cameo can't skew the
  // reference mean any more than it can skew its own player's rating).
  type Row = { id: number; pos: Pos; totalGp: number; seasons: SeasonRates[]; bySeason: Record<string, SeasonRates> };
  const rows: Row[] = [];
  const poolNum: Record<Pos, Record<RateKey, number>> = { F: { gRate: 0, aRate: 0, hitsRate: 0, blkPG: 0, pmPG: 0, tkPG: 0, gvPG: 0 }, D: { gRate: 0, aRate: 0, hitsRate: 0, blkPG: 0, pmPG: 0, tkPG: 0, gvPG: 0 } };
  const poolGp: Record<Pos, number> = { F: 0, D: 0 };
  const poolShToi = { F: { num: 0, den: 0 }, D: { num: 0, den: 0 } };

  for (const p of players) {
    const seasons = (p.mpSkater as unknown as Record<string, MpAll>) ?? {};
    const pos: Pos = posOf(p.position);
    const bySeason: Record<string, SeasonRates> = {};
    let totalGp = 0;
    for (const y of Object.keys(SEASON_WEIGHT)) {
      const sr = seasonRates(seasons[y]);
      if (!sr) continue;
      bySeason[y] = sr;
      totalGp += sr.gp;
      poolGp[pos] += sr.gp;
      for (const k of RATE_KEYS) poolNum[pos][k] += sr[k] * sr.gp;
      if (sr.shRatio != null) { const m = seasons[y]; poolShToi[pos].num += m.toi4v5; poolShToi[pos].den += m.offIceToi4v5 + m.toi4v5; }
    }
    rows.push({ id: p.id, pos, totalGp, seasons: Object.values(bySeason), bySeason });
  }
  const means: Record<Pos, Record<RateKey, number | null> & { shRatio: number | null }> = {
    F: { gRate: null, aRate: null, hitsRate: null, blkPG: null, pmPG: null, tkPG: null, gvPG: null, shRatio: null },
    D: { gRate: null, aRate: null, hitsRate: null, blkPG: null, pmPG: null, tkPG: null, gvPG: null, shRatio: null },
  };
  for (const pos of ["F", "D"] as const) {
    for (const k of RATE_KEYS) means[pos][k] = poolGp[pos] > 0 ? poolNum[pos][k] / poolGp[pos] : null;
    means[pos].shRatio = poolShToi[pos].den > 0 ? poolShToi[pos].num / poolShToi[pos].den : null;
  }

  // Too small a combined sample to trust anything — fall back to a plain, unboosted
  // copy of the live STHS rating rather than an extrapolated number or the stale
  // +5%-boosted UNHL value from before this recompute.
  const bigEnough = rows.filter((r) => r.totalGp >= MIN_GP);
  const tooSmall = rows.filter((r) => r.totalGp < MIN_GP);
  const byId = new Map(players.map((p) => [p.id, p]));

  let updated = 0, skipped = 0;
  const CHUNK = 100;
  for (let i = 0; i < tooSmall.length; i += CHUNK) {
    const writes = tooSmall.slice(i, i + CHUNK).map((r) => {
      const p = byId.get(r.id)!;
      const data: Record<string, number> = {};
      if (p.ck != null) data.unhlCk = p.ck;
      if (p.sc != null) data.unhlSc = p.sc;
      if (p.pa != null) data.unhlPa = p.pa;
      if (p.df != null) data.unhlDf = p.df;
      if (Object.keys(data).length) { updated++; return prisma.player.update({ where: { id: p.id }, data }); }
      skipped++; return null;
    }).filter((w): w is NonNullable<typeof w> => w != null);
    if (writes.length) await prisma.$transaction(writes);
  }

  // Pass 2: regress EACH season's rate toward the position mean by its own GP, then
  // blend the regressed rates with the fixed 5/15/80 weights (renormalized over the
  // seasons actually present for this player).
  for (let i = 0; i < bigEnough.length; i += CHUNK) {
    const batch = bigEnough.slice(i, i + CHUNK);
    const writes = [];
    for (const r of batch) {
      const p = byId.get(r.id)!;
      const pos = r.pos;
      const blend = (k: RateKey): number | null => {
        let wsum = 0, wtot = 0;
        for (const [y, w] of Object.entries(SEASON_WEIGHT)) {
          const sr = r.bySeason[y]; if (!sr) continue;
          const rel = sr.gp / (sr.gp + REGRESS_K);
          const posMean = means[pos][k];
          const regressed = posMean != null ? posMean + rel * (sr[k] - posMean) : sr[k];
          wsum += regressed * w; wtot += w;
        }
        return wtot > 0 ? wsum / wtot : null;
      };
      const blendShRatio = (): number | null => {
        let wsum = 0, wtot = 0;
        for (const [y, w] of Object.entries(SEASON_WEIGHT)) {
          const sr = r.bySeason[y]; if (!sr || sr.shRatio == null) continue;
          const rel = sr.gp / (sr.gp + REGRESS_K);
          const posMean = means[pos].shRatio;
          const regressed = posMean != null ? posMean + rel * (sr.shRatio - posMean) : sr.shRatio;
          wsum += regressed * w; wtot += w;
        }
        return wtot > 0 ? wsum / wtot : null;
      };

      const gRate = blend("gRate"), aRate = blend("aRate"), hitsRate = blend("hitsRate");
      const blkPG = blend("blkPG"), pmPG = blend("pmPG"), tkPG = blend("tkPG"), gvPG = blend("gvPG");
      const shRatio = blendShRatio();

      const data: Record<string, number> = {};
      if (gRate != null) data.unhlSc = anchorToSths(lookup(pos === "D" ? SPEC[1].D : SPEC[1].F, gRate), p.sc, r.totalGp);
      if (aRate != null) data.unhlPa = anchorToSths(lookup(pos === "D" ? SPEC[2].D : SPEC[2].F, aRate), p.pa, r.totalGp);
      if (hitsRate != null) data.unhlCk = anchorToSths(lookup(pos === "D" ? SPEC[0].D : SPEC[0].F, hitsRate), p.ck, r.totalGp);
      // DF's lookup tables expect season-TOTAL plusMinus/takeaways/giveaways (as a
      // real full season would produce them), not per-game rates — scale the
      // blended per-game rate back up by a reference season length.
      if (shRatio != null && blkPG != null && pmPG != null && tkPG != null && gvPG != null && p.df != null) {
        const dfCalc = projectDFFromRates(pos, {
          shRatio, blkPG, plusMinus: pmPG * SEASON_GAMES, tk: tkPG * SEASON_GAMES, gv: gvPG * SEASON_GAMES, currentDF: p.df,
        });
        data.unhlDf = anchorToSths(dfCalc, p.df, r.totalGp);
      }

      if (Object.keys(data).length === 0) { skipped++; continue; }
      updated++;
      writes.push(prisma.player.update({ where: { id: p.id }, data }));
    }
    if (writes.length) await prisma.$transaction(writes);
  }
  return { updated, skipped };
}
