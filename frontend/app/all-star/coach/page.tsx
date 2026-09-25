import Link from "next/link";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { latestEvent, teamsOf, phaseOf, nomineesOf, coachDeadline, DIVS, type DivKey } from "@/lib/all-star-server";
import CoachRoom from "@/components/all-star/CoachRoom";

export const dynamic = "force-dynamic";
const fmt = (d: Date) => d.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", dateStyle: "medium", timeStyle: "short" });

export default async function CoachRoomPage({ searchParams }: { searchParams: Promise<{ div?: string }> }) {
  const sp = await searchParams;
  const [ev, teamId, admin] = await Promise.all([latestEvent(), getTeamSession(), isAdmin()]);
  const shell = (body: React.ReactNode) => (
    <div className="space-y-6 py-2">
      <PageHeader title="📋 All-Star coach room" subtitle="Pick your 11 and set the 3-on-3 lineup" right={<BackPill href="/all-star">All-Star</BackPill>} />
      {body}
    </div>
  );
  if (!ev) return shell(<Card><p className="text-sm text-slate-400">No All-Star event is scheduled.</p></Card>);
  const teams = teamsOf(ev);
  const mine = teams.filter((t) => t.coachTeamId != null && t.coachTeamId === teamId);
  const div = (DIVS.find((d) => d.key === sp.div)?.key ?? mine[0]?.key ?? (admin ? "ATL" : null)) as DivKey | null;
  const t = div ? teams.find((x) => x.key === div)! : null;
  if (!t || (!admin && t.coachTeamId !== teamId)) return shell(<Card><p className="text-sm text-slate-400">Only the four All-Star coaches (and the commissioner) can open the coach room.</p></Card>);
  const ph = phaseOf(ev);
  const editable = ev.status !== "DONE" && (admin || ph === "coaches");
  const nominees = ph === "planned" || ph === "nominations" ? [] : await nomineesOf(ev.id, t.key);
  return shell(
    <>
      {admin && (
        <div className="flex flex-wrap gap-2">
          {teams.map((x) => <Link key={x.key} href={`/all-star/coach?div=${x.key}`} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${x.key === t.key ? "bg-blue-600 text-white" : "border border-slate-700 text-slate-300"}`}>{x.name}</Link>)}
        </div>
      )}
      <Card title={`${t.name}`} accent="text-amber-400">
        <p className="text-sm text-slate-400 mb-4">
          {ph === "coaches" ? <>Due <b className="text-slate-200">{fmt(coachDeadline(ev))}</b>. Anything left unset is filled in automatically.</>
            : ph === "planned" || ph === "nominations" ? <>The coach room opens when nominations close{ev.votingClosesAt ? <> (<b className="text-slate-200">{fmt(ev.votingClosesAt)}</b>)</> : null}.</>
            : ev.status === "DONE" ? "The event has been played." : "The deadline has passed — the lineup is locked."}
          {t.submittedAt && <span className="ml-2 text-emerald-400">{t.auto ? "Auto lineup in place." : "✓ Lineup saved."}</span>}
          {admin && t.coachTeamId !== teamId && <span className="ml-2 text-amber-400">(editing as commissioner)</span>}
        </p>
        {nominees.length > 0
          ? <CoachRoom eventId={ev.id} div={t.key} teamName={t.name} editable={editable}
              nominees={nominees.map((p) => ({ id: p.id, name: p.name, slot: p.slot, teamId: p.teamId, teamCode: p.teamCode, teamLogo: p.teamLogo, line: p.line, hurt: p.hurt }))}
              initial={t.roster ? { roster: t.roster, units: t.units ?? [], starter: t.starter, shootout: t.shootout } : null} />
          : <p className="text-sm text-slate-500">Nominees appear here once nominations close.</p>}
      </Card>
    </>,
  );
}
