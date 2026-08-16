import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { canManageTeam } from "@/lib/auth";
import { Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

const M = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-slate-700/40 text-slate-300 border-slate-600/40" },
  COUNTERED: { label: "He countered", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  SHORTLISTED: { label: "Shortlisted", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  ACCEPTED: { label: "Signed ✓", cls: "bg-green-500/15 text-green-300 border-green-500/30" },
  REJECTED: { label: "Out", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  WITHDRAWN: { label: "Withdrawn", cls: "bg-slate-700/40 text-slate-500 border-slate-600/40" },
};

export default async function TeamFreeAgentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!team) notFound();

  const canManage = await canManageTeam(team.id);
  if (!canManage) {
    return (
      <Card title="Free Agents" accent="text-amber-400">
        <p className="text-sm text-slate-500">Only {team.name}&apos;s GM manages free-agent offers. Browse the market on the <Link href="/free-agents" className="text-blue-400 hover:underline">Free Agent Frenzy board</Link>.</p>
      </Card>
    );
  }

  const offers = await prisma.faOffer.findMany({ where: { teamId: team.id, status: { notIn: ["WITHDRAWN"] } }, orderBy: { updatedAt: "desc" } });
  const players = await prisma.player.findMany({ where: { id: { in: offers.map((o) => o.playerId) } }, select: { id: true, name: true, position: true, slug: true } });
  const pById = new Map(players.map((p) => [p.id, p]));

  return (
    <div className="space-y-5">
      <Card title="Your Free-Agent Offers" accent="text-amber-400"
        >
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-500">Your standing offers and where each negotiation stands. Make or raise offers on the board.</p>
          <Link href="/free-agents" className="shrink-0 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium">Free Agent Board →</Link>
        </div>
        {offers.length === 0 ? (
          <p className="text-sm text-slate-500">No active offers. Head to the <Link href="/free-agents" className="text-blue-400 hover:underline">board</Link> to bid on free agents.</p>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {offers.map((o) => {
              const p = pById.get(o.playerId);
              const st = STATUS[o.status] ?? STATUS.PENDING;
              return (
                <div key={o.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    {p?.slug ? <Link href={`/players/${p.slug}`} className="text-sm font-semibold hover:text-blue-400">{cleanName(p?.name ?? "")}</Link> : <span className="text-sm font-semibold">{cleanName(p?.name ?? "")}</span>}
                    <span className="ml-1.5 text-[11px] text-slate-500">{p?.position}</span>
                    <div className="text-xs text-slate-400 tabular-nums">Your offer {M(o.salary)} × {o.years}yr{o.grantClause ? ` · ${o.grantClause === "M_NTC" ? "M-NTC" : o.grantClause}` : ""}
                      {o.status === "COUNTERED" && o.counterSalary ? <span className="text-blue-300"> · he wants {M(o.counterSalary)} × {o.counterYears}yr</span> : null}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
