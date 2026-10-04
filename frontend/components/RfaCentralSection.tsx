import { prisma } from "@/lib/prisma";
import { arbitrationRange, ensureRfaCases, resolveExpiredQODueDates } from "@/lib/rfa-server";
import { Card } from "@/components/ui";
import RfaDashboard from "@/components/RfaDashboard";

// RFA Central body, shared by /rfa (league view for admins) and Team Contracts.
// `teamId` = any club of the organization (NHL or its farm); omit for the whole league.
// AHL players are always shown under their NHL parent, so there are only 32 groups.
export default async function RfaCentralSection({ teamId }: { teamId?: number }) {
  let orgIds: number[] | undefined;
  if (teamId) {
    const me = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, parentTeamId: true } });
    const parentId = me?.parentTeamId ?? teamId;
    const kids = await prisma.team.findMany({ where: { parentTeamId: parentId }, select: { id: true } });
    orgIds = [parentId, ...kids.map((t) => t.id)];
    await Promise.all(orgIds.map((id) => ensureRfaCases(id)));
  } else {
    await ensureRfaCases(undefined);
  }
  await resolveExpiredQODueDates();
  const rows = await prisma.rfaCase.findMany({
    where: orgIds ? { teamId: { in: orgIds } } : undefined,
    include: {
      player: { select: { id: true, name: true, position: true, age: true, capHit: true, overall: true } },
      team: { select: { id: true, code: true, name: true, isAffiliate: true, parentTeamId: true, parentTeam: { select: { id: true, code: true, name: true } } } },
    },
    orderBy: [{ qoDueAt: "asc" }, { player: { name: "asc" } }],
  });
  const data = await Promise.all(rows.map(async (r) => {
    const arb = r.status === "ARB_FILED" ? await arbitrationRange(r.playerId, r.qoAmount) : null;
    const comparables = arb?.comps ?? [];
    const range = arb ? { low: arb.low, high: arb.high } : null;
    const ovr = r.player.overall ?? 0;
    const offerSheetRisk = r.status === "OS_ELIGIBLE" ? (ovr >= 72 ? "High" : ovr >= 62 ? "Medium" : "Low") : "Low";
    const { parentTeam, parentTeamId, id: _id, ...team } = r.team;
    const org = parentTeam ?? { id: r.team.id, code: r.team.code, name: r.team.name };
    return {
      ...r, team, org,
      qoDueAt: r.qoDueAt.toISOString(), qoTenderedAt: r.qoTenderedAt?.toISOString() ?? null,
      offerSheetRisk: offerSheetRisk as "Low" | "Medium" | "High", comparables, range,
    };
  }));
  return data.length
    ? <RfaDashboard rows={data} leagueView={!teamId} />
    : <Card><p className="text-sm text-slate-500">No RFAs with expiring contracts right now.</p></Card>;
}
