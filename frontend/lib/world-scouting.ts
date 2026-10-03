import { prisma } from "@/lib/prisma";
import { getLeagueDate } from "@/lib/calendar-server";
import { draftSourceWhere } from "@/lib/draft-source";

type WorldIdentity = { id: number; name: string; normalizedName: string; birthDate: string | null; position: string | null };
export type WorldScoutingMeta = { age: number | null; rights: { name: string; logoUrl: string | null } | null; draftable: boolean; saved: boolean };

export function ageOnDate(birthDate: string | null, date: Date): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthDate || birth > date) return null;
  let age = date.getUTCFullYear() - birth.getUTCFullYear();
  if (date.getUTCMonth() < birth.getUTCMonth() || (date.getUTCMonth() === birth.getUTCMonth() && date.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

/** A player must still be under 24 at the draft year's June 30 cut-off.
 * This deliberately does not use the current league date: an October page is
 * scouting the following draft, while a March page is scouting the current one. */
export function draftEligibilityCutoff(draftYear: number) {
  return new Date(Date.UTC(draftYear, 5, 30));
}

/** Compute draft year from a season string (e.g. "2026-27" -> 2027). */
export function draftYearForSeason(season?: string | null): number | undefined {
  if (!season) return undefined;
  const match = season.match(/^(\d{4})-(\d{2}|\d{4})$/);
  if (!match) return undefined;
  const start = parseInt(match[1], 10);
  return start + 1;
}

/** Ownership is authoritative by WorldPlayer link. A name-only match is accepted
 * only when unique on both sides, avoiding a false rights badge for namesakes. */
export async function worldScoutingMeta(
  players: WorldIdentity[],
  teamId: number | null,
  targetDraftYear?: number | null
): Promise<{ year: number; meta: Map<number, WorldScoutingMeta> }> {
  const [date, config] = await Promise.all([
    getLeagueDate(),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } }),
  ]);
  const defaultYear = date.getUTCFullYear() + (date.getUTCMonth() >= 6 ? 1 : 0);
  const year = targetDraftYear && Number.isSafeInteger(targetDraftYear) ? targetDraftYear : defaultYear;
  const eligibilityCutoff = draftEligibilityCutoff(year);
  const source = config?.rosterMode === "real" ? "real" : "profinhl";
  const ids = players.map((p) => p.id);
  const names = [...new Set(players.map((p) => p.name))];
  const [rights, draftRows, rankings] = await Promise.all([
    prisma.prospect.findMany({
      where: { OR: [{ worldPlayerId: { in: ids } }, { source, name: { in: names } }] },
      select: { source: true, worldPlayerId: true, name: true, team: { select: { name: true, logoUrl: true } } },
    }),
    prisma.draftProspect.findMany({
      where: { ...draftSourceWhere(config?.rosterMode), name: { in: names } },
      select: { id: true, draftYear: true, name: true, birthDate: true, draftedByTeamId: true },
    }),
    teamId == null
      ? Promise.resolve([])
      : prisma.draftRanking.findMany({
          where: { teamId, OR: [{ customYear: year, draftProspectId: null }, { prospect: { draftYear: year } }] },
          select: { customName: true, customBirth: true, draftProspectId: true },
        }),
  ]);
  const byId = new Map(rights.filter((r) => r.source === source && r.worldPlayerId != null).map((r) => [r.worldPlayerId!, r.team]));
  const nameCount = new Map<string, number>();
  for (const p of players) nameCount.set(p.normalizedName, (nameCount.get(p.normalizedName) ?? 0) + 1);
  const rightsByName = new Map<string, typeof rights>();
  for (const r of rights.filter((item) => item.source === source)) {
    const key = r.name.toLocaleLowerCase();
    rightsByName.set(key, [...(rightsByName.get(key) ?? []), r]);
  }
  const meta = new Map<number, WorldScoutingMeta>();
  for (const p of players) {
    const exact = rightsByName.get(p.name.toLocaleLowerCase()) ?? [];
    const owner = byId.get(p.id) ?? (exact.length === 1 && nameCount.get(p.normalizedName) === 1 ? exact[0].team : null);
    // The age shown in Around the World is the draft-age on 30 June, which is
    // also the single authoritative eligibility rule for the Draft List:
    // A player is draft eligible only if they will NOT have reached 24 years of age
    // by 30 June of that draft year (age < 24 on 30.6.), have a known birth date,
    // are not already owned by an UNHL team, and have not been drafted.
    const age = ageOnDate(p.birthDate, eligibilityCutoff);
    const draftMatches = draftRows.filter((d) => d.name.toLocaleLowerCase() === p.name.toLocaleLowerCase() && (!d.birthDate || d.birthDate === p.birthDate));
    const draftRowForYear = draftMatches.find((d) => d.draftYear === year);
    const drafted = draftMatches.some((d) => d.draftedByTeamId != null);
    const saved = rankings.some(
      (r) =>
        (draftRowForYear && r.draftProspectId === draftRowForYear.id) ||
        (r.draftProspectId == null && r.customName?.toLocaleLowerCase() === p.name.toLocaleLowerCase() && r.customBirth === p.birthDate)
    );
    const draftable = !owner && !drafted && age != null && age < 24;
    meta.set(p.id, { age, rights: owner ?? null, draftable, saved });
  }
  return { year, meta };
}
