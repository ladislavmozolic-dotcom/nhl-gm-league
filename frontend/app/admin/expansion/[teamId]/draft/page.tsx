import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { exposedPlayersFor, isFwd, isDef } from "@/lib/expansion-server";
import ExpansionDraftBoard from "@/components/ExpansionDraftBoard";
import { startExpansionDraftAction, makeExpansionPickAction, undoLastExpansionPickAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ExpansionDraftPage({ params }: { params: Promise<{ teamId: string }> }) {
  if (!(await isAdmin())) redirect("/login");
  const expansionTeamId = Number((await params).teamId);

  const [expTeam, draft] = await Promise.all([
    prisma.team.findUnique({ where: { id: expansionTeamId }, select: { id: true, name: true, slug: true, logoUrl: true } }),
    prisma.expansionDraftState.findUnique({ where: { teamId: expansionTeamId } }),
  ]);
  if (!expTeam || !draft) notFound();

  if (draft.status === "SETUP") {
    const others = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false, NOT: { id: expansionTeamId } }, select: { id: true } });
    const submitted = await prisma.expansionProtection.count({ where: { expansionDraftId: draft.id, teamId: { in: others.map((t) => t.id) } } });
    return (
      <div className="mx-auto max-w-3xl px-4 py-2 space-y-6">
        <PageHeader title={`${expTeam.name} — Expansion Draft`} subtitle="Protection window still open" right={<BackPill href={`/admin/expansion/${expansionTeamId}`}>Back</BackPill>} />
        <Card>
          <p className="text-sm text-slate-300">{submitted}/{others.length} clubs have submitted a protection list.</p>
          {submitted >= others.length ? (
            <form action={async () => { "use server"; await startExpansionDraftAction(expansionTeamId); }} className="mt-4">
              <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">Start the draft</button>
            </form>
          ) : (
            <p className="text-xs text-slate-500 mt-3">The draft can&apos;t start until every club has submitted. See the <Link href={`/admin/expansion/${expansionTeamId}`} className="text-blue-400 hover:underline">submission status</Link>.</p>
          )}
        </Card>
      </div>
    );
  }

  if (draft.status === "DONE") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-2 space-y-6">
        <PageHeader title={`${expTeam.name} — Expansion Draft`} subtitle="Complete" right={<BackPill href={`/admin/expansion/${expansionTeamId}`}>Back</BackPill>} />
        <Card><Link href={`/admin/expansion/${expansionTeamId}/results`} className="text-blue-400 hover:underline text-sm">View the full results →</Link></Card>
      </div>
    );
  }

  // LIVE — the on-the-clock club
  const sourceTeamId = draft.pickOrder[draft.currentIdx];
  const [sourceTeam, exposed, picksMade] = await Promise.all([
    prisma.team.findUnique({ where: { id: sourceTeamId }, select: { id: true, name: true, code: true, logoUrl: true } }),
    exposedPlayersFor(sourceTeamId, draft.id),
    prisma.expansionPick.findMany({ where: { expansionDraftId: draft.id }, orderBy: { pickNumber: "asc" } }),
  ]);
  const fromTeams = await prisma.team.findMany({ where: { id: { in: picksMade.map((p) => p.fromTeamId) } }, select: { id: true, code: true, logoUrl: true } });
  const fromTeamOf = new Map(fromTeams.map((t) => [t.id, t]));
  const pickedPlayers = await prisma.player.findMany({ where: { id: { in: picksMade.map((p) => p.playerId) } }, select: { id: true, name: true, position: true } });
  const playerOf = new Map(pickedPlayers.map((p) => [p.id, p]));

  const boardPlayers = exposed.map((p) => ({
    id: p.id, name: p.name, position: p.position, isGoalie: p.isGoalie, overall: p.overall,
    posGroup: (p.isGoalie ? "G" : isFwd(p.position) ? "F" : isDef(p.position) ? "D" : "F") as "F" | "D" | "G",
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-2 space-y-6">
      <PageHeader title={`${expTeam.name} — Expansion Draft`} subtitle={`Pick ${draft.currentIdx + 1} of ${draft.pickOrder.length}`} right={<BackPill href={`/admin/expansion/${expansionTeamId}`}>Back</BackPill>} />

      {picksMade.length > 0 && (
        <Card title="Selections so far" bodyClassName="p-3">
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {picksMade.map((p) => {
              const from = fromTeamOf.get(p.fromTeamId);
              const pl = playerOf.get(p.playerId);
              return (
                <div key={p.id} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-5 text-right tabular-nums">{p.pickNumber}.</span>
                  {from?.logoUrl && <img src={from.logoUrl} alt="" className="w-4 h-4 object-contain" />}
                  <span className="text-slate-500">{from?.code}</span>
                  <span className="text-slate-200">{pl?.name}</span>
                  <span className="text-slate-600">{pl?.position}</span>
                </div>
              );
            })}
          </div>
          <form action={async () => { "use server"; await undoLastExpansionPickAction(expansionTeamId); }} className="mt-2">
            <button type="submit" className="text-xs text-red-400 hover:text-red-300">↺ Undo last pick</button>
          </form>
        </Card>
      )}

      <ExpansionDraftBoard
        expansionTeamId={expansionTeamId}
        sourceTeam={sourceTeam ? { name: sourceTeam.name, code: sourceTeam.code, logoUrl: sourceTeam.logoUrl } : null}
        players={boardPlayers}
        onPick={makeExpansionPickAction}
      />
    </div>
  );
}
