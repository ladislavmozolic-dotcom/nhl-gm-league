import { isAdmin } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { checkExpansionRoster } from "@/lib/expansion-server";
import { loadSettings } from "@/lib/sim/settings";

export const dynamic = "force-dynamic";

const fmt = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

export default async function ExpansionResultsPage({ params }: { params: Promise<{ teamId: string }> }) {
  if (!(await isAdmin())) redirect("/login");
  const expansionTeamId = Number((await params).teamId);

  const [expTeam, draft] = await Promise.all([
    prisma.team.findUnique({ where: { id: expansionTeamId }, select: { id: true, name: true, logoUrl: true } }),
    prisma.expansionDraftState.findUnique({ where: { teamId: expansionTeamId } }),
  ]);
  if (!expTeam || !draft) notFound();

  const picks = await prisma.expansionPick.findMany({ where: { expansionDraftId: draft.id }, orderBy: { pickNumber: "asc" } });
  const fromTeams = await prisma.team.findMany({ where: { id: { in: picks.map((p) => p.fromTeamId) } }, select: { id: true, code: true, name: true, logoUrl: true } });
  const fromTeamOf = new Map(fromTeams.map((t) => [t.id, t]));
  const players = await prisma.player.findMany({ where: { id: { in: picks.map((p) => p.playerId) } }, select: { id: true, name: true, position: true, overall: true } });
  const playerOf = new Map(players.map((p) => [p.id, p]));

  const settings = await loadSettings();
  const check = draft.status === "DONE" ? await checkExpansionRoster(expansionTeamId, settings.expansionCapFloorPct) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-2 space-y-6">
      <PageHeader
        title={`${expTeam.name} — Expansion Draft Results`}
        subtitle={draft.status === "DONE" ? `${picks.length} selections` : "In progress"}
        right={<BackPill href={`/admin/expansion/${expansionTeamId}`}>Back</BackPill>}
      />

      {check && (
        <div className="grid sm:grid-cols-2 gap-3">
          {settings.expansionRequireGoalie && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${check.hasGoalie ? "border-emerald-800 bg-emerald-950/30 text-emerald-300" : "border-red-800 bg-red-950/30 text-red-300"}`}>
              {check.hasGoalie ? `✓ ${check.goalieCount} goalie(s) selected` : "⚠ No goalie was selected"}
            </div>
          )}
          <div className={`rounded-lg border px-4 py-3 text-sm ${check.underFloorBy === 0 ? "border-emerald-800 bg-emerald-950/30 text-emerald-300" : "border-amber-800 bg-amber-950/30 text-amber-300"}`}>
            {check.underFloorBy === 0
              ? `✓ Committed cap ${fmt(check.committedCap)} meets the ${fmt(check.capFloor)} floor`
              : `⚠ ${fmt(check.underFloorBy)} under the ${fmt(check.capFloor)} floor (committed ${fmt(check.committedCap)})`}
          </div>
        </div>
      )}

      <Card title="Selections by club">
        <div className="space-y-1.5">
          {picks.map((p) => {
            const from = fromTeamOf.get(p.fromTeamId);
            const pl = playerOf.get(p.playerId);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm">
                <span className="w-6 text-right text-slate-500 tabular-nums">{p.pickNumber}.</span>
                {from?.logoUrl && <img src={from.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                <span className="text-slate-500 w-10">{from?.code}</span>
                <span className="flex-1 truncate text-slate-100">{pl?.name}</span>
                <span className="text-xs text-slate-500">{pl?.position}</span>
                {pl?.overall != null && <span className="text-xs text-slate-500 tabular-nums">{pl.overall} OV</span>}
              </div>
            );
          })}
          {picks.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No picks yet.</p>}
        </div>
      </Card>
    </div>
  );
}
