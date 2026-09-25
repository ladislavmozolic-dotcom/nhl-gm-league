import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { disciplineList } from "@/lib/discipline-server";
import { SuspensionItem } from "@/components/SuspensionList";
import { IssueForm } from "@/components/PlayerSafety";

export const dynamic = "force-dynamic";

export default async function AdminDisciplinePage() {
  if (!(await isAdmin())) redirect("/login");
  const rows = await disciplineList();
  const now = new Date().getTime();
  const pending = rows.filter((r) => r.appealStatus === "PENDING");
  const active = rows.filter((r) => r.kind === "SUSPENSION" && r.status === "ACTIVE" && r.appealStatus !== "PENDING");
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="⚖️ Player Safety" subtitle="Appeals · active suspensions · commissioner rulings" right={<BackPill href="/admin">Admin</BackPill>} />
      <Card title={`📨 Appeals waiting (${pending.length})`} accent="text-amber-400">
        {pending.length ? <ul className="divide-y divide-slate-800/70">{pending.map((r) => <SuspensionItem key={r.id} now={now} r={r} myTeamId={null} admin />)}</ul> : <p className="text-sm text-slate-500">No appeals pending.</p>}
      </Card>
      <Card title="Issue a ruling" accent="text-red-400"><IssueForm /><p className="text-[11px] text-slate-500 mt-2">Automatic reviews run after every sim day (Admin ▸ Simulation settings ▸ Player Safety: on/off and frequency).</p></Card>
      <Card title={`🚫 Active suspensions (${active.length})`} accent="text-blue-400" right={<Link href="/league/player-safety" className="text-xs text-blue-400 hover:underline">Public page →</Link>}>
        {active.length ? <ul className="divide-y divide-slate-800/70">{active.map((r) => <SuspensionItem key={r.id} now={now} r={r} myTeamId={null} admin />)}</ul> : <p className="text-sm text-slate-500">None.</p>}
      </Card>
    </div>
  );
}
