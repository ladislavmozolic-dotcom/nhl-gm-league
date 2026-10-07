// Waivers — a club must expose a player on waivers before he can be sent to the
// AHL; other clubs may claim him during a one-day window (priority = reverse
// standings, worst team first — EXCEPT a club that has won a more recent claim
// than another contender drops behind it regardless of standings, in every
// phase; see waiverOrderCompare). If nobody claims, he clears and drops to the
// affiliate. A no-movement clause (NMC) blocks waivers entirely; a no-trade
// clause (NTC) does NOT — the player can still be waived.

import { prisma } from "./prisma";
import { loadSettings } from "./sim/settings";
import { getLeagueDate, computePhase } from "./calendar-server";
import { roundForDate, daysBetween } from "./calendar";
import { computeStandings } from "./sim/standings";
import { cleanName } from "./playerName";
import { CURRENT_SEASON_START, liveCapHit } from "./finance";
import { WAIVER_CAP_HIT_LIMIT, RECALL_EXEMPT_DAYS, RECALL_EXEMPT_GAMES } from "./roster-rules";
import type { Phase } from "./calendar";

export type WaiverRow = {
  id: number;
  playerId: number;
  playerName: string;
  playerSlug: string | null;
  position: string;
  capHit: number;
  photoUrl?: string | null;
  overall?: number | null;
  age?: number | null;
  contractYears?: number | null;
  fromTeamId: number;
  fromCode: string;
  fromName?: string;
  fromLogoUrl?: string | null;
  placedDay: number;
  placedAt: Date;
  clause: string | null;
  claims: { teamId: number; code: string; name?: string; logoUrl?: string | null }[];
};

export type WaiverPriorityRow = { teamId: number; code: string; name: string; logoUrl: string | null; rank: number };

/** Shared ordering rule for both the display list (waiverPriorityOrder) and
 *  actual claim resolution (processWaivers): a club that has won a more
 *  recent claim than another contender drops BEHIND it, full stop — this
 *  holds in every phase, not just the off-season queue, so a club can't keep
 *  winning claim after claim just because its standings stay the worst. Only
 *  once neither side has a "fresher" claim than the other (both null, or an
 *  exact tie) do we fall back to the phase's normal tiebreak: reverse
 *  standings in-season, else claim-submission order. */
type WaiverOrderEntrant = { id: number; lastWaiverClaimAt: Date | null };
function waiverOrderCompare(
  a: WaiverOrderEntrant,
  b: WaiverOrderEntrant,
  useStandings: boolean,
  priority: Map<number, number>,
  fallbackTie: (a: WaiverOrderEntrant, b: WaiverOrderEntrant) => number,
): number {
  const la = a.lastWaiverClaimAt, lb = b.lastWaiverClaimAt;
  if (la || lb) {
    if (!la) return -1; // a has never claimed — ahead of b, who has
    if (!lb) return 1; // b has never claimed — ahead of a, who has
    if (la.getTime() !== lb.getTime()) return la.getTime() - lb.getTime(); // more recent claim sorts later (further back)
  }
  if (useStandings) return (priority.get(b.id) ?? -1) - (priority.get(a.id) ?? -1) || a.id - b.id;
  return fallbackTie(a, b);
}

/** Full-league waiver-claim priority order, first-in-line first — the SAME
 *  ordering processWaivers uses to resolve a contested claim (reverse
 *  standings in-season, a claim-order queue otherwise, with the "drops to
 *  back after winning" override from waiverOrderCompare layered on top in
 *  both), just computed for every club instead of one contested waiver so a
 *  GM can see where their club stands in line before claiming. */
export async function waiverPriorityOrder(phase: Phase): Promise<WaiverPriorityRow[]> {
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, code: true, name: true, logoUrl: true, lastWaiverClaimAt: true },
  });
  const useStandings = phase === "regular" || phase === "playoffs";
  const standings = useStandings ? await computeStandings() : [];
  const priority = new Map(standings.map((s, i) => [s.teamId, i])); // 0 = best
  const ordered = [...teams].sort((a, b) => waiverOrderCompare(a, b, useStandings, priority, (x, y) => x.id - y.id));
  return ordered.map((t, i) => ({ teamId: t.id, code: t.code ?? String(t.id), name: t.name, logoUrl: t.logoUrl, rank: i + 1 }));
}

