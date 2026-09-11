import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { cleanName } from "@/lib/playerName";
import { isAdmin } from "@/lib/auth";
import { evaluateTeamOffer, loadMarketPool, teamContentionMap } from "@/lib/free-agency-server";
import { deployRoleBonus, contentionBonus } from "@/lib/free-agency";

export const dynamic = "force-dynamic";

const M = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
const lineLabel = (l: number) => `L${l}`;

export default async function SigningsPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  // Admin/comish-only — reveals every club's bid on a player, which the live
  // board deliberately keeps blind from other GMs (fairness). Historical
  // signings are fair game for the commissioner to review, not for a rival GM.
  if (!(await isAdmin())) redirect("/");

  const round = [1, 2, 3].includes(Number((await searchParams).round)) ? Number((await searchParams).round) : 1;

  // every free-agent signing, with the round it happened in (from the accepted offer)
  const accepted = await prisma.faOffer.findMany({ where: { status: "ACCEPTED" }, orderBy: { salary: "desc" } });
  const signedRound = accepted.filter((o) => (o.round || 3) === round);

  // every OTHER standing offer the signed player had — any status (COUNTERED /
  // SHORTLISTED / REJECTED), not just outright REJECTED, so a still-live
  // competing bid at the moment of signing shows up too.
  const rivals = signedRound.length
    ? await prisma.faOffer.findMany({ where: { status: { not: "ACCEPTED" }, playerId: { in: signedRound.map((o) => o.playerId) } } })
    : [];
  const rivalsByPlayer = new Map<number, typeof rivals>();
  for (const o of rivals) { const a = rivalsByPlayer.get(o.playerId) ?? []; a.push(o); rivalsByPlayer.set(o.playerId, a); }

  const pIds = [...new Set(signedRound.map((o) => o.playerId))];
  const tIds = [...new Set([...accepted, ...rivals].map((o) => o.teamId))];
  const [players, teams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: pIds } }, select: { id: true, name: true, position: true, slug: true } }),
    prisma.team.findMany({ where: { id: { in: tIds } }, select: { id: true, code: true, slug: true } }),
  ]);
  const pById = new Map(players.map((p) => [p.id, p]));
  const code = new Map(teams.map((t) => [t.id, t.code ?? String(t.id)]));
  const counts = [1, 2, 3].map((r) => accepted.filter((o) => (o.round || 3) === r).length);

  // score every offer (winner + rivals) with the SAME utility function the
  // resolver used to pick the winner, so "why him" reflects the real logic
  // instead of a raw $ comparison.
  const pool = await loadMarketPool();
  const cmap = await teamContentionMap();
  type Scored = { teamId: number; salary: number; years: number; line: number; pp: boolean; pk: boolean; status: string; utility: number | null; acceptable: boolean; roleBonus: number; contBonus: number; stBonus: number };
  const scoredByPlayer = new Map<number, Scored[]>();
  for (const playerId of pIds) {
    const offers = [...(accepted.filter((o) => o.playerId === playerId)), ...(rivalsByPlayer.get(playerId) ?? [])];
    const scored: Scored[] = [];
    for (const o of offers) {
      const ev = await evaluateTeamOffer(playerId, o.teamId, o.salary, o.years, { line: o.line, pp: o.pp, pk: o.pk }, pool, cmap, round, { clause: o.grantClause, breadth: o.mNtcBreadth });
      const roleBonus = ev ? deployRoleBonus(ev.base.grp, o.line) : 0;
      const contBonus = ev ? contentionBonus(ev.base.contention) : 0;
      const stBonus = ev ? (ev.base.desired.wantPP && o.pp ? 400_000 : 0) + (ev.base.desired.wantPK && o.pk ? 300_000 : 0) : 0;
      scored.push({ teamId: o.teamId, salary: o.salary, years: o.years, line: o.line, pp: o.pp, pk: o.pk, status: o.status, utility: ev?.utility ?? null, acceptable: ev?.acceptable ?? false, roleBonus, contBonus, stBonus });
    }
    scored.sort((a, b) => (b.utility ?? -Infinity) - (a.utility ?? -Infinity));
    scoredByPlayer.set(playerId, scored);
  }

  const Tab = ({ r }: { r: number }) => (
    <Link href={`/signings?round=${r}`}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${round === r ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-400 hover:bg-slate-800"}`}>
      Round {r} <span className="text-xs opacity-70">({counts[r - 1]})</span>
    </Link>
  );

  return (
    <div className="space-y-5 py-2">
      <PageHeader title="Free-Agent Signings" subtitle="Admin view — who signed in each frenzy round, every competing bid, and why the winner beat the rest" />
      <div className="flex gap-2 flex-wrap">{[1, 2, 3].map((r) => <Tab key={r} r={r} />)}</div>

      {signedRound.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No signings in round {round} yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {signedRound.map((o) => {
            const p = pById.get(o.playerId);
            const scored = scoredByPlayer.get(o.playerId) ?? [];
            const winner = scored.find((s) => s.teamId === o.teamId);
            const runnerUp = scored.find((s) => s.teamId !== o.teamId);
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

                {scored.length > 1 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs min-w-[560px]">
                      <thead>
                        <tr className="text-[10px] text-slate-500 uppercase tracking-wide border-b border-slate-800">
                          <th className="text-left py-1.5 pr-3 font-medium">Club</th>
                          <th className="text-right py-1.5 px-2 font-medium">Offer</th>
                          <th className="text-center py-1.5 px-2 font-medium">Role</th>
                          <th className="text-center py-1.5 px-2 font-medium">ST</th>
                          <th className="text-right py-1.5 px-2 font-medium">Role bonus</th>
                          <th className="text-right py-1.5 px-2 font-medium">Contention</th>
                          <th className="text-right py-1.5 px-2 font-medium">ST bonus</th>
                          <th className="text-right py-1.5 pl-2 font-medium">Utility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scored.map((s) => {
                          const isWinner = s.teamId === o.teamId;
                          return (
                            <tr key={s.teamId} className={`border-b border-slate-800/40 last:border-0 ${isWinner ? "bg-emerald-950/20" : ""}`}>
                              <td className="py-1.5 pr-3 font-semibold">{code.get(s.teamId)}{isWinner && <span className="ml-1 text-emerald-400">✓</span>}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums">{M(s.salary)}×{s.years}</td>
                              <td className="py-1.5 px-2 text-center text-slate-400">{lineLabel(s.line)}</td>
                              <td className="py-1.5 px-2 text-center text-slate-400">{[s.pp && "PP", s.pk && "PK"].filter(Boolean).join("/") || "—"}</td>
                              <td className={`py-1.5 px-2 text-right tabular-nums ${s.roleBonus >= 0 ? "text-slate-300" : "text-rose-400"}`}>{s.roleBonus >= 0 ? "+" : ""}{M(s.roleBonus)}</td>
                              <td className={`py-1.5 px-2 text-right tabular-nums ${s.contBonus >= 0 ? "text-slate-300" : "text-rose-400"}`}>{s.contBonus >= 0 ? "+" : ""}{M(s.contBonus)}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums text-slate-300">{s.stBonus > 0 ? `+${M(s.stBonus)}` : "—"}</td>
                              <td className="py-1.5 pl-2 text-right tabular-nums font-semibold">{s.utility != null ? M(s.utility) : "—"}{!s.acceptable && <span className="ml-1 text-[10px] text-rose-400" title="Below his floor / wrong term">✗</span>}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {winner && runnerUp && winner.utility != null && runnerUp.utility != null && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        {winner.salary >= runnerUp.salary
                          ? `${code.get(winner.teamId)} simply offered more (${M(winner.salary)} vs ${M(runnerUp.salary)}).`
                          : `${code.get(winner.teamId)} won on fit, not money (${M(winner.salary)} vs ${code.get(runnerUp.teamId)}'s ${M(runnerUp.salary)}) — `
                            + [winner.roleBonus > runnerUp.roleBonus && "a better promised role", winner.contBonus > runnerUp.contBonus && "contender status", winner.stBonus > runnerUp.stBonus && "the PP/PK time he wanted"].filter(Boolean).join(" + ") + "."}
                      </p>
                    )}
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
