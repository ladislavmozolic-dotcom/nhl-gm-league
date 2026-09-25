"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveAllStarEventAction, buildRostersAction, runAllStarNowAction, resetAllStarResultsAction,
  deleteAllStarEventAction, editRosterAction, type EventForm,
} from "@/app/admin/all-star/actions";

type Side = "A" | "B";
type Slot = "F" | "D" | "G";
type P = { id: number; name: string; side: Side; slot: Slot; teamCode: string | null };
type SideRoster = { F: number[]; D: number[]; G: number[]; starters: number[] };

const input = "bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200 w-full";
const btn = "px-3.5 py-1.5 rounded-lg font-semibold text-sm disabled:opacity-50";

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    start(async () => {
      setMsg(null);
      try { const r = await fn(); setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Failed." }); if (r.ok) router.refresh(); }
      catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    });
  };
  return { pending, msg, run };
}

export function AllStarEventForm({ initial }: { initial: EventForm }) {
  const [f, setF] = useState<EventForm>(initial);
  const { pending, msg, run } = useAct();
  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => setF({ ...f, [k]: v });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-400 space-y-1 md:col-span-2 block">Event title<input className={input} value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label className="text-xs text-slate-400 space-y-1 block">🏒 Skills + Game (Bratislava time)<input type="datetime-local" className={input} value={f.eventAt} onChange={(e) => set("eventAt", e.target.value)} /></label>
        <div />
        <label className="text-xs text-slate-400 space-y-1 block">🗳️ Voting opens<input type="datetime-local" className={input} value={f.votingOpensAt} onChange={(e) => set("votingOpensAt", e.target.value)} /></label>
        <label className="text-xs text-slate-400 space-y-1 block">🗳️ Voting closes<input type="datetime-local" className={input} value={f.votingClosesAt} onChange={(e) => set("votingClosesAt", e.target.value)} /></label>
        <label className="text-xs text-slate-400 space-y-1 block">Eastern team name<input className={input} value={f.teamAName} onChange={(e) => set("teamAName", e.target.value)} /></label>
        <label className="text-xs text-slate-400 space-y-1 block">Western team name<input className={input} value={f.teamBName} onChange={(e) => set("teamBName", e.target.value)} /></label>
        <label className="text-xs text-slate-400 space-y-1 block">Fan share of the vote (%) — GMs get the rest
          <input type="number" min={0} max={100} className={input} value={f.fanWeightPct} onChange={(e) => set("fanWeightPct", Number(e.target.value))} /></label>
        <label className="flex items-center gap-2 text-sm text-slate-300 pt-5"><input type="checkbox" checked={f.lowDefense} onChange={(e) => set("lowDefense", e.target.checked)} /> All-Star style (little defense, few penalties, more goals)</label>
      </div>
      <div className="flex items-center gap-3">
        <button className={`${btn} bg-blue-600 hover:bg-blue-500 text-white`} disabled={pending} onClick={() => run(() => saveAllStarEventAction(f), "Saved.")}>{pending ? "…" : f.id ? "Save changes" : "Create event"}</button>
        {msg && <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
      </div>
      <p className="text-xs text-slate-500">When voting opens, an announcement with a &quot;Vote now&quot; link goes to every GM automatically. When it closes, rosters are built. At the event time the Skills Competition and the game are played and the results are posted to News — all by the 5-minute cron, no button needed.</p>
    </div>
  );
}

export function AllStarControls({ eventId, hasRosters, done }: { eventId: number; hasRosters: boolean; done: boolean }) {
  const { pending, msg, run } = useAct();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className={`${btn} border border-slate-700 text-slate-200 hover:bg-slate-800`} disabled={pending}
          onClick={() => run(() => buildRostersAction(eventId), "Rosters built.", hasRosters ? "Rebuild both rosters from the current vote? Manual edits will be lost." : undefined)}>
          {hasRosters ? "Rebuild rosters" : "Build rosters now"}
        </button>
        <button className={`${btn} bg-amber-600 hover:bg-amber-500 text-white`} disabled={pending}
          onClick={() => run(() => runAllStarNowAction(eventId), "Played — results are live.", done ? "Results already exist. Re-run everything (new results)?" : "Play the Skills Competition and the game now?")}>
          ▶ Play now
        </button>
        {done && <button className={`${btn} border border-slate-700 text-slate-200 hover:bg-slate-800`} disabled={pending} onClick={() => run(() => resetAllStarResultsAction(eventId), "Results cleared.", "Clear the results (rosters and votes stay)?")}>Clear results</button>}
        <button className={`${btn} border border-red-800 text-red-300 hover:bg-red-950`} disabled={pending} onClick={() => run(() => deleteAllStarEventAction(eventId), "Deleted.", "Delete this event with all votes and results?")}>Delete event</button>
      </div>
      {msg && <div className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</div>}
    </div>
  );
}

export function AllStarRosterEditor({ eventId, rosters, players, names, sideNames }: {
  eventId: number; rosters: Record<Side, SideRoster>; players: P[]; names: Record<number, string>; sideNames: Record<Side, string>;
}) {
  const { pending, msg, run } = useAct();
  const [q, setQ] = useState<Record<string, string>>({});
  return (
    <div className="space-y-3">
      <div className="grid gap-6 md:grid-cols-2">
        {(["A", "B"] as const).map((side) => (
          <div key={side}>
            <div className="font-bold mb-2 text-slate-200">{sideNames[side]}</div>
            {(["F", "D", "G"] as const).map((slot) => {
              const key = side + slot;
              const term = (q[key] ?? "").toLowerCase();
              const all = new Set([...rosters.A.F, ...rosters.A.D, ...rosters.A.G, ...rosters.B.F, ...rosters.B.D, ...rosters.B.G]);
              const matches = term.length < 2 ? [] : players.filter((p) => p.slot === slot && !all.has(p.id) && p.name.toLowerCase().includes(term)).slice(0, 6);
              return (
                <div key={slot} className="mb-3">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{slot === "F" ? "Forwards" : slot === "D" ? "Defense" : "Goalies"} ({rosters[side][slot].length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {rosters[side][slot].map((id) => (
                      <button key={id} disabled={pending} onClick={() => run(() => editRosterAction(eventId, side, slot, "remove", id), "Removed.")}
                        className="rounded-full border border-slate-700 px-2.5 py-0.5 text-xs text-slate-200 hover:border-red-600 hover:text-red-300" title="Remove">
                        {rosters[side].starters.includes(id) ? "★ " : ""}{names[id] ?? id} ✕
                      </button>
                    ))}
                  </div>
                  <div className="relative mt-1.5">
                    <input className={input} placeholder="Add a player…" value={q[key] ?? ""} onChange={(e) => setQ({ ...q, [key]: e.target.value })} />
                    {matches.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                        {matches.map((p) => (
                          <button key={p.id} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-800" disabled={pending}
                            onClick={() => { setQ({ ...q, [key]: "" }); run(() => editRosterAction(eventId, side, slot, "add", p.id), "Added."); }}>
                            {p.name} <span className="text-xs text-slate-500">{p.teamCode}{p.side !== side ? " · other conference" : ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {msg && <div className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</div>}
    </div>
  );
}
