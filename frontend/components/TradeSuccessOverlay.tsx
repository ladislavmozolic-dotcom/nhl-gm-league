"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { latestTradeCelebrationAction } from "@/app/trades/build/actions";

type Celebration = { id: number; otherTeam: string; otherLogo: string | null; acquired: string[]; sent: string[] };
const KEY = "dismissedTradeCelebrations";

const dismissed = (): number[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const remember = (id: number) => { try { localStorage.setItem(KEY, JSON.stringify([...dismissed().slice(-40), id])); } catch { /* ignore */ } };

export default function TradeSuccessOverlay() {
  const [show, setShow] = useState<Celebration | null>(null);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const c = await latestTradeCelebrationAction();
        if (alive && c && !dismissed().includes(c.id)) setShow(c);
      } catch { /* ignore */ }
    };
    check();
    const iv = setInterval(check, 12000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  if (!show) return null;
  const close = () => { remember(show.id); setShow(null); router.refresh(); };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={close}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-[#0b1f17] to-[#0a1628] p-8 text-center shadow-2xl shadow-emerald-500/10">
        <div className="text-5xl mb-3">🤝</div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400 mb-1">Trade complete</div>
        <h2 className="text-2xl font-black text-white mb-5">Deal done with {show.otherTeam}</h2>
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3">
            <div className="text-[11px] uppercase tracking-wide text-emerald-300 font-bold mb-1">You acquired</div>
            <ul className="text-sm text-white space-y-0.5">{(show.acquired.length ? show.acquired : ["—"]).map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
          <div className="rounded-xl bg-slate-700/20 border border-slate-700 p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">You sent</div>
            <ul className="text-sm text-slate-300 space-y-0.5">{(show.sent.length ? show.sent : ["—"]).map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a href={`/trades/${show.id}`} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 text-sm font-semibold">View trade</a>
          <button onClick={close} className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">Great!</button>
        </div>
      </div>
    </div>
  );
}
