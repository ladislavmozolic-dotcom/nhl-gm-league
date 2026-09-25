"use client";

import { useEffect, useState, useTransition } from "react";
import { nominationFormAction, nominateAction, type NominationFormData } from "@/app/all-star/actions";

type Slot = "F" | "D" | "G";
const LIMIT: Record<Slot, number> = { F: 3, D: 2, G: 1 };
const LABEL: Record<Slot, string> = { F: "Forwards", D: "Defense", G: "Goalie" };

/** The GM's All-Star nomination — used inline in the League Notifications message
 *  and on /all-star/nominate. Loads its own data so a message can just mount it. */
export default function NominationForm({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<NominationFormData | null>(null);
  const [picks, setPicks] = useState<Record<Slot, number[]>>({ F: [], D: [], G: [] });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const load = () => nominationFormAction().then((d) => { setData(d); if (!("error" in d)) setPicks(d.submitted ? d.picks : { F: [], D: [], G: [] }); });
  useEffect(() => { load(); }, []);

  if (!data) return <div className="text-xs text-slate-500 mt-2">Loading your roster…</div>;
  if ("error" in data) return <div className="text-xs text-slate-400 mt-2">{data.error}</div>;
  const toggle = (id: number, slot: Slot) => setPicks((p) => {
    const cur = p[slot];
    return { ...p, [slot]: cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= LIMIT[slot] ? cur : [...cur, id] };
  });
  const full = (["F", "D", "G"] as const).every((s) => picks[s].length === LIMIT[s]);
  const vote = () => start(async () => {
    setMsg(null);
    const r = await nominateAction(data.eventId, picks);
    if (r.ok) { setMsg({ ok: true, text: "✅ Nomination sent — you can change it until the deadline." }); load(); }
    else setMsg({ ok: false, text: r.error });
  });
  const closes = data.closesAt ? new Date(data.closesAt).toLocaleString("sk-SK", { timeZone: "Europe/Bratislava", dateStyle: "medium", timeStyle: "short" }) : null;

  return (
    <div className={`mt-2 rounded-xl border border-slate-700 bg-slate-900/80 ${compact ? "p-2.5" : "p-4"} text-slate-100 space-y-3`}>
      <div className="text-xs text-slate-400">
        {data.teamName} · {data.open ? <>open until <b className="text-slate-200">{closes}</b></> : data.phase === "planned" ? "not open yet" : "nominations are closed"}
        {data.submitted && <span className="ml-2 text-emerald-400 font-semibold">✓ sent</span>}
      </div>
      {(["F", "D", "G"] as const).map((slot) => (
        <div key={slot}>
          <div className="flex justify-between text-[11px] uppercase tracking-wide text-slate-500 mb-1">
            <span>{LABEL[slot]}</span><span className={picks[slot].length === LIMIT[slot] ? "text-emerald-400" : ""}>{picks[slot].length}/{LIMIT[slot]}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.players.filter((p) => p.slot === slot).map((p) => {
              const on = picks[slot].includes(p.id);
              const blocked = !on && picks[slot].length >= LIMIT[slot];
              return (
                <button key={p.id} type="button" disabled={!data.open || blocked} onClick={() => toggle(p.id, slot)}
                  className={`rounded-lg border px-2 py-1 text-xs text-left transition ${on ? "bg-blue-600 border-blue-500 text-white" : "border-slate-700 text-slate-300 hover:border-slate-500"} ${blocked ? "opacity-40" : ""} disabled:cursor-not-allowed`}>
                  <span className="font-semibold">{p.name}</span>{p.hurt && <span title="Injured"> 🏥</span>}
                  <span className={`block text-[10px] ${on ? "text-blue-100" : "text-slate-500"}`}>{p.line}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {data.open && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={vote} disabled={!full || pending} className="px-4 py-1.5 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40">
            {pending ? "…" : data.submitted ? "Update vote" : "Vote"}
          </button>
          {!full && <span className="text-[11px] text-slate-500">Pick 3 F, 2 D and 1 G to vote.</span>}
        </div>
      )}
      {msg && <div className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</div>}
    </div>
  );
}
