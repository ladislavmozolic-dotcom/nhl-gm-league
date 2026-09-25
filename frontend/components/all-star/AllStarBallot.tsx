"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitBallotAction } from "@/app/all-star/actions";

type Side = "A" | "B";
type Slot = "F" | "D" | "G";
type P = { id: number; name: string; side: Side; slot: Slot; teamCode: string | null; teamLogo: string | null; line: string };
type Ballot = Record<Side, Record<Slot, number[]>>;
const LIMIT: Record<Slot, number> = { F: 3, D: 2, G: 1 };
const LABEL: Record<Slot, string> = { F: "Forwards", D: "Defense", G: "Goalie" };

export default function AllStarBallot({ eventId, players, initial, sideNames, asGm }: {
  eventId: number; players: P[]; initial: Ballot; sideNames: Record<Side, string>; asGm: boolean;
}) {
  const router = useRouter();
  const [ballot, setBallot] = useState<Ballot>(initial);
  const [q, setQ] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const toggle = (p: P) => setBallot((b) => {
    const cur = b[p.side][p.slot];
    const next = cur.includes(p.id) ? cur.filter((x) => x !== p.id) : cur.length >= LIMIT[p.slot] ? cur : [...cur, p.id];
    return { ...b, [p.side]: { ...b[p.side], [p.slot]: next } };
  });
  const submit = () => start(async () => {
    setMsg(null);
    const r = await submitBallotAction(eventId, ballot);
    if (!r.ok) setMsg({ ok: false, text: r.error });
    else { setMsg({ ok: true, text: r.asGm ? "✅ Your GM ballot is in — you can change it until voting closes." : "✅ Your fan ballot is in — you can change it until voting closes." }); router.refresh(); }
  });
  const filled = (["A", "B"] as const).every((s) => (["F", "D", "G"] as const).every((sl) => ballot[s][sl].length === LIMIT[sl]));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {(["A", "B"] as const).map((side) => (
          <div key={side} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="font-bold text-slate-100">{sideNames[side]}</div>
            {(["F", "D", "G"] as const).map((slot) => {
              const key = `${side}${slot}`;
              const chosen = ballot[side][slot];
              const term = (q[key] ?? "").toLowerCase();
              const matches = term.length < 2 ? [] : players.filter((p) => p.side === side && p.slot === slot && !chosen.includes(p.id) && (p.name.toLowerCase().includes(term) || (p.teamCode ?? "").toLowerCase() === term)).slice(0, 8);
              return (
                <div key={slot}>
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 mb-1.5">
                    <span>{LABEL[slot]}</span><span className={chosen.length === LIMIT[slot] ? "text-emerald-400" : ""}>{chosen.length}/{LIMIT[slot]}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {chosen.map((id) => { const p = byId.get(id); return p ? (
                      <button key={id} onClick={() => toggle(p)} className="inline-flex items-center gap-1.5 rounded-full bg-blue-600/20 border border-blue-500/40 px-2.5 py-1 text-xs text-blue-100 hover:bg-red-600/20 hover:border-red-500/40" title="Remove">
                        {p.teamLogo && <img src={p.teamLogo} alt="" className="w-4 h-4 object-contain" />}{p.name} <span className="text-blue-300/70">✕</span>
                      </button>) : null; })}
                  </div>
                  {chosen.length < LIMIT[slot] && (
                    <div className="relative">
                      <input value={q[key] ?? ""} onChange={(e) => setQ({ ...q, [key]: e.target.value })} placeholder="Search a player or team code…"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600" />
                      {matches.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 shadow-xl max-h-72 overflow-auto">
                          {matches.map((p) => (
                            <button key={p.id} onClick={() => { toggle(p); setQ({ ...q, [key]: "" }); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-800">
                              {p.teamLogo && <img src={p.teamLogo} alt="" className="w-5 h-5 object-contain" />}
                              <span className="font-medium text-slate-100">{p.name}</span><span className="text-xs text-slate-500">{p.teamCode}</span>
                              <span className="ml-auto text-xs text-slate-400 tabular-nums">{p.line}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={submit} disabled={pending || !filled} className="px-4 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40">
          {pending ? "…" : asGm ? "Submit GM ballot" : "Submit fan ballot"}
        </button>
        {!filled && <span className="text-xs text-slate-500">Pick 3 forwards, 2 defensemen and 1 goalie in each conference.</span>}
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
