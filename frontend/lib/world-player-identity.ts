import { prisma } from "@/lib/prisma";
import { epSearchName } from "@/lib/playerName";

export const normalizeWorldName = (value: string) => epSearchName(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

type IdentityInput = {
  provider: string; externalId: string; name: string; position?: string | null;
  birthDate?: string | null; nationality?: string | null; currentTeamId?: number | null;
};

/** Resolve one real person across multiple providers/leagues. An exact unique UNHL
 * prospect match wins, so an owned player keeps one profile after moving leagues. */
export async function resolveWorldPlayer(input: IdentityInput) {
  const normalizedName = normalizeWorldName(input.name);
  const [alias, prospects, legacy, config] = await Promise.all([
    prisma.worldPlayerExternalId.findUnique({ where: { provider_externalId: { provider: input.provider, externalId: input.externalId } }, include: { player: true } }),
    prisma.prospect.findMany({ where: { name: { equals: input.name, mode: "insensitive" } }, select: { id: true, source: true, worldPlayerId: true, epUrl: true } }),
    prisma.worldPlayer.findUnique({ where: { externalId: `${input.provider}:${input.externalId}` } }),
    prisma.leagueConfig.findUnique({ where: { id: 1 }, select: { rosterMode: true } }),
  ]);
  const activeSource = config?.rosterMode === "real" ? "real" : "profinhl";
  const activeProspects = prospects.filter((item) => item.source === activeSource);
  const prospect = activeProspects.length === 1 ? activeProspects[0] : prospects.length === 1 ? prospects[0] : null;
  let player = prospect?.worldPlayerId ? await prisma.worldPlayer.findUnique({ where: { id: prospect.worldPlayerId } }) : null;
  player ??= alias?.player ?? legacy;
  if (!player) player = await prisma.worldPlayer.create({ data: { name: input.name, normalizedName, position: input.position, birthDate: input.birthDate, nationality: input.nationality, currentTeamId: input.currentTeamId } });

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
    name: input.name, normalizedName, position: input.position ?? player.position,
    birthDate: input.birthDate ?? player.birthDate, nationality: input.nationality ?? player.nationality,
    currentTeamId: input.currentTeamId ?? player.currentTeamId, epUrl: prospect?.epUrl ?? player.epUrl,
  } });
  if (prospect && prospect.worldPlayerId !== player.id) await prisma.prospect.update({ where: { id: prospect.id }, data: { worldPlayerId: player.id } });
  return { player, owned: Boolean(prospect), prospect };
}
