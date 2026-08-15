"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { ArenaSection } from "@/lib/finance";

type Props = {
  teamName: string; teamSlug: string; arena: string; sections: ArenaSection[];
  onSave: (slug: string, prices: number[]) => Promise<void>;
};

export default function FinanceEditor({ teamName, teamSlug, arena, sections, onSave }: Props) {
  const [prices, setPrices] = useState<number[]>(sections.map((s) => s.price));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const setPrice = (i: number, v: number) => {
    setPrices((prev) => prev.map((p, j) => (j === i ? v : p)));
    setSaved(false);
  };
  const totalCap = sections.reduce((t, s) => t + s.capacity, 0);
  const sellout = sections.reduce((t, s, i) => t + s.capacity * (prices[i] ?? s.price), 0);
  const save = () => start(async () => { await onSave(teamSlug, prices); setSaved(true); });

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">{teamName} — Finance</h1>
        <div className="flex gap-3 text-sm mt-1">
          <Link href={`/teams/${teamSlug}`} className="text-slate-400 hover:text-blue-400">← team</Link>
          <Link href={`/teams/${teamSlug}/roster/edit`} className="text-slate-400 hover:text-blue-400">Roster →</Link>
          <Link href={`/teams/${teamSlug}/lines`} className="text-slate-400 hover:text-blue-400">Lines →</Link>
        </div>
        <p className="text-sm text-slate-500 mt-1">{arena} · capacity {totalCap.toLocaleString()}</p>
      </div>

      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-800/40">
              <th className="text-left px-4 py-2.5">Section</th>
              <th className="text-right px-4 py-2.5">Arena Capacity</th>
              <th className="text-right px-4 py-2.5">Ticket Price</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s, i) => (
              <tr key={s.level} className="border-b border-slate-800/60">
                <td className="px-4 py-2.5 font-medium">{s.level}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{s.capacity.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className="text-slate-500 mr-1">$</span>
                  <input type="number" min={0} max={9999} value={prices[i]}
                    onChange={(e) => setPrice(i, Number(e.target.value))}
                    className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right tabular-nums" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-800 text-sm">
              <td className="px-4 py-2.5 font-semibold" colSpan={2}>Sellout revenue (per game)</td>
              <td className="px-4 py-2.5 text-right font-bold tabular-nums text-green-400">${sellout.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={pending}
          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold text-sm disabled:opacity-50">
          {pending ? "Saving…" : "Submit Ticket Price Change"}
        </button>
        {saved && <span className="text-green-400 text-sm">✓ Prices saved</span>}
      </div>
    </div>
  );
}
