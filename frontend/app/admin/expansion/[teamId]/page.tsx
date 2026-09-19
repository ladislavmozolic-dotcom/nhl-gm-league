import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ExpansionDraftDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  if (!(await isAdmin())) redirect("/login");
  const teamId = Number((await params).teamId);

  const [expTeam, draft] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, slug: true, logoUrl: true } }),
    prisma.expansionDraftState.findUnique({ where: { teamId } }),
  ]);
  if (!expTeam || !draft) notFound();

  const [others, submissions] = await Promise.all([
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false, NOT: { id: teamId } }, select: { id: true, name: true, slug: true, logoUrl: true, gmNickname: true } , orderBy: { name: "asc" } }),
    prisma.expansionProtection.findMany({ where: { expansionDraftId: draft.id } }),
  ]);
  const subOf = new Map(submissions.map((s) => [s.teamId, s]));
  const submittedCount = submissions.length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-2 space-y-6">
      <PageHeader
        title={expTeam.name}
        subtitle={`Expansion draft — ${draft.status === "SETUP" ? "protection window open" : draft.status === "LIVE" ? "draft in progress" : "complete"}`}
        right={<BackPill href="/admin/expansion">Expansion</BackPill>}
      />

      <Card title={`Protection submissions — ${submittedCount}/${others.length}`}>
        <div className="space-y-1.5">
          {others.map((t) => {
            const sub = subOf.get(t.id);
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm">
                {t.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                <span className="flex-1 truncate text-slate-200">{t.name}</span>
                {sub ? (
                  <span className="text-xs text-emerald-400">✓ {sub.format} · {new Date(sub.submittedAt).toLocaleDateString()}{sub.submittedBy ? ` · ${sub.submittedBy}` : ""}</span>
                ) : (
                  <span className="text-xs text-slate-500">not submitted</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {draft.status === "SETUP" && submittedCount < others.length && (
        <p className="text-xs text-slate-500">The draft can&apos;t start until every existing club has submitted a protection list. As admin you can submit on a club&apos;s behalf too — open its <Link href="/league" className="text-blue-400 hover:underline">team page</Link> at <code className="text-slate-400">/teams/&lt;slug&gt;/expansion-protection</code>.</p>
      )}
      {draft.status === "SETUP" && submittedCount === others.length && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300 flex items-center justify-between gap-3">
          <span>✓ Every club has submitted — ready to draft.</span>
          <Link href={`/admin/expansion/${teamId}/draft`} className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold whitespace-nowrap">Open the draft →</Link>
        </div>
      )}
      {draft.status === "LIVE" && (
        <div className="rounded-lg border border-blue-800 bg-blue-950/30 px-4 py-3 text-sm text-blue-300 flex items-center justify-between gap-3">
          <span>Draft in progress — pick {draft.currentIdx + 1} of {draft.pickOrder.length}.</span>
          <Link href={`/admin/expansion/${teamId}/draft`} className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold whitespace-nowrap">Continue →</Link>
        </div>
      )}
      {draft.status === "DONE" && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-slate-300 flex items-center justify-between gap-3">
          <span>Draft complete.</span>
          <Link href={`/admin/expansion/${teamId}/results`} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold whitespace-nowrap">View results →</Link>
        </div>
      )}
    </div>
  );
}
