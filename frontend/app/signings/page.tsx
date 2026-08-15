import { prisma } from "@/lib/prisma";
import ComingSoon from "@/components/ComingSoon";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SigningsPage() {
  const signings = await prisma.transaction.findMany({
    where: { type: { in: ["SIGNING", "signing"] } },
    orderBy: { createdAt: "desc" }, take: 50,
  });
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Signings" subtitle="Contracts signed through the site." />
      {signings.length > 0 ? (
        <Card bodyClassName="p-0">
          <div className="divide-y divide-slate-800/40">
            {signings.map((s) => (
              <div key={s.id} className="px-4 py-3 text-sm flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors">
                <span>{s.message}</span>
                <span className="text-xs text-slate-500 whitespace-nowrap">{s.createdAt.toLocaleDateString("sk-SK")}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <ComingSoon title="Free-Agent Signings" points={[
          "List of players who signed a contract, newest first (team, term, cap hit)",
          "Signings happen directly on the site: a GM offers a free agent a contract, it debits the cap/bank",
          "Needs a signing action + Contract offer flow — logged here as SIGNING transactions",
        ]} />
      )}
    </div>
  );
}
