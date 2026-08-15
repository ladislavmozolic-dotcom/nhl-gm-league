import { prisma } from "./prisma";

// A DraftProspect can belong to this league's own draft ("profinhl" / untagged) or to
// imported real NHL draft history ("real"). Every query for "the draft of a year" must
// scope to the active roster world so the two never mix — e.g. real 2026 (McKenna→TOR)
// vs the ProfiNHL 2026 draft must not both surface in the live Draft Room.
export type DraftSourceWhere = { source: "real" } | { OR: [{ source: null }, { source: "profinhl" }] };

export function draftSourceWhere(rosterMode: string | null | undefined): DraftSourceWhere {
  return rosterMode === "real" ? { source: "real" } : { OR: [{ source: null }, { source: "profinhl" }] };
}

/** Resolve the current roster mode → its DraftProspect source filter. */
export async function currentDraftSourceWhere(): Promise<DraftSourceWhere> {
  const cfg = await prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } });
  return draftSourceWhere(cfg?.rosterMode);
}
