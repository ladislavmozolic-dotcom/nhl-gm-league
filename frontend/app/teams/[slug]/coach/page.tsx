import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canManageTeam } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import CoachManager from "@/components/CoachManager";

export const dynamic = "force-dynamic";

const SEL = { id: true, name: true, country: true, style: true, overall: true, age: true, ph: true, df: true, of: true, pd: true, ex: true, ld: true, salary: true, contract: true } as const;

export default async function TeamCoachPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    select: { id: true, name: true, bankAccount: true, headCoach: { select: SEL } },
  });
  if (!team) notFound();

  const [canManage, freeAgents] = await Promise.all([
    canManageTeam(team.id),
    prisma.coach.findMany({ where: { teamId: null }, orderBy: [{ overall: "desc" }, { name: "asc" }], select: SEL }),
  ]);

  return (
    <div className="space-y-5 py-2">
      <PageHeader title={`${team.name} — Head Coach`}
        subtitle="Hire from the free-agent pool or fire your bench boss. Firing pays out his full remaining contract (salary × years) from the club bank."
        right={<Link href={`/teams/${slug}`} className="text-sm text-slate-400 hover:text-blue-400">← Team</Link>} />
      {!canManage && <p className="text-xs text-amber-300/80">You're viewing this as a guest — only {team.name}'s GM (or the commissioner) can hire and fire.</p>}
      <CoachManager teamId={team.id} slug={slug} teamName={team.name} current={team.headCoach ?? null} freeAgents={freeAgents} canManage={canManage} bank={team.bankAccount ?? 0} />
    </div>
  );
}
