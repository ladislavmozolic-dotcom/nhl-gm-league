// Waivers — a club must expose a player on waivers before he can be sent to the
// AHL; other clubs may claim him during a one-day window (priority = reverse
// standings, worst team first). If nobody claims, he clears and drops to the
// affiliate. A no-movement clause (NMC) blocks waivers entirely; a no-trade
// clause (NTC) does NOT — the player can still be waived.

import { prisma } from "./prisma";
import { loadSettings } from "./sim/settings";
import { getLeagueDate } from "./calendar-server";
import { roundForDate } from "./calendar";
import { computeStandings } from "./sim/standings";
import { cleanName } from "./playerName";

export type WaiverRow = {
  id: number; playerId: number; playerName: string; position: string; capHit: number;
  fromTeamId: number; fromCode: string; placedDay: number; clause: string | null;
  claims: { teamId: number; code: string }[];
};

/** Active waivers for the wire, newest first. */
export async function activeWaivers(): Promise<WaiverRow[]> {
  const waivers = await prisma.waiver.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, include: { claims: true } });
  if (waivers.length === 0) return [];
  const players = await prisma.player.findMany({ where: { id: { in: waivers.map((w) => w.playerId) } }, select: { id: true, name: true, position: true, capHit: true, tradeClause: true } });
  const pById = new Map(players.map((p) => [p.id, p]));
  const teamIds = new Set<number>();
  for (const w of waivers) { teamIds.add(w.fromTeamId); w.claims.forEach((c) => teamIds.add(c.teamId)); }
  const teams = await prisma.team.findMany({ where: { id: { in: [...teamIds] } }, select: { id: true, code: true } });
  const code = new Map(teams.map((t) => [t.id, t.code ?? String(t.id)]));
  return waivers.map((w) => {
    const p = pById.get(w.playerId);
    return {
      id: w.id, playerId: w.playerId, playerName: cleanName(p?.name ?? ""), position: p?.position ?? "", capHit: p?.capHit ?? 0,
      fromTeamId: w.fromTeamId, fromCode: code.get(w.fromTeamId) ?? "?", placedDay: w.placedDay, clause: p?.tradeClause ?? null,
      claims: w.claims.map((c) => ({ teamId: c.teamId, code: code.get(c.teamId) ?? "?" })),
    };
  });
}

/** Place a player on waivers. NMC blocks it; NTC is allowed. */
export async function placeOnWaivers(playerId: number, actorTeamId: number): Promise<{ ok: boolean; error?: string }> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true, rosterType: true, tradeClause: true, name: true } });
  if (!p) return { ok: false, error: "Player not found." };
  if (p.teamId !== actorTeamId) return { ok: false, error: "That player isn't on your team." };
  if (p.rosterType !== "NHL") return { ok: false, error: "Only an NHL player goes through waivers." };
  const settings = await loadSettings();
  if (!settings.waiversEnabled) return { ok: false, error: "Waivers are turned off in this league — send players down freely from the roster mover." };
  if (settings.clausesEnabled && p.tradeClause === "NMC") return { ok: false, error: `${cleanName(p.name)} has a no-movement clause — he can't be waived.` };
  const existing = await prisma.waiver.findUnique({ where: { playerId } });
  if (existing && existing.status === "ACTIVE") return { ok: false, error: "He's already on waivers." };
  const day = roundForDate(await getLeagueDate());
  await prisma.$transaction([
    existing
      ? prisma.waiver.update({ where: { playerId }, data: { status: "ACTIVE", fromTeamId: actorTeamId, placedDay: day, claimedByTeamId: null, resolvedAt: null } })
      : prisma.waiver.create({ data: { playerId, fromTeamId: actorTeamId, placedDay: day } }),
    prisma.waiverClaim.deleteMany({ where: { waiver: { playerId } } }),
    prisma.player.update({ where: { id: playerId }, data: { waiverStatus: "ON_WAIVERS" } }),
    prisma.transaction.create({ data: { type: "WAIVER", message: `${cleanName(p.name)} was placed on waivers.` } }),
  ]);
  return { ok: true };
}

