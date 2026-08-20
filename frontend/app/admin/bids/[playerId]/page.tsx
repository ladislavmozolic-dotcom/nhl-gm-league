import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

const fmtM = (c: number) => `$${(c / 1e6).toFixed(2)}M`;
const fmtDate = (d: Date) => d.toLocaleString("sk-SK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Admin: the full UFA bidding trail for a player — every offer/raise from every club,
// oldest first, plus how it ended. Reachable from Latest Signings (click the player).
export default async function AdminBidsPage({ params }: { params: Promise<{ playerId: string }> }) {
  if (!(await isAdmin())) redirect("/");
  const { playerId } = await params;
  const pid = Number(playerId);
  const player = Number.isFinite(pid) ? await prisma.player.findUnique({ where: { id: pid }, select: { id: true, name: true, slug: true, rosterType: true, capHit: true, contractYears: true, team: { select: { code: true, name: true } } } }) : null;
  if (!player) notFound();

  const [bids, offers] = await Promise.all([
    prisma.faBid.findMany({ where: { playerId: pid }, orderBy: { id: "asc" } }),
    prisma.faOffer.findMany({ where: { playerId: pid } }),
  ]);
  const teamIds = [...new Set([...bids.map((b) => b.teamId), ...offers.map((o) => o.teamId)])];
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, code: true } });
  const code = new Map(teams.map((t) => [t.id, t.code]));
  const accepted = offers.find((o) => o.status === "ACCEPTED");

  return (
    <div className="space-y-5 py-2">
      <PageHeader
        title={`${cleanName(player.name)} — Bidding Trail`}
        subtitle="Every offer & raise on this free agent, oldest first (admin view)."
        right={<Link href="/admin/signings" className="text-sm text-slate-400 hover:text-blue-400">← Latest Signings</Link>}
      />

      <Card>
        <p className="text-sm text-slate-300">
          {player.rosterType === "NHL" || player.rosterType === "AHL"
            ? <>Signed with <b>{player.team?.code ?? player.team?.name ?? "—"}</b>{player.capHit ? <> — {fmtM(player.capHit)} × {player.contractYears ?? "?"}yr</> : null}{accepted ? <> (accepted {code.get(accepted.teamId) ?? "?"}'s offer)</> : null}.</>
            : <>Still on the market ({player.rosterType}).</>}
          {" "}<Link href={`/players/${player.slug ?? player.id}`} className="text-blue-400 hover:text-blue-300">Player profile →</Link>
        </p>
      </Card>

      <Card bodyClassName="p-0">
        {bids.length === 0 ? (
          <p className="text-center text-slate-500 py-10 text-sm">No bids logged for this player. (The bid log records offers placed after the feature went live.)</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-3 py-3 font-medium">Club</th>
                  <th className="text-right px-3 py-3 font-medium">Bid</th>
                  <th className="text-center px-3 py-3 font-medium">Round</th>
                  <th className="text-right px-4 py-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {bids.map((b, i) => {
                  const won = accepted && b.teamId === accepted.teamId;
                  return (
                    <tr key={b.id} className={`border-b border-slate-800/40 last:border-0 ${won ? "bg-emerald-950/20" : "hover:bg-slate-800/30"}`}>
                      <td className="px-4 py-2.5 text-slate-500 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium">{code.get(b.teamId) ?? "?"}{won && <span className="ml-1.5 text-[10px] text-emerald-400 font-bold">✓ SIGNED</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtM(b.salary)} × {b.years}yr</td>
                      <td className="px-3 py-2.5 text-center text-slate-500 tabular-nums">{b.round || "—"}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums whitespace-nowrap">{fmtDate(b.createdAt)}</td>
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
