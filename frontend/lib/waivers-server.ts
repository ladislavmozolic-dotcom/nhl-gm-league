// Waivers — a club must expose a player on waivers before he can be sent to the
// AHL; other clubs may claim him during a one-day window (priority = reverse
// standings, worst team first). If nobody claims, he clears and drops to the
// affiliate. A no-movement clause (NMC) blocks waivers entirely; a no-trade
// clause (NTC) does NOT — the player can still be waived.

import { prisma } from "./prisma";
import { loadSettings } from "./sim/settings";
import { getLeagueDate, computePhase } from "./calendar-server";
import { roundForDate } from "./calendar";
import { computeStandings } from "./sim/standings";
import { cleanName } from "./playerName";
import type { Phase } from "./calendar";

export type WaiverRow = {
  id: number; playerId: number; playerName: string; playerSlug: string | null; position: string; capHit: number;
  fromTeamId: number; fromCode: string; placedDay: number; clause: string | null;
  claims: { teamId: number; code: string }[];
};

/** Active waivers for the wire, newest first. */
export async function activeWaivers(): Promise<WaiverRow[]> {
  const waivers = await prisma.waiver.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, include: { claims: true } });
  if (waivers.length === 0) return [];
  const players = await prisma.player.findMany({ where: { id: { in: waivers.map((w) => w.playerId) } }, select: { id: true, name: true, slug: true, position: true, capHit: true, tradeClause: true } });
  const pById = new Map(players.map((p) => [p.id, p]));
  const teamIds = new Set<number>();
  for (const w of waivers) { teamIds.add(w.fromTeamId); w.claims.forEach((c) => teamIds.add(c.teamId)); }
  const teams = await prisma.team.findMany({ where: { id: { in: [...teamIds] } }, select: { id: true, code: true } });
  const code = new Map(teams.map((t) => [t.id, t.code ?? String(t.id)]));
  return waivers.map((w) => {
    const p = pById.get(w.playerId);
    return {
      id: w.id, playerId: w.playerId, playerName: cleanName(p?.name ?? ""), playerSlug: p?.slug ?? null, position: p?.position ?? "", capHit: p?.capHit ?? 0,
      fromTeamId: w.fromTeamId, fromCode: code.get(w.fromTeamId) ?? "?", placedDay: w.placedDay, clause: p?.tradeClause ?? null,
      claims: w.claims.map((c) => ({ teamId: c.teamId, code: code.get(c.teamId) ?? "?" })),
    };
  });
}

// Flat cap-hit ceiling for a waiver placement — a simple stand-in for real NHL
// waiver-exemption rules (age/games-played based) until something more nuanced is
// built. A player above this is too valuable to realistically clear waivers to the
// farm this way, so the placement is blocked outright rather than let it happen and
// almost certainly get claimed.
const WAIVER_CAP_HIT_LIMIT = 1_500_000;

/** Place a player on waivers. NMC blocks it; NTC is allowed. */
export async function placeOnWaivers(playerId: number, actorTeamId: number): Promise<{ ok: boolean; error?: string }> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true, rosterType: true, tradeClause: true, name: true, capHit: true } });
  if (!p) return { ok: false, error: "Player not found." };
  if (p.teamId !== actorTeamId) return { ok: false, error: "That player isn't on your team." };
  if (p.rosterType !== "NHL") return { ok: false, error: "Only an NHL player goes through waivers." };
  const settings = await loadSettings();
  if (!settings.waiversEnabled) return { ok: false, error: "Waivers are turned off in this league — send players down freely from the roster mover." };
  if (settings.clausesEnabled && p.tradeClause === "NMC") return { ok: false, error: `${cleanName(p.name)} has a no-movement clause — he can't be waived.` };
  if ((p.capHit ?? 0) > WAIVER_CAP_HIT_LIMIT) return { ok: false, error: `${cleanName(p.name)} carries a $${(WAIVER_CAP_HIT_LIMIT / 1e6).toFixed(1)}M+ cap hit — too valuable to waive to the farm.` };
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

