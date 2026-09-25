import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { cleanName } from "@/lib/playerName";
import {
  latestEvent, votingState, eligiblePlayers, ballotOf, voteStandings,
  type Rosters, type Side, type Slot, type AllStarGameResult,
} from "@/lib/all-star-server";
import { SKILLS_EVENTS, type SkillsResult } from "@/lib/all-star";
import AllStarBallot from "@/components/all-star/AllStarBallot";
import Countdown from "@/components/all-star/Countdown";
import { myVoterKey } from "./actions";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", dateStyle: "full", timeStyle: "short" });
const SLOT_LABEL: Record<Slot, string> = { F: "Forwards", D: "Defense", G: "Goalies" };

export default async function AllStarPage() {
  const ev = await latestEvent();
  if (!ev) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="⭐ All-Star Game" subtitle="The league's mid-season showcase" />
        <Card><p className="text-sm text-slate-400">No All-Star Weekend is scheduled yet — the commissioner will announce the date and the fan vote here.</p></Card>
      </div>
    );
  }
  const now = new Date();
  const vs = votingState(ev, now);
  const sideName: Record<Side, string> = { A: ev.teamAName, B: ev.teamBName };
  const rosters = ev.rosters as Rosters | null;
  const skills = ev.skills as SkillsResult | null;
  const game = ev.game as AllStarGameResult | null;

  const [standings, eligible, voterKey, teamId] = await Promise.all([
    voteStandings(ev), eligiblePlayers(), myVoterKey(), getTeamSession(),
  ]);
  const pById = new Map(eligible.map((p) => [p.id, p]));
  const rosterIds = rosters ? (["A", "B"] as const).flatMap((s) => [...rosters[s].F, ...rosters[s].D, ...rosters[s].G]) : [];
  const extra = rosterIds.filter((id) => !pById.has(id));
  const extraRows = extra.length ? await prisma.player.findMany({ where: { id: { in: extra } }, select: { id: true, name: true, slug: true, team: { select: { code: true, logoUrl: true } } } }) : [];
  const info = (id: number) => {
    const p = pById.get(id);
    if (p) return { name: p.name, slug: p.slug, teamCode: p.teamCode, logo: p.teamLogo, line: p.line };
    const x = extraRows.find((r) => r.id === id);
    return { name: cleanName(x?.name ?? "?"), slug: x?.slug ?? null, teamCode: x?.team?.code ?? null, logo: x?.team?.logoUrl ?? null, line: "" };
  };
  const myBallot = voterKey ? await ballotOf(ev.id, voterKey) : { A: { F: [], D: [], G: [] }, B: { F: [], D: [], G: [] } };
  const fanBallots = new Set((await prisma.allStarVote.findMany({ where: { eventId: ev.id, isGm: false }, select: { voterKey: true }, distinct: ["voterKey"] })).map((v) => v.voterKey)).size;
  const gmBallots = new Set((await prisma.allStarVote.findMany({ where: { eventId: ev.id, isGm: true }, select: { voterKey: true }, distinct: ["voterKey"] })).map((v) => v.voterKey)).size;

  return (
    <div className="space-y-6 py-2">
      <PageHeader title={`⭐ ${ev.title}`} subtitle={`${ev.teamAName} vs ${ev.teamBName} · ${fmt(ev.eventAt)}`} />

      {/* status strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Fan vote</div>
          <div className="mt-1 text-lg font-bold text-slate-100">
            {vs === "open" ? <>Open · closes in <Countdown to={ev.votingClosesAt!.toISOString()} /></> : vs === "upcoming" ? <>Opens in <Countdown to={ev.votingOpensAt!.toISOString()} /></> : vs === "closed" ? "Closed" : "No public vote"}
          </div>
          <div className="text-xs text-slate-500 mt-1">{fanBallots} fan ballot{fanBallots === 1 ? "" : "s"} · {gmBallots} GM ballot{gmBallots === 1 ? "" : "s"} · fans {ev.fanWeightPct}% / GMs {100 - ev.fanWeightPct}%</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Skills Competition + Game</div>
          <div className="mt-1 text-lg font-bold text-slate-100">{ev.status === "DONE" ? "Played" : <>Starts in <Countdown to={ev.eventAt.toISOString()} done="any minute" /></>}</div>
          <div className="text-xs text-slate-500 mt-1">{fmt(ev.eventAt)}</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">How it works</div>
          <p className="text-xs text-slate-400 mt-1">Vote 3 forwards, 2 defensemen and 1 goalie per conference — they&apos;re the starters. The rest of each 12F / 6D / 2G roster is picked on season performance, with every club getting at least one All-Star.</p>
        </div>
      </div>

      {game && (
        <Card title="🏒 All-Star Game" accent="text-amber-400">
          <div className="flex items-center justify-center gap-6 py-2">
            <div className="text-right"><div className="font-bold text-slate-200">{ev.teamAName}</div><div className="text-xs text-slate-500">{game.shotsA} shots</div></div>
            <div className="text-4xl font-black tabular-nums">{game.scoreA} – {game.scoreB}</div>
            <div><div className="font-bold text-slate-200">{ev.teamBName}</div><div className="text-xs text-slate-500">{game.shotsB} shots</div></div>
          </div>
          {game.endedIn !== "REG" && <p className="text-center text-xs text-slate-500">Final ({game.endedIn})</p>}
          {game.mvp && <p className="text-center mt-2 text-sm">🏆 MVP: <b className="text-amber-300">{game.mvp.name}</b> <span className="text-slate-500">({game.mvp.teamCode}) · {game.mvp.g}G {game.mvp.a}A</span></p>}
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Scoring</div>
              <ul className="space-y-1 text-sm">
                {game.goals.map((g, i) => (
                  <li key={i} className="flex gap-2"><span className="text-xs text-slate-500 w-16 shrink-0 tabular-nums">{g.period > 3 ? (g.period === 4 ? "OT" : "SO") : `P${g.period}`} {g.time}</span>
                    <span className={g.side === "A" ? "text-sky-300" : "text-rose-300"}>{g.scorer}</span>{g.assists.length > 0 && <span className="text-slate-500 text-xs pt-0.5">({g.assists.join(", ")})</span>}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">⭐ Three stars</div>
              <ol className="space-y-1 text-sm">{game.stars.map((s, i) => <li key={s.id}>{"★".repeat(i + 1)} <b>{s.name}</b> <span className="text-slate-500">({s.teamCode}) {s.g}G {s.a}A</span></li>)}</ol>
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mt-3 mb-1">Goalies</div>
              <ul className="text-sm space-y-0.5">{game.goalies.map((g) => <li key={g.id}>{g.name} <span className="text-slate-500">— {g.sv}/{g.sa} saves</span></li>)}</ul>
            </div>
          </div>
        </Card>
      )}

      {skills && (
        <Card title={`🎯 Skills Competition — ${ev.teamAName} ${skills.points.A} : ${skills.points.B} ${ev.teamBName}`} accent="text-sky-400">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {skills.events.map((e) => (
              <div key={e.key} className="rounded-lg border border-slate-800 p-3">
                <div className="font-bold text-slate-100">{e.title}</div>
                <div className="text-[11px] text-slate-500 mb-2">{SKILLS_EVENTS.find((x) => x.key === e.key)?.about}</div>
                <ol className="space-y-1 text-sm">
                  {e.rows.map((r, i) => (
                    <li key={`${r.id}-${i}`} className={`flex items-center gap-2 ${i === 0 ? "text-amber-300 font-semibold" : "text-slate-300"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${r.side === "A" ? "bg-sky-400" : "bg-rose-400"}`} />
                      <span className="flex-1 truncate">{i === 0 ? "🥇 " : ""}{r.name} <span className="text-xs text-slate-500">{r.teamCode}</span></span>
                      <span className="tabular-nums">{r.display}</span>
                      {r.detail && <span className="text-[10px] text-slate-500">{r.detail}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Card>
      )}

      {rosters && (
        <Card title="👥 All-Star rosters" accent="text-emerald-400">
          <div className="grid gap-6 md:grid-cols-2">
            {(["A", "B"] as const).map((side) => (
              <div key={side}>
                <div className={`font-bold mb-2 ${side === "A" ? "text-sky-300" : "text-rose-300"}`}>{sideName[side]}</div>
                {(["F", "D", "G"] as const).map((slot) => (
                  <div key={slot} className="mb-3">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{SLOT_LABEL[slot]}</div>
                    <ul className="text-sm space-y-0.5">
                      {rosters[side][slot].map((id) => { const p = info(id); return (
                        <li key={id} className="flex items-center gap-2">
                          {p.logo && <img src={p.logo} alt="" className="w-4 h-4 object-contain" />}
                          <Link href={`/players/${p.slug ?? id}`} className="hover:text-blue-400">{p.name}</Link>
                          <span className="text-xs text-slate-500">{p.teamCode}</span>
                          {rosters[side].starters.includes(id) && <span className="text-[10px] font-bold text-amber-300">★ fan starter</span>}
                        </li>); })}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      {vs === "open" && (
        <Card title={teamId != null ? "🗳️ Your GM ballot" : "🗳️ Fan ballot"} accent="text-blue-400">
          <AllStarBallot eventId={ev.id} players={eligible.map(({ slug: _s, teamId: _t, ...p }) => p)} initial={myBallot} sideNames={sideName} asGm={teamId != null} />
        </Card>
      )}

      {(vs === "open" || vs === "closed") && standings.length > 0 && (
        <Card title="📊 Vote leaders" accent="text-violet-400">
          <div className="grid gap-6 md:grid-cols-2">
            {(["A", "B"] as const).map((side) => (
              <div key={side}>
                <div className="font-bold mb-2 text-slate-200">{sideName[side]}</div>
                {(["F", "D", "G"] as const).map((slot) => {
                  const top = standings.filter((s) => s.side === side && s.slot === slot).slice(0, slot === "F" ? 6 : slot === "D" ? 4 : 3);
                  return (
                    <div key={slot} className="mb-3">
                      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{SLOT_LABEL[slot]}</div>
                      {top.length === 0 ? <p className="text-xs text-slate-600">No votes yet.</p> : (
                        <ul className="text-sm space-y-0.5">
                          {top.map((s, i) => { const p = info(s.playerId); const starter = i < (slot === "F" ? 3 : slot === "D" ? 2 : 1); return (
                            <li key={s.playerId} className={`flex items-center gap-2 ${starter ? "text-slate-100" : "text-slate-400"}`}>
                              <span className="w-4 text-right text-xs text-slate-500">{i + 1}</span>
                              <span className="flex-1 truncate">{p.name} <span className="text-xs text-slate-500">{p.teamCode}</span></span>
                              <span className="text-xs tabular-nums text-slate-400">{(s.score * 100).toFixed(1)}%</span>
                            </li>); })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">Score = fans {ev.fanWeightPct}% × share of fan ballots + GMs {100 - ev.fanWeightPct}% × share of GM ballots. The top {`3 F / 2 D / 1 G`} in each conference start.</p>
        </Card>
      )}
    </div>
  );
}
