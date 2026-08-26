// Demo dataset — a handful of recognisable players so the engine runs end-to-end.
// Numbers are plausible but ILLUSTRATIVE (hand-set), not scraped. Swap for real MoneyPuck /
// EDGE / injury / AHL loaders later; the shape is exactly what those loaders must emit.

import type { AhlSeasonStats, PlayerInput, SeasonStats, SituationLine } from "./types";

/** Build a situation line from per-60 rates + minutes of ice time. */
type R = Partial<{
  g: number; xg: number; sog: number; a1: number; a2: number; hits: number; gv: number;
  dzgv: number; take: number; blk: number; pen: number; minors: number; majors: number; rush: number;
}>;
function ln(toiMin: number, r: R): SituationLine {
  const h = toiMin / 60;
  return {
    icetime: Math.round(toiMin * 60),
    goals: (r.g ?? 0) * h, xGoals: (r.xg ?? 0) * h, shotsOnGoal: (r.sog ?? 0) * h,
    primaryAssists: (r.a1 ?? 0) * h, secondaryAssists: (r.a2 ?? 0) * h,
    hits: (r.hits ?? 0) * h, giveaways: (r.gv ?? 0) * h, dzGiveaways: (r.dzgv ?? 0) * h,
    takeaways: (r.take ?? 0) * h, blocks: (r.blk ?? 0) * h, penaltiesDrawn: (r.pen ?? 0) * h,
    minorsTaken: (r.minors ?? 0) * h, majorsTaken: (r.majors ?? 0) * h, rushAttempts: (r.rush ?? 0) * h,
  };
}
/** On-ice relatives are set directly on the 5v5 / PK line after building it. */
function withRel(l: SituationLine, rel: Partial<Pick<SituationLine, "xGA60Rel" | "hdXGA60Rel" | "CA60Rel">>): SituationLine {
  return { ...l, ...rel };
}
const fo = (won: number, lost: number) => ({ faceoffsWon: won, faceoffsLost: lost });

// A season factory: ev + pp (+ pk) + all aggregate.
function season(o: {
  season: string; gp: number; fights?: number;
  ev: SituationLine; pp: SituationLine; pk?: SituationLine; foWon?: number; foLost?: number;
}): SeasonStats {
  const evT = o.ev.icetime, ppT = o.pp.icetime, pkT = o.pk?.icetime ?? 0;
  const allT = evT + ppT + pkT + Math.round(evT * 0.05);
  const sum = (f: (l: SituationLine) => number | undefined) =>
    (f(o.ev) ?? 0) + (f(o.pp) ?? 0) + (o.pk ? (f(o.pk) ?? 0) : 0);
  const all: SituationLine = {
    icetime: allT,
    goals: sum((l) => l.goals), xGoals: sum((l) => l.xGoals), shotsOnGoal: sum((l) => l.shotsOnGoal),
    primaryAssists: sum((l) => l.primaryAssists), secondaryAssists: sum((l) => l.secondaryAssists),
    hits: sum((l) => l.hits), giveaways: sum((l) => l.giveaways), dzGiveaways: sum((l) => l.dzGiveaways),
    takeaways: sum((l) => l.takeaways), blocks: sum((l) => l.blocks), penaltiesDrawn: sum((l) => l.penaltiesDrawn),
    minorsTaken: sum((l) => l.minorsTaken), majorsTaken: sum((l) => l.majorsTaken), rushAttempts: sum((l) => l.rushAttempts),
    ...fo(o.foWon ?? 0, o.foLost ?? 0),
  };
  return { season: o.season, gamesPlayed: o.gp, fights: o.fights, ev5v5: o.ev, pp: o.pp, pk: o.pk, all };
}