/** Another club claims a waived player (resolved by priority when the window closes). */
export async function claimWaiver(waiverId: number, teamId: number): Promise<{ ok: boolean; error?: string }> {
  const w = await prisma.waiver.findUnique({ where: { id: waiverId } });
  if (!w || w.status !== "ACTIVE") return { ok: false, error: "That waiver is no longer active." };
  if (w.fromTeamId === teamId) return { ok: false, error: "You can't claim your own player." };
  await prisma.waiverClaim.upsert({ where: { waiverId_teamId: { waiverId, teamId } }, create: { waiverId, teamId }, update: {} });
  return { ok: true };
}

/** The placing club pulls a player back before the window closes. */
export async function cancelWaiver(waiverId: number, actorTeamId: number): Promise<{ ok: boolean; error?: string }> {
  const w = await prisma.waiver.findUnique({ where: { id: waiverId }, select: { id: true, fromTeamId: true, playerId: true, status: true } });
  if (!w || w.status !== "ACTIVE") return { ok: false, error: "That waiver is no longer active." };
  if (w.fromTeamId !== actorTeamId) return { ok: false, error: "Only the placing club can pull him back." };
  await prisma.$transaction([
    prisma.waiverClaim.deleteMany({ where: { waiverId } }),
    prisma.waiver.update({ where: { id: waiverId }, data: { status: "CANCELLED", resolvedAt: new Date() } }),
    prisma.player.update({ where: { id: w.playerId }, data: { waiverStatus: "NONE" } }),
  ]);
  return { ok: true };
}

/** Resolve every waiver whose one-day window has closed (placedDay < currentDay).
 *  Claimed → the worst-standings claimant gets him (NHL); else he clears to the
 *  placing club's AHL affiliate. Called from the calendar day-advance. */
export async function processWaivers(currentDay: number): Promise<{ claimed: number; cleared: number; details: string[] }> {
  const due = await prisma.waiver.findMany({ where: { status: "ACTIVE", placedDay: { lt: currentDay } }, include: { claims: true } });
  if (due.length === 0) return { claimed: 0, cleared: 0, details: [] };

  const standings = await computeStandings();
  const priority = new Map(standings.map((s, i) => [s.teamId, i])); // index 0 = best; higher = worse (claim priority)
  const teams = await prisma.team.findMany({ select: { id: true, code: true, parentTeamId: true, affiliateTeams: { select: { id: true } } } });
  const tById = new Map(teams.map((t) => [t.id, t]));
  const details: string[] = [];
  let claimed = 0, cleared = 0;

  for (const w of due) {
    const player = await prisma.player.findUnique({ where: { id: w.playerId }, select: { name: true, capHit: true } });
    const name = cleanName(player?.name ?? "");
    if (w.claims.length > 0) {
      // worst standings (highest priority index) wins; tie → earliest claim
      const winner = [...w.claims].sort((a, b) => (priority.get(b.teamId) ?? -1) - (priority.get(a.teamId) ?? -1) || a.id - b.id)[0];
      await prisma.$transaction([
        prisma.player.update({ where: { id: w.playerId }, data: { teamId: winner.teamId, rosterType: "NHL", waiverStatus: "NONE", captaincy: null } }),
        prisma.waiver.update({ where: { id: w.id }, data: { status: "CLAIMED", claimedByTeamId: winner.teamId, resolvedAt: new Date() } }),
        prisma.transaction.create({ data: { type: "WAIVER", message: `${tById.get(winner.teamId)?.code ?? "A club"} claimed ${name} off waivers from ${tById.get(w.fromTeamId)?.code ?? "?"}.` } }),
      ]);
      claimed++; details.push(`${name} → ${tById.get(winner.teamId)?.code} (claimed)`);
    } else {
      // cleared → drop to the placing club's AHL affiliate (if any)
      const affiliate = tById.get(w.fromTeamId)?.affiliateTeams[0]?.id ?? null;
      await prisma.$transaction([
        prisma.player.update({ where: { id: w.playerId }, data: affiliate ? { teamId: affiliate, rosterType: "AHL", waiverStatus: "CLEARED" } : { waiverStatus: "CLEARED" } }),
        prisma.waiver.update({ where: { id: w.id }, data: { status: "CLEARED", resolvedAt: new Date() } }),
        prisma.transaction.create({ data: { type: "WAIVER", message: `${name} cleared waivers${affiliate ? " and was assigned to the AHL" : ""}.` } }),
      ]);
      cleared++; details.push(`${name} cleared${affiliate ? " → AHL" : ""}`);
    }
  }
  return { claimed, cleared, details };
}
