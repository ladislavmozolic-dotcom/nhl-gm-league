import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { canManageTeam } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { protectionRosterFor, isForcedProtect, isAutoExempt, isFwd, isDef } from "@/lib/expansion-server";
import { loadSettings } from "@/lib/sim/settings";
import ExpansionProtectionForm from "@/components/ExpansionProtectionForm";
import { submitProtectionListAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ExpansionProtectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true, logoUrl: true, league: true } });
  if (!team) notFound();
  if (!(await canManageTeam(team.id))) redirect(`/teams/${slug}/login`);

  const drafts = await prisma.expansionDraftState.findMany({ where: { status: "SETUP", NOT: { teamId: team.id } }, orderBy: { id: "asc" } });

  if (drafts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-2 space-y-6">
        <PageHeader title="Expansion Protection" subtitle={team.name} />
        <Card><p className="text-slate-500 text-center py-8">No expansion draft protection window is open right now.</p></Card>
      </div>
    );
  }

  const [roster, expansionTeams, submissions, settings] = await Promise.all([
    protectionRosterFor(team.id),
    prisma.team.findMany({ where: { id: { in: drafts.map((d) => d.teamId) } }, select: { id: true, name: true, logoUrl: true } }),
    prisma.expansionProtection.findMany({ where: { teamId: team.id, expansionDraftId: { in: drafts.map((d) => d.id) } } }),
    loadSettings(),
  ]);
  const expTeamOf = new Map(expansionTeams.map((t) => [t.id, t]));
  const subOf = new Map(submissions.map((s) => [s.expansionDraftId, s]));

  const players = roster.map((p) => ({
    ...p,
    posGroup: (p.isGoalie ? "G" : isFwd(p.position) ? "F" : isDef(p.position) ? "D" : "F") as "F" | "D" | "G",
    forced: isForcedProtect(p),
    exempt: isAutoExempt(p, settings.expansionRuleset),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-2 space-y-6">
      <PageHeader title="Expansion Protection" subtitle={`${team.name} — protect your roster before the expansion draft`} />
      {drafts.map((d) => {
        const expTeam = expTeamOf.get(d.teamId);
        const existing = subOf.get(d.id);
        return (
          <Card key={d.id} title={expTeam ? `vs. ${expTeam.name}` : "Expansion Draft"}>
            <ExpansionProtectionForm
              teamId={team.id}
              slug={slug}
              expansionDraftId={d.id}
              players={players}
              initialFormat={(existing?.format as "7-3-1" | "8-1") ?? "7-3-1"}
              initialChosenIds={existing?.playerIds ?? []}
              submittedAt={existing?.submittedAt?.toISOString() ?? null}
              action={submitProtectionListAction}
            />
          </Card>
        );
      })}
    </div>
  );
}
