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

// Defensive-action map — hits / blocks / takeaways by rink zone (from the engine's
// located defensive events). Locations are modeled by zone tendency, so the map
// varies by a player's volume + role (a D blocks the slot/point; a forward hits the
// boards) rather than centimetre tracking.
export type DefCell = { zone: Zone; hits: number; blocks: number; takeaways: number; total: number };
export type DefenseMap = { hits: number; blocks: number; takeaways: number; cells: DefCell[] } | null;

export async function playerDefenseMap(playerId: number): Promise<DefenseMap> {
  const gameFilter = { season: SEASON, league: "NHL", status: "FINAL" as const, seriesId: null };
  const rows = await prisma.gameEvent.findMany({
    where: { playerId, type: { in: ["HIT", "BLOCK", "TAKEAWAY"] }, game: gameFilter },
    select: { type: true, sector: true },
  });
  if (!rows.length) return null;
  const by = new Map<Zone, { hits: number; blocks: number; takeaways: number }>();
  for (const z of ZONES) by.set(z, { hits: 0, blocks: 0, takeaways: 0 });
  for (const r of rows) {
    const z = norm(r.sector); if (!z) continue;
    const c = by.get(z)!;
    if (r.type === "HIT") c.hits++; else if (r.type === "BLOCK") c.blocks++; else c.takeaways++;
  }
  const cells: DefCell[] = ZONES.map((z) => { const c = by.get(z)!; return { zone: z, ...c, total: c.hits + c.blocks + c.takeaways }; });
  const hits = cells.reduce((t, c) => t + c.hits, 0), blocks = cells.reduce((t, c) => t + c.blocks, 0), takeaways = cells.reduce((t, c) => t + c.takeaways, 0);
  return { hits, blocks, takeaways, cells };
}

export async function playerHeatMap(playerId: number): Promise<HeatMap> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { position: true, isGoalie: true } });
  if (!p) return null;
  const isGoalie = p.isGoalie || p.position === "G";
  const gameFilter = { season: SEASON, league: "NHL", status: "FINAL" as const, seriesId: null };
  // zone arrays are stored in SECTORS order: [POINT, PERIMETER, CIRCLE, SLOT, NET_FRONT]
  const ARR: Zone[] = ["POINT", "PERIMETER", "CIRCLE", "SLOT", "NET_FRONT"];
  const sumZones = (arrs: number[][]): Map<Zone, number> => {
    const m = new Map<Zone, number>(); for (const z of ZONES) m.set(z, 0);
    for (const a of arrs) ARR.forEach((z, i) => m.set(z, (m.get(z) ?? 0) + (a[i] ?? 0)));
    return m;
  };

  if (isGoalie) {
    // FULL save map from per-game zone tallies (every shot faced/saved, all zones)
    const rows = await prisma.goalieGameStat.findMany({ where: { playerId, started: true, game: gameFilter }, select: { faceZones: true, saveZones: true } });
    const facedBy = sumZones(rows.map((r) => r.faceZones));
    const savesBy = sumZones(rows.map((r) => r.saveZones));
    const cells = ZONES.map((z) => { const f = facedBy.get(z) ?? 0, s = savesBy.get(z) ?? 0; return { zone: z, faced: f, saves: s, svPct: f ? s / f : 0 }; }).filter((c) => c.faced > 0);
    const faced = cells.reduce((t, c) => t + c.faced, 0), saves = cells.reduce((t, c) => t + c.saves, 0);
    if (!faced) return null;
    return { kind: "goalie", faced, saves, svPct: faced ? saves / faced : 0, cells };
  }

  // FULL shot map from per-game zone tallies; goals-by-zone from GOAL events
  const rows = await prisma.playerGameStat.findMany({ where: { playerId, game: gameFilter }, select: { shotZones: true } });
  const shotsBy = sumZones(rows.map((r) => r.shotZones));
  const goalEv = await prisma.gameEvent.findMany({ where: { type: "GOAL", playerId, game: gameFilter }, select: { sector: true } });
  const goalsBy = new Map<Zone, number>();
  for (const e of goalEv) { const z = norm(e.sector); if (z) goalsBy.set(z, (goalsBy.get(z) ?? 0) + 1); }
  const cells = ZONES.map((z) => { const sh = shotsBy.get(z) ?? 0, g = Math.min(sh, goalsBy.get(z) ?? 0); return { zone: z, shots: sh, goals: g, shPct: sh ? g / sh : 0 }; });
  const total = cells.reduce((t, c) => t + c.shots, 0), goals = cells.reduce((t, c) => t + c.goals, 0);
  if (!total) return null;
  const sorted = [...cells].sort((a, b) => b.shots - a.shots);
  return { kind: "skater", total, goals, cells, topZone: sorted[0]?.shots ? sorted[0].zone : null };
}