// ── McDavid — elite skater/playmaker ────────────────────────────────────────
const mcdavid: PlayerInput = {
  bio: { id: "mcdavid", name: "Connor McDavid", pos: "C", age: 29, heightCm: 185, weightKg: 88 },
  edge: { maxSpeedMph: 24.1, bursts20: 1150, bursts22: 360, skatingMiles: 225, shotSpeedMph: 92 },
  career: { careerNhlGP: 720, careerPlayoffGP: 70, nhlSeasons: 11, shootoutGoals: 22, shootoutAttempts: 48, captaincyHistory: ["C", "C", "C"] },
  injuries: [{ season: "2025-26", gamesMissedInjury: 4, eligibleGames: 82 }, { season: "2024-25", gamesMissedInjury: 6, eligibleGames: 82 }, { season: "2023-24", gamesMissedInjury: 6, eligibleGames: 82 }],
  seasons: [
    season({ season: "2025-26", gp: 78, ev: withRel(ln(1250, { g: 1.05, xg: 0.95, sog: 9.2, a1: 1.45, a2: 0.7, hits: 1.2, gv: 2.6, dzgv: 0.3, take: 1.9, blk: 0.6, pen: 1.6, minors: 0.45, rush: 5.2 }), { xGA60Rel: 0.12, hdXGA60Rel: 0.1, CA60Rel: 2 }), pp: ln(270, { g: 1.7, xg: 1.3, sog: 8, a1: 2.7, a2: 1.2 }), foWon: 700, foLost: 720 }),
    season({ season: "2024-25", gp: 76, ev: withRel(ln(1230, { g: 1.0, xg: 0.9, sog: 9.0, a1: 1.5, a2: 0.75, hits: 1.1, gv: 2.7, dzgv: 0.3, take: 2.0, blk: 0.5, pen: 1.7, minors: 0.4, rush: 5.0 }), { xGA60Rel: 0.15, hdXGA60Rel: 0.12, CA60Rel: 3 }), pp: ln(265, { g: 1.5, xg: 1.25, sog: 7.8, a1: 2.9, a2: 1.3 }), foWon: 690, foLost: 715 }),
    season({ season: "2023-24", gp: 76, ev: withRel(ln(1240, { g: 0.95, xg: 0.88, sog: 8.8, a1: 1.55, a2: 0.72, hits: 1.0, gv: 2.8, dzgv: 0.35, take: 1.9, blk: 0.5, pen: 1.6, minors: 0.5, rush: 4.9 }), { xGA60Rel: 0.14, hdXGA60Rel: 0.1, CA60Rel: 2.5 }), pp: ln(270, { g: 1.4, xg: 1.2, sog: 7.5, a1: 3.0, a2: 1.4 }), foWon: 700, foLost: 720 }),
  ],
};

// ── MacKinnon — elite shooter/skater ─────────────────────────────────────────
const mackinnon: PlayerInput = {
  bio: { id: "mackinnon", name: "Nathan MacKinnon", pos: "C", age: 30, heightCm: 183, weightKg: 90 },
  edge: { maxSpeedMph: 23.6, bursts20: 1050, bursts22: 300, skatingMiles: 220, shotSpeedMph: 96 },
  career: { careerNhlGP: 880, careerPlayoffGP: 90, nhlSeasons: 13, shootoutGoals: 15, shootoutAttempts: 44, captaincyHistory: ["A", "A", "A"] },
  injuries: [{ season: "2025-26", gamesMissedInjury: 0, eligibleGames: 82 }, { season: "2024-25", gamesMissedInjury: 0, eligibleGames: 82 }, { season: "2023-24", gamesMissedInjury: 0, eligibleGames: 82 }],
  seasons: [
    season({ season: "2025-26", gp: 82, ev: withRel(ln(1300, { g: 1.15, xg: 1.0, sog: 12.5, a1: 1.15, a2: 0.65, hits: 1.4, gv: 2.2, dzgv: 0.25, take: 1.5, blk: 0.5, pen: 1.2, minors: 0.4, rush: 4.6 }), { xGA60Rel: -0.05, hdXGA60Rel: -0.04, CA60Rel: -1 }), pp: ln(280, { g: 1.5, xg: 1.4, sog: 11, a1: 2.1, a2: 1.0 }), foWon: 720, foLost: 760 }),
    season({ season: "2024-25", gp: 82, ev: withRel(ln(1290, { g: 1.1, xg: 0.98, sog: 12.2, a1: 1.2, a2: 0.7, hits: 1.3, gv: 2.3, dzgv: 0.25, take: 1.6, blk: 0.5, pen: 1.1, minors: 0.4, rush: 4.5 }), { xGA60Rel: -0.03, hdXGA60Rel: -0.02, CA60Rel: 0 }), pp: ln(285, { g: 1.4, xg: 1.35, sog: 10.5, a1: 2.2, a2: 1.1 }), foWon: 730, foLost: 770 }),
    season({ season: "2023-24", gp: 82, ev: withRel(ln(1295, { g: 1.05, xg: 0.95, sog: 12.0, a1: 1.25, a2: 0.72, hits: 1.2, gv: 2.4, dzgv: 0.28, take: 1.5, blk: 0.5, pen: 1.2, minors: 0.45, rush: 4.4 }), { xGA60Rel: -0.02, hdXGA60Rel: -0.01, CA60Rel: 0.5 }), pp: ln(285, { g: 1.35, xg: 1.3, sog: 10.2, a1: 2.3, a2: 1.15 }), foWon: 735, foLost: 765 }),
  ],
};