export type RecallExemption = { exempt: boolean; daysUsed: number; gamesUsed: number; daysLeft: number; gamesLeft: number };

/** Rule 30/10 recall pass — is this player still riding a free (no-waivers)
 *  trip back to the farm? Only meaningful for a player with a lastRecalledAt
 *  stamp (set by saveRosterMoves whenever a move calls him up from the AHL).
 *  Days are league-calendar days since that call-up; games are NHL games
 *  actually played since then, counted lazily off PlayerGameStat rather than
 *  a live incrementing counter — same "compute on demand" pattern the rest of
 *  the calendar/waiver code uses (roundForDate, daysBetween). Batched so a
 *  whole roster page needs one query, not one per player. */
export async function recallExemptions(players: { id: number; lastRecalledAt: Date | null }[]): Promise<Map<number, RecallExemption>> {
  const map = new Map<number, RecallExemption>();
  const NONE: RecallExemption = { exempt: false, daysUsed: 0, gamesUsed: 0, daysLeft: 0, gamesLeft: 0 };
  const withRecall = players.filter((p): p is { id: number; lastRecalledAt: Date } => p.lastRecalledAt != null);
  for (const p of players) if (p.lastRecalledAt == null) map.set(p.id, NONE);
  if (withRecall.length === 0) return map;

  const today = await getLeagueDate();
  const earliest = withRecall.reduce((min, p) => (p.lastRecalledAt < min ? p.lastRecalledAt : min), withRecall[0].lastRecalledAt);
  const stats = await prisma.playerGameStat.findMany({
    where: { playerId: { in: withRecall.map((p) => p.id) }, game: { league: "NHL", gameDate: { gte: earliest } } },
    select: { playerId: true, game: { select: { gameDate: true } } },
  });
  const gamesByPlayer = new Map<number, Date[]>();
  for (const s of stats) {
    if (!s.game?.gameDate) continue;
    const arr = gamesByPlayer.get(s.playerId) ?? [];
    arr.push(s.game.gameDate);
    gamesByPlayer.set(s.playerId, arr);
  }
  for (const p of withRecall) {
    const daysUsed = daysBetween(p.lastRecalledAt, today);
    const gamesUsed = (gamesByPlayer.get(p.id) ?? []).filter((d) => d >= p.lastRecalledAt).length;
    const exempt = daysUsed <= RECALL_EXEMPT_DAYS && gamesUsed <= RECALL_EXEMPT_GAMES;
    map.set(p.id, {
      exempt, daysUsed, gamesUsed,
      daysLeft: Math.max(0, RECALL_EXEMPT_DAYS - daysUsed), gamesLeft: Math.max(0, RECALL_EXEMPT_GAMES - gamesUsed),
    });
  }
  return map;
}

/** Active waivers for the wire, newest first. */
export async function activeWaivers(): Promise<WaiverRow[]> {
  const waivers = await prisma.waiver.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, include: { claims: true } });
  if (waivers.length === 0) return [];
  const players = await prisma.player.findMany({
    where: { id: { in: waivers.map((w) => w.playerId) } },
    select: {
      id: true,
      name: true,
      slug: true,
      position: true,
      capHit: true,
      contractYears: true,
      tradeClause: true,
      photoUrl: true,
      nhlId: true,
      age: true,
      overall: true,
    },
  });
  const pById = new Map(players.map((p) => [p.id, p]));
  const teamIds = new Set<number>();
  for (const w of waivers) { teamIds.add(w.fromTeamId); w.claims.forEach((c) => teamIds.add(c.teamId)); }
  const teams = await prisma.team.findMany({
    where: { id: { in: [...teamIds] } },
    select: { id: true, code: true, name: true, logoUrl: true },
  });
  const tMap = new Map(teams.map((t) => [t.id, t]));
  return waivers.map((w) => {
    const p = pById.get(w.playerId);
    const fromTeam = tMap.get(w.fromTeamId);
    const photo = p?.photoUrl ?? (p?.nhlId ? `https://assets.nhle.com/mugs/nhl/latest/${p.nhlId}/168x168.png` : null);
    return {
      id: w.id,
      playerId: w.playerId,
      playerName: cleanName(p?.name ?? ""),
      playerSlug: p?.slug ?? null,
      photoUrl: photo,
      position: p?.position ?? "",
      capHit: p ? liveCapHit(p) : 0,
      contractYears: p?.contractYears ?? null,
      age: p?.age ?? null,
      overall: p?.overall ?? null,
      fromTeamId: w.fromTeamId,
      fromCode: fromTeam?.code ?? String(w.fromTeamId),
      fromName: fromTeam?.name ?? "",
      fromLogoUrl: fromTeam?.logoUrl ?? null,
      placedDay: w.placedDay,
      placedAt: w.placedAt,
      clause: p?.tradeClause ?? null,
      claims: w.claims.map((c) => {
        const ct = tMap.get(c.teamId);
        return {
          teamId: c.teamId,
          code: ct?.code ?? String(c.teamId),
          name: ct?.name ?? "",
          logoUrl: ct?.logoUrl ?? null,
        };
      }),
    };
  });
}

