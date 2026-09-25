"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retireNumberAction, unretireNumberAction } from "@/app/teams/[slug]/retired-numbers/actions";

type Cand = { playerId: number; name: string; number: number | null; gp: number; hof: boolean };
const inp = "rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm";

export function RetireNumberForm({ slug, candidates }: { slug: string; candidates: Cand[] }) {
  const [pid, setPid] = useState(candidates[0]?.playerId ?? 0);
  const cur = candidates.find((c) => c.playerId === pid);
  const [num, setNum] = useState(cur?.number ? String(cur.number) : "");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-end gap-2 text-xs">
      <label className="flex flex-col gap-1 text-slate-400">Player
        <select className={inp} value={pid} onChange={(e) => { const id = Number(e.target.value); setPid(id); const c = candidates.find((x) => x.playerId === id); setNum(c?.number ? String(c.number) : ""); }}>
          {candidates.map((c) => <option key={c.playerId} value={c.playerId}>{c.name} — {c.gp} GP{c.hof ? " · HoF" : ""}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-slate-400">No.<input className={`${inp} w-14`} value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 2))} /></label>
      <label className="flex flex-col gap-1 text-slate-400">Tribute (optional)<input className={`${inp} w-72`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Captain of the 2031 Cup team…" /></label>
      <button disabled={pending || !pid || !num} onClick={() => start(async () => { const r = await retireNumberAction(slug, pid, Number(num), note); setMsg(r.ok ? "Retired — the ceremony is in League News." : r.error); if (r.ok) router.refresh(); })} className="rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-3 py-1.5 font-bold text-white">🎽 Retire the number</button>
      {msg && <span className="text-slate-400">{msg}</span>}
    </div>
  );
}

export function UnretireButton({ slug, id }: { slug: string; id: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return <button disabled={pending} title="Remove (admin)" onClick={() => start(async () => { if (confirm("Remove this retired number?")) { await unretireNumberAction(slug, id); router.refresh(); } })} className="text-[10px] text-slate-500 hover:text-red-400">✕</button>;
}
