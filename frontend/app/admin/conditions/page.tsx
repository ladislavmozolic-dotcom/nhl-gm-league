import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { cleanName } from "@/lib/playerName";
import { CURRENT_SEASON_START } from "@/lib/finance";
import { evaluateCondition, OP_LABELS, METRIC_LABELS, type Op, type Metric } from "@/lib/trade-conditions-server";
import ConditionActions from "@/components/ConditionActions";
import AttachConditionTracking from "@/components/AttachConditionTracking";
import ResolveConditionButton from "@/components/ResolveConditionButton";
import { PageHeader, Card, BackPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminConditionsPage() {
  if (!(await isAdmin())) redirect("/");

  const conditions = await prisma.tradeCondition.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  const teamIds = [...new Set(conditions.flatMap((c) => [c.fromTeamId, c.toTeamId]))];
  const [teams, skaters, picks] = await Promise.all([
    prisma.team.findMany({ select: { id: true, name: true, code: true } }),
    prisma.player.findMany({ where: { rosterType: "NHL", isGoalie: false }, select: { id: true, name: true, teamId: true }, orderBy: { name: "asc" } }),
    prisma.draftPick.findMany({ where: { teamId: { in: teamIds } }, orderBy: [{ year: "asc" }, { round: "asc" }] }),
  ]);
  const nameOf = (id: number) => teams.find((t) => t.id === id)?.name ?? `#${id}`;
  const codeOf = (id: number | null) => (id != null ? teams.find((t) => t.id === id)?.code ?? "" : "");
  const picksByTeam = new Map<number, typeof picks>();
  for (const p of picks) picksByTeam.set(p.teamId, [...(picksByTeam.get(p.teamId) ?? []), p]);
  const skaterOptions = skaters.map((s) => ({ id: s.id, label: `${cleanName(s.name)} (${codeOf(s.teamId)})` }));
  const playersById = new Map(skaters.map((s) => [s.id, s]));

  const pending = conditions.filter((c) => c.status === "PENDING");

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Trade Conditions"
        subtitle={`Conditional future compensation from trades. Attach a player/stat threshold to a condition to track it automatically — the picks it governs lock until resolved. ${pending.length} pending.`}
        right={<BackPill href="/admin">Admin</BackPill>}
      />

      {conditions.length === 0 ? (
        <Card><p className="text-center text-slate-500 py-8">No trade conditions recorded yet. They are created from trades that carry a condition.</p></Card>
      ) : (
        <div className="space-y-3">
          {await Promise.all(conditions.map(async (c) => {
            const structured = c.playerId != null && c.seasonYear != null;
            const evalResult = structured ? await evaluateCondition(c) : null;
            const player = c.playerId != null ? playersById.get(c.playerId) : null;
            const teamPicks = [...(picksByTeam.get(c.fromTeamId) ?? []), ...(picksByTeam.get(c.toTeamId) ?? [])];
            return (
              <Card key={c.id} bodyClassName="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div className="flex-1 min-w-[220px]">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{c.description}{c.tradeId && <Link href="/trades" className="text-slate-500 text-xs ml-2 hover:text-blue-400">#{c.tradeId}</Link>}</p>
                    <p className="text-xs text-slate-500 mt-1">{nameOf(c.fromTeamId)} → {nameOf(c.toTeamId)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.status === "FULFILLED" ? "bg-green-500/20 text-green-400" : c.status === "EXPIRED" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>{c.status}</span>
                    <ConditionActions id={c.id} status={c.status} />
                  </div>
                </div>

                {structured && player && (
                  <div className="mt-3 bg-slate-950/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-slate-500">Tracking <b className="text-slate-300">{cleanName(player.name)}</b> — {c.seasonYear}-{String((c.seasonYear ?? 0) + 1).slice(-2)} regular season</p>
                    {evalResult && (
                      <div className="space-y-1.5">
                        {evalResult.clauses.map((cl, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className={`font-bold ${cl.pass ? "text-emerald-400" : "text-slate-500"}`}>{cl.pass ? "✓" : "○"}</span>
                            <span className="text-slate-400">{METRIC_LABELS[cl.metric as Metric] ?? cl.metric} {OP_LABELS[cl.op as Op] ?? cl.op} {cl.threshold}</span>
                            <span className="text-slate-600">— currently {cl.value}</span>
                            {i === 0 && evalResult.clauses.length > 1 && <span className="text-slate-600 italic">{c.logic2 === "OR" ? "OR" : "AND"}</span>}
                          </div>
                        ))}
                        <p className={`text-xs font-bold ${evalResult.met ? "text-emerald-400" : "text-slate-500"}`}>
                          {evalResult.met ? "Condition currently MET" : "Condition currently NOT met"} ({evalResult.stats.gamesPlayed} GP so far)
                        </p>
                      </div>
                    )}
                    {c.status === "PENDING" && <ResolveConditionButton conditionId={c.id} />}
                  </div>
                )}

                {!structured && c.status === "PENDING" && (
                  <AttachConditionTracking
                    conditionId={c.id}
                    skaterOptions={skaterOptions}
                    picks={teamPicks.map((p) => ({ id: p.id, label: `${p.year} R${p.round} (${codeOf(p.teamId)})`, locked: p.lockedByConditionId != null }))}
                    defaultSeasonYear={CURRENT_SEASON_START}
                  />
                )}
              </Card>
            );
          }))}
        </div>
      )}
    </div>
  );
}
