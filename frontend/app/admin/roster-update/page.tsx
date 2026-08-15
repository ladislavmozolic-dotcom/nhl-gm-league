import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { previewReconciliation } from "@/lib/roster-reconcile";
import RosterReconcile from "@/components/RosterReconcile";

export const dynamic = "force-dynamic";

export default async function RosterUpdatePage() {
  const admin = await isAdmin();
  if (!admin) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="Post-Season Roster Update" subtitle="Reconcile rosters before the draft" />
        <Card><p className="text-sm text-slate-500">Sign in as a league admin to run the roster reconciliation.</p></Card>
      </div>
    );
  }
  const rows = await previewReconciliation();

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Post-Season Roster Update" subtitle="Reconcile A-team & farm rosters from last season's games (run before the June draft)"
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>} />

      <Card title="Rules" accent="text-slate-200">
        <ul className="text-sm text-slate-300 space-y-1 list-disc pl-5">
          <li><b className="text-red-400">Release</b> — 0 NHL/AHL games last season, UFA age (27+), no one-way deal for next season.</li>
          <li><b className="text-blue-400">→ Prospects</b> — 0 NHL/AHL games, and either UFA with a one-way deal, or RFA age (≤26) on any deal.</li>
          <li><b className="text-green-400">Activate → NHL</b> — a farm player on a ≤$0.6M deal who played ≥10 NHL games.</li>
          <li><b className="text-emerald-400">Prospect → NHL (ELC)</b> — a prospect who played ≥10 NHL games → A-team on an auto ELC.</li>
          <li><b className="text-teal-400">Prospect → AHL ($100k)</b> — a prospect with ≥15 AHL games (≥5 goalie) → farm at $100k.</li>
        </ul>
      </Card>

      <Card title={`Proposed moves (${rows.length})`} accent="text-amber-400">
        <p className="text-xs text-slate-500 mb-3">Review, then apply per-player or all at once. Refresh AHL GP first if it&apos;s stale.</p>
        <RosterReconcile rows={rows} />
      </Card>
    </div>
  );
}
