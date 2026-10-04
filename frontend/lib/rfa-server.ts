import "server-only";

import { prisma } from "@/lib/prisma";
import { getLeagueDate } from "@/lib/calendar-server";
import { loadSettings } from "@/lib/sim/settings";
import { ufaAtExpiry } from "@/lib/free-agency-server";
import { CURRENT_SEASON_START } from "@/lib/finance";

export const RFA_OPEN_STATUSES = ["QO_DUE", "QO_TENDERED", "NEGOTIATING", "ARB_FILED", "AWARDED", "OS_ELIGIBLE"];

function expirySeason(p: { contractExpiry: number | null; contractYears: number | null }) {
  return p.contractExpiry ?? (CURRENT_SEASON_START + Math.max(0, p.contractYears ?? 0));
}

export function qoDueDate(season: number, day: number) {
  return new Date(Date.UTC(season, 5, Math.max(1, Math.min(30, day))));
}

/** Creates missing cases idempotently. This lets the feature roll out to live leagues
 * without requiring a one-off data migration before the first dashboard visit. */
export async function ensureRfaCases(teamId?: number) {
  const settings = await loadSettings();
  if (settings.faMode === "simple") return 0;
  const players = await prisma.player.findMany({
    where: {
      ...(teamId ? { teamId } : {}), rosterType: { in: ["NHL", "AHL", "NONROSTER"] },
      contractYears: { not: null, lte: 1 }, NOT: { capHit: 100_000 },
    },
    select: { id: true, teamId: true, capHit: true, contractExpiry: true, contractYears: true, age: true, birthDate: true, rightsReleased: true, lastSeasonGP: true },
  });
  let created = 0;
  const today = await getLeagueDate();
  for (const p of players) {
    if (ufaAtExpiry(p)) continue;
    const season = expirySeason(p);
    // The qualifying-offer window is an off-season deadline. If the league is already past it
    // (e.g. this feature went live mid-season), opening a case now would hand every club an
    // already-overdue QO and the next deadline sweep would cut its RFAs loose — so no case.
    if (qoDueDate(season, settings.rfaQoDeadlineDay) < today) continue;
    const qo = Math.max(settings.rfaQoMin, Math.round(((p.capHit ?? 0) * settings.rfaQoPct) / 100 / 50_000) * 50_000);
    const eligible = (p.age ?? 0) >= settings.arbMinAge || (p.lastSeasonGP ?? 0) >= settings.arbMinLastSeasonGp;
    const r = await prisma.rfaCase.upsert({
      where: { playerId_season: { playerId: p.id, season } },
      update: { teamId: p.teamId, qoAmount: qo, qoDueAt: qoDueDate(season, settings.rfaQoDeadlineDay), arbEligible: eligible },
      create: { playerId: p.id, teamId: p.teamId, season, qoAmount: qo, qoDueAt: qoDueDate(season, settings.rfaQoDeadlineDay), arbEligible: eligible },
    });
    if (r.createdAt.getTime() === r.updatedAt.getTime()) created++;
  }
  return created;
}

/** A missed QO relinquishes rights. An expired player becomes a normal UFA now;
 * a final-year player is marked for release when his contract runs out. */
export async function resolveExpiredQODueDates(now?: Date) {
  const effectiveNow = now ?? await getLeagueDate();
  const stale = await prisma.rfaCase.findMany({
    where: { status: "QO_DUE", qoDueAt: { lt: effectiveNow } },
    include: { player: { select: { contractYears: true } } },
  });
  for (const c of stale) {
    // a case opened AFTER its own deadline never gave the club a chance to tender — leave it be
    if (c.createdAt > c.qoDueAt) continue;
    await prisma.$transaction([
      prisma.rfaCase.update({ where: { id: c.id }, data: { status: "UFA", resolvedAt: effectiveNow } }),
      prisma.player.update({ where: { id: c.playerId }, data: { rightsReleased: true, franchiseTag: false, resignStatus: "walkedToUFA", ...(c.player.contractYears === 0 ? { rosterType: "UFA" } : {}) } }),
    ]);
  }
  return stale.length;
}

