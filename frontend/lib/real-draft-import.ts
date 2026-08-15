// Import a REAL, completed NHL Entry Draft (results — who was picked where) from the
// public NHL API and store it as DraftProspect rows tagged source="real". These show
// only in real-roster mode's Draft History (see lib/draft-source.ts), never mixing
// with this league's own drafts. Durable + reusable so a DB reset can re-seed.

import { prisma } from "./prisma";

const API = "https://api-web.nhle.com/v1/draft/picks";
const UA = { "User-Agent": "Mozilla/5.0" };
// franchise continuity so old drafts map to today's clubs
const ALIAS: Record<string, string> = { ARI: "UTA", PHX: "UTA", ARIZONA: "UTA" };

const mapPos = (c: string) => (c === "L" ? "LW" : c === "R" ? "RW" : c); // C, D, G stay
const isNA = (cc: string | null) => cc === "CAN" || cc === "USA";
const categoryOf = (pos: string, cc: string | null) => (pos === "G" ? (isNA(cc) ? 3 : 4) : isNA(cc) ? 1 : 2);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export type RealDraftImport = { year: number; inserted: number; unmatched: string[] };

/** Fetch + store the real NHL draft for a year (all 7 rounds). Replaces any prior
 *  real import for that year. Returns how many picks landed + any unmapped clubs. */
export async function importRealDraft(year: number): Promise<RealDraftImport> {
  const teams = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true } });
  const idByCode = new Map(teams.map((t) => [t.code, t.id]));
  const resolve = (code: string) => idByCode.get(ALIAS[code] ?? code) ?? null;

  const picks: any[] = [];
  for (let round = 1; round <= 7; round++) {
    const r = await fetch(`${API}/${year}/${round}`, { headers: UA });
    if (!r.ok) continue;
    const j = await r.json();
    picks.push(...(j.picks ?? []));
  }

  const unmatched = new Set<string>();
  const data = picks
    .filter((pk) => pk.lastName?.default && pk.overallPick)
    .map((pk) => {
      const teamId = resolve(pk.teamAbbrev);
      if (teamId == null) unmatched.add(pk.teamAbbrev);
      const first = pk.firstName?.default ?? "";
      const last = pk.lastName?.default ?? "";
      const cc = pk.countryCode ?? null;
      const pos = pk.positionCode ? mapPos(pk.positionCode) : "C"; // some old picks lack a position
      const ov = clamp(Math.round(66 - pk.overallPick * 0.08), 42, 68);
      return {
        draftYear: year, source: "real", firstName: first, lastName: last, name: `${first} ${last}`.trim(),
        position: pos, shoots: null, heightIn: pk.height ?? null, weightLb: pk.weight ?? null, country: cc,
        amateurClub: pk.amateurClubName ?? null, amateurLeague: pk.amateurLeague ?? null,
        category: categoryOf(pk.positionCode ?? "", cc), ov, potential: clamp(ov + Math.round((225 - pk.overallPick) / 14), ov, 90),
        draftedByTeamId: teamId, overallPick: pk.overallPick,
      };
    });

  await prisma.$transaction([
    prisma.draftProspect.deleteMany({ where: { draftYear: year, source: "real" } }),
    prisma.draftProspect.createMany({ data }),
  ]);
  return { year, inserted: data.length, unmatched: [...unmatched] };
}

/** Which real-draft years are already stored (for the admin list). */
export async function importedRealDraftYears(): Promise<{ year: number; count: number }[]> {
  const g = await prisma.draftProspect.groupBy({ by: ["draftYear"], where: { source: "real" }, _count: { _all: true }, orderBy: { draftYear: "desc" } });
  return g.map((x) => ({ year: x.draftYear, count: x._count._all }));
}