// ── Makar — elite two-way defenseman ─────────────────────────────────────────
const makar: PlayerInput = {
  bio: { id: "makar", name: "Cale Makar", pos: "D", age: 27, heightCm: 183, weightKg: 84 },
  edge: { maxSpeedMph: 23.9, bursts20: 1000, bursts22: 280, skatingMiles: 245, shotSpeedMph: 90 },
  career: { careerNhlGP: 450, careerPlayoffGP: 60, nhlSeasons: 7, shootoutGoals: 4, shootoutAttempts: 9, captaincyHistory: ["A", "A", null] },
  injuries: [{ season: "2025-26", gamesMissedInjury: 5, eligibleGames: 82 }, { season: "2024-25", gamesMissedInjury: 2, eligibleGames: 82 }, { season: "2023-24", gamesMissedInjury: 5, eligibleGames: 82 }],
  seasons: [
    season({ season: "2025-26", gp: 77, ev: withRel(ln(1650, { g: 0.42, xg: 0.32, sog: 7.0, a1: 0.85, a2: 0.55, hits: 1.0, gv: 1.8, dzgv: 0.3, take: 2.1, blk: 4.6, pen: 0.8, minors: 0.35, rush: 3.4 }), { xGA60Rel: -0.35, hdXGA60Rel: -0.3, CA60Rel: -7 }), pp: ln(240, { g: 0.9, xg: 0.7, sog: 9, a1: 1.8, a2: 1.0 }), pk: withRel(ln(60, { blk: 6 }), { xGA60Rel: -0.8 }), foWon: 0, foLost: 0 }),
    season({ season: "2024-25", gp: 80, ev: withRel(ln(1660, { g: 0.4, xg: 0.3, sog: 6.8, a1: 0.9, a2: 0.6, hits: 0.9, gv: 1.9, dzgv: 0.3, take: 2.0, blk: 4.5, pen: 0.9, minors: 0.35, rush: 3.3 }), { xGA60Rel: -0.32, hdXGA60Rel: -0.28, CA60Rel: -6.5 }), pp: ln(245, { g: 0.85, xg: 0.68, sog: 8.8, a1: 1.9, a2: 1.05 }), pk: withRel(ln(70, { blk: 6 }), { xGA60Rel: -0.7 }), foWon: 0, foLost: 0 }),
    season({ season: "2023-24", gp: 77, ev: withRel(ln(1655, { g: 0.38, xg: 0.29, sog: 6.7, a1: 0.92, a2: 0.6, hits: 0.9, gv: 2.0, dzgv: 0.32, take: 1.9, blk: 4.4, pen: 0.8, minors: 0.4, rush: 3.2 }), { xGA60Rel: -0.3, hdXGA60Rel: -0.26, CA60Rel: -6 }), pp: ln(245, { g: 0.8, xg: 0.66, sog: 8.6, a1: 2.0, a2: 1.1 }), pk: withRel(ln(65, { blk: 6 }), { xGA60Rel: -0.65 }), foWon: 0, foLost: 0 }),
  ],
};

// ── Kucherov — elite playmaker (RW) ──────────────────────────────────────────
const kucherov: PlayerInput = {
  bio: { id: "kucherov", name: "Nikita Kucherov", pos: "RW", age: 32, heightCm: 180, weightKg: 83 },
  edge: { maxSpeedMph: 22.4, bursts20: 620, bursts22: 90, skatingMiles: 205, shotSpeedMph: 88 },
  career: { careerNhlGP: 800, careerPlayoffGP: 130, nhlSeasons: 12, shootoutGoals: 10, shootoutAttempts: 30, captaincyHistory: ["A", null, null] },
  injuries: [{ season: "2025-26", gamesMissedInjury: 2, eligibleGames: 82 }, { season: "2024-25", gamesMissedInjury: 0, eligibleGames: 82 }, { season: "2023-24", gamesMissedInjury: 0, eligibleGames: 82 }],
  seasons: [
    season({ season: "2025-26", gp: 80, ev: withRel(ln(1280, { g: 0.85, xg: 0.7, sog: 8.5, a1: 1.55, a2: 0.85, hits: 0.5, gv: 3.0, dzgv: 0.35, take: 1.3, blk: 0.6, pen: 1.3, minors: 0.5, rush: 4.0 }), { xGA60Rel: 0.05, hdXGA60Rel: 0.04, CA60Rel: 1 }), pp: ln(300, { g: 1.3, xg: 1.0, sog: 8, a1: 3.2, a2: 1.4 }), foWon: 0, foLost: 0 }),
    season({ season: "2024-25", gp: 82, ev: withRel(ln(1275, { g: 0.8, xg: 0.68, sog: 8.3, a1: 1.6, a2: 0.9, hits: 0.5, gv: 3.1, dzgv: 0.35, take: 1.3, blk: 0.6, pen: 1.4, minors: 0.5, rush: 3.9 }), { xGA60Rel: 0.06, hdXGA60Rel: 0.05, CA60Rel: 1.5 }), pp: ln(305, { g: 1.2, xg: 0.98, sog: 7.8, a1: 3.3, a2: 1.5 }), foWon: 0, foLost: 0 }),
    season({ season: "2023-24", gp: 81, ev: withRel(ln(1278, { g: 0.82, xg: 0.69, sog: 8.4, a1: 1.62, a2: 0.88, hits: 0.5, gv: 3.0, dzgv: 0.34, take: 1.4, blk: 0.6, pen: 1.35, minors: 0.45, rush: 3.9 }), { xGA60Rel: 0.05, hdXGA60Rel: 0.04, CA60Rel: 1 }), pp: ln(305, { g: 1.25, xg: 0.99, sog: 7.9, a1: 3.4, a2: 1.55 }), foWon: 0, foLost: 0 }),
  ],
};