/** Place a player on waivers. NMC blocks it; NTC is allowed. */
export async function placeOnWaivers(playerId: number, actorTeamId: number): Promise<{ ok: boolean; error?: string }> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { teamId: true, rosterType: true, tradeClause: true, name: true, capHit: true, contractYears: true } });
  if (!p) return { ok: false, error: "Player not found." };
  if (p.teamId !== actorTeamId) return { ok: false, error: "That player isn't on your team." };
  if (p.rosterType !== "NHL") return { ok: false, error: "Only an NHL player goes through waivers." };
  const settings = await loadSettings();
  if (!settings.waiversEnabled) return { ok: false, error: "Waivers are turned off in this league — send players down freely from the roster mover." };
  if (settings.clausesEnabled && p.tradeClause === "NMC") return { ok: false, error: `${cleanName(p.name)} has a no-movement clause — he can't be waived.` };
  if (liveCapHit(p) > WAIVER_CAP_HIT_LIMIT) return { ok: false, error: `${cleanName(p.name)} carries a $${(WAIVER_CAP_HIT_LIMIT / 1e6).toFixed(1)}M+ cap hit — too valuable to waive to the farm.` };
  const existing = await prisma.waiver.findUnique({ where: { playerId } });
  if (existing && existing.status === "ACTIVE") return { ok: false, error: "He's already on waivers." };
  const day = roundForDate(await getLeagueDate());
  const now = new Date();
  const fromTeam = await prisma.team.findUnique({ where: { id: actorTeamId }, select: { code: true } });
  const teamTag = fromTeam?.code ? ` (${fromTeam.code})` : "";
  await prisma.$transaction([
    existing
      ? prisma.waiver.update({ where: { playerId }, data: { status: "ACTIVE", fromTeamId: actorTeamId, placedDay: day, placedAt: now, claimedByTeamId: null, resolvedAt: null } })
      : prisma.waiver.create({ data: { playerId, fromTeamId: actorTeamId, placedDay: day, placedAt: now } }),
    prisma.waiverClaim.deleteMany({ where: { waiver: { playerId } } }),
    prisma.player.update({ where: { id: playerId }, data: { waiverStatus: "ON_WAIVERS" } }),
    prisma.transaction.create({ data: { type: "WAIVER", playerId, teamId: actorTeamId, message: `${cleanName(p.name)}${teamTag} was placed on waivers.` } }),
  ]);
  return { ok: true };
}

