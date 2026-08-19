import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getTeamSession } from "@/lib/auth";
import { getArenaSections } from "@/lib/finance";
import FinanceEditor from "@/components/FinanceEditor";
import TeamCapView from "@/components/TeamCapView";
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
    <div className="space-y-8 pb-16">
      <FinanceEditor
        teamName={team.name}
        teamSlug={slug}
        arena={team.arena}
        sections={sections}
        onSave={saveTicketPrices}
      />
      {/* Cap sheet — which players are under contract, at what cap hit, and for how many
          seasons (UFA/RFA when the deal ends). Restored to team Finance where GMs expect it. */}
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-lg font-bold mb-3 text-slate-200">Salary Cap — who&apos;s signed &amp; for how long</h2>
        <TeamCapView slug={slug} />
      </div>
    </div>
  );
}
