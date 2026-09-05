import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";
import DeleteFaOfferButton from "@/components/DeleteFaOfferButton";
import ResetResignButton from "@/components/ResetResignButton";

export const dynamic = "force-dynamic";

const ACTIVE_OFFERS = ["PENDING", "COUNTERED", "SHORTLISTED"];
const fmtM = (c: number) => `$${(c / 1e6).toFixed(2)}M`;
const fmtDate = (d: Date) => d.toLocaleString("sk-SK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function AdminAgentPage() {
  // Free Agent Frenzy: open-market standing offers (FaOffer — a rival club
  // bidding on a player who's actually reached the market).
  const rawOffers = await prisma.faOffer.findMany({ where: { status: { in: ACTIVE_OFFERS } }, orderBy: { updatedAt: "desc" } });
  const [offerPlayers, offerTeams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: rawOffers.map((o) => o.playerId) } }, select: { id: true, name: true, position: true } }),
    prisma.team.findMany({ where: { id: { in: rawOffers.map((o) => o.teamId) } }, select: { id: true, name: true, code: true } }),
  ]);
  const offerPlayerById = new Map(offerPlayers.map((p) => [p.id, p]));
  const offerTeamById = new Map(offerTeams.map((t) => [t.id, t]));
  const marketOffers = rawOffers
    .map((o) => ({ ...o, player: offerPlayerById.get(o.playerId), team: offerTeamById.get(o.teamId) }))
    .filter((o): o is typeof o & { player: NonNullable<typeof o.player>; team: NonNullable<typeof o.team> } => !!o.player && !!o.team);

  // Team Re-signings: a club's own live extension talks with its pending free
  // agent — this state lives directly on Player (resignStatus/resignRound/
  // resignOfferSalary), there's no separate offer row the way the open market has.
  const resigns = await prisma.player.findMany({
    where: { resignStatus: { in: ["open", "countered"] } },
    select: { id: true, name: true, position: true, teamId: true, resignStatus: true, resignRound: true, resignOfferSalary: true, resignCounterSalary: true, resignCounterYears: true },
    orderBy: { id: "desc" },
  });
  const resignTeams = await prisma.team.findMany({ where: { id: { in: resigns.map((p) => p.teamId).filter((id): id is number => id != null) } }, select: { id: true, name: true, code: true } });
  const resignTeamById = new Map(resignTeams.map((t) => [t.id, t]));

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="🤖 AI Agent"
        subtitle="Standing offers the free-agent negotiation engine is currently working through — clear a stuck or unwanted one."
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>}
      />

      <Card title="Free Agent Frenzy" accent="text-blue-400">
        <p className="text-xs text-slate-500 mb-3 px-4 pt-2">{marketOffers.length} open-market offer{marketOffers.length === 1 ? "" : "s"}.</p>
        {marketOffers.length === 0 ? (
          <p className="text-center text-slate-500 py-10 text-sm">Nothing active right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left px-4 py-3 font-medium">Player</th>
                  <th className="text-left px-3 py-3 font-medium">Club</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                  <th className="text-right px-3 py-3 font-medium">Offer</th>
                  <th className="text-right px-3 py-3 font-medium">Updated</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {marketOffers.map((o) => (
                  <tr key={o.id} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/admin/bids/${o.playerId}`} className="hover:text-blue-400" title="View the full bidding trail">{cleanName(o.player.name)}</Link>
                      {o.player.position && <span className="text-slate-500 text-xs ml-1.5">{o.player.position}</span>}
                    </td>
                    <td className="px-3 py-3 text-slate-400">{o.team.code ?? o.team.name}</td>
                    <td className="px-3 py-3"><span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300 font-semibold">{o.status}</span></td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtM(o.salary)} × {o.years}yr</td>
                    <td className="px-3 py-3 text-right text-slate-500 tabular-nums whitespace-nowrap">{fmtDate(o.updatedAt)}</td>
                    <td className="px-4 py-3 text-right"><DeleteFaOfferButton offerId={o.id} name={cleanName(o.player.name)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Team Re-signings" accent="text-emerald-400">
        <p className="text-xs text-slate-500 mb-3 px-4 pt-2">{resigns.length} club{resigns.length === 1 ? "" : "s"} in live extension talks with their own player.</p>
        {resigns.length === 0 ? (
          <p className="text-center text-slate-500 py-10 text-sm">Nothing active right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left px-4 py-3 font-medium">Player</th>
                  <th className="text-left px-3 py-3 font-medium">Club</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                  <th className="text-right px-3 py-3 font-medium">Club's offer</th>
                  <th className="text-right px-3 py-3 font-medium">His counter</th>
                  <th className="text-right px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {resigns.map((p) => {
                  const team = p.teamId != null ? resignTeamById.get(p.teamId) : undefined;
                  return (
                    <tr key={p.id} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/admin/bids/${p.id}`} className="hover:text-blue-400">{cleanName(p.name)}</Link>
                        {p.position && <span className="text-slate-500 text-xs ml-1.5">{p.position}</span>}
                      </td>
                      <td className="px-3 py-3 text-slate-400">{team?.code ?? team?.name ?? "—"}</td>
                      <td className="px-3 py-3">
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300 font-semibold">{p.resignStatus} · round {p.resignRound}</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.resignOfferSalary ? fmtM(p.resignOfferSalary) : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.resignCounterSalary ? `${fmtM(p.resignCounterSalary)} × ${p.resignCounterYears ?? "?"}yr` : "—"}</td>
                      <td className="px-4 py-3 text-right"><ResetResignButton playerId={p.id} name={cleanName(p.name)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