/** Another club claims a waived player (resolved by priority when the window closes). */
export async function claimWaiver(waiverId: number, teamId: number): Promise<{ ok: boolean; error?: string }> {
  const w = await prisma.waiver.findUnique({ where: { id: waiverId } });
  if (!w || w.status !== "ACTIVE") return { ok: false, error: "That waiver is no longer active." };
  if (w.fromTeamId === teamId) return { ok: false, error: "You can't claim your own player." };

  // Same rule as a trade: a club that retained salary on this player can't get
  // him back (trade OR waivers) until the ban has run out, unless the specific
  // contract it retained on has since fully expired.
  const settings = await loadSettings();
  const history = await prisma.buyout.findMany({
    where: { playerId: w.playerId, teamId, totalCost: 0 },
    select: { startYear: true, years: true, leagueDate: true, createdAt: true },
  });
  if (history.length) {
    const nowLeagueDate = await getLeagueDate();
    const stillBlocked = history.find((r) => {
      if (CURRENT_SEASON_START >= r.startYear + r.years) return false; // that contract's retention has run out
      return daysBetween(r.leagueDate ?? r.createdAt, nowLeagueDate) < settings.retentionReacquireBanDays;
    });
    if (stillBlocked) {
      const daysLeft = settings.retentionReacquireBanDays - daysBetween(stillBlocked.leagueDate ?? stillBlocked.createdAt, nowLeagueDate);
      return { ok: false, error: `Your club retained salary on this player — ${daysLeft} day(s) left before you can reclaim him.` };
    }
  }

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
 *  no error anywhere. placedAt is a real wall-clock timestamp immune to that —
 *  and, unlike createdAt, it's refreshed every time this row is reused for a
 *  repeat trip (one Waiver row per player, ever), so a player waived a second
 *  time doesn't inherit his FIRST placement's age and get resolved almost
 *  instantly by this safety net instead of waiting out the real one-day window. */
export async function processWaivers(currentDay: number, phase: Phase): Promise<{ claimed: number; cleared: number; details: string[] }> {
  const staleCutoff = new Date(Date.now() - 48 * 3600 * 1000);
  const due = await prisma.waiver.findMany({
    where: { status: "ACTIVE", OR: [{ placedDay: { lt: currentDay } }, { placedAt: { lt: staleCutoff } }] },
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
      const fromTeam = tById.get(w.fromTeamId);
      const fromTag = fromTeam?.code ? ` (${fromTeam.code})` : "";
      if (w.claims.length > 0) {
        // a club that won a more recent claim drops behind one that hasn't, in every
        // phase (waiverOrderCompare); only once neither side is "fresher" does the
        // phase's normal tiebreak (standings in-season, else earliest claim) decide
        const winner = [...w.claims].sort((a, b) =>
          waiverOrderCompare(
            { id: a.teamId, lastWaiverClaimAt: tById.get(a.teamId)?.lastWaiverClaimAt ?? null },
            { id: b.teamId, lastWaiverClaimAt: tById.get(b.teamId)?.lastWaiverClaimAt ?? null },
            useStandings,
            priority,
            () => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
          )
        )[0];
        await prisma.$transaction([
          // a new organization just claimed him — the old club's trade-block listing doesn't carry over
          prisma.player.update({ where: { id: w.playerId }, data: { teamId: winner.teamId, rosterType: "NHL", waiverStatus: "NONE", captaincy: null, onBlock: false, blockNote: null } }),
          prisma.waiver.update({ where: { id: w.id }, data: { status: "CLAIMED", claimedByTeamId: winner.teamId, resolvedAt: new Date() } }),
          // move the winner to the back of the line for next time — now actually
          // consulted in-season too (waiverOrderCompare checks this before standings)
          prisma.team.update({ where: { id: winner.teamId }, data: { lastWaiverClaimAt: new Date() } }),
          prisma.transaction.create({ data: { type: "WAIVER", playerId: w.playerId, teamId: winner.teamId, message: `${tById.get(winner.teamId)?.code ?? "A club"} claimed ${name}${fromTag} off waivers from ${tById.get(w.fromTeamId)?.code ?? "?"}.` } }),
        ]);
        // keep the in-memory queue state current so a second waiver resolved in this
        // same batch also sees this club as just-claimed, not its stale pre-batch spot
        const wTeam = tById.get(winner.teamId);
        if (wTeam) wTeam.lastWaiverClaimAt = new Date();
        claimed++; details.push(`${name} → ${tById.get(winner.teamId)?.code} (claimed)`);
      } else {
        // cleared → drop to the placing club's AHL affiliate (if any)
        const affiliate = fromTeam?.affiliateTeams[0]?.id ?? null;
        await prisma.$transaction([
          prisma.player.update({ where: { id: w.playerId }, data: affiliate ? { teamId: affiliate, rosterType: "AHL", waiverStatus: "CLEARED" } : { waiverStatus: "CLEARED" } }),
          prisma.waiver.update({ where: { id: w.id }, data: { status: "CLEARED", resolvedAt: new Date() } }),
          prisma.transaction.create({ data: { type: "WAIVER", playerId: w.playerId, teamId: w.fromTeamId, message: `${name}${fromTag} cleared waivers${affiliate ? " and was assigned to the AHL" : ""}.` } }),
        ]);
        cleared++; details.push(`${name} cleared${affiliate ? " → AHL" : ""}`);
      }
  }
  return { claimed, cleared, details };
}
