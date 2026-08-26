// AHL → NHL League Translation Engine.
//
// Instead of a flat "AHL × 0.75" multiplier, every rate is run through a per-metric
// regression  NHLmetric = α + β·AHLmetric + γ·age  (fit from players who played both
// leagues in a similar window; see LEAGUE_EQ in config). The result is an NHL-EQUIVALENT
// SeasonStats that flows through the exact same rating pipeline as a real NHL season.
//
// Deliberately NOT translated: skating (EDGE isn't public AHL-wide → SK falls back to a
// prior/scouting input) and the advanced defensive on-ice metrics (xGA rel etc.), which
// AHL public data doesn't expose. Those parameters simply regress to the mean for AHL guys.

import { LEAGUE_EQ } from "./config";
import { clamp } from "./math";
import type { AhlSeasonStats, SeasonStats } from "./types";

const ASSUMED_TOI_PER_GAME = 900; // seconds (15:00) when AHL icetime is unknown

const tr = (metric: keyof typeof LEAGUE_EQ, ahlPer60: number, age: number): number => {
  const c = LEAGUE_EQ[metric];
  return Math.max(0, c.alpha + c.beta * ahlPer60 + c.gamma * age);
};

/** Convert AHL seasons to NHL-equivalent SeasonStats (all production folded into the 5v5 line). */
export function ahlToNhlEquivalent(ahl: AhlSeasonStats[], age: number): SeasonStats[] {
  return ahl.map((s) => {
    const toi = s.icetime && s.icetime > 0 ? s.icetime : s.gamesPlayed * ASSUMED_TOI_PER_GAME;
    const per60 = (n?: number) => (toi > 0 ? 3600 * (n ?? 0) / toi : 0);

    const g60 = tr("g60", per60(s.goals), age);
    const a1 = tr("a1_60", per60(s.primaryAssists), age);
    const a2 = tr("a2_60", per60(s.secondaryAssists), age);
    const sog = tr("sog60", per60(s.shotsOnGoal), age);
    const hits = tr("hits60", per60(s.hits), age);
    const xg = tr("xg60", per60(s.goals), age); // no AHL xG → translate off goals as a proxy

    const toH = (rate60: number) => (rate60 * toi) / 3600; // back to counts on the same TOI
    return {
      season: s.season,
      gamesPlayed: s.gamesPlayed,
      ev5v5: {
        icetime: toi,
        goals: toH(g60),
        xGoals: toH(xg),
        primaryAssists: toH(a1),
        secondaryAssists: toH(a2),
        shotsOnGoal: toH(sog),
        hits: toH(hits),
        faceoffsWon: s.faceoffsWon,
        faceoffsLost: s.faceoffsLost,
      },
    } satisfies SeasonStats;
  });
}

/** AHL translations carry extra uncertainty → damp confidence for AHL-derived ratings. */
export const AHL_CONFIDENCE_FACTOR = 0.7;
export const clampRate = clamp;