// ── Tom Wilson — physical winger (showcases CK/FG/DI) ────────────────────────
const wilson: PlayerInput = {
  bio: { id: "wilson", name: "Tom Wilson", pos: "RW", age: 32, heightCm: 191, weightKg: 100 },
  edge: { maxSpeedMph: 21.6, bursts20: 400, bursts22: 40, skatingMiles: 195, shotSpeedMph: 90 },
  career: { careerNhlGP: 780, careerPlayoffGP: 100, nhlSeasons: 12, shootoutGoals: 1, shootoutAttempts: 6, captaincyHistory: ["A", "A", null] },
  injuries: [{ season: "2025-26", gamesMissedInjury: 8, eligibleGames: 82, longTermEvents: 1 }, { season: "2024-25", gamesMissedInjury: 4, eligibleGames: 82 }, { season: "2023-24", gamesMissedInjury: 3, eligibleGames: 82 }],
  seasons: [
    season({ season: "2025-26", gp: 74, fights: 6, ev: withRel(ln(1050, { g: 0.55, xg: 0.5, sog: 6.0, a1: 0.45, a2: 0.35, hits: 11.5, gv: 1.5, dzgv: 0.3, take: 0.8, blk: 1.5, pen: 1.1, minors: 1.4, majors: 0.35, rush: 2.0 }), { xGA60Rel: -0.05, hdXGA60Rel: -0.03, CA60Rel: -1 }), pp: ln(180, { g: 0.9, xg: 0.8, sog: 6, a1: 0.8, a2: 0.5 }), foWon: 0, foLost: 0 }),
    season({ season: "2024-25", gp: 78, fights: 8, ev: withRel(ln(1080, { g: 0.5, xg: 0.48, sog: 5.8, a1: 0.5, a2: 0.35, hits: 12.0, gv: 1.5, dzgv: 0.3, take: 0.8, blk: 1.6, pen: 1.0, minors: 1.5, majors: 0.4, rush: 2.0 }), { xGA60Rel: -0.04, hdXGA60Rel: -0.02, CA60Rel: -0.5 }), pp: ln(175, { g: 0.85, xg: 0.78, sog: 5.8, a1: 0.8, a2: 0.5 }), foWon: 0, foLost: 0 }),
    season({ season: "2023-24", gp: 77, fights: 7, ev: withRel(ln(1070, { g: 0.48, xg: 0.46, sog: 5.6, a1: 0.48, a2: 0.34, hits: 11.8, gv: 1.6, dzgv: 0.32, take: 0.7, blk: 1.5, pen: 1.0, minors: 1.5, majors: 0.38, rush: 1.9 }), { xGA60Rel: -0.03, hdXGA60Rel: -0.01, CA60Rel: 0 }), pp: ln(170, { g: 0.8, xg: 0.75, sog: 5.6, a1: 0.75, a2: 0.5 }), foWon: 0, foLost: 0 }),
  ],
};

// ── An AHL scorer — exercises the league-translation engine ──────────────────
const ahlProspect: PlayerInput = {
  bio: { id: "ahl-scorer", name: "Farmhand Prospect", pos: "C", age: 21, heightCm: 185, weightKg: 86, isAhl: true },
  seasons: [],
  ahl: [
    { season: "2025-26", gamesPlayed: 68, icetime: 68 * 1080, goals: 30, primaryAssists: 25, secondaryAssists: 18, shotsOnGoal: 190, hits: 60, faceoffsWon: 420, faceoffsLost: 400 },
    { season: "2024-25", gamesPlayed: 70, icetime: 70 * 1020, goals: 22, primaryAssists: 20, secondaryAssists: 15, shotsOnGoal: 165, hits: 55, faceoffsWon: 400, faceoffsLost: 410 },
  ] as AhlSeasonStats[],
  previous: { SK: 66 }, // no EDGE for AHL → SK falls back to this prior
};

export const DEMO_PLAYERS: PlayerInput[] = [mcdavid, mackinnon, makar, kucherov, wilson, ahlProspect];
