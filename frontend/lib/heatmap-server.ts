// Player heat maps — where a skater shoots and scores, and where a goalie faces &
// stops shots, aggregated by rink danger-zone from the event stream (GameEvent
// SHOT/GOAL/SAVE carry a `sector`). Not centimetre-precise: 5 danger zones, the
// NHL-EDGE way of turning tracking into a legible picture.

import { prisma } from "./prisma";

const SEASON = "2026-27";
// canonical rink danger zones, high-danger → low
export const ZONES = ["NET_FRONT", "SLOT", "CIRCLE", "PERIMETER", "POINT"] as const;
export type Zone = (typeof ZONES)[number];
export const ZONE_LABEL: Record<Zone, string> = { NET_FRONT: "Net-front", SLOT: "Slot", CIRCLE: "Circles", PERIMETER: "Perimeter", POINT: "Point" };

const norm = (s: string | null): Zone | null => {
  if (!s) return null;
  const u = s.toUpperCase();
  if (u === "NET_FRONT" || u === "SLOT" || u === "CIRCLE" || u === "PERIMETER" || u === "POINT") return u as Zone;
  if (u === "HIGH_SLOT") return "SLOT";
  if (u.includes("CIRCLE")) return "CIRCLE";
  return null;
};

export type ZoneCell = { zone: Zone; shots: number; goals: number; shPct: number };
export type SkaterShotMap = { kind: "skater"; total: number; goals: number; cells: ZoneCell[]; topZone: Zone | null };
export type GoalieSaveMap = { kind: "goalie"; faced: number; saves: number; svPct: number; cells: { zone: Zone; faced: number; saves: number; svPct: number }[] };
export type HeatMap = SkaterShotMap | GoalieSaveMap | null;

export async function playerHeatMap(playerId: number): Promise<HeatMap> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { position: true, isGoalie: true } });
  if (!p) return null;
  const isGoalie = p.isGoalie || p.position === "G";
  const gameFilter = { season: SEASON, league: "NHL", status: "FINAL" as const, seriesId: null };

  if (isGoalie) {
    // shots faced = SAVE events by this goalie + GOAL events against this goalie (targetId)
    const [saveEv, goalEv] = await Promise.all([
      prisma.gameEvent.findMany({ where: { type: "SAVE", playerId, game: gameFilter }, select: { sector: true } }),
      prisma.gameEvent.findMany({ where: { type: "GOAL", targetId: playerId, game: gameFilter }, select: { sector: true } }),
    ]);
    // Only high-danger SAVE events persist, so a goalie's save data exists only for
    // the danger zones (SLOT/NET_FRONT). Build faced = saves + goals-in-that-zone,
    // and ONLY keep zones that have real save data — otherwise low-danger zones would
    // show goals-only and a nonsense 0% save rate.
    const savesBy = new Map<Zone, number>(), goalsBy = new Map<Zone, number>();
    for (const e of saveEv) { const z = norm(e.sector); if (z) savesBy.set(z, (savesBy.get(z) ?? 0) + 1); }
    for (const e of goalEv) { const z = norm(e.sector); if (z) goalsBy.set(z, (goalsBy.get(z) ?? 0) + 1); }
    const cells = ZONES.filter((z) => (savesBy.get(z) ?? 0) > 0).map((z) => { const s = savesBy.get(z) ?? 0, f = s + (goalsBy.get(z) ?? 0); return { zone: z, faced: f, saves: s, svPct: f ? s / f : 0 }; });
    const faced = cells.reduce((t, c) => t + c.faced, 0), saves = cells.reduce((t, c) => t + c.saves, 0);
    if (!faced) return null;
    return { kind: "goalie", faced, saves, svPct: faced ? saves / faced : 0, cells };
  }

  const [shotEv, goalEv] = await Promise.all([
    prisma.gameEvent.findMany({ where: { type: "SHOT", playerId, game: gameFilter }, select: { sector: true } }),
    prisma.gameEvent.findMany({ where: { type: "GOAL", playerId, game: gameFilter }, select: { sector: true } }),
  ]);
  const shotsBy = new Map<Zone, number>(), goalsBy = new Map<Zone, number>();
  for (const e of shotEv) { const z = norm(e.sector); if (z) shotsBy.set(z, (shotsBy.get(z) ?? 0) + 1); }
  // a goal's shot is only persisted as SHOT if high-danger — add goals into the shot tally so shot% ≤ 100 and low-danger goals still map
  for (const e of goalEv) { const z = norm(e.sector); if (z) { goalsBy.set(z, (goalsBy.get(z) ?? 0) + 1); if ((shotsBy.get(z) ?? 0) < (goalsBy.get(z) ?? 0)) shotsBy.set(z, goalsBy.get(z) ?? 0); } }
  const cells = ZONES.map((z) => { const sh = shotsBy.get(z) ?? 0, g = goalsBy.get(z) ?? 0; return { zone: z, shots: sh, goals: g, shPct: sh ? g / sh : 0 }; });
  const total = cells.reduce((t, c) => t + c.shots, 0), goals = cells.reduce((t, c) => t + c.goals, 0);
  if (!total) return null;
  const topZone = [...cells].sort((a, b) => b.shots - a.shots)[0]?.shots ? [...cells].sort((a, b) => b.shots - a.shots)[0].zone : null;
  return { kind: "skater", total, goals, cells, topZone };
}
