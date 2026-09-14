import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { teamChemistryView } from "@/lib/chemistry-admin-server";
import { PageHeader, BackPill } from "@/components/ui";
import ChemistryAdminEditor from "@/components/ChemistryAdminEditor";

export const dynamic = "force-dynamic";

export default async function AdminTeamChemistryPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdmin())) redirect("/");
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!team) notFound();

  const view = await teamChemistryView(team.id);

  return (
    <div className="space-y-5 py-2 max-w-3xl mx-auto">
      <PageHeader title={`${team.name} — Chemistry`} subtitle="Edits here feed the live sim directly (SimSkater.chem) — no game needs to be played first." right={<BackPill href="/admin/chemistry">All Teams</BackPill>} />
      {!view ? (
        <p className="text-slate-500 text-sm">This club has no lines set yet — set lines in the Line Editor first.</p>
      ) : (
        <ChemistryAdminEditor teamId={team.id} slug={slug} base={view.base} forwardBonds={view.forwardBonds} defenseBonds={view.defenseBonds} stUnits={view.stUnits} />
      )}
      <p className="text-xs text-slate-600">
        Each value is a pairwise bond (0-100). Below 70 it starts costing offense/defense (up to −6% at 0); 70+ is full strength, never a bonus above it.
        &quot;Clear&quot; removes the override so it falls back to the league base ({view?.base ?? 35}) and resumes growing/decaying normally from the next game.
      </p>
    </div>
  );
}