/** Resolve every waiver whose one-day window has closed (placedDay < currentDay).
 *  Claimed → in the regular season/playoffs, the worst-standings claimant gets
 *  him (real waiver-priority logic only makes sense once standings mean
 *  something); any other phase (off-season, Frenzy, preseason) instead uses a
 *  claim-order queue — whichever claiming club has gone longest without
 *  winning a contested claim gets him (ties broken by who claimed first), and
 *  the winner drops to the back of that line for next time. Unclaimed players
 *  clear to the placing club's AHL affiliate. Called from the calendar
 *  day-advance.
 *
 *  Also resolves anything ACTIVE for more than 48 real hours regardless of its
 *  placedDay, as a safety net: placedDay is an index computed from the league
 *  clock (roundForDate) at the moment a player was waived, so a transient
 *  league-date corruption (it's happened — leagueDate briefly fast-forwarded
 *  months ahead during a testing session) can permanently strand a waiver on a
 *  placedDay index the calendar will never catch up to again, silently, with
 *  no error anywhere. createdAt is a real wall-clock timestamp immune to that. */
export async function processWaivers(currentDay: number, phase: Phase): Promise<{ claimed: number; cleared: number; details: string[] }> {
  const staleCutoff = new Date(Date.now() - 48 * 3600 * 1000);
  const due = await prisma.waiver.findMany({
    where: { status: "ACTIVE", OR: [{ placedDay: { lt: currentDay } }, { createdAt: { lt: staleCutoff } }] },
    include: { claims: true },
  });
  if (due.length === 0) return { claimed: 0, cleared: 0, details: [] };

  const useStandings = phase === "regular" || phase === "playoffs";
  const standings = useStandings ? await computeStandings() : [];
  const priority = new Map(standings.map((s, i) => [s.teamId, i])); // index 0 = best; higher = worse (claim priority)
  const teams = await prisma.team.findMany({ select: { id: true, code: true, parentTeamId: true, affiliateTeams: { select: { id: true } }, lastWaiverClaimAt: true } });
  const tById = new Map(teams.map((t) => [t.id, t]));
  const details: string[] = [];
  let claimed = 0, cleared = 0;

  for (const w of due) {
    const player = await prisma.player.findUnique({ where: { id: w.playerId }, select: { name: true, capHit: true } });
    const name = cleanName(player?.name ?? "");
    if (w.claims.length > 0) {
      const winner = useStandings
        // worst standings (highest priority index) wins; tie → earliest claim
        ? [...w.claims].sort((a, b) => (priority.get(b.teamId) ?? -1) - (priority.get(a.teamId) ?? -1) || a.id - b.id)[0]
        // claim-order queue: never-claimed/longest-idle club first, tie → earliest claim this round
        : [...w.claims].sort((a, b) => {
            const la = tById.get(a.teamId)?.lastWaiverClaimAt ?? null;
            const lb = tById.get(b.teamId)?.lastWaiverClaimAt ?? null;
            if (la === null && lb === null) return a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id;
            if (la === null) return -1;
            if (lb === null) return 1;
            return la.getTime() - lb.getTime() || a.createdAt.getTime() - b.createdAt.getTime();
          })[0];
      await prisma.$transaction([
        // a new organization just claimed him — the old club's trade-block listing doesn't carry over
        prisma.player.update({ where: { id: w.playerId }, data: { teamId: winner.teamId, rosterType: "NHL", waiverStatus: "NONE", captaincy: null, onBlock: false, blockNote: null } }),
        prisma.waiver.update({ where: { id: w.id }, data: { status: "CLAIMED", claimedByTeamId: winner.teamId, resolvedAt: new Date() } }),
        // move the winner to the back of the claim-order queue for next time (harmless in-season, since standings decide there anyway)
        prisma.team.update({ where: { id: winner.teamId }, data: { lastWaiverClaimAt: new Date() } }),
        prisma.transaction.create({ data: { type: "WAIVER", message: `${tById.get(winner.teamId)?.code ?? "A club"} claimed ${name} off waivers from ${tById.get(w.fromTeamId)?.code ?? "?"}.` } }),
      ]);
      // keep the in-memory queue state current so a second waiver resolved in this
      // same batch also sees this club as just-claimed, not its stale pre-batch spot
      const wTeam = tById.get(winner.teamId);
      if (wTeam) wTeam.lastWaiverClaimAt = new Date();
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
