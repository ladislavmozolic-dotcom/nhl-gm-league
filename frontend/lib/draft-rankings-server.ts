// Per-GM Draft Rankings — private scouting board + draft queue. Server-side loaders
// (mutations live in app/draft/rankings/actions.ts and the auto-pick in the room).

import { prisma } from "./prisma";
import { currentDraftSourceWhere } from "./draft-source";
import { countryFlag } from "./flags";

export type BoardRow = {
  id: number;                 // DraftRanking id (stable identity for queue/reorder)
  prospectId: number | null;  // board prospect id, or null for a custom off-board entry
  custom: boolean;
  rank: number; tier: string | null; note: string | null;
  name: string; position: string; country: string | null; amateurLeague: string | null; amateurClub: string | null;
  shoots: string | null; heightIn: number | null; weightLb: number | null;
  ov: number | null; potential: number | null; csRank: number | null; epLink: string | null; flag: string;
  drafted: boolean; draftedByCode: string | null;
};

/** Draft years still worth scouting for the current source — i.e. classes that still
 *  have UNDRAFTED prospects (a fully-drafted historical class is dropped). Ascending. */
export async function scoutingYears(): Promise<number[]> {
  const src = await currentDraftSourceWhere();
  const rows = await prisma.draftProspect.findMany({ where: { draftedByTeamId: null, ...src }, select: { draftYear: true }, distinct: ["draftYear"], orderBy: { draftYear: "asc" } });
  return rows.map((r) => r.draftYear);
}

/** A GM's board for one draft year: queued rows (rank>0, ordered) then board-only (rank 0).
 *  Includes both board-linked prospects and custom off-board entries for that year. */
export async function loadBoard(teamId: number, year: number): Promise<BoardRow[]> {
  const src = await currentDraftSourceWhere();
  const rows = await prisma.draftRanking.findMany({
    where: { teamId, OR: [{ prospect: { draftYear: year, ...src } }, { draftProspectId: null, customYear: year }] },
    include: { prospect: true },
  });
  const takenBy = [...new Set(rows.map((r) => r.prospect?.draftedByTeamId).filter((x): x is number => x != null))];
  const teams = takenBy.length ? await prisma.team.findMany({ where: { id: { in: takenBy } }, select: { id: true, code: true } }) : [];
  const codeOf = new Map(teams.map((t) => [t.id, t.code]));
  const mapped: BoardRow[] = rows.map((r) => {
    if (r.prospect) {
      return {
        id: r.id, prospectId: r.prospect.id, custom: false, rank: r.rank, tier: r.tier, note: r.note,
        name: r.prospect.name, position: r.prospect.position, country: r.prospect.country, amateurLeague: r.prospect.amateurLeague, amateurClub: r.prospect.amateurClub,
        shoots: r.prospect.shoots, heightIn: r.prospect.heightIn, weightLb: r.prospect.weightLb,
        ov: r.prospect.ov, potential: r.prospect.potential, csRank: r.prospect.csRank, epLink: r.prospect.epLink, flag: countryFlag(r.prospect.country),
        drafted: r.prospect.draftedByTeamId != null, draftedByCode: r.prospect.draftedByTeamId != null ? (codeOf.get(r.prospect.draftedByTeamId) ?? null) : null,
      };
    }
    return {
      id: r.id, prospectId: null, custom: true, rank: r.rank, tier: r.tier, note: r.note,
      name: r.customName ?? "—", position: r.customPos ?? "—", country: null, amateurLeague: null, amateurClub: null,
      shoots: null, heightIn: null, weightLb: null,
      ov: null, potential: null, csRank: null, epLink: r.customEp, flag: "✍️",
      drafted: false, draftedByCode: null,
    };
  });
  const queued = mapped.filter((m) => m.rank > 0).sort((a, b) => a.rank - b.rank);
  const bench = mapped.filter((m) => m.rank === 0).sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0) || (b.ov ?? 0) - (a.ov ?? 0));
  return [...queued, ...bench];
}
