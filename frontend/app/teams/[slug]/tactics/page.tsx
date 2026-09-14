import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { canManageTeam } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import SystemEditor from "@/components/SystemEditor";
import CoachAdvice from "@/components/CoachAdvice";
import { loadSimTeam } from "@/lib/sim";
import { loadTeamSystem } from "@/lib/sim/lines";
import { mergeTactics } from "@/lib/sim/tactics";
import { coachAdvice } from "@/lib/coach-advice";

export const dynamic = "force-dynamic";

export default async function TeamTacticsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!team) notFound();
  if (!(await canManageTeam(team.id))) redirect(`/teams/${slug}/login`);

  // roster profile drives system fit; current stored system (if any) — read via
  // loadTeamSystem, NOT loadTeamLines, since loadTeamLines returns null whenever
  // the club hasn't set custom forward lines/D pairs yet, which would otherwise
  // make a previously-saved system silently reset to "Balanced" on every reload.
  const [sim, system] = await Promise.all([loadSimTeam(team.id), loadTeamSystem(team.id)]);
  const current = mergeTactics(system);
  const advice = coachAdvice(sim.profile, current, sim.coachEx);

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Team System" subtitle={`${team.name} — set your club's identity. Pick a system your roster fits.`} />
      <CoachAdvice teamId={team.id} suggestions={advice} canManage />
      <SystemEditor teamId={team.id} profile={sim.profile} initial={current} coachEx={sim.coachEx} />
    </div>
  );
}