export async function arbitrationComparables(playerId: number) {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { position: true, isGoalie: true, age: true, overall: true, capHit: true } });
  if (!p) return [];
  const peers = await prisma.player.findMany({
    where: { id: { not: playerId }, rosterType: { in: ["NHL", "AHL"] }, contractYears: { gt: 0 }, capHit: { gt: 0 }, isGoalie: p.isGoalie },
    select: { id: true, name: true, position: true, age: true, overall: true, capHit: true, contractYears: true, lastSeasonGP: true, lastSeasonPts: true, lastSeasonSvPct: true },
    take: 120,
  });
  return peers
    .filter((x) => p.isGoalie || x.position === p.position)
    .sort((a, b) => {
      const da = Math.abs((a.overall ?? 0) - (p.overall ?? 0)) * 3 + Math.abs((a.age ?? 0) - (p.age ?? 0));
      const db = Math.abs((b.overall ?? 0) - (p.overall ?? 0)) * 3 + Math.abs((b.age ?? 0) - (p.age ?? 0));
      return da - db;
    }).slice(0, 6);
}

export async function arbitrationRange(playerId: number, qo: number) {
  const comps = await arbitrationComparables(playerId);
  const salaries = comps.map((p) => p.capHit ?? 0).filter(Boolean).sort((a, b) => a - b);
  const median = salaries.length ? salaries[Math.floor(salaries.length / 2)] : qo;
  return { comps, low: Math.max(qo, Math.round(median * 0.80 / 50_000) * 50_000), high: Math.max(qo, Math.round(median * 1.20 / 50_000) * 50_000) };
}

// ── CBA rule: when must a QO be one-way? ──────────────────────────────────────
// A club MUST tender a one-way QO to a player who, simultaneously, (1) played 180+ NHL
// games over the last 3 seasons, (2) played 60+ NHL games last season and (3) was not
// on waivers since the start of camp. Anyone else may get a two-way QO.
export const QO_ONE_WAY_GP_3Y = 180;
export const QO_ONE_WAY_GP_LAST = 60;

export type QoFormInfo = { oneWayRequired: boolean; gp3: number; gpLast: number; waived: boolean };

type QoFormPlayer = { id: number; lastSeasonGP: number | null; mpSkater: unknown; careerGP: unknown };

/** Games over the last 3 seasons: MoneyPuck per-season totals when present; goalies/others
 *  without them fall back to career regular-season games (an upper bound), then last season. */
function gamesLast3(p: QoFormPlayer): number {
  const last = p.lastSeasonGP ?? 0;
  const mp = p.mpSkater as Record<string, { gp?: number }> | null;
  if (mp && typeof mp === "object") {
    const seasons = Object.keys(mp).map(Number).filter(Number.isFinite).sort((a, b) => b - a).slice(0, 3);
    if (seasons.length) return Math.max(last, seasons.reduce((n, y) => n + (mp[String(y)]?.gp ?? 0), 0));
  }
  const career = (p.careerGP as { reg?: number } | null)?.reg;
  return Math.max(last, typeof career === "number" ? career : 0);
}

/** Batch version — one waiver query for all players. "Since camp" is approximated by the
 *  last 365 days of recorded waiver placements. */
export async function qoFormInfo(players: QoFormPlayer[]): Promise<Map<number, QoFormInfo>> {
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000);
  const waivers = players.length ? await prisma.transaction.findMany({
    where: { type: "WAIVER", playerId: { in: players.map((p) => p.id) }, createdAt: { gte: since }, message: { contains: "placed on waivers" } },
    select: { playerId: true },
  }) : [];
  const waived = new Set(waivers.map((w) => w.playerId));
  return new Map(players.map((p) => {
    const gp3 = gamesLast3(p), gpLast = p.lastSeasonGP ?? 0, w = waived.has(p.id);
    return [p.id, { oneWayRequired: gp3 >= QO_ONE_WAY_GP_3Y && gpLast >= QO_ONE_WAY_GP_LAST && !w, gp3, gpLast, waived: w }];
  }));
}

export function qoOneWayMessage(i: QoFormInfo) {
  return `The CBA requires a one-way QO for him: ${i.gp3} NHL games in the last 3 seasons (180+), ${i.gpLast} last season (60+), no waivers. A two-way is only possible for players who miss one of these.`;
}
