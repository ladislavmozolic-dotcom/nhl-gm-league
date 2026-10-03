import { prisma } from "@/lib/prisma";
import { epSearchName } from "@/lib/playerName";

export const normalizeWorldName = (value: string) => epSearchName(value).replace(/\s*\([^)]*\)/g, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

type IdentityInput = {
  provider: string; externalId: string; name: string; position?: string | null;
  birthDate?: string | null; nationality?: string | null; currentTeamId?: number | null;
  epUrl?: string | null;
};

/** Resolve one real person across multiple providers/leagues. An exact unique UNHL
 * prospect match wins, so an owned player keeps one profile after moving leagues. */
export async function resolveWorldPlayer(input: IdentityInput) {
  const normalizedName = normalizeWorldName(input.name);
  const cleanInput = input.name.replace(/\s*\([^)]*\)/g, "").trim();
  const [alias, prospects, legacy, config] = await Promise.all([
    prisma.worldPlayerExternalId.findUnique({ where: { provider_externalId: { provider: input.provider, externalId: input.externalId } }, include: { player: true } }),
    prisma.prospect.findMany({
      where: {
        OR: [
          { name: { equals: input.name, mode: "insensitive" } },
          { name: { equals: cleanInput, mode: "insensitive" } },
        ],
      },
      select: { id: true, source: true, worldPlayerId: true, epUrl: true },
    }),
    prisma.worldPlayer.findUnique({ where: { externalId: `${input.provider}:${input.externalId}` } }),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } }),
  ]);
  const activeSource = config?.rosterMode === "real" ? "real" : "profinhl";
  const activeProspects = prospects.filter((item) => item.source === activeSource);
  const prospect = activeProspects.length === 1 ? activeProspects[0] : prospects.length >= 1 ? prospects[0] : null;
  let player = prospect?.worldPlayerId ? await prisma.worldPlayer.findUnique({ where: { id: prospect.worldPlayerId } }) : null;
  player ??= alias?.player ?? legacy;
  if (!player) player = await prisma.worldPlayer.create({ data: { name: cleanInput, normalizedName, position: input.position, birthDate: input.birthDate, nationality: input.nationality, currentTeamId: input.currentTeamId, epUrl: input.epUrl } });

  // Remove an old provider-specific duplicate only when nothing in UNHL owns it.
  const duplicate = alias?.player ?? legacy;
  if (duplicate && duplicate.id !== player.id) {
    const [prospectLinks, rosterLinks] = await Promise.all([
      prisma.prospect.count({ where: { worldPlayerId: duplicate.id } }),
      prisma.player.count({ where: { worldPlayerId: duplicate.id } }),
    ]);
    if (!prospectLinks && !rosterLinks) await prisma.worldPlayer.delete({ where: { id: duplicate.id } });
  }
  await prisma.worldPlayerExternalId.upsert({
    where: { provider_externalId: { provider: input.provider, externalId: input.externalId } },
    create: { provider: input.provider, externalId: input.externalId, playerId: player.id },
    update: { playerId: player.id },
  });
  player = await prisma.worldPlayer.update({ where: { id: player.id }, data: {
    name: cleanInput, normalizedName, position: input.position ?? player.position,
    birthDate: input.birthDate ?? player.birthDate, nationality: input.nationality ?? player.nationality,
    currentTeamId: input.currentTeamId ?? player.currentTeamId, epUrl: input.epUrl ?? prospect?.epUrl ?? player.epUrl,
  } });
  // Link all matching prospect rows (both profinhl and real)
  for (const p of prospects) {
    if (p.worldPlayerId !== player.id) await prisma.prospect.update({ where: { id: p.id }, data: { worldPlayerId: player.id } });
  }
  return { player, owned: Boolean(prospect), prospect };
}

/**
 * Scans all prospects in the database, normalizes names, and links any unlinked prospect
 * that matches an existing WorldPlayer uniquely.
 */
export async function reconcileAllProspects() {
  const [prospects, worldPlayers] = await Promise.all([
    prisma.prospect.findMany({ select: { id: true, name: true, worldPlayerId: true, epUrl: true } }),
    prisma.worldPlayer.findMany({ select: { id: true, name: true, normalizedName: true, epUrl: true } }),
  ]);

  const byNorm = new Map<string, typeof worldPlayers>();
  for (const wp of worldPlayers) {
    const list = byNorm.get(wp.normalizedName) ?? [];
    list.push(wp);
    byNorm.set(wp.normalizedName, list);
  }

  let linkedCount = 0;
  for (const p of prospects) {
    if (p.worldPlayerId != null) continue;
    const clean = p.name.replace(/\s*\([^)]*\)/g, "").trim();
    const norm = normalizeWorldName(clean);
    const matches = byNorm.get(norm) ?? [];
    if (matches.length === 1) {
      const wp = matches[0];
      await prisma.prospect.update({
        where: { id: p.id },
        data: { worldPlayerId: wp.id },
      });
      if (p.epUrl && !wp.epUrl) {
        await prisma.worldPlayer.update({
          where: { id: wp.id },
          data: { epUrl: p.epUrl },
        });
      }
      linkedCount++;
    }
  }

  return { reconciled: linkedCount };
}
