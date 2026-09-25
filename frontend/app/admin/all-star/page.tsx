import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { cleanName } from "@/lib/playerName";
import { utcToBratislavaLocal } from "@/lib/trade-deadline";
import { latestEvent, votingState, voteStandings, eligiblePlayers, type Rosters } from "@/lib/all-star-server";
import { AllStarEventForm, AllStarControls, AllStarRosterEditor } from "@/components/all-star/AllStarAdmin";

export const dynamic = "force-dynamic";

export default async function AdminAllStarPage() {
  if (!(await isAdmin())) redirect("/login");
  const ev = await latestEvent();
  const loc = (d: Date | null | undefined) => (d ? utcToBratislavaLocal(d) : "");
  const initial = ev
    ? { id: ev.id, title: ev.title, eventAt: loc(ev.eventAt), votingOpensAt: loc(ev.votingOpensAt), votingClosesAt: loc(ev.votingClosesAt), teamAName: ev.teamAName, teamBName: ev.teamBName, fanWeightPct: ev.fanWeightPct, lowDefense: ev.lowDefense }
    : { id: null, title: "UNHL All-Star Weekend", eventAt: "", votingOpensAt: "", votingClosesAt: "", teamAName: "Eastern All-Stars", teamBName: "Western All-Stars", fanWeightPct: 50, lowDefense: true };

  let rosterBlock = null;
  let voteBlock = null;
  if (ev) {
    const rosters = ev.rosters as Rosters | null;
    const [eligible, standings, ballots] = await Promise.all([
      eligiblePlayers(), voteStandings(ev),
      prisma.allStarVote.findMany({ where: { eventId: ev.id }, select: { voterKey: true, isGm: true }, distinct: ["voterKey"] }),
    ]);
    const names: Record<number, string> = Object.fromEntries(eligible.map((p) => [p.id, `${p.name} (${p.teamCode ?? "—"})`]));
    if (rosters) {
      const missing = (["A", "B"] as const).flatMap((s) => [...rosters[s].F, ...rosters[s].D, ...rosters[s].G]).filter((id) => !names[id]);
      for (const p of missing.length ? await prisma.player.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } }) : []) names[p.id] = cleanName(p.name);
      rosterBlock = <AllStarRosterEditor eventId={ev.id} rosters={rosters} players={eligible.map((p) => ({ id: p.id, name: p.name, side: p.side, slot: p.slot, teamCode: p.teamCode }))} names={names} sideNames={{ A: ev.teamAName, B: ev.teamBName }} />;
    }
    const gm = ballots.filter((b) => b.isGm).length, fans = ballots.length - gm;
    voteBlock = (
      <div className="text-sm text-slate-300 space-y-2">
        <p>Voting: <b>{votingState(ev)}</b> · {fans} fan ballots · {gm} GM ballots</p>
        <ol className="grid gap-x-6 md:grid-cols-2 text-xs text-slate-400">
          {standings.slice(0, 20).map((s) => <li key={s.playerId}>{s.side === "A" ? "East" : "West"} {s.slot} — {names[s.playerId] ?? s.playerId}: {(s.score * 100).toFixed(1)}% ({s.fanVotes} fan / {s.gmVotes} GM)</li>)}
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="⭐ All-Star Weekend" subtitle="Plan the date, the fan vote and the rosters" right={<BackPill href="/admin">Admin</BackPill>} />
      <Card title={ev ? "Event" : "Create the event"} accent="text-amber-400">
        <AllStarEventForm initial={initial} />
      </Card>
      {ev && (
        <>
          <Card title="Controls" accent="text-blue-400" right={<Link href="/all-star" className="text-xs text-blue-400 hover:underline">Public page →</Link>}>
            <AllStarControls eventId={ev.id} hasRosters={!!ev.rosters} done={ev.status === "DONE"} />
          </Card>
          <Card title="Vote" accent="text-violet-400">{voteBlock}</Card>
          <Card title="Rosters" accent="text-emerald-400">
            {rosterBlock ?? <p className="text-sm text-slate-500">Rosters are built automatically when voting closes — or press &quot;Build rosters now&quot;. You can then add / remove anyone.</p>}
          </Card>
        </>
      )}
    </div>
  );
}
