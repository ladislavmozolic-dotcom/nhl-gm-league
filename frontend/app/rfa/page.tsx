import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { arbitrationComparables, ensureRfaCases, resolveExpiredQODueDates } from "@/lib/rfa-server";
import { PageHeader, Card } from "@/components/ui";
import RfaDashboard from "@/components/RfaDashboard";

export const dynamic = "force-dynamic";

export default async function RfaPage() {
  const teamId = await getTeamSession();
  if (!teamId) return <main className="mx-auto max-w-4xl px-4 py-6"><PageHeader title="RFA Central" subtitle="Qualifying offers, arbitration and offer-sheet risk" /><Card><p className="text-sm text-slate-400">Sign in as a club GM to manage its restricted free agents.</p></Card></main>;
  await ensureRfaCases(teamId);
  await resolveExpiredQODueDates();
  const rows = await prisma.rfaCase.findMany({ where: { teamId }, include: { player: { select: { id: true, name: true, position: true, age: true, capHit: true, overall: true } } }, orderBy: [{ qoDueAt: "asc" }, { player: { name: "asc" } }] });
  const withDashboardData = await Promise.all(rows.map(async (r) => {
    const comparables = r.status === "ARB_FILED" ? await arbitrationComparables(r.playerId) : [];
    const offerSheetRisk = r.status === "OS_ELIGIBLE"
      ? (r.player.overall ?? 0) >= 72 ? "High" : (r.player.overall ?? 0) >= 62 ? "Medium" : "Low"
      : "Low";
    return { ...r, qoDueAt: r.qoDueAt.toISOString(), qoTenderedAt: r.qoTenderedAt?.toISOString() ?? null, offerSheetRisk: offerSheetRisk as "Low" | "Medium" | "High", comparables };
  }));
  return <main className="mx-auto max-w-4xl px-4 py-6 space-y-5">
    <PageHeader title="RFA Central" subtitle="All qualifying offers, arbitration cases and offer-sheet exposure in one place" />
    <Card><p className="text-sm text-slate-400">A normal <b>Re-sign</b> remains available throughout the final contract year. Tendering the QO preserves RFA rights; missing it releases the player to UFA. Arbitration is optional, and an award can only be walked away from when it meets the league threshold.</p></Card>
    {rows.length ? <RfaDashboard rows={withDashboardData} teamId={teamId} /> : <Card><p className="text-sm text-slate-500">No RFAs with expiring contracts right now.</p></Card>}
  </main>;
}
