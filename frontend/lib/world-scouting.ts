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

/** Ownership is authoritative by WorldPlayer link. A name-only match is accepted
 * only when unique on both sides, avoiding a false rights badge for namesakes. */
export async function worldScoutingMeta(players: WorldIdentity[], teamId: number | null): Promise<{ year: number; meta: Map<number, WorldScoutingMeta> }> {
  const [date, config] = await Promise.all([
    getLeagueDate(),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } }),
  ]);
  const year = date.getUTCFullYear() + (date.getUTCMonth() >= 6 ? 1 : 0);
  const source = config?.rosterMode === "real" ? "real" : "profinhl";
  const ids = players.map((p) => p.id);
  const names = [...new Set(players.map((p) => p.name))];
  const [rights, draftRows, rankings] = await Promise.all([
    prisma.prospect.findMany({ where: { OR: [{ worldPlayerId: { in: ids } }, { source, name: { in: names } }] }, select: { source: true, worldPlayerId: true, name: true, team: { select: { name: true, logoUrl: true } } } }),
    prisma.draftProspect.findMany({ where: { ...draftSourceWhere(config?.rosterMode), draftYear: year, name: { in: names } }, select: { id: true, name: true, birthDate: true, draftedByTeamId: true } }),
    teamId == null ? Promise.resolve([]) : prisma.draftRanking.findMany({ where: { teamId, OR: [{ customYear: year, draftProspectId: null }, { prospect: { draftYear: year } }] }, select: { customName: true, customBirth: true, draftProspectId: true } }),
  ]);
  const byId = new Map(rights.filter((r) => r.worldPlayerId != null).map((r) => [r.worldPlayerId!, r.team]));
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
    const age = ageOnDate(p.birthDate, date);
    const draftMatches = draftRows.filter((d) => d.name.toLocaleLowerCase() === p.name.toLocaleLowerCase() && (!d.birthDate || d.birthDate === p.birthDate));
    const draftRow = draftMatches.length === 1 ? draftMatches[0] : null;
    const drafted = draftMatches.some((d) => d.draftedByTeamId != null);
    const saved = rankings.some((r) => (draftRow && r.draftProspectId === draftRow.id) || (r.draftProspectId == null && r.customName?.toLocaleLowerCase() === p.name.toLocaleLowerCase() && r.customBirth === p.birthDate));
    meta.set(p.id, { age, rights: owner ?? null, draftable: !owner && !drafted && (age == null || age <= 23), saved });
  }
  return { year, meta };
}
