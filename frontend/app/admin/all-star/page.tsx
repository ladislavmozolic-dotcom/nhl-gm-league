import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { utcToBratislavaLocal } from "@/lib/trade-deadline";
import { latestEvent, teamsOf, phaseOf, nominations, DIVS } from "@/lib/all-star-server";
import { AllStarEventForm, AllStarControls, AllStarTeamRow } from "@/components/all-star/AllStarAdmin";

export const dynamic = "force-dynamic";
const PHASE: Record<string, string> = { planned: "Planned — nominations not open yet", nominations: "GM nominations open", coaches: "Coaches picking lineups", ready: "Ready — plays at game time", done: "Played" };

export default async function AdminAllStarPage() {
  if (!(await isAdmin())) redirect("/login");
  const ev = await latestEvent();
  const loc = (d: Date | null | undefined) => (d ? utcToBratislavaLocal(d) : "");
  const initial = ev
    ? { id: ev.id, title: ev.title, eventAt: loc(ev.eventAt), nomOpensAt: loc(ev.votingOpensAt), nomClosesAt: loc(ev.votingClosesAt), coachDeadlineAt: loc(ev.coachDeadlineAt), lowDefense: ev.lowDefense, mvpBonusRound: ev.mvpBonusRound }
    : { id: null, title: "UNHL All-Star Weekend", eventAt: "", nomOpensAt: "", nomClosesAt: "", coachDeadlineAt: "", lowDefense: true, mvpBonusRound: 8 };

  const clubs = await prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, name: true, code: true, division: true, gm: true, gmNickname: true, passwordHash: true }, orderBy: { name: "asc" } });
  const gms = clubs.filter((c) => c.passwordHash).map((c) => ({ id: c.id, label: `${c.gmNickname || c.gm || "GM"} — ${c.code ?? c.name}` }));
  const noms = ev ? await nominations(ev.id) : new Map();

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="⭐ All-Star Weekend" subtitle="4 division teams · GM nominations · coach-GMs · 3-on-3 tournament" right={<BackPill href="/admin">Admin</BackPill>} />
      <Card title={ev ? `Event — ${PHASE[phaseOf(ev)]}` : "Create the event"} accent="text-amber-400"><AllStarEventForm initial={initial} /></Card>
      {ev && (
        <>
          <Card title="Teams & coaches" accent="text-blue-400" right={<Link href="/all-star" className="text-xs text-blue-400 hover:underline">Public page →</Link>}>
            <div className="space-y-3">
              {teamsOf(ev).map((t) => (
                <AllStarTeamRow key={t.key} eventId={ev.id} div={t.key} name={t.name} coachTeamId={t.coachTeamId} gms={gms}
                  status={`${DIVS.find((d) => d.key === t.key)!.division} · ${t.roster ? (t.auto ? "auto lineup" : `lineup saved ${new Date(t.submittedAt!).toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" })}`) : "no lineup yet"}`} />
              ))}
            </div>
          </Card>
          <Card title="Controls" accent="text-amber-400"><AllStarControls eventId={ev.id} done={ev.status === "DONE"} /></Card>
          <Card title={`Nominations — ${[...noms.values()].filter((n) => !n.auto).length} sent by GMs · ${[...noms.values()].filter((n) => n.auto).length} automatic · ${clubs.length - noms.size} missing`} accent="text-violet-400">
            <div className="grid gap-x-6 gap-y-1 md:grid-cols-2 xl:grid-cols-4 text-xs">
              {DIVS.map((d) => (
                <div key={d.key}>
                  <div className="font-bold text-slate-300 mb-1">{d.division}</div>
                  {clubs.filter((c) => c.division === d.division).map((c) => {
                    const n = noms.get(c.id);
                    return <div key={c.id} className="flex justify-between"><span className="text-slate-400">{c.code} {c.passwordHash ? "" : "🤖"}</span><span className={n ? (n.auto ? "text-amber-400" : "text-emerald-400") : "text-slate-600"}>{n ? (n.auto ? "auto" : "✓ sent") : "—"}</span></div>;
                  })}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
