"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFaEarlyAccessAction } from "@/app/free-agents/actions";

/** Commissioner-only control: give comish-tier a manual head start on the UFA market
 *  while it's still closed to ordinary GMs — for leagues that pin the phase by hand
 *  (Season Control) rather than following the real calendar, where the automatic
 *  "market opens tomorrow" preview has no date-driven tomorrow to look ahead to. */
export default function FaEarlyAccessToggle({ on, comish, marketOpen }: { on: boolean; comish: boolean; marketOpen: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggle = () => start(async () => { await setFaEarlyAccessAction(!on); router.refresh(); });

  if (!comish || marketOpen) return null; // only relevant while the market is otherwise closed

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${on ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-700 bg-slate-800/30"}`}>
      <span className={on ? "text-emerald-200" : "text-slate-400"}>
        {on ? "🚀 Predstih pre komisára/co-komisára je AKTÍVNY — vy môžete podávať ponuky, ostatní GM ešte nie." : "Trh je zatvorený pre všetkých vrátane vás."}
        <span className="text-slate-500 ml-1.5 text-xs">(túto lištu vidí len komisár)</span>
      </span>
      <button onClick={toggle} disabled={pending}
        className={`shrink-0 px-3.5 py-1.5 rounded-lg font-semibold text-white text-sm disabled:opacity-50 ${on ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"}`}>
        {pending ? "…" : on ? "Vypnúť predstih" : "🚀 Zapnúť predstih (dnes)"}
      </button>
    </div>
  );
}
