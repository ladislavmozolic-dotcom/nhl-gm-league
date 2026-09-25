import { PageHeader, Card } from "@/components/ui";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { disciplineList, APPEAL_HOURS } from "@/lib/discipline-server";
import { SuspensionItem } from "@/components/SuspensionList";

export const dynamic = "force-dynamic";

export default async function PlayerSafetyPage() {
  const [rows, myTeamId, admin] = await Promise.all([disciplineList(), getTeamSession(), isAdmin()]);
  const now = new Date().getTime();
  const active = rows.filter((r) => r.kind === "SUSPENSION" && r.status === "ACTIVE");
  const rest = rows.filter((r) => !active.includes(r));
  const games = rows.filter((r) => r.kind === "SUSPENSION" && r.status !== "OVERTURNED").reduce((t, r) => t + r.games, 0);
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="⚖️ Player Safety" subtitle={`${rows.filter((r) => r.kind === "SUSPENSION").length} suspensions (${games} games) · ${rows.filter((r) => r.kind === "FINE").length} fines this season`} />
      <Card title="How it works" accent="text-slate-400">
        <p className="text-sm text-slate-400">After every night&apos;s games the Department of Player Safety reviews game misconducts, majors for violent infractions (boarding, cross-checking, elbowing…) and hits that injure an opponent. Repeat offenders (a suspension within 18 months) are punished harder. A suspended player doesn&apos;t dress and serves in his NHL club&apos;s games; he forfeits salary per the CBA (first offence: 1/days-in-season per game, repeat offender: 1/82) — the club keeps that money. His GM can appeal to the commissioner within {APPEAL_HOURS} hours; the player serves while the appeal is heard.</p>
      </Card>
      <Card title={`🚫 Currently suspended (${active.length})`} accent="text-red-400">
        {active.length ? <ul className="divide-y divide-slate-800/70">{active.map((r) => <SuspensionItem key={r.id} now={now} r={r} myTeamId={myTeamId} admin={admin} />)}</ul> : <p className="text-sm text-slate-500">Nobody is suspended.</p>}
      </Card>
      <Card title="📜 Rulings this season" accent="text-blue-400">
        {rest.length ? <ul className="divide-y divide-slate-800/70">{rest.map((r) => <SuspensionItem key={r.id} now={now} r={r} myTeamId={myTeamId} admin={admin} />)}</ul> : <p className="text-sm text-slate-500">No rulings yet.</p>}
      </Card>
    </div>
  );
}
