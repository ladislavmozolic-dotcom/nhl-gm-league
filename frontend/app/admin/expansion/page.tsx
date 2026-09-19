import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { SETUP: "Protection window open", LIVE: "Draft in progress", DONE: "Complete" };
const STATUS_COLOR: Record<string, string> = { SETUP: "text-amber-400", LIVE: "text-blue-400", DONE: "text-emerald-400" };

export default async function ExpansionHubPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  if (!(await isAdmin())) redirect("/login");
  const sp = await searchParams;

  const drafts = await prisma.expansionDraftState.findMany({ orderBy: { id: "desc" } });
  const teamIds = drafts.map((d) => d.teamId);
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true, slug: true, logoUrl: true, conference: true, division: true } });
  const teamOf = new Map(teams.map((t) => [t.id, t]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-2 space-y-6">
      <PageHeader title="NHL Expansion" subtitle="Add new clubs to the league and run their expansion draft." right={<BackPill href="/admin">Admin</BackPill>} />

      {sp.created && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-2.5 text-sm text-emerald-300">
          ✓ Expansion team created — AHL affiliate and placeholder coach are ready. Open the protection-list window from its card below once you want existing GMs to start submitting.
        </div>
      )}

      <Link href="/admin/expansion/new"
        className="block rounded-xl border border-dashed border-slate-700 hover:border-blue-500/60 px-4 py-4 text-center text-sm font-semibold text-slate-300 hover:text-white transition-colors">
        + Add Expansion Team
      </Link>

      <Card title="Expansion drafts">
        {drafts.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No expansion teams yet.</p>
        ) : (
          <div className="space-y-2">
            {drafts.map((d) => {
              const t = teamOf.get(d.teamId);
              if (!t) return null;
              return (
                <Link key={d.id} href={`/teams/${t.slug}`} className="flex items-center gap-3 rounded-lg border border-slate-800 px-3 py-2.5 hover:border-slate-600">
                  {t.logoUrl && <img src={t.logoUrl} alt="" className="w-8 h-8 object-contain" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-100 truncate">{t.name}</div>
                    <div className="text-[11px] text-slate-500">{t.conference || "—"} / {t.division || "—"}</div>
                  </div>
                  <span className={`text-xs font-semibold ${STATUS_COLOR[d.status] ?? "text-slate-400"}`}>{STATUS_LABEL[d.status] ?? d.status}</span>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
