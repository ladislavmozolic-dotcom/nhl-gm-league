"use server";

import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/** Commissioner override: move a player directly from his current org to another
 *  team's org, bypassing the trade-builder/acceptance flow entirely (no consent,
 *  no cap check, no clause block) — for correcting mistakes or admin-forced
 *  moves outside the normal trade system. Preserves his NHL/AHL level: an NHL
 *  player lands on the destination's NHL roster, an AHL player on its AHL
 *  affiliate. Clears captaincy/trade-block/waiver flags, same as a real trade
 *  (collectMoveOps in lib/trade-exec.ts) — a new organization's decisions don't
 *  carry over from the old one. */
export async function adminTransferPlayer(playerId: number, toTeamId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const [player, toTeam] = await Promise.all([
    prisma.player.findUnique({ where: { id: playerId }, select: { id: true, name: true, teamId: true, rosterType: true } }),
    prisma.team.findUnique({ where: { id: toTeamId }, select: { id: true, name: true, code: true, league: true, isAffiliate: true, affiliateTeams: { select: { id: true } } } }),
  ]);
  if (!player) return { ok: false as const, error: "Player not found." };
  if (!toTeam) return { ok: false as const, error: "Team not found." };
  if (player.rosterType !== "NHL" && player.rosterType !== "AHL") return { ok: false as const, error: "Only a rostered NHL/AHL player can be transferred this way." };

  const fromTeam = await prisma.team.findUnique({ where: { id: player.teamId ?? -1 }, select: { name: true } });
  const toFarm = player.rosterType === "AHL";
  const destId = toFarm ? (toTeam.affiliateTeams[0]?.id ?? toTeam.id) : toTeam.id;
  const destRoster = toFarm && toTeam.affiliateTeams[0] ? "AHL" : "NHL";

  await prisma.$transaction([
    prisma.player.update({
      where: { id: playerId },
      data: { teamId: destId, rosterType: destRoster, captaincy: null, onBlock: false, blockNote: null, waiverStatus: "NONE", scratched: false },
    }),
    prisma.transaction.create({
      data: { type: "TRADE", message: `[Admin] ${player.name} moved from ${fromTeam?.name ?? "?"} to ${toTeam.name}.` },
    }),
  ]);
  revalidatePath("/admin/roster-moves");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Same commissioner override, for a draft pick — just reassigns current
 *  ownership (teamId). ownerLogoId (who ORIGINALLY held the pick, shown on
 *  every "2027 R3"-style label even after it's changed hands) is deliberately
 *  left untouched, same as a real trade. */
export async function adminTransferPick(pickId: number, toTeamId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const [pick, toTeam] = await Promise.all([
    prisma.draftPick.findUnique({ where: { id: pickId }, select: { id: true, year: true, round: true, teamId: true } }),
    prisma.team.findUnique({ where: { id: toTeamId }, select: { id: true, name: true } }),
  ]);
  if (!pick) return { ok: false as const, error: "Pick not found." };
  if (!toTeam) return { ok: false as const, error: "Team not found." };
  const fromTeam = await prisma.team.findUnique({ where: { id: pick.teamId }, select: { name: true } });
  await prisma.$transaction([
    prisma.draftPick.update({ where: { id: pickId }, data: { teamId: toTeamId } }),
    prisma.transaction.create({
      data: { type: "TRADE", message: `[Admin] ${pick.year} Round ${pick.round} pick moved from ${fromTeam?.name ?? "?"} to ${toTeam.name}.` },
    }),
  ]);
  revalidatePath("/admin/roster-moves");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Same commissioner override, for a prospect. */
export async function adminTransferProspect(prospectId: number, toTeamId: number) {
  if (!(await isAdmin())) return { ok: false as const, error: "Admin only." };
  const [prospect, toTeam] = await Promise.all([
    prisma.prospect.findUnique({ where: { id: prospectId }, select: { id: true, name: true, teamId: true } }),
    prisma.team.findUnique({ where: { id: toTeamId }, select: { id: true, name: true } }),
  ]);
  if (!prospect) return { ok: false as const, error: "Prospect not found." };
  if (!toTeam) return { ok: false as const, error: "Team not found." };
  const fromTeam = await prisma.team.findUnique({ where: { id: prospect.teamId }, select: { name: true } });
  await prisma.$transaction([
    prisma.prospect.update({ where: { id: prospectId }, data: { teamId: toTeamId } }),
    prisma.transaction.create({
      data: { type: "TRADE", message: `[Admin] Prospect ${prospect.name} moved from ${fromTeam?.name ?? "?"} to ${toTeam.name}.` },
    }),
  ]);
  revalidatePath("/admin/roster-moves");
  revalidatePath("/", "layout");
  return { ok: true as const };
}
