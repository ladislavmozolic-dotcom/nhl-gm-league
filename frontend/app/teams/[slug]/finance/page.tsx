import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getTeamSession } from "@/lib/auth";
import { getArenaSections } from "@/lib/finance";
import FinanceEditor from "@/components/FinanceEditor";
import { saveTicketPrices } from "./actions";

export const dynamic = "force-dynamic";

export default async function FinancePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) notFound();
  const session = await getTeamSession();
  if (session !== team.id) redirect(`/teams/${slug}/login`);

  const sections = getArenaSections(team);
  return (
    <FinanceEditor
      teamName={team.name}
      teamSlug={slug}
      arena={team.arena}
      sections={sections}
      onSave={saveTicketPrices}
    />
  );
}
