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
  for (const p of players) {
    if (ufaAtExpiry(p)) continue;
    const season = expirySeason(p);
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
