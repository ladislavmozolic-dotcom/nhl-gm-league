"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { appealSuspensionAction, ruleOnSuspensionAction, issueDisciplineAction } from "@/app/league/player-safety/actions";

const inp = "rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm";

export function AppealForm({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-amber-600 hover:bg-amber-500 px-3 py-1 text-xs font-bold text-white">Appeal to the commissioner</button>;
  return (
    <div className="mt-2 space-y-2">
      <textarea className={`${inp} w-full h-20`} placeholder="Why should the suspension be reduced or overturned?" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex gap-2 items-center">
        <button disabled={pending} onClick={() => start(async () => { const r = await appealSuspensionAction(id, text); setMsg(r.ok ? "Appeal filed." : r.error); if (r.ok) { setOpen(false); router.refresh(); } })} className="rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-3 py-1 text-xs font-bold text-white">File appeal</button>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400">Cancel</button>
        {msg && <span className="text-xs text-slate-400">{msg}</span>}
      </div>
    </div>
  );
}

export function RulingForm({ id, games }: { id: number; games: number }) {
  const [reduce, setReduce] = useState(String(Math.max(1, games - 1)));
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (d: "UPHELD" | "REDUCED" | "OVERTURNED") => start(async () => { const r = await ruleOnSuspensionAction(id, d, d === "REDUCED" ? Number(reduce) : null, note); setMsg(r.ok ? "Done." : r.error); router.refresh(); });
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
      <input className={`${inp} w-64`} placeholder="Note to the club (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button disabled={pending} onClick={() => go("UPHELD")} className="rounded bg-slate-700 hover:bg-slate-600 px-2.5 py-1 font-bold">Uphold</button>
      {games > 1 && <><button disabled={pending} onClick={() => go("REDUCED")} className="rounded bg-sky-700 hover:bg-sky-600 px-2.5 py-1 font-bold">Reduce to</button><input className={`${inp} w-14`} value={reduce} onChange={(e) => setReduce(e.target.value.replace(/\D/g, ""))} /><span className="text-slate-500">games</span></>}
      <button disabled={pending} onClick={() => go("OVERTURNED")} className="rounded bg-red-700 hover:bg-red-600 px-2.5 py-1 font-bold">Overturn</button>
      {msg && <span className="text-slate-400">{msg}</span>}
    </div>
  );
}

export function IssueForm() {
  const [player, setPlayer] = useState("");
  const [kind, setKind] = useState<"SUSPENSION" | "FINE">("SUSPENSION");
  const [games, setGames] = useState("2");
  const [fine, setFine] = useState("5000");
  const [incident, setIncident] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-end gap-2 text-xs">
      <label className="flex flex-col gap-1 text-slate-400">Player (name or id)<input className={`${inp} w-48`} value={player} onChange={(e) => setPlayer(e.target.value)} /></label>
      <label className="flex flex-col gap-1 text-slate-400">Ruling
        <select className={inp} value={kind} onChange={(e) => setKind(e.target.value as "SUSPENSION" | "FINE")}><option value="SUSPENSION">Suspension</option><option value="FINE">Fine</option></select>
      </label>
      {kind === "SUSPENSION" ? <label className="flex flex-col gap-1 text-slate-400">Games<input className={`${inp} w-16`} value={games} onChange={(e) => setGames(e.target.value.replace(/\D/g, ""))} /></label>
        : <label className="flex flex-col gap-1 text-slate-400">Fine $<input className={`${inp} w-24`} value={fine} onChange={(e) => setFine(e.target.value.replace(/\D/g, ""))} /></label>}
      <label className="flex flex-col gap-1 text-slate-400">Incident<input className={`${inp} w-80`} value={incident} onChange={(e) => setIncident(e.target.value)} placeholder="Illegal check to the head on …" /></label>
      <button disabled={pending} onClick={() => start(async () => { const r = await issueDisciplineAction({ playerQuery: player, kind, games: Number(games), fine: Number(fine), incident }); setMsg(r.ok ? "Issued." : r.error); if (r.ok) router.refresh(); })} className="rounded bg-red-700 hover:bg-red-600 disabled:opacity-50 px-3 py-1.5 font-bold text-white">Issue</button>
      {msg && <span className="text-slate-400">{msg}</span>}
    </div>
  );
}
