// Per-GM Draft Rankings — private scouting board + draft queue. Server-side loaders
// (mutations live in app/draft/rankings/actions.ts and the auto-pick in the room).

import { prisma } from "./prisma";
import { currentDraftSourceWhere } from "./draft-source";
import { countryFlag } from "./flags";

export type BoardRow = {
  prospectId: number; rank: number; tier: string | null; note: string | null;
  name: string; position: string; country: string | null; amateurLeague: string | null; amateurClub: string | null;
  shoots: string | null; heightIn: number | null; weightLb: number | null;
  ov: number; potential: number; csRank: number | null; flag: string;
  drafted: boolean; draftedByCode: string | null;
};

/** Draft years that have an importable class for the current source (nearest first). */
export async function scoutingYears(): Promise<number[]> {
  const src = await currentDraftSourceWhere();
  const rows = await prisma.draftProspect.findMany({ where: { ...src }, select: { draftYear: true }, distinct: ["draftYear"], orderBy: { draftYear: "asc" } });
  return rows.map((r) => r.draftYear);
}

/** A GM's board for one draft year: queued rows (rank>0, ordered) then board-only (rank 0). */
export async function loadBoard(teamId: number, year: number): Promise<BoardRow[]> {
  const src = await currentDraftSourceWhere();
  const rows = await prisma.draftRanking.findMany({
    where: { teamId, prospect: { draftYear: year, ...src } },
    include: { prospect: true },
    orderBy: [{ rank: "asc" }, { updatedAt: "asc" }], // rank 0 sorts first, so re-sort below
  });
  // team codes for any drafted-by
  const takenBy = [...new Set(rows.map((r) => r.prospect.draftedByTeamId).filter((x): x is number => x != null))];
  const teams = takenBy.length ? await prisma.team.findMany({ where: { id: { in: takenBy } }, select: { id: true, code: true } }) : [];
  const codeOf = new Map(teams.map((t) => [t.id, t.code]));
  const mapped: BoardRow[] = rows.map((r) => ({
    prospectId: r.prospect.id, rank: r.rank, tier: r.tier, note: r.note,
    name: r.prospect.name, position: r.prospect.position, country: r.prospect.country, amateurLeague: r.prospect.amateurLeague, amateurClub: r.prospect.amateurClub,
    shoots: r.prospect.shoots, heightIn: r.prospect.heightIn, weightLb: r.prospect.weightLb,
    ov: r.prospect.ov, potential: r.prospect.potential, csRank: r.prospect.csRank, flag: countryFlag(r.prospect.country),
    drafted: r.prospect.draftedByTeamId != null, draftedByCode: r.prospect.draftedByTeamId != null ? (codeOf.get(r.prospect.draftedByTeamId) ?? null) : null,
  }));
  // queued (rank>0) ordered by rank; then board-only (rank 0) by potential
  const queued = mapped.filter((m) => m.rank > 0).sort((a, b) => a.rank - b.rank);
  const bench = mapped.filter((m) => m.rank === 0).sort((a, b) => b.potential - a.potential || b.ov - a.ov);
  return [...queued, ...bench];
}
