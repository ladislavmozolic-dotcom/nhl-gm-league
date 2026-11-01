// A dual F/D player (e.g. "RW/D") dresses on whichever side the GM put him in the Lines editor — the sim
// deploys him there (loadSimTeam) — so the 12F/6D/2G compliance count must use the same side.
import { prisma } from "./prisma";
import { posGroup } from "./ratingBands";

export type DressSideMap = Map<number, "F" | "D">;

/** Player id -> side the club's saved lines place him on (only players who appear in the lines). */
export async function lineSideMap(teamId: number): Promise<DressSideMap> {
  const row = await prisma.teamLines.findUnique({ where: { teamId }, select: { forwardLines: true, defensePairs: true } });
  const m: DressSideMap = new Map();
  if (!row) return m;
  for (const l of (row.forwardLines as { lw?: number | null; c?: number | null; rw?: number | null }[]) ?? []) for (const id of [l.lw, l.c, l.rw]) if (id != null) m.set(id, "F");
  for (const p of (row.defensePairs as { ld?: number | null; rd?: number | null }[]) ?? []) for (const id of [p.ld, p.rd]) if (id != null) m.set(id, "D");
  return m;
}

const isDual = (position: string | null | undefined) => /D/.test(position ?? "") && /[CWF]/.test(position ?? "");

/** F/D/G group for a dressed player; a dual F/D player follows his place in the lines. */
export function dressGroup(p: { id: number; position: string | null; isGoalie: boolean }, sides: DressSideMap): "F" | "D" | "G" {
  const g = posGroup(p.position, p.isGoalie);
  if (g === "G" || !isDual(p.position)) return g;
  return sides.get(p.id) ?? g;
}
