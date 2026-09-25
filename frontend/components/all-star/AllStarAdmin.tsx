"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveAllStarEventAction, setAllStarTeamAction, sendNominationsNowAction, closeNominationsNowAction,
  autoFillTeamAction, runAllStarNowAction, resetAllStarResultsAction, deleteAllStarEventAction, type EventForm,
} from "@/app/admin/all-star/actions";

type DivKey = "ATL" | "MET" | "CEN" | "PAC";
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
  const Msg = () => (msg ? <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span> : null);
  return { pending, run, Msg };
}

/** "YYYY-MM-DDTHH:mm" ± days, as plain wall-clock arithmetic (the input is Bratislava time). */
const shift = (local: string, days: number) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days, +m[4], +m[5]));
  return d.toISOString().slice(0, 16);
};

export function AllStarEventForm({ initial }: { initial: EventForm }) {
  const [f, setF] = useState<EventForm>(initial);
  const { pending, run, Msg } = useAct();
  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => setF({ ...f, [k]: v });
  const standard = () => f.eventAt && setF({ ...f, nomOpensAt: shift(f.eventAt, -7), nomClosesAt: shift(f.eventAt, -2), coachDeadlineAt: shift(f.eventAt, 0) });
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-400 space-y-1 md:col-span-2 block">Event title<input className={input} value={f.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label className="text-xs text-slate-400 space-y-1 block">🏒 Game day & time — Skills + 3-on-3 tournament (Bratislava)
          <input type="datetime-local" className={input} value={f.eventAt} onChange={(e) => set("eventAt", e.target.value)} /></label>
        <div className="flex items-end"><button type="button" className={`${btn} border border-slate-700 text-slate-200 hover:bg-slate-800`} onClick={standard} disabled={!f.eventAt}>↺ Standard schedule (−7 d / −2 d)</button></div>
        <label className="text-xs text-slate-400 space-y-1 block">🗳️ GM nominations open<input type="datetime-local" className={input} value={f.nomOpensAt} onChange={(e) => set("nomOpensAt", e.target.value)} /></label>
        <label className="text-xs text-slate-400 space-y-1 block">🗳️ GM nominations close<input type="datetime-local" className={input} value={f.nomClosesAt} onChange={(e) => set("nomClosesAt", e.target.value)} /></label>
        <label className="text-xs text-slate-400 space-y-1 block">📋 Coaches&apos; lineups due (blank = game time)<input type="datetime-local" className={input} value={f.coachDeadlineAt} onChange={(e) => set("coachDeadlineAt", e.target.value)} /></label>
        <label className="text-xs text-slate-400 space-y-1 block">🏆 MVP&apos;s club gets a bonus pick in round (0 = none)
          <input type="number" min={0} max={20} className={input} value={f.mvpBonusRound} onChange={(e) => set("mvpBonusRound", Number(e.target.value))} /></label>
        <label className="flex items-center gap-2 text-sm text-slate-300 md:col-span-2"><input type="checkbox" checked={f.lowDefense} onChange={(e) => set("lowDefense", e.target.checked)} /> All-Star style — wide-open, no penalties (~8-10 goals a game)</label>
      </div>
      <div className="flex items-center gap-3">
        <button className={`${btn} bg-blue-600 hover:bg-blue-500 text-white`} disabled={pending} onClick={() => run(() => saveAllStarEventAction(f), "Saved.")}>{pending ? "…" : f.id ? "Save changes" : "Create event"}</button>
        <Msg />
      </div>
      <p className="text-xs text-slate-500">The cron does the rest: at the nomination opening every GM gets a message with the nomination form; at the close missing clubs are auto-nominated and the four coaches are messaged; at game time any unfinished lineup is filled in, the Skills Competition + semis + final are played, the MVP&apos;s club gets its bonus pick and the results go to News.</p>
    </div>
  );
}

export function AllStarTeamRow({ eventId, div, name, coachTeamId, gms, status }: {
  eventId: number; div: DivKey; name: string; coachTeamId: number | null; gms: { id: number; label: string }[]; status: string;
}) {
  const [n, setN] = useState(name);
  const [c, setC] = useState<number | null>(coachTeamId);
  const { pending, run, Msg } = useAct();
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto] items-center border-b border-slate-800 pb-3">
      <input className={input} value={n} onChange={(e) => setN(e.target.value)} />
      <select className={input} value={c ?? ""} onChange={(e) => setC(e.target.value ? Number(e.target.value) : null)}>
        <option value="">— no coach (auto lineup) —</option>
        {gms.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
      </select>
      <button className={`${btn} bg-blue-600 hover:bg-blue-500 text-white`} disabled={pending} onClick={() => run(() => setAllStarTeamAction(eventId, div, n, c), "Saved.")}>Save</button>
      <div className="flex items-center gap-2">
        <a href={`/all-star/coach?div=${div}`} className="text-xs text-blue-400 hover:underline whitespace-nowrap">Coach room →</a>
        <button className="text-xs text-slate-400 hover:text-white whitespace-nowrap" disabled={pending} onClick={() => run(() => autoFillTeamAction(eventId, div), "Auto lineup set.", "Replace this team's lineup with the automatic one?")}>Auto lineup</button>
      </div>
      <div className="md:col-span-4 text-xs text-slate-500">{status} <Msg /></div>
    </div>
  );
}

export function AllStarControls({ eventId, done }: { eventId: number; done: boolean }) {
  const { pending, run, Msg } = useAct();
  const b2 = `${btn} border border-slate-700 text-slate-200 hover:bg-slate-800`;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button className={b2} disabled={pending} onClick={() => run(() => sendNominationsNowAction(eventId), "Nomination messages sent.", "Send the nomination message to every GM now?")}>📨 Send nomination messages now</button>
        <button className={b2} disabled={pending} onClick={() => run(() => closeNominationsNowAction(eventId), "Nominations closed, coaches notified.", "Close nominations now (auto-fill missing clubs) and message the coaches?")}>🔒 Close nominations now</button>
        <button className={`${btn} bg-amber-600 hover:bg-amber-500 text-white`} disabled={pending} onClick={() => run(() => runAllStarNowAction(eventId), "Played — results are live.", done ? "Results already exist. Re-play everything?" : "Play the Skills Competition and the tournament now?")}>▶ Play now</button>
        {done && <button className={b2} disabled={pending} onClick={() => run(() => resetAllStarResultsAction(eventId), "Results cleared.", "Clear results and take back the MVP bonus pick? Nominations and lineups stay.")}>Clear results</button>}
        <button className={`${btn} border border-red-800 text-red-300 hover:bg-red-950`} disabled={pending} onClick={() => run(() => deleteAllStarEventAction(eventId), "Deleted.", "Delete this event with all nominations and results?")}>Delete event</button>
      </div>
      <Msg />
    </div>
  );
}
