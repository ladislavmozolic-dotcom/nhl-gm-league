import { prisma } from "@/lib/prisma";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { arbitrationComparables, ensureRfaCases, resolveExpiredQODueDates } from "@/lib/rfa-server";
import { PageHeader, Card } from "@/components/ui";
import RfaDashboard from "@/components/RfaDashboard";

export const dynamic = "force-dynamic";

export default async function RfaPage() {
  const teamId = await getTeamSession();
  if (!teamId) return <main className="mx-auto max-w-4xl px-4 py-6"><PageHeader title="RFA Central" subtitle="Qualifying offers, arbitration and offer-sheet risk" /><Card><p className="text-sm text-slate-400">Sign in as a club GM to manage its restricted free agents.</p></Card></main>;
  const [admin, myTeam] = await Promise.all([
    isAdmin(),
    prisma.team.findUnique({ where: { id: teamId }, select: { id: true, parentTeamId: true, affiliateTeams: { select: { id: true } } } }),
  ]);
  const parentId = myTeam?.parentTeamId ?? teamId;
  const affiliates = myTeam?.parentTeamId
    ? await prisma.team.findMany({ where: { parentTeamId: parentId }, select: { id: true } })
    : (myTeam?.affiliateTeams ?? []);
  const orgIds = [parentId, ...affiliates.map((t) => t.id)];
  // Admins get the whole league; club GMs get the NHL club and its affiliates.
  await ensureRfaCases(admin ? undefined : parentId);
  await Promise.all(admin ? [] : affiliates.map((t) => ensureRfaCases(t.id)));
  await resolveExpiredQODueDates();
  const rows = await prisma.rfaCase.findMany({
    where: admin ? undefined : { teamId: { in: orgIds } },
    include: { player: { select: { id: true, name: true, position: true, age: true, capHit: true, overall: true } }, team: { select: { code: true, name: true, isAffiliate: true } } },
    orderBy: [{ qoDueAt: "asc" }, { player: { name: "asc" } }],
  });
  const withDashboardData = await Promise.all(rows.map(async (r) => {
    const comparables = r.status === "ARB_FILED" ? await arbitrationComparables(r.playerId) : [];
    const offerSheetRisk = r.status === "OS_ELIGIBLE"
      ? (r.player.overall ?? 0) >= 72 ? "High" : (r.player.overall ?? 0) >= 62 ? "Medium" : "Low"
      : "Low";
    return { ...r, qoDueAt: r.qoDueAt.toISOString(), qoTenderedAt: r.qoTenderedAt?.toISOString() ?? null, offerSheetRisk: offerSheetRisk as "Low" | "Medium" | "High", comparables };
  }));
  return <main className="mx-auto max-w-4xl px-4 py-6 space-y-5">
    <PageHeader title={admin ? "RFA Central — League view" : "RFA Central — Your organization"} subtitle={admin ? "Every club's qualifying offers, arbitration cases and offer-sheet exposure" : "Your NHL club and affiliate qualifying offers, arbitration cases and offer-sheet exposure"} />
    <Card><p className="text-sm text-slate-400">A normal <b>Re-sign</b> remains available throughout the final contract year. Tendering the QO preserves RFA rights; missing it releases the player to UFA. Arbitration is optional, and an award can only be walked away from when it meets the league threshold.</p></Card>
    {rows.length ? <RfaDashboard rows={withDashboardData} /> : <Card><p className="text-sm text-slate-500">No RFAs with expiring contracts right now.</p></Card>}
  </main>;
}
