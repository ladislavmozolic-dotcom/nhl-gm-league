"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBonusPickAction, removeBonusPickAction, randomiseBonusRoundAction } from "@/app/draft/room/actions";

export type BonusTeam = { id: number; code: string; name: string };
export type BonusRow = { id: number; round: number; teamCode: string; reason: string | null; seq: number };

export default function BonusPickManager({ teams, bonus }: { teams: BonusTeam[]; bonus: BonusRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [round, setRound] = useState(8);
  const [teamId, setTeamId] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const add = () => start(async () => {
    setErr(null);
    if (teamId === "") { setErr("Pick a club."); return; }
    const r = await addBonusPickAction({ round, teamId: Number(teamId), reason: reason || undefined });
    if (!r.ok) { setErr(r.error ?? "Failed."); return; }
    setReason(""); setTeamId("");
    router.refresh();
  });
  const remove = (id: number) => start(async () => { await removeBonusPickAction(id); router.refresh(); });
  const randomise = (r: number) => start(async () => { await randomiseBonusRoundAction(r); router.refresh(); });

  // group picks by round (already ordered by seq → shows the drawn order)
  const rounds = [...new Set(bonus.map((b) => b.round))].sort((a, b) => a - b);

  return (
    <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 overflow-hidden">
      <div className="px-3 py-2 border-b border-amber-700/30 text-sm font-semibold text-amber-200">★ Bonus picks · extra rounds</div>
      <div className="p-3 space-y-2.5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-slate-400">Round
            <select value={round} onChange={(e) => setRound(Number(e.target.value))} className="mt-0.5 block rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100">
              {[8, 9, 10, 11, 12].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-slate-400 flex-1 min-w-[140px]">Club
            <select value={teamId} onChange={(e) => setTeamId(e.target.value === "" ? "" : Number(e.target.value))} className="mt-0.5 block w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100">
              <option value="">Select…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
            </select>
          </label>
        </div>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. Article of the month)"
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none" />
        {err && <div className="text-xs text-rose-400">{err}</div>}
        <button onClick={add} disabled={pending} className="rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-1.5">Award bonus pick</button>

        {rounds.map((r) => {
          const picks = bonus.filter((b) => b.round === r);
          const drawn = picks.some((p) => p.seq > 0);
          return (
            <div key={r} className="pt-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-300">Round {r}</span>
                <span className="text-[11px] text-slate-500">{picks.length} pick{picks.length === 1 ? "" : "s"} · {drawn ? "order drawn" : "order not drawn"}</span>
                <button onClick={() => randomise(r)} disabled={pending} className="ml-auto text-xs rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-2.5 py-1 font-medium">🎲 Randomise order</button>
              </div>
              {picks.map((b, i) => (
                <div key={b.id} className="flex items-center gap-2 text-sm rounded-lg bg-slate-900/40 px-2.5 py-1.5">
                  <span className="w-5 text-right text-xs text-slate-500 tabular-nums">{drawn ? b.seq : i + 1}</span>
                  <span className="font-medium text-slate-100">{b.teamCode}</span>
                  {b.reason && <span className="text-xs text-slate-500 truncate">· {b.reason}</span>}
                  <button onClick={() => remove(b.id)} disabled={pending} className="ml-auto text-xs text-rose-400/80 hover:text-rose-300 underline">remove</button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
