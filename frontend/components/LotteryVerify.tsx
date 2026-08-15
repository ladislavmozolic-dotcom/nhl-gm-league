"use client";

import { useEffect, useState } from "react";
import { comboRank, TOTAL_COMBOS } from "@/lib/lottery-combos";

export type VerifyBlock = { pos: number; code: string; name: string; logo: string | null; pct: number; count: number; startRank: number; endRank: number };

/** Lets any GM check a four-ball combination against the published assignment:
 *  it computes the combination's canonical rank and shows which club owns it. */
export default function LotteryVerify({ blocks }: { blocks: VerifyBlock[] }) {
  const [vals, setVals] = useState<string[]>(["", "", "", ""]);
  // a fresh draw (practice or live) wipes any combination the GM was checking
  useEffect(() => {
    const clear = () => setVals(["", "", "", ""]);
    window.addEventListener("lottery:new-draw", clear);
    return () => window.removeEventListener("lottery:new-draw", clear);
  }, []);
  const nums = vals.map((v) => parseInt(v, 10)).filter((n) => Number.isFinite(n));
  const rank = nums.length === 4 ? comboRank(nums) : null;
  const owner = rank != null ? blocks.find((b) => rank >= b.startRank && rank <= b.endRank) ?? null : null;
  const redraw = rank === TOTAL_COMBOS; // the single unassigned combination
  const dup = new Set(nums).size !== nums.length;
  const bad = nums.length === 4 && (dup || rank == null);

  const setAt = (i: number, v: string) => setVals((p) => p.map((x, j) => (j === i ? v.replace(/[^0-9]/g, "").slice(0, 2) : x)));

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
        <span className="text-lg">🔎</span>
        <span className="text-sm font-semibold text-slate-100">Verify a combination</span>
        <span className="text-xs text-slate-500 ml-auto">1000 combinations assigned · {TOTAL_COMBOS}th is the redraw</span>
      </div>

      {/* interactive checker */}
      <div className="px-5 py-4 border-b border-slate-800/70">
        <div className="text-sm text-slate-400 mb-3">Enter any four balls (1–14) to see which club owns that combination.</div>
        <div className="flex flex-wrap items-center gap-2">
          {vals.map((v, i) => (
            <input key={i} inputMode="numeric" value={v} onChange={(e) => setAt(i, e.target.value)} placeholder="?"
              className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 text-center text-lg font-bold text-white focus:border-amber-500 focus:outline-none" />
          ))}
          <div className="ml-2 text-sm">
            {nums.length < 4 && <span className="text-slate-500">Pick four numbers…</span>}
            {bad && <span className="text-rose-400 font-medium">{dup ? "Balls must be distinct." : "Numbers must be 1–14."}</span>}
            {!bad && rank != null && (
              redraw ? (
                <span className="text-slate-300">Combination <b>#{rank}</b> — the <b>redraw</b> (belongs to no club).</span>
              ) : owner ? (
                <span className="inline-flex items-center gap-2 text-slate-200">
                  Combination <b className="text-amber-300">#{rank}</b> →
                  {owner.logo && <img src={owner.logo} alt="" className="w-5 h-5 object-contain" />}
                  <b>{owner.name}</b>
                </span>
              ) : null
            )}
          </div>
        </div>
      </div>

      {/* published assignment */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <th className="px-3 py-2 text-right w-10">#</th>
              <th className="px-2 py-2">Club</th>
              <th className="px-3 py-2 text-right">Odds</th>
              <th className="px-3 py-2 text-right">Combos</th>
              <th className="px-3 py-2 text-right">Ranks</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.pos} className="border-b border-slate-800/50">
                <td className="px-3 py-1.5 text-slate-500 tabular-nums text-right">{b.pos}</td>
                <td className="px-2 py-1.5">
                  <span className="inline-flex items-center gap-2">
                    {b.logo && <img src={b.logo} alt="" className="w-5 h-5 object-contain" />}
                    <span className="font-medium text-slate-200">{b.code}</span>
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-amber-300 font-semibold">{b.pct}%</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-300">{b.count}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{b.startRank}–{b.endRank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
