import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import TeamCapView from "@/components/TeamCapView";
import ContractSection from "@/components/ContractSection";

export const dynamic = "force-dynamic";

// Team-scoped salary-cap view — lives under the team layout so the team
// sub-nav stays visible when switching to "Salary". Includes the Contract
// section (renewals split into UFA / RFA / ELC).
export default async function TeamSalaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug }, select: { id: true } });
  if (!team) notFound();
  return (
    <div className="space-y-5">
      <TeamCapView slug={slug} />
      <ContractSection teamId={team.id} />
    </div>
  );
}
