import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { money } from "@/lib/finance";
import { cleanName } from "@/lib/playerName";
import { PageHeader, Card } from "@/components/ui";
import RevokeTradeButton from "@/components/RevokeTradeButton";

export const dynamic = "force-dynamic";

// Admin: every COMPLETED trade in the league, with full asset detail + a Revoke that
// reverses the deal (returns all assets to their original clubs).
export default async function AdminTradesPage() {
  if (!(await isAdmin())) redirect("/");
  const trades = await prisma.trade.findMany({ where: { status: "ACCEPTED" }, orderBy: { respondedAt: "desc" }, take: 100 });
  const [teams, assets] = await Promise.all([
    prisma.team.findMany({ select: { id: true, name: true, code: true, logoUrl: true } }),
    prisma.tradeAsset.findMany({ where: { tradeId: { in: trades.map((t) => t.id) } } }),
  ]);
  const tById = new Map(teams.map((t) => [t.id, t]));
  const [players, prospects, picks] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: assets.filter((a) => a.playerId).map((a) => a.playerId!) } }, select: { id: true, name: true } }),
    prisma.prospect.findMany({ where: { id: { in: assets.filter((a) => a.prospectId).map((a) => a.prospectId!) } }, select: { id: true, name: true } }),
    prisma.draftPick.findMany({ where: { id: { in: assets.filter((a) => a.draftPickId).map((a) => a.draftPickId!) } }, select: { id: true, year: true, round: true } }),
  ]);
  const pN = new Map(players.map((p) => [p.id, p.name])), prN = new Map(prospects.map((p) => [p.id, p.name])), pkN = new Map(picks.map((p) => [p.id, `${p.year} R${p.round}`]));
  const labels = (id: number, side: "FROM" | "TO") =>
    assets.filter((a) => a.tradeId === id && a.side === side).map((a) =>
      a.assetType === "PLAYER" ? cleanName(pN.get(a.playerId ?? -1) ?? "Player") + (a.retentionPct ? ` (${a.retentionPct}% ret.)` : "")
      : a.assetType === "PROSPECT" ? `⭐ ${cleanName(prN.get(a.prospectId ?? -1) ?? "Prospect")}`
      : a.assetType === "PICK" ? `🎫 ${pkN.get(a.draftPickId ?? -1) ?? "Pick"}`
      : a.assetType === "CASH" ? `💵 ${money(a.cashAmount ?? 0)}` : a.assetType);

  return (
    <div className="space-y-5 py-2">
      <PageHeader title="Completed Trades" subtitle="Every accepted trade — revoke one to return all assets to their original clubs." right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>} />
      {trades.length === 0 ? (
        <Card><p className="text-slate-500 text-center py-8">No completed trades yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {trades.map((t) => {
            const ft = tById.get(t.fromTeamId), tt = tById.get(t.toTeamId);
            return (
              <div key={t.id} className="bg-slate-900/70 rounded-2xl border border-slate-800 p-4">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {ft?.logoUrl && <img src={ft.logoUrl} alt="" className="w-6 h-6 object-contain" />}{ft?.code}
                    <span className="text-slate-600">⇄</span>
                    {tt?.logoUrl && <img src={tt.logoUrl} alt="" className="w-6 h-6 object-contain" />}{tt?.code}
                    <span className="text-[11px] text-slate-500 font-normal">#{t.id} · {t.respondedAt?.toLocaleDateString("sk-SK", { day: "numeric", month: "short", year: "numeric" }) ?? ""}</span>
                  </div>
                  <RevokeTradeButton tradeId={t.id} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {([[ft?.name, labels(t.id, "FROM")], [tt?.name, labels(t.id, "TO")]] as const).map(([nm, ls], k) => (
                    <div key={k} className="bg-slate-950/50 rounded-lg p-2.5">
                      <div className="text-slate-500 mb-1">{nm} sent</div>
                      {ls.length === 0 ? <div className="text-slate-600">nothing</div> : ls.map((l, i) => <div key={i} className="text-slate-200">{l}</div>)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-600">Revoke reverses the roster/cash moves and marks the trade <b>REVERTED</b>. Salary retention created by the deal isn&apos;t unwound, and an asset already traded on again is left where it is.</p>
    </div>
  );
}
