import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";

export const dynamic = "force-dynamic";

const M = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;

export default async function SigningsPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const round = [1, 2, 3].includes(Number((await searchParams).round)) ? Number((await searchParams).round) : 1;

  // every free-agent signing, with the round it happened in (from the accepted offer)
  const accepted = await prisma.faOffer.findMany({ where: { status: "ACCEPTED" }, orderBy: { salary: "desc" } });
  const signedRound = accepted.filter((o) => (o.round || 3) === round);

  // the other (rejected) offers each signed player had — "what else was on the table"
  const rejected = await prisma.faOffer.findMany({ where: { status: "REJECTED", playerId: { in: signedRound.map((o) => o.playerId) } } });
  const otherByPlayer = new Map<number, typeof rejected>();
  for (const o of rejected) { const a = otherByPlayer.get(o.playerId) ?? []; a.push(o); otherByPlayer.set(o.playerId, a); }

  const pIds = [...new Set(signedRound.map((o) => o.playerId))];
  const tIds = [...new Set([...accepted, ...rejected].map((o) => o.teamId))];
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: pIds } }, select: { id: true, name: true, position: true, slug: true } }),
    prisma.team.findMany({ where: { id: { in: tIds } }, select: { id: true, code: true, slug: true } }),
  ]);
  const pById = new Map(players.map((p) => [p.id, p]));
  const code = new Map(teams.map((t) => [t.id, t.code ?? String(t.id)]));
  const counts = [1, 2, 3].map((r) => accepted.filter((o) => (o.round || 3) === r).length);

  const Tab = ({ r }: { r: number }) => (
    <Link href={`/signings?round=${r}`}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${round === r ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>
      Round {r} <span className="text-xs opacity-70">({counts[r - 1]})</span>
    </Link>
  );

  return (
    <div className="space-y-5 py-2">
      <PageHeader title="Free-Agent Signings" subtitle="Who signed in each frenzy round — and what else was on the table" />
      <div className="flex gap-2 flex-wrap">{[1, 2, 3].map((r) => <Tab key={r} r={r} />)}</div>

      {signedRound.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No signings in round {round} yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {signedRound.map((o) => {
            const p = pById.get(o.playerId);
            const others = (otherByPlayer.get(o.playerId) ?? []).sort((a, b) => b.salary - a.salary);
            return (
              <Card key={o.id} bodyClassName="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    {p?.slug ? <Link href={`/players/${p.slug}`} className="font-bold hover:text-blue-400">{cleanName(p?.name ?? "")}</Link> : <span className="font-bold">{cleanName(p?.name ?? "")}</span>}
                    <span className="ml-1.5 text-xs text-slate-500">{p?.position}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-emerald-400 font-semibold">✓ {code.get(o.teamId)}</span>
                    <span className="ml-2 tabular-nums text-slate-200">{M(o.salary)} × {o.years}yr</span>
                    {o.grantClause && <span className="ml-1.5 text-[10px] font-bold text-amber-400">{o.grantClause === "M_NTC" ? "M-NTC" : o.grantClause}</span>}
                  </div>
                </div>
                {others.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Also on the table</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                      {others.map((r) => <span key={r.id} className="tabular-nums"><b className="text-slate-300">{code.get(r.teamId)}</b> {M(r.salary)} × {r.years}yr</span>)}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
