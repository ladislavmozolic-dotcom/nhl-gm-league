// Injury data: CURRENT (players out right now) and ALL (every injury that
// occurred this season, from the sim's INJURY event stream). Used by the
// league-wide report and each team's Injuries tab.

import { prisma } from "./prisma";
import { cleanName } from "./playerName";
import { onLtir } from "./finance";

export type CurrentInjury = {
  playerId: number; name: string; slug: string | null; position: string;
  teamId: number | null; teamCode: string | null; teamName: string | null; teamSlug: string | null; teamLogo: string | null; league: string | null;
  desc: string; daysLeft: number; severity: string;
  isGoalie: boolean; capHit: number; onLtir: boolean; // onLtir = injury drives cap relief (skater, CON < 90)
};

export type SeasonInjury = {
  id: number; playerId: number | null; name: string; slug: string | null;
  teamId: number | null; teamCode: string | null; teamName: string | null; teamSlug: string | null; teamLogo: string | null;
  part: string; mechanism: string; severity: string; days: number;
  byName: string | null; gameId: number; gameDate: Date | null; round: number | null;
};

/** Fallback severity from remaining days (legacy rows with no persisted severity). */
function severityFromDays(days: number): string {
  if (days >= 120) return "Season-ending";
  if (days >= 45) return "Long-term";
  if (days >= 20) return "Multi-week";
  if (days >= 7) return "Week-to-Week";
  return "Day-to-Day";
}

export async function currentInjuries(opts?: { teamId?: number; league?: string }): Promise<CurrentInjury[]> {
  const rows = await prisma.player.findMany({
    where: {
      injuryDaysLeft: { gt: 0 },
      ...(opts?.teamId ? { teamId: opts.teamId } : {}),
      ...(opts?.league ? { team: { league: opts.league } } : {}),
    },
    include: { team: { select: { id: true, code: true, name: true, slug: true, logoUrl: true, league: true } } },
    orderBy: { injuryDaysLeft: "desc" },
  });
  return rows.map((p) => ({
    playerId: p.id, name: cleanName(p.name), slug: p.slug, position: p.position ?? "—",
    teamId: p.team?.id ?? null, teamCode: p.team?.code ?? null, teamName: p.team?.name ?? null, teamSlug: p.team?.slug ?? null, teamLogo: p.team?.logoUrl ?? null, league: p.team?.league ?? null,
    desc: p.injuryDesc ?? "Injury", daysLeft: p.injuryDaysLeft, severity: p.injurySeverity ?? severityFromDays(p.injuryDaysLeft),
    isGoalie: p.isGoalie, capHit: p.capHit ?? 0,
    onLtir: onLtir({ capHit: p.capHit, injuryDaysLeft: p.injuryDaysLeft, condition: p.condition, isGoalie: p.isGoalie }),
  }));
}

/** Every injury that happened this season (from GameEvent INJURY records). */
export async function seasonInjuries(season: string, opts?: { teamId?: number; league?: string }): Promise<SeasonInjury[]> {
  const events = await prisma.gameEvent.findMany({
    where: {
      type: "INJURY",
      game: { season, status: "FINAL", ...(opts?.league ? { league: opts.league } : {}) },
      ...(opts?.teamId ? { teamId: opts.teamId } : {}),
    },
    include: { game: { select: { id: true, gameDate: true, round: true } } },
    orderBy: { id: "desc" },
  });
  const playerIds = [...new Set(events.flatMap((e) => [e.playerId, e.targetId]).filter((x): x is number => x != null))];
  const teamIds = [...new Set(events.map((e) => e.teamId).filter((x): x is number => x != null))];
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, name: true, slug: true } }),
    prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, code: true, name: true, slug: true, logoUrl: true } }),
  ]);
  const pById = new Map(players.map((p) => [p.id, p]));
  const tById = new Map(teams.map((t) => [t.id, t]));
  return events.map((e) => {
    const m = (e.meta ?? {}) as { part?: string; mechanism?: string; severity?: string; days?: number };
    const p = e.playerId != null ? pById.get(e.playerId) : null;
    const t = e.teamId != null ? tById.get(e.teamId) : null;
    return {
      id: e.id, playerId: e.playerId, name: p ? cleanName(p.name) : (e.playerId != null ? "—" : "—"), slug: p?.slug ?? null,
      teamId: e.teamId, teamCode: t?.code ?? null, teamName: t?.name ?? null, teamSlug: t?.slug ?? null, teamLogo: t?.logoUrl ?? null,
      part: m.part ?? "Injury", mechanism: m.mechanism ?? "—", severity: m.severity ?? "—", days: m.days ?? 0,
      byName: e.targetId != null ? (pById.get(e.targetId) ? cleanName(pById.get(e.targetId)!.name) : null) : null,
      gameId: e.game.id, gameDate: e.game.gameDate, round: e.game.round,
    };
  });
}
