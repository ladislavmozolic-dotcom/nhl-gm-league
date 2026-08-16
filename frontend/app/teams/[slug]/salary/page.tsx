import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import TeamCapView from "@/components/TeamCapView";

export const dynamic = "force-dynamic";

// Team-scoped salary-cap view. Contract renewals + clauses live on the Contracts
// page (Contracts ▾ menu); this is the cap sheet only.
export default async function TeamSalaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) notFound();
  return (
    <div className="space-y-5">
      <TeamCapView slug={slug} />
    </div>
  );
}
