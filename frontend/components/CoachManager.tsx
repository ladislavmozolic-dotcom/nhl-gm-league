"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { coachDemand, coachBuyout } from "@/lib/coach-contract";
import { fireCoachAction, hireCoachAction } from "@/app/teams/[slug]/coach/actions";

type Coach = { id: number; name: string; country: string | null; style: string; overall: number; age: number | null;
  ph: number; df: number; of: number; pd: number; ex: number; ld: number; salary: number; contract: number };

const money = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`;
const STYLE_CLASS: Record<string, string> = {
  Offensive: "bg-rose-500/15 text-rose-300 border-rose-500/30", Defensive: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  Physical: "bg-amber-500/15 text-amber-300 border-amber-500/30", Balanced: "bg-slate-600/20 text-slate-300 border-slate-600/40",
};
const RAT = [["PH", "ph"], ["DF", "df"], ["OF", "of"], ["PD", "pd"], ["EX", "ex"], ["LD", "ld"]] as const;
const ratColor = (v: number) => v >= 85 ? "text-emerald-400" : v >= 78 ? "text-green-400" : v >= 70 ? "text-blue-400" : v >= 62 ? "text-amber-400" : "text-slate-400";

export default function CoachManager({ teamId, slug, teamName, current, freeAgents, canManage, bank }:
  { teamId: number; slug: string; teamName: string; current: Coach | null; freeAgents: Coach[]; canManage: boolean; bank: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmFire, setConfirmFire] = useState(false);

  const payout = current ? coachBuyout(current.salary, current.contract) : 0;

  const fire = () => start(async () => {
    const r = await fireCoachAction(teamId, slug);
    setConfirmFire(false);
    setMsg(r.ok ? { ok: true, text: `Fired ${r.coachName} — ${money(r.payout)} paid out from the bank. He's back in the free-agent pool.` } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });
  const hire = (c: Coach) => start(async () => {
    const r = await hireCoachAction(teamId, c.id, slug);
    setMsg(r.ok ? { ok: true, text: `Hired ${r.coachName} — ${money(r.salary)} × ${r.years} yr${r.years === 1 ? "" : "s"}.` } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`rounded-lg border px-4 py-2.5 text-sm ${msg.ok ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-200" : "bg-rose-950/30 border-rose-800/40 text-rose-200"}`}>{msg.text}</div>
      )}

      {/* current coach */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Current Head Coach</h2>
          <span className="text-xs text-slate-500">Bank: <span className="font-semibold text-slate-300">{money(bank)}</span></span>
        </div>
        {current ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <div className="text-lg font-bold">{current.name}</div>
              <div className="text-xs text-slate-500">{current.country ?? "—"} · age {current.age ?? "—"}</div>
            </div>
            <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${STYLE_CLASS[current.style] ?? STYLE_CLASS.Balanced}`}>{current.style}</span>
            <div className="flex items-center gap-3 text-sm tabular-nums">
              {RAT.map(([label, key]) => <span key={key} className="text-slate-500">{label}<span className={`ml-1 font-semibold ${ratColor(current[key])}`}>{current[key]}</span></span>)}
              <span className="text-slate-500">OV<span className={`ml-1 font-bold ${ratColor(current.overall)}`}>{current.overall}</span></span>
            </div>
            <div className="text-sm text-slate-300 ml-auto">{money(current.salary)} × {current.contract} yr{current.contract === 1 ? "" : "s"}</div>
            {canManage && (
              confirmFire ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-amber-300">Fire {current.name}? Bank pays <b>{money(payout)}</b> (salary × years).</span>
                  <button onClick={fire} disabled={pending} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold disabled:opacity-50">Confirm</button>
                  <button onClick={() => setConfirmFire(false)} disabled={pending} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmFire(true)} disabled={pending} className="px-3 py-1.5 rounded-lg border border-rose-700/60 text-rose-300 text-sm font-semibold hover:bg-rose-950/40">Fire coach</button>
              )
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Bench is <span className="text-amber-300 font-semibold">vacant</span> — hire a coach below. Until then the team runs with a neutral bench.</p>
        )}
      </div>

      {/* free agents */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Available Coaches</h2>
          <span className="text-xs text-slate-500">{freeAgents.length} free agents · asking price by rating (max 4 yrs)</span>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800 bg-slate-800/30">
                <th className="text-left px-3 py-2.5 font-medium">Coach</th>
                <th className="text-left px-3 py-2.5 font-medium">Style</th>
                {RAT.map(([l]) => <th key={l} className="text-right px-2 py-2.5 font-medium">{l}</th>)}
                <th className="text-right px-2 py-2.5 font-medium">OV</th>
                <th className="text-right px-3 py-2.5 font-medium">Asking</th>
                {canManage && <th className="px-3 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {freeAgents.map((c) => {
                const d = coachDemand(c.overall);
                return (
                  <tr key={c.id} className="border-b border-slate-800/40 hover:bg-slate-800/30 last:border-0">
                    <td className="px-3 py-2"><span className="font-medium">{c.name}</span> <span className="text-slate-600 text-xs">{c.country ?? ""}</span></td>
                    <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${STYLE_CLASS[c.style] ?? STYLE_CLASS.Balanced}`}>{c.style}</span></td>
                    {RAT.map(([l, k]) => <td key={k} className={`px-2 py-2 text-right tabular-nums ${ratColor(c[k])}`}>{c[k]}</td>)}
                    <td className={`px-2 py-2 text-right tabular-nums font-bold ${ratColor(c.overall)}`}>{c.overall}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-300 whitespace-nowrap">{money(d.salary)} × {d.years}y</td>
                    {canManage && (
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => hire(c)} disabled={pending || current != null}
                          title={current != null ? "Fire the current coach first" : `Hire ${c.name}`}
                          className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Hire</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {canManage && current != null && <p className="text-xs text-slate-600 mt-2">To hire a new coach, fire the current one first — firing pays out his full remaining contract from the bank.</p>}
      </div>
    </div>
  );
}
