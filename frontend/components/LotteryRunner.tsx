"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runLotteryAction, practiceLotteryAction, type LotteryResultRow } from "@/app/admin/draft-lottery/actions";

export type OddsRow = { pos: number; code: string; logo: string | null; points: number; pct: number };
export type LotteryRow = { pick: number; code: string; name: string; logo: string | null; viaLottery: boolean };
type Row = { pick: number; name: string; logo: string | null; viaLottery: boolean };

export default function LotteryRunner({ year, odds, order, admin }: { year: number; odds: OddsRow[]; order: LotteryRow[]; admin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [practice, setPractice] = useState<LotteryResultRow[] | null>(null);
  const [reveal, setReveal] = useState(0); // 0 hidden · 1 = #2 shown · 2 = both shown

  const isPractice = practice != null;
  const shown: Row[] | null = practice ?? (order.length ? order : null);

  const doPractice = () => start(async () => { const r = await practiceLotteryAction(year); if (r.order) { setPractice(r.order); setReveal(0); } });
  const drawOfficial = () => start(async () => { await runLotteryAction(year); setPractice(null); setReveal(0); router.refresh(); });

  if (!shown) {
    return (
      <div className="space-y-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 text-sm font-semibold text-slate-200">Lottery odds · #1 pick</div>
          <table className="w-full text-sm">
            <tbody>
              {odds.map((o) => (
                <tr key={o.pos} className="border-b border-slate-800/50">
                  <td className="px-3 py-2 text-slate-500 tabular-nums w-10 text-right">{o.pos}</td>
                  <td className="px-2 py-2">{o.logo && <img src={o.logo} alt="" className="w-6 h-6 object-contain inline" />}</td>
                  <td className="px-2 py-2 font-medium text-slate-200">{o.code}</td>
                  <td className="px-2 py-2 text-slate-500 tabular-nums">{o.points} pts</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-300">{o.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={doPractice} disabled={pending} className="rounded-xl border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 text-amber-300 font-semibold px-5 py-2.5">
            {pending ? "Drawing…" : "🎲 Practice draw"}
          </button>
          {admin && (
            <button onClick={drawOfficial} disabled={pending} className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold px-6 py-2.5 text-lg">
              🎰 Draw the Lottery (official)
            </button>
          )}
        </div>
      </div>
    );
  }

  const winners = shown.filter((o) => o.viaLottery).sort((a, b) => a.pick - b.pick);
  const Slot = ({ o }: { o: Row }) => (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${o.viaLottery ? "border-amber-500/40 bg-amber-500/10" : "border-slate-800 bg-slate-900/40"}`}>
      <span className="w-8 text-center text-sm font-bold text-slate-500 tabular-nums">{o.pick}</span>
      {o.logo && <img src={o.logo} alt="" className="w-7 h-7 object-contain" />}
      <span className="font-medium text-slate-100">{o.name}</span>
      {o.viaLottery && <span className="ml-auto text-xs font-semibold text-amber-400">🎰 Lottery win</span>}
    </div>
  );

  return (
    <div className="space-y-5">
      {isPractice && <div className="inline-block text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5">Practice draw — not saved</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        {[winners[1], winners[0]].map((w, idx) => {
          const isFirst = w?.pick === 1;
          const on = isFirst ? reveal >= 2 : reveal >= 1;
          return (
            <div key={w?.pick ?? idx} className={`rounded-2xl border ${isFirst ? "border-amber-500/60" : "border-slate-700"} bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center`}>
              <div className="text-xs uppercase tracking-widest text-amber-400/90">{isFirst ? "1st overall pick" : "2nd overall pick"}</div>
              {on && w ? (
                <div className="mt-3 animate-[lotFade_0.4s_ease]">
                  <style>{`@keyframes lotFade{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}`}</style>
                  {w.logo && <img src={w.logo} alt="" className="w-20 h-20 object-contain mx-auto mb-2" />}
                  <div className="text-2xl font-black text-white">{w.name}</div>
                </div>
              ) : (
                <div className="mt-3 h-[104px] grid place-items-center text-5xl text-slate-700">?</div>
              )}
            </div>
          );
        })}
      </div>
      {reveal < 2 && (
        <button onClick={() => setReveal((r) => r + 1)} className="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5">
          {reveal === 0 ? "Reveal the 2nd pick" : "Reveal the 1st pick 🏆"}
        </button>
      )}

      {reveal >= 2 && (
        <div>
          <div className="text-sm text-slate-400 mb-2">Full round-1 order</div>
          <div className="grid gap-1.5 sm:grid-cols-2">{shown.map((o) => <Slot key={o.pick} o={o} />)}</div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 pt-1">
        <button onClick={doPractice} disabled={pending} className="text-xs text-amber-400 hover:text-amber-300 underline">{pending ? "…" : "🎲 Practice again"}</button>
        {admin && <button onClick={drawOfficial} disabled={pending} className="text-xs text-slate-400 hover:text-slate-200 underline">{pending ? "…" : "Draw official (saves this as round 1)"}</button>}
        {isPractice && <button onClick={() => { setPractice(null); setReveal(0); }} className="text-xs text-slate-500 hover:text-slate-300 underline">Back to odds</button>}
      </div>
    </div>
  );
}
