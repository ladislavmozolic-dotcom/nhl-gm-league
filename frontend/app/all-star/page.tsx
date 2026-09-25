import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getTeamSession } from "@/lib/auth";
import { cleanName } from "@/lib/playerName";
import {
  latestEvent, teamsOf, phaseOf, coachDeadline, nominations, nameOfDiv, DIVS,
  type AllStarTournament, type AsGame, type DivKey,
} from "@/lib/all-star-server";
import { SKILLS_EVENTS, type SkillsResult } from "@/lib/all-star";
import Countdown from "@/components/all-star/Countdown";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", dateStyle: "medium", timeStyle: "short" });
const TEAM_TONE: Record<DivKey, string> = { ATL: "text-sky-300", MET: "text-violet-300", CEN: "text-amber-300", PAC: "text-rose-300" };
const DOT: Record<DivKey, string> = { ATL: "bg-sky-400", MET: "bg-violet-400", CEN: "bg-amber-400", PAC: "bg-rose-400" };

export default async function AllStarPage() {
  const ev = await latestEvent();
  if (!ev) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="⭐ All-Star Game" subtitle="The league's mid-season showcase" />
        <Card><p className="text-sm text-slate-400">No All-Star Weekend is scheduled yet — the commissioner will announce the date here.</p></Card>
      </div>
    );
  }
  const teamId = await getTeamSession();
  const ph = phaseOf(ev);
  const teams = teamsOf(ev);
  const skills = ev.skills as SkillsResult | null;
  const tour = ev.game as AllStarTournament | null;
  const noms = await nominations(ev.id);
  const clubCount = await prisma.team.count({ where: { league: "NHL", isAffiliate: false } });
  const sentByGms = [...noms.values()].filter((n) => !n.auto).length;

  const rosterIds = teams.flatMap((t) => (t.roster ? [...t.roster.F, ...t.roster.D, ...t.roster.G] : []));
  const coachIds = teams.map((t) => t.coachTeamId).filter((x): x is number => x != null);
  const [players, coaches] = await Promise.all([
    rosterIds.length ? prisma.player.findMany({ where: { id: { in: rosterIds } }, select: { id: true, name: true, slug: true, team: { select: { code: true, logoUrl: true } } } }) : Promise.resolve([]),
    coachIds.length ? prisma.team.findMany({ where: { id: { in: coachIds } }, select: { id: true, code: true, logoUrl: true, gm: true, gmNickname: true } }) : Promise.resolve([]),
  ]);
  const pBy = new Map(players.map((p) => [p.id, p]));
  const cBy = new Map(coaches.map((c) => [c.id, c]));
  const pn = (id: number) => cleanName(pBy.get(id)?.name ?? "?");
  const iCoach = teams.some((t) => t.coachTeamId != null && t.coachTeamId === teamId);

  const steps = [
    { key: "nominations", label: "GM nominations", when: ev.votingOpensAt && ev.votingClosesAt ? `${fmt(ev.votingOpensAt)} – ${fmt(ev.votingClosesAt)}` : "—" },
    { key: "coaches", label: "Coaches pick the teams", when: ev.votingClosesAt ? `until ${fmt(coachDeadline(ev))}` : "—" },
    { key: "ready", label: "Skills + 3-on-3 tournament", when: fmt(ev.eventAt) },
  ];
  const order = ["planned", "nominations", "coaches", "ready", "done"];

  const GameCard = ({ g }: { g: AsGame }) => (
    <div className="rounded-lg border border-slate-800 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{g.round === "F" ? "🏆 Final" : "Semi-final"}</div>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-bold ${TEAM_TONE[g.a]} ${g.winner === g.a ? "" : "opacity-60"}`}>{nameOfDiv(teams, g.a)}</span>
        <span className="text-2xl font-black tabular-nums">{g.scoreA} – {g.scoreB}</span>
        <span className={`font-bold ${TEAM_TONE[g.b]} ${g.winner === g.b ? "" : "opacity-60"}`}>{nameOfDiv(teams, g.b)}</span>
      </div>
      <div className="text-[11px] text-slate-500 text-center">{g.endedIn === "SO" ? "Final (SO)" : "Final"} · shots {g.shotsA}–{g.shotsB}</div>
      <ul className="mt-2 space-y-0.5 text-xs">
        {g.goals.map((x, i) => (
          <li key={i} className="flex gap-2"><span className="w-12 shrink-0 tabular-nums text-slate-500">{x.period === 1 ? "1st" : "2nd"} {x.time}</span>
            <span className={TEAM_TONE[x.team]}>{x.scorer}</span>{x.assists.length > 0 && <span className="text-slate-500">({x.assists.join(", ")})</span>}</li>
        ))}
        {g.shootout.length > 0 && <li className="text-slate-400 pt-1">Shootout: {g.shootout.map((s) => `${s.shooter} ${s.result === "goal" ? "✓" : "✗"}`).join(" · ")}</li>}
      </ul>
      <div className="mt-2 text-[11px] text-slate-500">Goalies: {g.goalies.map((x) => `${x.name} ${x.sv}/${x.sa}`).join(" · ")}</div>
    </div>
  );

  return (
    <div className="space-y-6 py-2">
      <PageHeader title={`⭐ ${ev.title}`} subtitle={`4 division teams · 3-on-3 · ${fmt(ev.eventAt)}`} />

      {/* timeline */}
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((s) => {
          const idx = order.indexOf(s.key), cur = order.indexOf(ph);
          const state = cur > idx ? "done" : cur === idx ? "now" : "next";
          return (
            <div key={s.key} className={`rounded-xl border p-4 ${state === "now" ? "border-blue-500/60 bg-blue-950/30" : "border-slate-800 bg-slate-900/60"}`}>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">{state === "done" ? "✓ done" : state === "now" ? "● now" : "next"}</div>
              <div className="mt-1 font-bold text-slate-100">{s.label}</div>
              <div className="text-xs text-slate-400 mt-1">{s.when}</div>
              {state === "now" && s.key === "nominations" && ev.votingClosesAt && <div className="text-xs text-blue-300 mt-1">closes in <Countdown to={ev.votingClosesAt.toISOString()} /></div>}
              {state === "now" && s.key === "coaches" && <div className="text-xs text-blue-300 mt-1">due in <Countdown to={coachDeadline(ev).toISOString()} /></div>}
              {(state === "now" || state === "next") && s.key === "ready" && <div className="text-xs text-blue-300 mt-1">starts in <Countdown to={ev.eventAt.toISOString()} done="any minute" /></div>}
            </div>
          );
        })}
      </div>

      {ph === "nominations" && (
        <Card title="🗳️ Nominations" accent="text-blue-400">
          <p className="text-sm text-slate-400">{sentByGms} of {clubCount} clubs have nominated. Every GM nominates 3 forwards, 2 defensemen and 1 goalie from his roster — clubs that don&apos;t are filled in automatically at the deadline.</p>
          {teamId != null && <Link href="/all-star/nominate" className="mt-3 inline-block rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-bold text-white">{noms.get(teamId) ? "✓ Change your nomination" : "Nominate your All-Stars →"}</Link>}
        </Card>
      )}
      {iCoach && ph === "coaches" && (
        <Card title="📋 You're an All-Star coach" accent="text-amber-400">
          <Link href="/all-star/coach" className="inline-block rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-sm font-bold text-white">Open the coach room →</Link>
        </Card>
      )}

      {tour && (
        <Card title={`🏒 Tournament — ${nameOfDiv(teams, tour.champion)} win!`} accent="text-amber-400">
          {tour.mvp && (
            <p className="mb-4 text-sm">🏆 MVP: <b className="text-amber-300">{tour.mvp.name}</b> <span className="text-slate-500">({tour.mvp.clubCode}) · {tour.mvp.g}G {tour.mvp.a}A</span>
              {tour.mvpPick && <span className="ml-2 text-emerald-400">→ {tour.mvpPick.clubCode} earn a bonus round-{tour.mvpPick.round} pick in the {tour.mvpPick.year} draft</span>}</p>
          )}
          <div className="grid gap-4 md:grid-cols-3">{tour.games.map((g) => <GameCard key={g.round} g={g} />)}</div>
        </Card>
      )}

      {skills && (
        <Card title={`🎯 Skills Competition — ${Object.entries(skills.points).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${nameOfDiv(teams, k as DivKey)} ${v}`).join(" · ")}`} accent="text-sky-400">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {skills.events.map((e) => (
              <div key={e.key} className="rounded-lg border border-slate-800 p-3">
                <div className="font-bold text-slate-100">{e.title}</div>
                <div className="text-[11px] text-slate-500 mb-2">{SKILLS_EVENTS.find((x) => x.key === e.key)?.about}</div>
                <ol className="space-y-1 text-sm">
                  {e.rows.map((r, i) => (
                    <li key={`${r.id}-${i}`} className={`flex items-center gap-2 ${i === 0 ? "text-amber-300 font-semibold" : "text-slate-300"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${DOT[r.side as DivKey] ?? "bg-slate-500"}`} />
                      <span className="flex-1 truncate">{i === 0 ? "🥇 " : ""}{r.name} <span className="text-xs text-slate-500">{r.teamCode}</span></span>
                      <span className="tabular-nums">{r.display}</span>{r.detail && <span className="text-[10px] text-slate-500">{r.detail}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="👥 The four teams" accent="text-emerald-400">
        <div className="grid gap-6 md:grid-cols-2">
          {teams.map((t) => {
            const c = t.coachTeamId ? cBy.get(t.coachTeamId) : null;
            return (
              <div key={t.key}>
                <div className={`font-bold ${TEAM_TONE[t.key]}`}>{t.name} <span className="text-xs font-normal text-slate-500">{DIVS.find((d) => d.key === t.key)!.division}</span></div>
                <div className="text-xs text-slate-400 mb-2">Coach: {c ? <>{c.logoUrl && <img src={c.logoUrl} alt="" className="inline w-4 h-4 object-contain mr-1" />}{c.gmNickname || c.gm || "GM"} ({c.code})</> : "to be announced"}</div>
                {t.roster ? (
                  <div className="space-y-2 text-sm">
                    {t.units?.map((u, i) => <div key={i}><span className="text-[11px] uppercase tracking-wider text-slate-500 mr-2">Unit {i + 1}</span>{u.map(pn).join(" · ")}</div>)}
                    <div><span className="text-[11px] uppercase tracking-wider text-slate-500 mr-2">Goalies</span>{t.roster.G.map((id) => `${pn(id)}${id === t.starter ? " (starts)" : ""}`).join(" · ")}</div>
                    <div className="text-xs text-slate-500">Full roster: {[...t.roster.F, ...t.roster.D, ...t.roster.G].map((id) => `${pn(id)} (${pBy.get(id)?.team?.code ?? "—"})`).join(", ")}</div>
                    {t.auto && <div className="text-[11px] text-amber-400/80">Lineup set automatically</div>}
                  </div>
                ) : <p className="text-xs text-slate-600">Roster to come — picked by the coach from the division&apos;s nominees.</p>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
